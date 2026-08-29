import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import {
  PurchaseContractForm,
  type ContractFormValues,
} from "@/components/purchase-contract/purchase-contract-form";
import { PurchaseContractShell } from "@/components/purchase-contract/purchase-contract-shell";
import { getCurrentSession } from "@/lib/auth-session";
import { getServerEnv } from "@/lib/env";
import {
  getPurchaseContractFormOptions,
  suggestPurchaseContractNumber,
} from "@/lib/purchase-contract.server";

export const metadata: Metadata = { title: "新建采购合同" };

export default async function NewPurchaseContractPage() {
  const session = await getCurrentSession();
  if (!session) {
    redirect("/login");
  }
  if (session.user.role !== "admin") {
    redirect("/purchase-contracts");
  }

  const { APP_NAME } = getServerEnv();
  let options;
  let contractNo;
  try {
    [options, contractNo] = await Promise.all([
      getPurchaseContractFormOptions(),
      suggestPurchaseContractNumber(),
    ]);
  } catch {
    return (
      <PurchaseContractShell
        appName={APP_NAME}
        title="新建采购合同"
        description={session.user.email}
        actions={<ContractListLink />}
      >
        <p role="alert" className="text-sm text-red-700">
          新建采购合同所需信息暂时无法加载，请稍后重试。
        </p>
      </PurchaseContractShell>
    );
  }

  const initialValues: ContractFormValues = {
    contractNo,
    signingDate: new Date().toISOString().slice(0, 10),
    signingPlace: null,
    companyId: options.companies[0]?.id ?? "",
    supplierId: options.suppliers[0]?.id ?? "",
    deliveryDate: null,
    deliveryAddress: null,
    deliveryContactName: null,
    deliveryContactPhone: null,
    packagingTerms: null,
    inspectionTerms: null,
    paymentTerms: null,
    shippingMethod: null,
    breachTerms: null,
    qualityTerms: null,
    changeTerms: null,
    specialNotice: null,
    disputeTerms: null,
    additionalTerms: null,
    items: [
      {
        productId: options.products[0]?.id ?? "",
        quantity: "",
        unitPrice: "",
      },
    ],
  };

  return (
    <PurchaseContractShell
      appName={APP_NAME}
      title="新建采购合同"
      description={session.user.email}
      actions={<ContractListLink />}
    >
      <PurchaseContractForm
        contractId={null}
        initialValues={initialValues}
        companies={options.companies}
        suppliers={options.suppliers}
        products={options.products}
      />
    </PurchaseContractShell>
  );
}

function ContractListLink() {
  return (
    <Link
      href="/purchase-contracts"
      className="text-sm font-medium text-neutral-600 transition-colors hover:text-neutral-950 focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16A34A] focus-visible:ring-offset-2"
    >
      ← 返回采购合同列表
    </Link>
  );
}
