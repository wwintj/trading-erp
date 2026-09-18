import { describe, expect, it, vi } from "vitest";

import {
  CUSTOMER_DUPLICATE_CODE_MESSAGE,
  CUSTOMER_FORBIDDEN_MESSAGE,
  CUSTOMER_GENERIC_ERROR_MESSAGE,
  CUSTOMER_SIGN_IN_MESSAGE,
  INITIAL_CUSTOMER_FORM_STATE,
} from "@/lib/customer";
import { executeCustomerSave } from "@/lib/customer-action.server";

function customerForm(overrides: Record<string, string> = {}) {
  const formData = new FormData();
  formData.set("code", "  CUST001  ");
  formData.set("legalName", "  测试客户有限公司  ");
  formData.set("shortName", "  测试客户  ");
  formData.set("unifiedCreditCode", "   ");
  formData.set("contactName", "  王经理  ");
  formData.set("phone", "   ");
  formData.set("email", " sales@example.com ");
  formData.set("address", "   ");
  formData.set("defaultDeliveryContactName", "  张建英  ");
  formData.set("defaultDeliveryPhone", " 13800000000 ");
  formData.set("defaultDeliveryAddress", "  浙江仓库  ");
  formData.set("notes", "   ");

  for (const [field, value] of Object.entries(overrides)) {
    formData.set(field, value);
  }

  return formData;
}

const adminSession = { user: { role: "admin" } };

describe("Customer save action", () => {
  it("rejects an unauthenticated mutation", async () => {
    const create = vi.fn();
    const update = vi.fn();

    const result = await executeCustomerSave(
      INITIAL_CUSTOMER_FORM_STATE,
      customerForm(),
      {
        getSession: vi.fn().mockResolvedValue(null),
        create,
        update,
      },
    );

    expect(result).toEqual({
      status: "error",
      message: CUSTOMER_SIGN_IN_MESSAGE,
    });
    expect(create).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it.each([
    ["create", {}],
    ["update", { customerId: "customer-1" }],
  ])("rejects a user role attempting to %s", async (_operation, overrides) => {
    const create = vi.fn();
    const update = vi.fn();

    const result = await executeCustomerSave(
      INITIAL_CUSTOMER_FORM_STATE,
      customerForm(overrides),
      {
        getSession: vi.fn().mockResolvedValue({ user: { role: "user" } }),
        create,
        update,
      },
    );

    expect(result).toEqual({
      status: "error",
      message: CUSTOMER_FORBIDDEN_MESSAGE,
    });
    expect(create).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("allows an admin to create a normalized Customer", async () => {
    const create = vi.fn().mockResolvedValue({ id: "customer-1" });

    const result = await executeCustomerSave(
      INITIAL_CUSTOMER_FORM_STATE,
      customerForm(),
      {
        getSession: vi.fn().mockResolvedValue(adminSession),
        create,
        update: vi.fn(),
      },
    );

    expect(result).toEqual({
      status: "success",
      message: "客户创建成功。",
      customerId: "customer-1",
    });
    expect(create).toHaveBeenCalledWith({
      code: "CUST001",
      legalName: "测试客户有限公司",
      shortName: "测试客户",
      unifiedCreditCode: null,
      contactName: "王经理",
      phone: null,
      email: "sales@example.com",
      address: null,
      defaultDeliveryContactName: "张建英",
      defaultDeliveryPhone: "13800000000",
      defaultDeliveryAddress: "浙江仓库",
      notes: null,
    });
  });

  it("allows an admin to update a Customer", async () => {
    const update = vi.fn().mockResolvedValue({ id: "customer-1" });

    const result = await executeCustomerSave(
      INITIAL_CUSTOMER_FORM_STATE,
      customerForm({ customerId: " customer-1 " }),
      {
        getSession: vi.fn().mockResolvedValue(adminSession),
        create: vi.fn(),
        update,
      },
    );

    expect(result).toEqual({
      status: "success",
      message: "客户保存成功。",
      customerId: "customer-1",
    });
    expect(update).toHaveBeenCalledWith(
      "customer-1",
      expect.objectContaining({ code: "CUST001" }),
    );
  });

  it("returns field errors without writing invalid input", async () => {
    const create = vi.fn();

    const result = await executeCustomerSave(
      INITIAL_CUSTOMER_FORM_STATE,
      customerForm({ code: "", legalName: "", email: "invalid" }),
      {
        getSession: vi.fn().mockResolvedValue(adminSession),
        create,
        update: vi.fn(),
      },
    );

    expect(result).toMatchObject({
      status: "error",
      message: "请检查并修正标记的字段。",
      fieldErrors: {
        code: "请输入客户代码。",
        legalName: "请输入公司全称。",
        email: "请输入有效的邮箱地址。",
      },
    });
    expect(create).not.toHaveBeenCalled();
  });

  it("maps duplicate code to a safe application error", async () => {
    const result = await executeCustomerSave(
      INITIAL_CUSTOMER_FORM_STATE,
      customerForm(),
      {
        getSession: vi.fn().mockResolvedValue(adminSession),
        create: vi.fn().mockRejectedValue({
          code: "P2002",
          meta: { target: "customer_code_key" },
        }),
        update: vi.fn(),
      },
    );

    expect(result).toEqual({
      status: "error",
      message: CUSTOMER_DUPLICATE_CODE_MESSAGE,
    });
    expect(result.message).not.toContain("P2002");
    expect(result.message).not.toContain("customer_code_key");
  });

  it("maps unknown failures to a safe generic message", async () => {
    const result = await executeCustomerSave(
      INITIAL_CUSTOMER_FORM_STATE,
      customerForm(),
      {
        getSession: vi.fn().mockResolvedValue(adminSession),
        create: vi.fn().mockRejectedValue(new Error("MySQL connection details")),
        update: vi.fn(),
      },
    );

    expect(result).toEqual({
      status: "error",
      message: CUSTOMER_GENERIC_ERROR_MESSAGE,
    });
    expect(result.message).not.toContain("MySQL");
  });
});
