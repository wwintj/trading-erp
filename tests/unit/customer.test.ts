import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  CUSTOMER_FIELD_LIMITS,
  isCustomerUniqueConstraintError,
  validateCustomerForm,
} from "@/lib/customer";

function customerForm(overrides: Record<string, string> = {}) {
  const formData = new FormData();
  formData.set("code", "  CUST001  ");
  formData.set("legalName", "  测试客户有限公司  ");
  formData.set("shortName", "   ");
  formData.set("unifiedCreditCode", "   ");
  formData.set("contactName", "   ");
  formData.set("phone", "   ");
  formData.set("email", "   ");
  formData.set("address", "   ");
  formData.set("defaultDeliveryContactName", "   ");
  formData.set("defaultDeliveryPhone", "   ");
  formData.set("defaultDeliveryAddress", "   ");
  formData.set("notes", "   ");

  for (const [field, value] of Object.entries(overrides)) {
    formData.set(field, value);
  }

  return formData;
}

describe("Customer validation", () => {
  it("requires trimmed code and legal name", () => {
    expect(
      validateCustomerForm(
        customerForm({ code: "   ", legalName: "   " }),
      ),
    ).toEqual({
      ok: false,
      fieldErrors: {
        code: "请输入客户代码。",
        legalName: "请输入公司全称。",
      },
    });
  });

  it("trims values without changing code case and normalizes optional blanks", () => {
    expect(validateCustomerForm(customerForm({ code: "  Usa-Abc  " }))).toEqual({
      ok: true,
      input: {
        code: "Usa-Abc",
        legalName: "测试客户有限公司",
        shortName: null,
        unifiedCreditCode: null,
        contactName: null,
        phone: null,
        email: null,
        address: null,
        defaultDeliveryContactName: null,
        defaultDeliveryPhone: null,
        defaultDeliveryAddress: null,
        notes: null,
      },
    });
  });

  it("preserves independent company contact and default delivery values", () => {
    const result = validateCustomerForm(
      customerForm({
        contactName: " 王经理 ",
        phone: " 010-10000 ",
        address: " 公司注册地址 ",
        defaultDeliveryContactName: " 张建英 ",
        defaultDeliveryPhone: " 13800000000 ",
        defaultDeliveryAddress: " 浙江仓库 ",
      }),
    );

    expect(result).toMatchObject({
      ok: true,
      input: {
        contactName: "王经理",
        phone: "010-10000",
        address: "公司注册地址",
        defaultDeliveryContactName: "张建英",
        defaultDeliveryPhone: "13800000000",
        defaultDeliveryAddress: "浙江仓库",
      },
    });
  });

  it("accepts a valid optional email", () => {
    expect(
      validateCustomerForm(customerForm({ email: " sales@example.com " })),
    ).toMatchObject({ ok: true, input: { email: "sales@example.com" } });
  });

  it("rejects an invalid optional email", () => {
    expect(validateCustomerForm(customerForm({ email: "not-an-email" }))).toEqual({
      ok: false,
      fieldErrors: { email: "请输入有效的邮箱地址。" },
    });
  });

  it.each(Object.entries(CUSTOMER_FIELD_LIMITS))(
    "enforces the %s field limit",
    (field, limit) => {
      const result = validateCustomerForm(
        customerForm({ [field]: "x".repeat(limit + 1) }),
      );

      expect(result).toMatchObject({
        ok: false,
        fieldErrors: { [field]: `不能超过 ${limit} 个字符。` },
      });
    },
  );

  it("recognizes Prisma unique constraint failures without exposing details", () => {
    expect(
      isCustomerUniqueConstraintError({
        code: "P2002",
        meta: { target: "customer_code_key" },
      }),
    ).toBe(true);
    expect(isCustomerUniqueConstraintError(new Error("duplicate"))).toBe(false);
  });

  it("uses a minimal Customer-only migration", () => {
    const migration = readFileSync(
      join(
        process.cwd(),
        "prisma/migrations/20260919033000_add_customer_master/migration.sql",
      ),
      "utf8",
    );

    expect(migration).toContain("CREATE TABLE `customer`");
    expect(migration).toContain("UNIQUE INDEX `customer_code_key`(`code`)");
    expect(migration).not.toMatch(
      /purchase_contract|supplier|company|product|sales_delivery_note/i,
    );
    expect(migration).not.toMatch(/\b(?:DROP|ALTER)\b/i);
  });
});
