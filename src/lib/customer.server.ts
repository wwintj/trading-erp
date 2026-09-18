import "server-only";

import { db } from "@/lib/db";
import type {
  CustomerInput,
  CustomerListItem,
  CustomerRecord,
} from "@/lib/customer";

export function listCustomers(): Promise<CustomerListItem[]> {
  return db.customer.findMany({
    orderBy: [{ code: "asc" }, { legalName: "asc" }, { id: "asc" }],
    select: {
      id: true,
      code: true,
      legalName: true,
      shortName: true,
      contactName: true,
      phone: true,
      defaultDeliveryContactName: true,
    },
  });
}

export function getCustomerById(id: string): Promise<CustomerRecord | null> {
  return db.customer.findUnique({ where: { id } });
}

export function createCustomer(input: CustomerInput): Promise<CustomerRecord> {
  return db.customer.create({ data: input });
}

export function updateCustomer(
  id: string,
  input: CustomerInput,
): Promise<CustomerRecord> {
  return db.customer.update({ where: { id }, data: input });
}
