import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const transaction = {
    company: { findUnique: vi.fn() },
    supplier: { findUnique: vi.fn() },
    product: { findMany: vi.fn() },
    purchaseContract: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    purchaseContractItem: {
      deleteMany: vi.fn(),
      update: vi.fn(),
    },
  };
  return {
    transaction,
    runTransaction: vi.fn(async (operation: (tx: typeof transaction) => unknown) =>
      operation(transaction),
    ),
    listContracts: vi.fn(),
    numberContracts: vi.fn(),
  };
});

vi.mock("@/lib/db", () => ({
  db: {
    $transaction: mocks.runTransaction,
    purchaseContract: {
      findMany: vi.fn((args: { where?: unknown }) =>
        args.where ? mocks.numberContracts(args) : mocks.listContracts(args),
      ),
    },
  },
}));

import { Prisma } from "@/generated/prisma/client";
import type { PurchaseContractInput } from "@/lib/purchase-contract";
import {
  PurchaseContractImmutableError,
  PurchaseContractValidationError,
  cancelPurchaseContract,
  createPurchaseContract,
  finalizePurchaseContract,
  listPurchaseContracts,
  reopenPurchaseContract,
  suggestPurchaseContractNumber,
  updatePurchaseContract,
} from "@/lib/purchase-contract.server";

const input: PurchaseContractInput = {
  contractNo: "PUR26WS0826",
  signingDate: "2026-08-28",
  signingPlace: "天津",
  companyId: "company-1",
  supplierId: "supplier-1",
  deliveryDate: "2026-09-01",
  deliveryAddress: "浙江乐清",
  deliveryContactName: "张建英",
  deliveryContactPhone: null,
  packagingTerms: "100米/盘",
  inspectionTerms: "按样验收",
  paymentTerms: "款到发货",
  shippingMethod: "德邦",
  breachTerms: null,
  qualityTerms: null,
  changeTerms: null,
  specialNotice: null,
  disputeTerms: null,
  additionalTerms: null,
  items: [{ productId: "product-1", quantity: "6400", unitPrice: "0.900" }],
};

const company = {
  id: "company-1",
  legalName: "天津纬信科技有限公司",
  unifiedCreditCode: "buyer-credit",
  contactName: "Buyer Contact",
  phone: "buyer-phone",
  address: "buyer-address",
  bankName: "buyer-bank",
  bankAccount: "buyer-account",
};
const supplier = {
  id: "supplier-1",
  legalName: "惠州市华业升塑胶制品有限公司",
  unifiedCreditCode: "seller-credit",
  contactName: "Seller Contact",
  phone: "seller-phone",
  address: "seller-address",
  bankName: "seller-bank",
  bankAccount: "seller-account",
};
const product = {
  id: "product-1",
  code: "WS-H42",
  name: "PVC热收缩套管",
  specification: null,
  unit: "米",
};

function existingDraftContract() {
  return {
    id: "contract-1",
    status: "DRAFT",
    companyId: "company-1",
    supplierId: "supplier-1",
    buyerLegalName: "旧买方名称",
    buyerUnifiedCreditCode: "old-buyer-credit",
    buyerContactName: "Old Buyer Contact",
    buyerPhone: "old-buyer-phone",
    buyerAddress: "old-buyer-address",
    buyerBankName: "old-buyer-bank",
    buyerBankAccount: "old-buyer-account",
    sellerLegalName: "旧卖方名称",
    sellerUnifiedCreditCode: "old-seller-credit",
    sellerContactName: "Old Seller Contact",
    sellerPhone: "old-seller-phone",
    sellerAddress: "old-seller-address",
    sellerBankName: "old-seller-bank",
    sellerBankAccount: "old-seller-account",
    items: [
      {
        id: "item-1",
        productId: "product-1",
        productCode: "WS-H42",
        productName: "PVC热收缩套管",
        specification: "旧规格",
        unit: "米",
      },
    ],
  };
}

function draftUpdateInput(
  overrides: Partial<PurchaseContractInput> = {},
): PurchaseContractInput {
  return {
    ...input,
    items: [
      {
        itemId: "item-1",
        productId: "product-1",
        quantity: "6400",
        unitPrice: "0.900",
      },
    ],
    ...overrides,
  };
}

