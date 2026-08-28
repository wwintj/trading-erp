import { describe, expect, it } from "vitest";

import {
  calculateExactContractItemAmount,
  calculateExactContractTotal,
  suggestNextPurchaseContractNumber,
  validatePurchaseContractForm,
} from "@/lib/purchase-contract";

function contractForm(overrides: Record<string, string> = {}) {
  const formData = new FormData();
  formData.set("contractNo", " PUR26WS0826 ");
  formData.set("signingDate", "2026-08-28");
  formData.set("signingPlace", " 天津 ");
  formData.set("companyId", "company-1");
  formData.set("supplierId", "supplier-1");
  formData.set("deliveryDate", "");
  formData.set("deliveryAddress", "   ");
  formData.set("deliveryContactName", "   ");
  formData.set("deliveryContactPhone", "   ");
  formData.set("packagingTerms", "   ");
  formData.set("inspectionTerms", "   ");
  formData.set("paymentTerms", "   ");
  formData.set("shippingMethod", "   ");
  formData.set("breachTerms", "   ");
  formData.set("qualityTerms", "   ");
  formData.set("changeTerms", "   ");
  formData.set("disputeTerms", "   ");
  formData.set("additionalTerms", "   ");
  formData.set(
    "itemsJson",
    JSON.stringify([
      {
        productId: "product-1",
        quantity: "6400",
        unitPrice: "0.900",
        amount: "0.01",
      },
    ]),
  );

  for (const [field, value] of Object.entries(overrides)) {
    formData.set(field, value);
  }
  return formData;
}

describe("Purchase Contract numbering", () => {
  it("suggests the deterministic next current-year number", () => {
    expect(
      suggestNextPurchaseContractNumber(
        ["PUR26WS0002", "PUR26WS0010", "PUR25WS9999", "OTHER"],
        2026,
      ),
    ).toBe("PUR26WS0011");
    expect(suggestNextPurchaseContractNumber([], 2026)).toBe("PUR26WS0001");
  });
});

describe("Purchase Contract exact decimals", () => {
  it("calculates 6400 × 0.900 exactly", () => {
    expect(calculateExactContractItemAmount("6400", "0.900")).toMatchObject({
      quantity: "6400.000",
      unitPrice: "0.9000",
      amount: "5760.00",
    });
  });

  it("rounds each line HALF_UP and sums exact minor units", () => {
    expect(
      calculateExactContractTotal([
        { productId: "p1", quantity: "2", unitPrice: "1.005" },
        { productId: "p2", quantity: "3", unitPrice: "0.3333" },
      ]),
    ).toMatchObject({
      items: [{ amount: "2.01" }, { amount: "1.00" }],
      totalAmount: "3.01",
    });
  });
});

describe("Purchase Contract validation", () => {
  it("accepts a manual historical number and ignores submitted amounts", () => {
    const result = validatePurchaseContractForm(contractForm());

    expect(result).toMatchObject({
      ok: true,
      input: {
        contractNo: "PUR26WS0826",
        signingDate: "2026-08-28",
        signingPlace: "天津",
        deliveryAddress: null,
        items: [
          { productId: "product-1", quantity: "6400", unitPrice: "0.900" },
        ],
      },
    });
    if (result.ok) {
      expect(result.input.items[0]).not.toHaveProperty("amount");
      expect(result.input).not.toHaveProperty("totalAmount");
    }
  });

  it("preserves a valid Draft itemId as untrusted row identity input", () => {
    const result = validatePurchaseContractForm(
      contractForm({
        itemsJson: JSON.stringify([
          {
            itemId: " item-1 ",
            productId: "product-1",
            quantity: "6400",
            unitPrice: "0.900",
          },
        ]),
      }),
    );

    expect(result).toMatchObject({
      ok: true,
      input: { items: [{ itemId: "item-1", productId: "product-1" }] },
    });
  });

  it("requires number, date, company, supplier, and at least one item", () => {
    const result = validatePurchaseContractForm(
      contractForm({
        contractNo: "",
        signingDate: "invalid",
        companyId: "",
        supplierId: "",
        itemsJson: "[]",
      }),
    );

    expect(result).toEqual({
      ok: false,
      fieldErrors: {
        contractNo: "请输入合同编号。",
        signingDate: "请输入有效的签订日期。",
        companyId: "请选择买方。",
        supplierId: "请选择卖方。",
        items: "请至少添加一条合同明细。",
      },
    });
  });

  it("validates product, positive quantity, and non-negative unit price", () => {
    const result = validatePurchaseContractForm(
      contractForm({
        itemsJson: JSON.stringify([
          { productId: "", quantity: "0", unitPrice: "-1" },
        ]),
      }),
    );

    expect(result).toMatchObject({
      ok: false,
      fieldErrors: {
        "items.0.productId": "请选择产品。",
        "items.0.quantity": expect.any(String),
        "items.0.unitPrice": expect.any(String),
      },
    });
  });

  it("validates dates and safe text lengths", () => {
    const result = validatePurchaseContractForm(
      contractForm({ deliveryDate: "2026-02-30", signingPlace: "x".repeat(256) }),
    );

    expect(result).toMatchObject({
      ok: false,
      fieldErrors: {
        deliveryDate: "请输入有效的交货日期。",
        signingPlace: "不能超过 255 个字符。",
      },
    });
  });
});
