import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { CompanyForm } from "@/components/company/company-form";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentSession } from "@/lib/auth-session";
import {
  type CompanyInput,
  CompanySingletonViolationError,
} from "@/lib/company";
import { getCompanySingleton } from "@/lib/company.server";
import { getServerEnv } from "@/lib/env";

export const metadata: Metadata = {
  title: "Company",
};

const emptyCompany: CompanyInput = {
  legalName: "",
  shortName: null,
  unifiedCreditCode: null,
  contactName: null,
  phone: null,
  email: null,
  address: null,
  bankName: null,
  bankAccount: null,
};

export default async function CompanyPage() {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/login");
  }

  const { APP_NAME } = getServerEnv();
  const canEdit = session.user.role === "admin";

  let company;
  try {
    company = await getCompanySingleton();
  } catch (error) {
    const message =
      error instanceof CompanySingletonViolationError
        ? "Multiple Company records were found. Resolve the data integrity issue before continuing."
        : "Company information is temporarily unavailable.";

    return (
      <CompanyShell appName={APP_NAME} description={session.user.email}>
        <p role="alert" className="text-sm text-red-700">
          {message}
        </p>
      </CompanyShell>
    );
  }

  return (
    <CompanyShell appName={APP_NAME} description={session.user.email}>
      {!company && !canEdit ? (
        <p className="text-sm text-neutral-600">
          Company has not been configured yet. An administrator must create it.
        </p>
      ) : company && !canEdit ? (
        <CompanyDetails company={company} />
      ) : (
        <>
          <p className="mb-6 text-sm text-neutral-600">
            {company
              ? "Edit the single Company record used by Trading ERP."
              : "Create the single Company record used by Trading ERP."}
          </p>
          <CompanyForm
            companyId={company?.id ?? null}
            initialValues={company ?? emptyCompany}
          />
        </>
      )}
    </CompanyShell>
  );
}

function CompanyShell({
  appName,
  description,
  children,
}: {
  appName: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-12">
      <Card className="w-full">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1.5">
              <p className="text-sm font-medium text-neutral-500">{appName}</p>
              <CardTitle>Company</CardTitle>
              <CardDescription>{description}</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard">Back to Dashboard</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </main>
  );
}

function CompanyDetails({ company }: { company: CompanyInput }) {
  const fields = [
    ["Legal name / 公司全称", company.legalName],
    ["Short name / 公司简称", company.shortName],
    ["Unified social credit code / 统一社会信用代码", company.unifiedCreditCode],
    ["Contact name / 联系人", company.contactName],
    ["Phone / 电话", company.phone],
    ["Email / 邮箱", company.email],
    ["Address / 地址", company.address],
    ["Bank name / 开户行", company.bankName],
    ["Bank account / 银行账号", company.bankAccount],
  ];

  return (
    <dl className="grid gap-5 text-sm sm:grid-cols-2">
      {fields.map(([label, value]) => (
        <div key={label} className="space-y-1">
          <dt className="font-medium text-neutral-500">{label}</dt>
          <dd className="whitespace-pre-wrap">{value || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
