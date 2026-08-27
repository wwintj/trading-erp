import "server-only";

import { db } from "@/lib/db";
import {
  type CompanyInput,
  type CompanyRecord,
  CompanySingletonViolationError,
  saveCompanySingleton,
  type CompanyTransactionRunner,
} from "@/lib/company";

const companyOrder = [{ createdAt: "asc" as const }, { id: "asc" as const }];

export async function getCompanySingleton(): Promise<CompanyRecord | null> {
  const companies = await db.company.findMany({
    orderBy: companyOrder,
    take: 2,
  });

  if (companies.length > 1) {
    throw new CompanySingletonViolationError();
  }

  return companies[0] ?? null;
}

const runSerializableCompanyTransaction: CompanyTransactionRunner = (operation) =>
  db.$transaction(
    async (transaction) =>
      operation({
        findFirstTwo: () =>
          transaction.company.findMany({
            orderBy: companyOrder,
            take: 2,
          }),
        create: (input: CompanyInput) =>
          transaction.company.create({ data: input }),
        update: (id: string, input: CompanyInput) =>
          transaction.company.update({ where: { id }, data: input }),
      }),
    { isolationLevel: "Serializable" },
  );

export function persistCompanySingleton(
  companyId: string | null,
  input: CompanyInput,
): Promise<CompanyRecord> {
  return saveCompanySingleton(
    companyId,
    input,
    runSerializableCompanyTransaction,
  );
}
