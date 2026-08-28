import "server-only";

import { db } from "@/lib/db";
import type {
  SupplierInput,
  SupplierListItem,
  SupplierRecord,
} from "@/lib/supplier";

export function listSuppliers(): Promise<SupplierListItem[]> {
  return db.supplier.findMany({
    orderBy: [{ code: "asc" }, { legalName: "asc" }, { id: "asc" }],
    select: {
      id: true,
      code: true,
      legalName: true,
      shortName: true,
      contactName: true,
      phone: true,
    },
  });
}

export function getSupplierById(id: string): Promise<SupplierRecord | null> {
  return db.supplier.findUnique({ where: { id } });
}

export function createSupplier(input: SupplierInput): Promise<SupplierRecord> {
  return db.supplier.create({ data: input });
}

export function updateSupplier(
  id: string,
  input: SupplierInput,
): Promise<SupplierRecord> {
  return db.supplier.update({ where: { id }, data: input });
}
