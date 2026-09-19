import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import {
  exactDeliveryQuantity, salesDeliveryNoteNumberPrefix,
  suggestNextSalesDeliveryNoteNumber, validateSalesDeliveryNoteForm,
  type SalesDeliveryNoteInput, type SalesDeliveryNoteOperation,
} from "@/lib/sales-delivery-note";

export class SalesDeliveryNoteValidationError extends Error {
  constructor(readonly fieldErrors: Record<string, string>) { super("Sales delivery note validation failed"); }
}
export class SalesDeliveryNoteImmutableError extends Error {}
export class SalesDeliveryNoteNotFoundError extends Error {}

export function listSalesDeliveryNotes() {
  return db.salesDeliveryNote.findMany({
    orderBy: [{ deliveryDate: "desc" }, { deliveryNo: "desc" }, { id: "desc" }],
    select: { id: true, deliveryNo: true, deliveryDate: true, customerLegalName: true, customerPoNo: true, status: true },
  });
}
export function getSalesDeliveryNoteById(id: string) {
  return db.salesDeliveryNote.findUnique({
    where: { id }, include: { items: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] } },
  });
}
export async function getSalesDeliveryNoteFormOptions() {
  const [companies, customers, products] = await Promise.all([
    db.company.findMany({
      orderBy: [{ legalName: "asc" }, { id: "asc" }],
      select: { id: true, legalName: true },
    }),
    db.customer.findMany({
      orderBy: [{ code: "asc" }, { id: "asc" }],
      select: { id: true, code: true, legalName: true, defaultDeliveryContactName: true, defaultDeliveryPhone: true, defaultDeliveryAddress: true },
    }),
    db.product.findMany({
      orderBy: [{ code: "asc" }, { id: "asc" }],
      select: { id: true, code: true, name: true, specification: true, unit: true },
    }),
  ]);
  return { companies, customers, products };
}
export async function suggestSalesDeliveryNoteNumber(now = new Date()) {
  const year = now.getUTCFullYear();
  const notes = await db.salesDeliveryNote.findMany({
    where: { deliveryNo: { startsWith: salesDeliveryNoteNumberPrefix(year) } },
    select: { deliveryNo: true },
  });
  return suggestNextSalesDeliveryNoteNumber(notes.map((note) => note.deliveryNo), year);
}
function findForUpdate(tx: Prisma.TransactionClient, id: string) {
  return tx.salesDeliveryNote.findUnique({ where: { id }, include: { items: true } });
}
type ExistingNote = NonNullable<Awaited<ReturnType<typeof findForUpdate>>>;

function validatedInput(input: SalesDeliveryNoteInput) {
  const form = new FormData();
  for (const [key, value] of Object.entries(input)) {
    if (key !== "items" && value !== null) form.set(key, String(value));
  }
  form.set("itemsJson", JSON.stringify(input.items));
  const result = validateSalesDeliveryNoteForm(form);
  if (!result.ok) throw new SalesDeliveryNoteValidationError(result.fieldErrors);
  return result.input;
}

