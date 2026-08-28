import { describe, expect, it, vi } from "vitest";

import {
  INITIAL_SUPPLIER_FORM_STATE,
  SUPPLIER_DUPLICATE_CODE_MESSAGE,
  SUPPLIER_FORBIDDEN_MESSAGE,
  SUPPLIER_GENERIC_ERROR_MESSAGE,
} from "@/lib/supplier";
import { executeSupplierSave } from "@/lib/supplier-action.server";

function supplierForm(overrides: Record<string, string> = {}) {
  const formData = new FormData();
  formData.set("code", "  HYS  ");
  formData.set("legalName", "  惠州市华业升塑胶制品有限公司  ");
  formData.set("shortName", "   ");
  formData.set("unifiedCreditCode", "  1234567890  ");
  formData.set("contactName", "   ");
  formData.set("phone", "   ");
  formData.set("email", "   ");
  formData.set("address", "   ");
  formData.set("bankName", "   ");
  formData.set("bankAccount", "   ");
  formData.set("notes", "   ");

  for (const [field, value] of Object.entries(overrides)) {
    formData.set(field, value);
  }

  return formData;
}

const adminSession = { user: { role: "admin" } };

describe("Supplier save action", () => {
  it("prevents a user role from mutating Supplier server-side", async () => {
    const create = vi.fn();
    const update = vi.fn();

    const result = await executeSupplierSave(
      INITIAL_SUPPLIER_FORM_STATE,
      supplierForm(),
      {
        getSession: vi.fn().mockResolvedValue({ user: { role: "user" } }),
        create,
        update,
      },
    );

    expect(result).toEqual({ status: "error", message: SUPPLIER_FORBIDDEN_MESSAGE });
    expect(create).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("allows an admin to create Supplier with normalized values", async () => {
    const create = vi.fn().mockResolvedValue({ id: "supplier-1" });

    const result = await executeSupplierSave(
      INITIAL_SUPPLIER_FORM_STATE,
      supplierForm(),
      {
        getSession: vi.fn().mockResolvedValue(adminSession),
        create,
        update: vi.fn(),
      },
    );

    expect(result).toEqual({
      status: "success",
      message: "供应商创建成功。",
      supplierId: "supplier-1",
    });
    expect(create).toHaveBeenCalledWith({
      code: "HYS",
      legalName: "惠州市华业升塑胶制品有限公司",
      shortName: null,
      unifiedCreditCode: "1234567890",
      contactName: null,
      phone: null,
      email: null,
      address: null,
      bankName: null,
      bankAccount: null,
      notes: null,
    });
  });

  it("allows an admin to update Supplier and preserves submitted code", async () => {
    const update = vi.fn().mockResolvedValue({ id: "supplier-1" });

    const result = await executeSupplierSave(
      INITIAL_SUPPLIER_FORM_STATE,
      supplierForm({ supplierId: "supplier-1" }),
      {
        getSession: vi.fn().mockResolvedValue(adminSession),
        create: vi.fn(),
        update,
      },
    );

    expect(result).toEqual({
      status: "success",
      message: "供应商保存成功。",
      supplierId: "supplier-1",
    });
    expect(update).toHaveBeenCalledWith(
      "supplier-1",
      expect.objectContaining({ code: "HYS" }),
    );
  });

  it("returns field errors without writing invalid input", async () => {
    const create = vi.fn();

    const result = await executeSupplierSave(
      INITIAL_SUPPLIER_FORM_STATE,
      supplierForm({ code: "", legalName: "", email: "invalid" }),
      {
        getSession: vi.fn().mockResolvedValue(adminSession),
        create,
        update: vi.fn(),
      },
    );

    expect(result).toMatchObject({
      status: "error",
      fieldErrors: {
        code: "请输入供应商代码。",
        legalName: "请输入公司全称。",
        email: "请输入有效的邮箱地址。",
      },
    });
    expect(create).not.toHaveBeenCalled();
  });

  it("maps duplicate code to a safe application error", async () => {
    const result = await executeSupplierSave(
      INITIAL_SUPPLIER_FORM_STATE,
      supplierForm(),
      {
        getSession: vi.fn().mockResolvedValue(adminSession),
        create: vi.fn().mockRejectedValue({
          code: "P2002",
          meta: { target: "supplier_code_key" },
        }),
        update: vi.fn(),
      },
    );

    expect(result).toEqual({
      status: "error",
      message: SUPPLIER_DUPLICATE_CODE_MESSAGE,
    });
    expect(result.message).not.toContain("P2002");
    expect(result.message).not.toContain("supplier_code_key");
  });

  it("maps database failures to a safe generic error", async () => {
    const result = await executeSupplierSave(
      INITIAL_SUPPLIER_FORM_STATE,
      supplierForm(),
      {
        getSession: vi.fn().mockResolvedValue(adminSession),
        create: vi.fn().mockRejectedValue(new Error("MySQL connection details")),
        update: vi.fn(),
      },
    );

    expect(result).toEqual({
      status: "error",
      message: SUPPLIER_GENERIC_ERROR_MESSAGE,
    });
    expect(result.message).not.toContain("MySQL");
  });
});
