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

function findPurchaseContractForUpdate(
  transaction: Prisma.TransactionClient,
  id: string,
) {
  return transaction.purchaseContract.findUnique({
    where: { id },
    include: { items: true },
  });
}

type ExistingPurchaseContract = NonNullable<
  Awaited<ReturnType<typeof findPurchaseContractForUpdate>>
>;

async function prepareContractData(
  transaction: Prisma.TransactionClient,
  input: PurchaseContractInput,
  existing?: ExistingPurchaseContract,
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
  const existingItemsById = new Map(
    existing?.items.map((item) => [item.id, item]) ?? [],
  );
  const submittedItemIds = new Set<string>();
  input.items.forEach((item, index) => {
    if (!productsById.has(item.productId)) {
      fieldErrors[`items.${index}.productId`] = "请选择有效的产品。";
    }
    if (item.itemId) {
      if (
        !existingItemsById.has(item.itemId) ||
        submittedItemIds.has(item.itemId)
      ) {
        fieldErrors[`items.${index}.itemId`] = "合同明细身份无效。";
      }
      submittedItemIds.add(item.itemId);
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
    const existingItem = item.itemId
      ? existingItemsById.get(item.itemId)
      : undefined;
    const snapshotProduct =
      existingItem && existingItem.productId === item.productId
        ? {
            code: existingItem.productCode,
            name: existingItem.productName,
            specification: existingItem.specification,
            unit: existingItem.unit,
          }
        : product;

    return {
      productId: product.id,
      sortOrder: index,
      productCode: snapshotProduct.code,
      productName: snapshotProduct.name,
      specification: snapshotProduct.specification,
      unit: snapshotProduct.unit,
      quantity: new Prisma.Decimal(calculated.quantity),
      unitPrice: new Prisma.Decimal(calculated.unitPrice),
      amount: new Prisma.Decimal(calculated.amount),
    };
  });

  const preserveBuyerSnapshot = existing?.companyId === input.companyId;
  const preserveSellerSnapshot = existing?.supplierId === input.supplierId;
  const buyerSnapshot =
    preserveBuyerSnapshot && existing
      ? {
          legalName: existing.buyerLegalName,
          unifiedCreditCode: existing.buyerUnifiedCreditCode,
          contactName: existing.buyerContactName,
          phone: existing.buyerPhone,
          address: existing.buyerAddress,
          bankName: existing.buyerBankName,
          bankAccount: existing.buyerBankAccount,
        }
      : company;
  const sellerSnapshot =
    preserveSellerSnapshot && existing
      ? {
          legalName: existing.sellerLegalName,
          unifiedCreditCode: existing.sellerUnifiedCreditCode,
          contactName: existing.sellerContactName,
          phone: existing.sellerPhone,
          address: existing.sellerAddress,
          bankName: existing.sellerBankName,
          bankAccount: existing.sellerBankAccount,
        }
      : supplier;

  return {
    header: {
      contractNo: input.contractNo,
      signingDate: dateFromText(input.signingDate),
      signingPlace: input.signingPlace,
      companyId: company.id,
      supplierId: supplier.id,
      buyerLegalName: buyerSnapshot.legalName,
      buyerUnifiedCreditCode: buyerSnapshot.unifiedCreditCode,
      buyerContactName: buyerSnapshot.contactName,
      buyerPhone: buyerSnapshot.phone,
      buyerAddress: buyerSnapshot.address,
      buyerBankName: buyerSnapshot.bankName,
      buyerBankAccount: buyerSnapshot.bankAccount,
      sellerLegalName: sellerSnapshot.legalName,
      sellerUnifiedCreditCode: sellerSnapshot.unifiedCreditCode,
      sellerContactName: sellerSnapshot.contactName,
      sellerPhone: sellerSnapshot.phone,
      sellerAddress: sellerSnapshot.address,
      sellerBankName: sellerSnapshot.bankName,
      sellerBankAccount: sellerSnapshot.bankAccount,
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
      specialNotice: input.specialNotice,
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
      const existing = await findPurchaseContractForUpdate(transaction, id);
      if (!existing) {
        throw new PurchaseContractNotFoundError();
      }
      if (existing.status !== "DRAFT") {
        throw new PurchaseContractImmutableError();
      }

      const data = await prepareContractData(transaction, input, existing);
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

export function reopenPurchaseContract(id: string) {
  return db.$transaction(
    async (transaction) => {
      const contract = await transaction.purchaseContract.findUnique({
        where: { id },
        select: { status: true },
      });
      if (!contract) {
        throw new PurchaseContractNotFoundError();
      }
      if (contract.status !== "FINAL") {
        throw new PurchaseContractImmutableError();
      }

      return transaction.purchaseContract.update({
        where: { id },
        data: { status: "DRAFT" },
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
