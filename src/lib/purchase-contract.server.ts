import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import {
  calculateExactContractTotal,
  purchaseContractNumberPrefix,
  suggestNextPurchaseContractNumber,
  type PurchaseContractInput,
} from "@/lib/purchase-contract";

export class PurchaseContractValidationError extends Error {
  constructor(readonly fieldErrors: Record<string, string>) {
    super("Purchase contract validation failed");
  }
}

export class PurchaseContractImmutableError extends Error {}
export class PurchaseContractNotFoundError extends Error {}

export function listPurchaseContracts() {
  return db.purchaseContract.findMany({
    orderBy: [
      { signingDate: "desc" },
      { contractNo: "desc" },
      { id: "desc" },
    ],
    select: {
      id: true,
      contractNo: true,
      signingDate: true,
      sellerLegalName: true,
      totalAmount: true,
      status: true,
    },
  });
}

export function getPurchaseContractById(id: string) {
  return db.purchaseContract.findUnique({
    where: { id },
    include: { items: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] } },
  });
}

export async function getPurchaseContractFormOptions() {
  const [companies, suppliers, products] = await Promise.all([
    db.company.findMany({ orderBy: [{ legalName: "asc" }, { id: "asc" }] }),
    db.supplier.findMany({ orderBy: [{ code: "asc" }, { id: "asc" }] }),
    db.product.findMany({ orderBy: [{ code: "asc" }, { id: "asc" }] }),
  ]);

  return { companies, suppliers, products };
}

export async function suggestPurchaseContractNumber(
  now: Date = new Date(),
): Promise<string> {
  const year = now.getUTCFullYear();
  const prefix = purchaseContractNumberPrefix(year);
  const contracts = await db.purchaseContract.findMany({
    where: { contractNo: { startsWith: prefix } },
    select: { contractNo: true },
  });

  return suggestNextPurchaseContractNumber(
    contracts.map((contract) => contract.contractNo),
    year,
  );
}

