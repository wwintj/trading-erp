import { describe, expect, it, vi } from "vitest";

import {
  INITIAL_PURCHASE_CONTRACT_FORM_STATE,
  PURCHASE_CONTRACT_DUPLICATE_NO_MESSAGE,
  PURCHASE_CONTRACT_FORBIDDEN_MESSAGE,
  PURCHASE_CONTRACT_GENERIC_ERROR_MESSAGE,
  PURCHASE_CONTRACT_IMMUTABLE_MESSAGE,
  PURCHASE_CONTRACT_SIGN_IN_MESSAGE,
} from "@/lib/purchase-contract";
import {
  executePurchaseContractSave,
  executePurchaseContractStatusChange,
} from "@/lib/purchase-contract-action.server";
import { PurchaseContractImmutableError } from "@/lib/purchase-contract.server";

function validForm(contractId?: string) {
  const form = new FormData();
  form.set("contractNo", "PUR26WS0826");
  form.set("signingDate", "2026-08-28");
  form.set("companyId", "company-1");
  form.set("supplierId", "supplier-1");
  form.set(
    "itemsJson",
    JSON.stringify([{ productId: "product-1", quantity: "6400", unitPrice: "0.900" }]),
  );
  if (contractId) form.set("contractId", contractId);
  return form;
}

const adminSession = { user: { role: "admin" } };

describe("Purchase Contract save action", () => {
  it.each([
    [null, PURCHASE_CONTRACT_SIGN_IN_MESSAGE],
    [{ user: { role: "user" } }, PURCHASE_CONTRACT_FORBIDDEN_MESSAGE],
  ])("rejects unauthorized save mutations", async (session, message) => {
    const create = vi.fn();
    const update = vi.fn();
    const result = await executePurchaseContractSave(
      INITIAL_PURCHASE_CONTRACT_FORM_STATE,
      validForm(),
      { getSession: vi.fn().mockResolvedValue(session), create, update },
    );

    expect(result).toEqual({ status: "error", message });
    expect(create).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("allows an admin to create a Draft contract", async () => {
    const create = vi.fn().mockResolvedValue({ id: "contract-1", status: "DRAFT" });
    const result = await executePurchaseContractSave(
      INITIAL_PURCHASE_CONTRACT_FORM_STATE,
      validForm(),
      { getSession: vi.fn().mockResolvedValue(adminSession), create, update: vi.fn() },
    );

    expect(result).toEqual({
      status: "success",
      message: "采购合同创建成功。",
      contractId: "contract-1",
    });
    expect(create).toHaveBeenCalledOnce();
  });

  it("allows an admin to update a Draft contract", async () => {
    const update = vi.fn().mockResolvedValue({ id: "contract-1", status: "DRAFT" });
    const result = await executePurchaseContractSave(
      INITIAL_PURCHASE_CONTRACT_FORM_STATE,
      validForm("contract-1"),
      { getSession: vi.fn().mockResolvedValue(adminSession), create: vi.fn(), update },
    );

    expect(result.message).toBe("采购合同保存成功。");
    expect(update).toHaveBeenCalledWith("contract-1", expect.any(Object));
  });

  it("maps duplicate, immutable, and internal errors safely", async () => {
    const base = { getSession: vi.fn().mockResolvedValue(adminSession), update: vi.fn() };
    const duplicate = await executePurchaseContractSave(
      INITIAL_PURCHASE_CONTRACT_FORM_STATE,
      validForm(),
      { ...base, create: vi.fn().mockRejectedValue({ code: "P2002", meta: { target: "index" } }) },
    );
    const immutable = await executePurchaseContractSave(
      INITIAL_PURCHASE_CONTRACT_FORM_STATE,
      validForm(),
      { ...base, create: vi.fn().mockRejectedValue(new PurchaseContractImmutableError()) },
    );
    const generic = await executePurchaseContractSave(
      INITIAL_PURCHASE_CONTRACT_FORM_STATE,
      validForm(),
      { ...base, create: vi.fn().mockRejectedValue(new Error("MySQL internal")) },
    );

    expect(duplicate.message).toBe(PURCHASE_CONTRACT_DUPLICATE_NO_MESSAGE);
    expect(duplicate.message).not.toContain("P2002");
    expect(immutable.message).toBe(PURCHASE_CONTRACT_IMMUTABLE_MESSAGE);
    expect(generic.message).toBe(PURCHASE_CONTRACT_GENERIC_ERROR_MESSAGE);
    expect(generic.message).not.toContain("MySQL");
  });
});

describe("Purchase Contract status actions", () => {
  it("blocks a user from finalizing or cancelling server-side", async () => {
    const finalize = vi.fn();
    const cancel = vi.fn();
    for (const operation of ["finalize", "cancel"] as const) {
      const result = await executePurchaseContractStatusChange(
        "contract-1",
        operation,
        {
          getSession: vi.fn().mockResolvedValue({ user: { role: "user" } }),
          finalize,
          cancel,
        },
      );
      expect(result.message).toBe(PURCHASE_CONTRACT_FORBIDDEN_MESSAGE);
    }
    expect(finalize).not.toHaveBeenCalled();
    expect(cancel).not.toHaveBeenCalled();
  });

  it("allows an admin to finalize and cancel with Chinese feedback", async () => {
    const dependencies = {
      getSession: vi.fn().mockResolvedValue(adminSession),
      finalize: vi.fn().mockResolvedValue({}),
      cancel: vi.fn().mockResolvedValue({}),
    };
    await expect(
      executePurchaseContractStatusChange("contract-1", "finalize", dependencies),
    ).resolves.toMatchObject({ status: "success", message: "采购合同已定稿。" });
    await expect(
      executePurchaseContractStatusChange("contract-1", "cancel", dependencies),
    ).resolves.toMatchObject({ status: "success", message: "采购合同已取消。" });
  });

  it("maps immutable status transitions to a safe Chinese error", async () => {
    const result = await executePurchaseContractStatusChange(
      "contract-1",
      "finalize",
      {
        getSession: vi.fn().mockResolvedValue(adminSession),
        finalize: vi.fn().mockRejectedValue(new PurchaseContractImmutableError()),
        cancel: vi.fn(),
      },
    );

    expect(result).toEqual({
      status: "error",
      message: PURCHASE_CONTRACT_IMMUTABLE_MESSAGE,
    });
  });
});
