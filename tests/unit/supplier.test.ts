import { describe, expect, it } from "vitest";

import {
  isSupplierUniqueConstraintError,
  validateSupplierForm,
} from "@/lib/supplier";

function supplierForm(overrides: Record<string, string> = {}) {
  const formData = new FormData();
  formData.set("code", "  HYS  ");
  formData.set("legalName", "  惠州市华业升塑胶制品有限公司  ");
  formData.set("shortName", "   ");
  formData.set("unifiedCreditCode", "   ");
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

describe("Supplier validation", () => {
  it("requires trimmed code and legal name", () => {
    const result = validateSupplierForm(
      supplierForm({ code: "   ", legalName: "   " }),
    );

    expect(result).toEqual({
      ok: false,
      fieldErrors: {
        code: "Supplier code is required.",
        legalName: "Legal name is required.",
      },
    });
  });

  it("trims required values and normalizes optional blanks to null", () => {
    const result = validateSupplierForm(supplierForm());

    expect(result).toEqual({
      ok: true,
      input: {
        code: "HYS",
        legalName: "惠州市华业升塑胶制品有限公司",
        shortName: null,
        unifiedCreditCode: null,
        contactName: null,
        phone: null,
        email: null,
        address: null,
        bankName: null,
        bankAccount: null,
        notes: null,
      },
    });
  });

  it("rejects an invalid optional email", () => {
    const result = validateSupplierForm(
      supplierForm({ email: "not-an-email" }),
    );

    expect(result).toEqual({
      ok: false,
      fieldErrors: { email: "Enter a valid email address." },
    });
  });

  it("recognizes Prisma unique constraint failures without exposing details", () => {
    expect(
      isSupplierUniqueConstraintError({
        code: "P2002",
        meta: { target: "supplier_code_key" },
      }),
    ).toBe(true);
    expect(isSupplierUniqueConstraintError(new Error("duplicate"))).toBe(false);
  });
});
