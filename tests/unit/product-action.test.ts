import { describe, expect, it, vi } from "vitest";

import {
  INITIAL_PRODUCT_FORM_STATE,
  PRODUCT_DUPLICATE_CODE_MESSAGE,
  PRODUCT_FORBIDDEN_MESSAGE,
  PRODUCT_GENERIC_ERROR_MESSAGE,
  PRODUCT_SIGN_IN_MESSAGE,
} from "@/lib/product";
import { executeProductSave } from "@/lib/product-action.server";

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

const adminSession = { user: { role: "admin" } };

describe("Product save action", () => {
  it("rejects unauthenticated mutations server-side", async () => {
    const create = vi.fn();
    const update = vi.fn();

    const result = await executeProductSave(
      INITIAL_PRODUCT_FORM_STATE,
      productForm(),
      {
        getSession: vi.fn().mockResolvedValue(null),
        create,
        update,
      },
    );

    expect(result).toEqual({ status: "error", message: PRODUCT_SIGN_IN_MESSAGE });
    expect(create).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("prevents a user role from mutating Product server-side", async () => {
    const create = vi.fn();
    const update = vi.fn();

    const result = await executeProductSave(
      INITIAL_PRODUCT_FORM_STATE,
      productForm(),
      {
        getSession: vi.fn().mockResolvedValue({ user: { role: "user" } }),
        create,
        update,
      },
    );

    expect(result).toEqual({ status: "error", message: PRODUCT_FORBIDDEN_MESSAGE });
    expect(create).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("allows an admin to create Product with normalized values", async () => {
    const create = vi.fn().mockResolvedValue({ id: "product-1" });

    const result = await executeProductSave(
      INITIAL_PRODUCT_FORM_STATE,
      productForm(),
      {
        getSession: vi.fn().mockResolvedValue(adminSession),
        create,
        update: vi.fn(),
      },
    );

    expect(result).toEqual({
      status: "success",
      message: "产品创建成功。",
      productId: "product-1",
    });
    expect(create).toHaveBeenCalledWith({
      code: "WS-H42",
      name: "PVC热收缩套管",
      specification: null,
      unit: "米",
      notes: null,
    });
  });

  it("allows an admin to update Product and preserves submitted code", async () => {
    const update = vi.fn().mockResolvedValue({ id: "product-1" });

    const result = await executeProductSave(
      INITIAL_PRODUCT_FORM_STATE,
      productForm({ productId: "product-1" }),
      {
        getSession: vi.fn().mockResolvedValue(adminSession),
        create: vi.fn(),
        update,
      },
    );

    expect(result).toEqual({
      status: "success",
      message: "产品保存成功。",
      productId: "product-1",
    });
    expect(update).toHaveBeenCalledWith(
      "product-1",
      expect.objectContaining({ code: "WS-H42" }),
    );
  });

  it("returns Chinese field errors without writing invalid input", async () => {
    const create = vi.fn();

    const result = await executeProductSave(
      INITIAL_PRODUCT_FORM_STATE,
      productForm({ code: "", name: "", unit: "" }),
      {
        getSession: vi.fn().mockResolvedValue(adminSession),
        create,
        update: vi.fn(),
      },
    );

    expect(result).toEqual({
      status: "error",
      message: "请检查并修正标记的字段。",
      fieldErrors: {
        code: "请输入产品代码。",
        name: "请输入产品名称。",
        unit: "请输入单位。",
      },
    });
    expect(create).not.toHaveBeenCalled();
  });

  it("maps duplicate code to a safe Chinese application error", async () => {
    const result = await executeProductSave(
      INITIAL_PRODUCT_FORM_STATE,
      productForm(),
      {
        getSession: vi.fn().mockResolvedValue(adminSession),
        create: vi.fn().mockRejectedValue({
          code: "P2002",
          meta: { target: "product_code_key" },
        }),
        update: vi.fn(),
      },
    );

    expect(result).toEqual({
      status: "error",
      message: PRODUCT_DUPLICATE_CODE_MESSAGE,
    });
    expect(result.message).not.toContain("P2002");
    expect(result.message).not.toContain("product_code_key");
  });

  it("maps database failures to a safe Chinese generic error", async () => {
    const result = await executeProductSave(
      INITIAL_PRODUCT_FORM_STATE,
      productForm(),
      {
        getSession: vi.fn().mockResolvedValue(adminSession),
        create: vi.fn().mockRejectedValue(new Error("MySQL connection details")),
        update: vi.fn(),
      },
    );

    expect(result).toEqual({
      status: "error",
      message: PRODUCT_GENERIC_ERROR_MESSAGE,
    });
    expect(result.message).not.toContain("MySQL");
  });
});