function dateFromText(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

async function prepareContractData(
  transaction: Prisma.TransactionClient,
  input: PurchaseContractInput,
) {
  const productIds = [...new Set(input.items.map((item) => item.productId))];
  const [company, supplier, products] = await Promise.all([
    transaction.company.findUnique({ where: { id: input.companyId } }),
    transaction.supplier.findUnique({ where: { id: input.supplierId } }),
    transaction.product.findMany({ where: { id: { in: productIds } } }),
  ]);
  const fieldErrors: Record<string, string> = {};

  if (!company) {
    fieldErrors.companyId = "请选择有效的买方。";
  }

  if (!supplier) {
    fieldErrors.supplierId = "请选择有效的卖方。";
  }

  const productsById = new Map(products.map((product) => [product.id, product]));
  input.items.forEach((item, index) => {
    if (!productsById.has(item.productId)) {
      fieldErrors[`items.${index}.productId`] = "请选择有效的产品。";
    }
  });

  if (Object.keys(fieldErrors).length > 0 || !company || !supplier) {
    throw new PurchaseContractValidationError(fieldErrors);
  }

  const totals = calculateExactContractTotal(input.items);
  if (!totals) {
    throw new PurchaseContractValidationError({
      items: "合同明细金额无效或超出允许范围。",
    });
  }

  const items = input.items.map((item, index) => {
    const product = productsById.get(item.productId);
    if (!product) {
      throw new PurchaseContractValidationError({
        [`items.${index}.productId`]: "请选择有效的产品。",
      });
    }
    const calculated = totals.items[index];

    return {
      productId: product.id,
      sortOrder: index,
      productCode: product.code,
      productName: product.name,
      specification: product.specification,
      unit: product.unit,
      quantity: new Prisma.Decimal(calculated.quantity),
      unitPrice: new Prisma.Decimal(calculated.unitPrice),
      amount: new Prisma.Decimal(calculated.amount),
    };
  });

  return {
    header: {
      contractNo: input.contractNo,
      signingDate: dateFromText(input.signingDate),
      signingPlace: input.signingPlace,
      companyId: company.id,
      supplierId: supplier.id,
      buyerLegalName: company.legalName,
      buyerUnifiedCreditCode: company.unifiedCreditCode,
      buyerContactName: company.contactName,
      buyerPhone: company.phone,
      buyerAddress: company.address,
      buyerBankName: company.bankName,
      buyerBankAccount: company.bankAccount,
      sellerLegalName: supplier.legalName,
      sellerUnifiedCreditCode: supplier.unifiedCreditCode,
      sellerContactName: supplier.contactName,
      sellerPhone: supplier.phone,
      sellerAddress: supplier.address,
      sellerBankName: supplier.bankName,
      sellerBankAccount: supplier.bankAccount,
      deliveryDate: input.deliveryDate ? dateFromText(input.deliveryDate) : null,
      deliveryAddress: input.deliveryAddress,
      deliveryContactName: input.deliveryContactName,
      deliveryContactPhone: input.deliveryContactPhone,
      packagingTerms: input.packagingTerms,
      inspectionTerms: input.inspectionTerms,
      paymentTerms: input.paymentTerms,
      shippingMethod: input.shippingMethod,
      breachTerms: input.breachTerms,
      qualityTerms: input.qualityTerms,
      changeTerms: input.changeTerms,
      disputeTerms: input.disputeTerms,
      additionalTerms: input.additionalTerms,
      totalAmount: new Prisma.Decimal(totals.totalAmount),
    },
    items,
  };
}

export function createPurchaseContract(input: PurchaseContractInput) {
  return db.$transaction(
    async (transaction) => {
      const data = await prepareContractData(transaction, input);
      return transaction.purchaseContract.create({
        data: {
          ...data.header,
          items: { create: data.items },
        },
        include: { items: { orderBy: { sortOrder: "asc" } } },
      });
    },
    { isolationLevel: "Serializable" },
  );
}

export function updatePurchaseContract(
  id: string,
  input: PurchaseContractInput,
) {
  return db.$transaction(
    async (transaction) => {
      const existing = await transaction.purchaseContract.findUnique({
        where: { id },
        select: { status: true },
      });
      if (!existing) {
        throw new PurchaseContractNotFoundError();
      }
      if (existing.status !== "DRAFT") {
        throw new PurchaseContractImmutableError();
      }

      const data = await prepareContractData(transaction, input);
      await transaction.purchaseContractItem.deleteMany({
        where: { purchaseContractId: id },
      });
      return transaction.purchaseContract.update({
        where: { id },
        data: {
          ...data.header,
          items: { create: data.items },
        },
        include: { items: { orderBy: { sortOrder: "asc" } } },
      });
    },
    { isolationLevel: "Serializable" },
  );
}

export function finalizePurchaseContract(id: string) {
  return db.$transaction(
    async (transaction) => {
      const contract = await transaction.purchaseContract.findUnique({
        where: { id },
        include: { items: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] } },
      });
      if (!contract) {
        throw new PurchaseContractNotFoundError();
      }
      if (contract.status !== "DRAFT") {
        throw new PurchaseContractImmutableError();
      }
      if (
        !contract.contractNo ||
        Number.isNaN(contract.signingDate.getTime()) ||
        !contract.companyId ||
        !contract.supplierId ||
        !contract.buyerLegalName ||
        !contract.sellerLegalName
      ) {
        throw new PurchaseContractValidationError({
          contract: "采购合同信息不完整，无法定稿。",
        });
      }

      if (
        contract.items.some(
          (item) =>
            !item.productId ||
            !item.productCode ||
            !item.productName ||
            !item.unit,
        )
      ) {
        throw new PurchaseContractValidationError({
          items: "采购合同明细快照不完整，无法定稿。",
        });
      }

      const itemInputs = contract.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity.toString(),
        unitPrice: item.unitPrice.toString(),
      }));
      const totals = calculateExactContractTotal(itemInputs);
      if (!totals || contract.items.length === 0) {
        throw new PurchaseContractValidationError({
          items: "采购合同明细无效，无法定稿。",
        });
      }

      await Promise.all(
        contract.items.map((item, index) =>
          transaction.purchaseContractItem.update({
            where: { id: item.id },
            data: {
              quantity: new Prisma.Decimal(totals.items[index].quantity),
              unitPrice: new Prisma.Decimal(totals.items[index].unitPrice),
              amount: new Prisma.Decimal(totals.items[index].amount),
            },
          }),
        ),
      );

      return transaction.purchaseContract.update({
        where: { id },
        data: {
          status: "FINAL",
          totalAmount: new Prisma.Decimal(totals.totalAmount),
        },
      });
    },
    { isolationLevel: "Serializable" },
  );
}

export function cancelPurchaseContract(id: string) {
  return db.$transaction(
    async (transaction) => {
      const contract = await transaction.purchaseContract.findUnique({
        where: { id },
        select: { status: true },
      });
      if (!contract) {
        throw new PurchaseContractNotFoundError();
      }
      if (contract.status === "CANCELLED") {
        throw new PurchaseContractImmutableError();
      }

      return transaction.purchaseContract.update({
        where: { id },
        data: { status: "CANCELLED" },
      });
    },
    { isolationLevel: "Serializable" },
  );
}
