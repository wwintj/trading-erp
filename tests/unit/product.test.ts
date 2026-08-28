import { describe, expect, it } from "vitest";

import {
  isProductUniqueConstraintError,
  validateProductForm,
} from "@/lib/product";

function productForm(overrides: Record<string, string> = {}) {
  const formData = new FormData();
  formData.set("code", "  WS-H42  ");
  formData.set("name", "  PVC热收缩套管  ");
  formData.set("specification", "   ");
  formData.set("unit", "  米  ");
  formData.set("notes", "   ");

  for (const [field, value] of Object.entries(overrides)) {
    formData.set(field, value);
  }

  return formData;
}

describe("Product validation", () => {
  it("requires trimmed code, name, and unit", () => {
    const result = validateProductForm(
      productForm({ code: "   ", name: "   ", unit: "   " }),
    );

    expect(result).toEqual({
      ok: false,
      fieldErrors: {
        code: "请输入产品代码。",
        name: "请输入产品名称。",
        unit: "请输入单位。",
      },
    });
  });

  it("trims required values and normalizes optional blanks to null", () => {
    const result = validateProductForm(productForm());

    expect(result).toEqual({
      ok: true,
      input: {
        code: "WS-H42",
        name: "PVC热收缩套管",
        specification: null,
        unit: "米",
        notes: null,
      },
    });
  });

  it("validates every field length", () => {
    const result = validateProductForm(
      productForm({
        code: "C".repeat(65),
        name: "N".repeat(256),
        specification: "S".repeat(256),
        unit: "U".repeat(33),
        notes: "X".repeat(4001),
      }),
    );

    expect(result).toEqual({
      ok: false,
      fieldErrors: {
        code: "不能超过 64 个字符。",
        name: "不能超过 255 个字符。",
        specification: "不能超过 255 个字符。",
        unit: "不能超过 32 个字符。",
        notes: "不能超过 4000 个字符。",
      },
    });
  });

  it("recognizes Prisma unique constraint failures without exposing details", () => {
    expect(
      isProductUniqueConstraintError({
        code: "P2002",
        meta: { target: "product_code_key" },
      }),
    ).toBe(true);
    expect(isProductUniqueConstraintError(new Error("duplicate"))).toBe(false);
  });
});