describe("Purchase Contract persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    company.legalName = "天津纬信科技有限公司";
    Object.assign(supplier, {
      legalName: "惠州市华业升塑胶制品有限公司",
      unifiedCreditCode: "seller-credit",
      contactName: "Seller Contact",
      phone: "seller-phone",
      address: "seller-address",
      bankName: "seller-bank",
      bankAccount: "seller-account",
    });
    product.name = "PVC热收缩套管";
    mocks.runTransaction.mockImplementation(
      async (operation: (tx: typeof mocks.transaction) => unknown) =>
        operation(mocks.transaction),
    );
    mocks.transaction.company.findUnique.mockResolvedValue(company);
    mocks.transaction.supplier.findUnique.mockResolvedValue(supplier);
    mocks.transaction.product.findMany.mockResolvedValue([product]);
    mocks.transaction.purchaseContract.findUnique.mockResolvedValue(
      existingDraftContract(),
    );
    mocks.transaction.purchaseContract.create.mockResolvedValue({ id: "contract-1" });
    mocks.transaction.purchaseContract.update.mockResolvedValue({ id: "contract-1" });
    mocks.transaction.purchaseContractItem.deleteMany.mockResolvedValue({ count: 1 });
    mocks.transaction.purchaseContractItem.update.mockResolvedValue({});
  });

  it("uses deterministic list ordering", async () => {
    mocks.listContracts.mockResolvedValue([]);

    await listPurchaseContracts();

    expect(mocks.listContracts).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [
          { signingDate: "desc" },
          { contractNo: "desc" },
          { id: "desc" },
        ],
      }),
    );
  });

  it("suggests a number from matching persisted numbers", async () => {
    mocks.numberContracts.mockResolvedValue([
      { contractNo: "PUR26WS0001" },
      { contractNo: "PUR26WS0008" },
    ]);

    await expect(
      suggestPurchaseContractNumber(new Date("2026-08-28T00:00:00.000Z")),
    ).resolves.toBe("PUR26WS0009");
  });

  it("atomically creates header, snapshots, items, and exact totals", async () => {
    await createPurchaseContract({ ...input, specialNotice: "重点说明" });

    expect(mocks.runTransaction).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: "Serializable" },
    );
    const createData = mocks.transaction.purchaseContract.create.mock.calls[0][0].data;
    expect(createData.buyerLegalName).toBe("天津纬信科技有限公司");
    expect(createData.sellerLegalName).toBe("惠州市华业升塑胶制品有限公司");
    expect(createData.totalAmount.toString()).toBe("5760");
    expect(createData.specialNotice).toBe("重点说明");
    expect(createData.items.create[0]).toMatchObject({
      productCode: "WS-H42",
      productName: "PVC热收缩套管",
      unit: "米",
      sortOrder: 0,
    });
    expect(createData.items.create[0].quantity.toFixed(3)).toBe("6400.000");
    expect(createData.items.create[0].unitPrice.toFixed(4)).toBe("0.9000");
    expect(createData.items.create[0].amount.toFixed(2)).toBe("5760.00");

    company.legalName = "后来修改的公司";
    supplier.legalName = "后来修改的供应商";
    product.name = "后来修改的产品";
    expect(createData.buyerLegalName).toBe("天津纬信科技有限公司");
    expect(createData.sellerLegalName).toBe("惠州市华业升塑胶制品有限公司");
    expect(createData.items.create[0].productName).toBe("PVC热收缩套管");
  });

  it("validates Company, Supplier, and Product existence inside the transaction", async () => {
    mocks.transaction.company.findUnique.mockResolvedValue(null);
    mocks.transaction.supplier.findUnique.mockResolvedValue(null);
    mocks.transaction.product.findMany.mockResolvedValue([]);

    await expect(createPurchaseContract(input)).rejects.toMatchObject({
      fieldErrors: {
        companyId: "请选择有效的买方。",
        supplierId: "请选择有效的卖方。",
        "items.0.productId": "请选择有效的产品。",
      },
    } satisfies Partial<PurchaseContractValidationError>);
    expect(mocks.transaction.purchaseContract.create).not.toHaveBeenCalled();
  });

  it("atomically replaces items only while the contract remains Draft", async () => {
    await updatePurchaseContract("contract-1", draftUpdateInput());

    expect(mocks.transaction.purchaseContractItem.deleteMany).toHaveBeenCalledWith({
      where: { purchaseContractId: "contract-1" },
    });
    expect(mocks.transaction.purchaseContract.update).toHaveBeenCalledOnce();

    for (const status of ["FINAL", "CANCELLED"]) {
      mocks.transaction.purchaseContract.findUnique.mockResolvedValue({
        ...existingDraftContract(),
        status,
      });
      await expect(
        updatePurchaseContract("contract-1", draftUpdateInput()),
      ).rejects.toBeInstanceOf(PurchaseContractImmutableError);
    }
  });

  it("preserves the buyer snapshot when companyId is unchanged", async () => {
    company.legalName = "新买方名称";

    await updatePurchaseContract("contract-1", draftUpdateInput({
      paymentTerms: "保存无关字段",
    }));

    const updateData = mocks.transaction.purchaseContract.update.mock.calls[0][0].data;
    expect(updateData.buyerLegalName).toBe("旧买方名称");
    expect(updateData.buyerBankAccount).toBe("old-buyer-account");
    expect(mocks.transaction.company.findUnique).toHaveBeenCalledWith({
      where: { id: "company-1" },
    });
  });

  it("preserves the seller snapshot when supplierId is unchanged", async () => {
    supplier.legalName = "新卖方名称";

    await updatePurchaseContract("contract-1", draftUpdateInput({
      paymentTerms: "保存无关字段",
    }));

    const updateData = mocks.transaction.purchaseContract.update.mock.calls[0][0].data;
    expect(updateData.sellerLegalName).toBe("旧卖方名称");
    expect(updateData.sellerBankAccount).toBe("old-seller-account");
    expect(mocks.transaction.supplier.findUnique).toHaveBeenCalledWith({
      where: { id: "supplier-1" },
    });
  });

  it("explicitly refreshes the same Supplier snapshot and saves current form edits", async () => {
    Object.assign(supplier, {
      legalName: "供应商最新名称",
      unifiedCreditCode: "new-seller-credit",
      contactName: "最新联系人",
      phone: "new-seller-phone",
      address: "最新供应商地址",
      bankName: "最新开户行",
      bankAccount: "new-seller-account",
    });

    await updatePurchaseContract(
      "contract-1",
      draftUpdateInput({
        paymentTerms: "当前未保存的付款条款",
        deliveryAddress: "当前未保存的收货地址",
      }),
      { refreshSellerSnapshot: true },
    );

    const updateData =
      mocks.transaction.purchaseContract.update.mock.calls[0][0].data;
    expect(updateData).toMatchObject({
      sellerLegalName: "供应商最新名称",
      sellerUnifiedCreditCode: "new-seller-credit",
      sellerContactName: "最新联系人",
      sellerPhone: "new-seller-phone",
      sellerAddress: "最新供应商地址",
      sellerBankName: "最新开户行",
      sellerBankAccount: "new-seller-account",
      supplierId: "supplier-1",
      buyerLegalName: "旧买方名称",
      paymentTerms: "当前未保存的付款条款",
      deliveryAddress: "当前未保存的收货地址",
    });
    expect(updateData.items.create[0]).toMatchObject({
      productName: "PVC热收缩套管",
    });
    expect(updateData.items.create[0].quantity.toFixed(3)).toBe("6400.000");
  });

  it("preserves item identity through Supplier refresh followed by a normal save", async () => {
    await updatePurchaseContract(
      "contract-1",
      draftUpdateInput({ paymentTerms: "刷新供应商时保存的条款" }),
      { refreshSellerSnapshot: true },
    );
    await updatePurchaseContract(
      "contract-1",
      draftUpdateInput({ paymentTerms: "随后普通保存的条款" }),
    );

    expect(mocks.transaction.purchaseContract.update).toHaveBeenCalledTimes(2);
    for (const [call] of mocks.transaction.purchaseContract.update.mock.calls) {
      expect(call.data.items.create[0].id).toBe("item-1");
    }
  });

  it("preserves item identity across two consecutive normal Draft saves", async () => {
    await updatePurchaseContract("contract-1", draftUpdateInput());
    await updatePurchaseContract("contract-1", draftUpdateInput());

    expect(mocks.transaction.purchaseContract.update).toHaveBeenCalledTimes(2);
    expect(
      mocks.transaction.purchaseContract.update.mock.calls.map(
        ([call]) => call.data.items.create[0].id,
      ),
    ).toEqual(["item-1", "item-1"]);
  });

  it("accepts a server-synced new row ID on the next Draft save", async () => {
    const firstSaveItems = [
      ...draftUpdateInput().items,
      { productId: "product-1", quantity: "2", unitPrice: "3" },
    ];

    await updatePurchaseContract(
      "contract-1",
      draftUpdateInput({ items: firstSaveItems }),
    );

    const firstCreate =
      mocks.transaction.purchaseContract.update.mock.calls[0][0].data.items.create;
    expect(firstCreate[0].id).toBe("item-1");
    expect(firstCreate[1]).not.toHaveProperty("id");

    mocks.transaction.purchaseContract.findUnique.mockResolvedValue({
      ...existingDraftContract(),
      items: [
        existingDraftContract().items[0],
        {
          id: "item-2",
          productId: "product-1",
          productCode: "WS-H42",
          productName: "新增行产品",
          specification: null,
          unit: "米",
        },
      ],
    });

    await updatePurchaseContract(
      "contract-1",
      draftUpdateInput({
        items: [
          draftUpdateInput().items[0],
          {
            itemId: "item-2",
            productId: "product-1",
            quantity: "2.000",
            unitPrice: "3.0000",
          },
        ],
      }),
    );

    const secondCreate =
      mocks.transaction.purchaseContract.update.mock.calls[1][0].data.items.create;
    expect(secondCreate.map((item: { id?: string }) => item.id)).toEqual([
      "item-1",
      "item-2",
    ]);
  });

  it.each(["FINAL", "CANCELLED"])(
    "rejects explicit Supplier refresh while status is %s",
    async (status) => {
      mocks.transaction.purchaseContract.findUnique.mockResolvedValue({
        ...existingDraftContract(),
        status,
      });

      await expect(
        updatePurchaseContract(
          "contract-1",
          draftUpdateInput(),
          { refreshSellerSnapshot: true },
        ),
      ).rejects.toBeInstanceOf(PurchaseContractImmutableError);
      expect(mocks.transaction.purchaseContract.update).not.toHaveBeenCalled();
      expect(mocks.transaction.purchaseContractItem.deleteMany).not.toHaveBeenCalled();
    },
  );

  it("fails safely when the selected Supplier no longer exists during refresh", async () => {
    mocks.transaction.supplier.findUnique.mockResolvedValue(null);

    await expect(
      updatePurchaseContract(
        "contract-1",
        draftUpdateInput(),
        { refreshSellerSnapshot: true },
      ),
    ).rejects.toMatchObject({
      fieldErrors: { supplierId: "请选择有效的卖方。" },
    } satisfies Partial<PurchaseContractValidationError>);
    expect(mocks.transaction.purchaseContract.update).not.toHaveBeenCalled();
    expect(mocks.transaction.purchaseContractItem.deleteMany).not.toHaveBeenCalled();
  });

  it("preserves an existing item snapshot when productId is unchanged", async () => {
    product.name = "主数据中的新产品名称";

    await updatePurchaseContract("contract-1", draftUpdateInput());

    const itemData =
      mocks.transaction.purchaseContract.update.mock.calls[0][0].data.items.create[0];
    expect(itemData).toMatchObject({
      productCode: "WS-H42",
      productName: "PVC热收缩套管",
      specification: "旧规格",
      unit: "米",
    });
  });

  it("refreshes the buyer snapshot when companyId changes", async () => {
    mocks.transaction.company.findUnique.mockResolvedValue({
      ...company,
      id: "company-2",
      legalName: "新买方名称",
      bankAccount: "new-buyer-account",
    });

    await updatePurchaseContract(
      "contract-1",
      draftUpdateInput({ companyId: "company-2" }),
    );

    const updateData = mocks.transaction.purchaseContract.update.mock.calls[0][0].data;
    expect(updateData.buyerLegalName).toBe("新买方名称");
    expect(updateData.buyerBankAccount).toBe("new-buyer-account");
  });

  it("refreshes the seller snapshot when supplierId changes", async () => {
    mocks.transaction.supplier.findUnique.mockResolvedValue({
      ...supplier,
      id: "supplier-2",
      legalName: "新卖方名称",
      bankAccount: "new-seller-account",
    });

    await updatePurchaseContract(
      "contract-1",
      draftUpdateInput({ supplierId: "supplier-2" }),
    );

    const updateData = mocks.transaction.purchaseContract.update.mock.calls[0][0].data;
    expect(updateData.sellerLegalName).toBe("新卖方名称");
    expect(updateData.sellerBankAccount).toBe("new-seller-account");
  });

  it("refreshes an existing item snapshot when productId changes", async () => {
    mocks.transaction.product.findMany.mockResolvedValue([
      {
        ...product,
        id: "product-2",
        code: "NEW-2",
        name: "新选择的产品",
        specification: "新规格",
        unit: "件",
      },
    ]);

    await updatePurchaseContract(
      "contract-1",
      draftUpdateInput({
        items: [
          {
            itemId: "item-1",
            productId: "product-2",
            quantity: "2",
            unitPrice: "3",
          },
        ],
      }),
    );

    const itemData =
      mocks.transaction.purchaseContract.update.mock.calls[0][0].data.items.create[0];
    expect(itemData).toMatchObject({
      id: "item-1",
      productId: "product-2",
      productCode: "NEW-2",
      productName: "新选择的产品",
      specification: "新规格",
      unit: "件",
    });
  });

  it("creates a current Product snapshot for a new row without itemId", async () => {
    product.name = "新增行当前产品名称";

    await updatePurchaseContract("contract-1", draftUpdateInput({
      items: [{ productId: "product-1", quantity: "2", unitPrice: "3" }],
    }));

    const itemData =
      mocks.transaction.purchaseContract.update.mock.calls[0][0].data.items.create[0];
    expect(itemData.productName).toBe("新增行当前产品名称");
    expect(itemData.sortOrder).toBe(0);
  });

  it("safely rejects an itemId that does not belong to the contract", async () => {
    await expect(
      updatePurchaseContract(
        "contract-1",
        draftUpdateInput({
          items: [
            {
              itemId: "item-from-another-contract",
              productId: "product-1",
              quantity: "6400",
              unitPrice: "0.900",
            },
          ],
        }),
      ),
    ).rejects.toMatchObject({
      fieldErrors: { "items.0.itemId": "合同明细身份无效。" },
    } satisfies Partial<PurchaseContractValidationError>);
    expect(mocks.transaction.purchaseContractItem.deleteMany).not.toHaveBeenCalled();
    expect(mocks.transaction.purchaseContract.update).not.toHaveBeenCalled();
  });

  it("reopens Final as Draft in a Serializable transaction and changes only status", async () => {
    mocks.transaction.purchaseContract.findUnique.mockResolvedValue({
      status: "FINAL",
    });

    await reopenPurchaseContract("contract-1");

    expect(mocks.runTransaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: "Serializable",
    });
    expect(mocks.transaction.purchaseContract.findUnique).toHaveBeenCalledWith({
      where: { id: "contract-1" },
      select: { status: true },
    });
    expect(mocks.transaction.purchaseContract.update).toHaveBeenCalledWith({
      where: { id: "contract-1" },
      data: { status: "DRAFT" },
    });
    expect(mocks.transaction.purchaseContractItem.deleteMany).not.toHaveBeenCalled();
    expect(mocks.transaction.purchaseContractItem.update).not.toHaveBeenCalled();
    expect(mocks.transaction.company.findUnique).not.toHaveBeenCalled();
    expect(mocks.transaction.supplier.findUnique).not.toHaveBeenCalled();
    expect(mocks.transaction.product.findMany).not.toHaveBeenCalled();
  });

  it.each(["DRAFT", "CANCELLED"])(
    "does not reopen a %s contract",
    async (status) => {
      mocks.transaction.purchaseContract.findUnique.mockResolvedValue({ status });

      await expect(
        reopenPurchaseContract("contract-1"),
      ).rejects.toBeInstanceOf(PurchaseContractImmutableError);
      expect(mocks.transaction.purchaseContract.update).not.toHaveBeenCalled();
    },
  );

  it("revalidates exact totals while finalizing and permits Final cancellation", async () => {
    mocks.transaction.purchaseContract.findUnique.mockResolvedValueOnce({
      id: "contract-1",
      status: "DRAFT",
      contractNo: "PUR26WS0826",
      signingDate: new Date("2026-08-28T00:00:00.000Z"),
      companyId: "company-1",
      supplierId: "supplier-1",
      buyerLegalName: "天津纬信科技有限公司",
      sellerLegalName: "惠州市华业升塑胶制品有限公司",
      items: [
        {
          id: "item-1",
          productId: "product-1",
          productCode: "WS-H42",
          productName: "PVC热收缩套管",
          unit: "米",
          quantity: new Prisma.Decimal("6400.000"),
          unitPrice: new Prisma.Decimal("0.9000"),
        },
      ],
    });

    await finalizePurchaseContract("contract-1");

    expect(mocks.transaction.purchaseContractItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ amount: expect.any(Prisma.Decimal) }),
      }),
    );
    const finalizedUpdate =
      mocks.transaction.purchaseContract.update.mock.calls.at(-1)?.[0];
    expect(finalizedUpdate?.data.totalAmount.toFixed(2)).toBe("5760.00");
    expect(finalizedUpdate?.data.status).toBe("FINAL");

    mocks.transaction.purchaseContract.findUnique.mockResolvedValueOnce({ status: "FINAL" });
    await cancelPurchaseContract("contract-1");
    const cancelledUpdate =
      mocks.transaction.purchaseContract.update.mock.calls.at(-1)?.[0];
    expect(cancelledUpdate?.data.status).toBe("CANCELLED");

    mocks.transaction.purchaseContract.findUnique.mockResolvedValueOnce({
      status: "CANCELLED",
    });
    await expect(cancelPurchaseContract("contract-1")).rejects.toBeInstanceOf(
      PurchaseContractImmutableError,
    );
  });
});
