import "server-only";

import { db } from "@/lib/db";
import type {
  ProductInput,
  ProductListItem,
  ProductRecord,
} from "@/lib/product";

export function listProducts(): Promise<ProductListItem[]> {
  return db.product.findMany({
    orderBy: [{ code: "asc" }, { name: "asc" }, { id: "asc" }],
    select: {
      id: true,
      code: true,
      name: true,
      specification: true,
      unit: true,
    },
  });
}

export function getProductById(id: string): Promise<ProductRecord | null> {
  return db.product.findUnique({ where: { id } });
}

export function createProduct(input: ProductInput): Promise<ProductRecord> {
  return db.product.create({ data: input });
}

export function updateProduct(
  id: string,
  input: ProductInput,
): Promise<ProductRecord> {
  return db.product.update({ where: { id }, data: input });
}