async function prepareNoteData(tx: Prisma.TransactionClient, raw: SalesDeliveryNoteInput, existing?: ExistingNote) {
  // Revalidate inside the transaction as well as at the action boundary.
  const input = validatedInput(raw);
  const [company, customer, products] = await Promise.all([
    tx.company.findUnique({ where: { id: input.companyId } }),
    tx.customer.findUnique({ where: { id: input.customerId } }),
    tx.product.findMany({ where: { id: { in: [...new Set(input.items.map((item) => item.productId))] } } }),
  ]);
  const errors: Record<string, string> = {};
  if (!company) errors.companyId = "请选择有效的发货方。";
  if (!customer) errors.customerId = "请选择有效的客户。";
  const productsById = new Map(products.map((product) => [product.id, product]));
  const oldItems = new Map(existing?.items.map((item) => [item.id, item]) ?? []);
  input.items.forEach((item, index) => {
    if (!productsById.has(item.productId)) errors[`items.${index}.productId`] = "请选择有效的产品。";
    if (item.itemId && !oldItems.has(item.itemId)) errors[`items.${index}.itemId`] = "送货明细身份无效。";
  });
  if (Object.keys(errors).length || !company || !customer) throw new SalesDeliveryNoteValidationError(errors);
  const sender = existing?.companyId === company.id ? {
    legalName: existing.senderLegalName, contactName: existing.senderContactName,
    phone: existing.senderPhone, address: existing.senderAddress,
  } : company;
  const items = input.items.map((item, sortOrder) => {
    const product = productsById.get(item.productId)!;
    const old = item.itemId ? oldItems.get(item.itemId) : undefined;
    const snapshot = old?.productId === item.productId ? {
      code: old.productCode, name: old.productName, specification: old.specification, unit: old.unit,
    } : product;
    return {
      ...(old ? { id: old.id } : {}),
      productId: item.productId, sortOrder,
      productCode: snapshot.code, productName: snapshot.name, specification: snapshot.specification, unit: snapshot.unit,
      quantity: new Prisma.Decimal(exactDeliveryQuantity(item.quantity)!),
      remark: item.remark,
    };
  });
  const { items: _items, ...header } = input;
  void _items;
  return {
    header: {
      ...header,
      deliveryDate: new Date(`${input.deliveryDate}T00:00:00.000Z`),
      senderLegalName: sender.legalName, senderContactName: sender.contactName,
      senderPhone: sender.phone, senderAddress: sender.address,
      customerLegalName: existing?.customerId === customer.id ? existing.customerLegalName : customer.legalName,
    },
    items,
  };
}
export function createSalesDeliveryNote(input: SalesDeliveryNoteInput) {
  return db.$transaction(async (tx) => {
    const data = await prepareNoteData(tx, input);
    return tx.salesDeliveryNote.create({
      data: { ...data.header, items: { create: data.items } },
      include: { items: { orderBy: { sortOrder: "asc" } } },
    });
  }, { isolationLevel: "Serializable" });
}
export function updateSalesDeliveryNote(id: string, input: SalesDeliveryNoteInput) {
  return db.$transaction(async (tx) => {
    const existing = await findForUpdate(tx, id);
    if (!existing) throw new SalesDeliveryNoteNotFoundError();
    if (existing.status !== "DRAFT") throw new SalesDeliveryNoteImmutableError();
    const data = await prepareNoteData(tx, input, existing);
    await tx.salesDeliveryNoteItem.deleteMany({ where: { salesDeliveryNoteId: id } });
    return tx.salesDeliveryNote.update({
      where: { id }, data: { ...data.header, items: { create: data.items } },
      include: { items: { orderBy: { sortOrder: "asc" } } },
    });
  }, { isolationLevel: "Serializable" });
}

function changeStatus(id: string, operation: SalesDeliveryNoteOperation) {
  return db.$transaction(async (tx) => {
    const existing = await findForUpdate(tx, id);
    if (!existing) throw new SalesDeliveryNoteNotFoundError();
    const allowed = operation === "finalize" ? existing.status === "DRAFT"
      : operation === "reopen" ? existing.status === "FINAL"
        : existing.status === "DRAFT" || existing.status === "FINAL";
    if (!allowed) throw new SalesDeliveryNoteImmutableError();
    if (operation === "finalize") {
      validatedInput({
        ...existing, deliveryDate: existing.deliveryDate.toISOString().slice(0, 10),
        items: existing.items.map((item) => ({
          itemId: item.id, productId: item.productId, quantity: item.quantity.toFixed(3), remark: item.remark,
        })),
      });
      if (!existing.senderLegalName.trim() || !existing.customerLegalName.trim() ||
        existing.items.some((item) => !item.productCode.trim() || !item.productName.trim() || !item.unit.trim() || !exactDeliveryQuantity(item.quantity.toString()))) {
        throw new SalesDeliveryNoteValidationError({ items: "送货单快照或明细不完整，无法定稿。" });
      }
    }
    return tx.salesDeliveryNote.update({
      where: { id }, data: { status: operation === "finalize" ? "FINAL" : operation === "reopen" ? "DRAFT" : "CANCELLED" },
    });
  }, { isolationLevel: "Serializable" });
}
export function finalizeSalesDeliveryNote(id: string) { return changeStatus(id, "finalize"); }
export function reopenSalesDeliveryNote(id: string) { return changeStatus(id, "reopen"); }
export function cancelSalesDeliveryNote(id: string) { return changeStatus(id, "cancel"); }
