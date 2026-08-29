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

  it("submits an explicit Supplier refresh intent with distinct success feedback", async () => {
    const form = validForm("contract-1");
    form.set("paymentTerms", "当前完整表单内容");
    form.set("intent", "refreshSupplierSnapshot");
    const update = vi.fn().mockResolvedValue({ id: "contract-1", status: "DRAFT" });

    const result = await executePurchaseContractSave(
      INITIAL_PURCHASE_CONTRACT_FORM_STATE,
      form,
      {
        getSession: vi.fn().mockResolvedValue(adminSession),
        create: vi.fn(),
        update,
      },
    );

    expect(result).toEqual({
      status: "success",
      message: "供应商资料已更新，并已保存当前草稿。",
      contractId: "contract-1",
    });
    expect(update).toHaveBeenCalledWith(
      "contract-1",
      expect.objectContaining({ paymentTerms: "当前完整表单内容" }),
      { refreshSellerSnapshot: true },
    );
  });

  it.each([null, { user: { role: "user" } }])(
    "rejects unauthorized explicit Supplier refresh mutations",
    async (session) => {
      const form = validForm("contract-1");
      form.set("intent", "refreshSupplierSnapshot");
      const update = vi.fn();

      const result = await executePurchaseContractSave(
        INITIAL_PURCHASE_CONTRACT_FORM_STATE,
        form,
        { getSession: vi.fn().mockResolvedValue(session), create: vi.fn(), update },
      );

      expect(result.status).toBe("error");
      expect(update).not.toHaveBeenCalled();
    },
  );

  it("rejects a refresh intent without an existing contract", async () => {
    const form = validForm();
    form.set("intent", "refreshSupplierSnapshot");
    const create = vi.fn();

    const result = await executePurchaseContractSave(
      INITIAL_PURCHASE_CONTRACT_FORM_STATE,
      form,
      { getSession: vi.fn().mockResolvedValue(adminSession), create, update: vi.fn() },
    );

    expect(result).toMatchObject({
      status: "error",
      message: "请检查并修正标记的字段。",
    });
    expect(create).not.toHaveBeenCalled();
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
  it("blocks a user from finalizing, reopening, or cancelling server-side", async () => {
    const finalize = vi.fn();
    const reopen = vi.fn();
    const cancel = vi.fn();
    for (const operation of ["finalize", "reopen", "cancel"] as const) {
      const result = await executePurchaseContractStatusChange(
        "contract-1",
        operation,
        {
          getSession: vi.fn().mockResolvedValue({ user: { role: "user" } }),
          finalize,
          reopen,
          cancel,
        },
      );
      expect(result.message).toBe(PURCHASE_CONTRACT_FORBIDDEN_MESSAGE);
    }
    expect(finalize).not.toHaveBeenCalled();
    expect(reopen).not.toHaveBeenCalled();
    expect(cancel).not.toHaveBeenCalled();
  });

  it("blocks an unauthenticated reopen server-side", async () => {
    const reopen = vi.fn();
    const result = await executePurchaseContractStatusChange(
      "contract-1",
      "reopen",
      {
        getSession: vi.fn().mockResolvedValue(null),
        finalize: vi.fn(),
        reopen,
        cancel: vi.fn(),
      },
    );

    expect(result).toEqual({
      status: "error",
      message: PURCHASE_CONTRACT_SIGN_IN_MESSAGE,
    });
    expect(reopen).not.toHaveBeenCalled();
  });

  it("allows an admin to finalize, reopen, and cancel with Chinese feedback", async () => {
    const dependencies = {
      getSession: vi.fn().mockResolvedValue(adminSession),
      finalize: vi.fn().mockResolvedValue({}),
      reopen: vi.fn().mockResolvedValue({}),
      cancel: vi.fn().mockResolvedValue({}),
    };
    await expect(
      executePurchaseContractStatusChange("contract-1", "finalize", dependencies),
    ).resolves.toMatchObject({ status: "success", message: "采购合同已定稿。" });
    await expect(
      executePurchaseContractStatusChange("contract-1", "reopen", dependencies),
    ).resolves.toMatchObject({
      status: "success",
      message: "采购合同已重新打开为草稿。",
    });
    await expect(
      executePurchaseContractStatusChange("contract-1", "cancel", dependencies),
    ).resolves.toMatchObject({ status: "success", message: "采购合同已取消。" });
  });

  it("maps an immutable reopen to a safe Chinese error", async () => {
    const result = await executePurchaseContractStatusChange(
      "contract-1",
      "reopen",
      {
        getSession: vi.fn().mockResolvedValue(adminSession),
        finalize: vi.fn(),
        reopen: vi.fn().mockRejectedValue(new PurchaseContractImmutableError()),
        cancel: vi.fn(),
      },
    );

    expect(result).toEqual({
      status: "error",
      message: PURCHASE_CONTRACT_IMMUTABLE_MESSAGE,
    });
  });
});
