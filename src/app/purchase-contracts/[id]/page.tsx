import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import {
  PurchaseContractForm,
  type ContractFormValues,
} from "@/components/purchase-contract/purchase-contract-form";
import { PurchaseContractShell } from "@/components/purchase-contract/purchase-contract-shell";
import { PurchaseContractStatusActions } from "@/components/purchase-contract/purchase-contract-status-actions";
import { getCurrentSession } from "@/lib/auth-session";
import { getServerEnv } from "@/lib/env";
import {
  PURCHASE_CONTRACT_STATUS_LABELS,
  type PurchaseContractStatus,
} from "@/lib/purchase-contract";
import {
  getPurchaseContractById,
  getPurchaseContractFormOptions,
} from "@/lib/purchase-contract.server";

export const metadata: Metadata = { title: "采购合同" };

export default async function PurchaseContractPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getCurrentSession();
  if (!session) {
    redirect("/login");
  }

  const { id } = await params;
  const { APP_NAME } = getServerEnv();
  let contract;
  try {
    contract = await getPurchaseContractById(id);
  } catch {
    return <ContractLoadError appName={APP_NAME} email={session.user.email} />;
  }
  if (!contract) {
    notFound();
  }

  const status = contract.status as PurchaseContractStatus;
  const canManage = session.user.role === "admin";
  const canEdit = canManage && status === "DRAFT";
  let options = null;
  if (canEdit) {
    try {
      options = await getPurchaseContractFormOptions();
    } catch {
      return <ContractLoadError appName={APP_NAME} email={session.user.email} />;
    }
  }

  return (
    <PurchaseContractShell
      appName={APP_NAME}
      title={contract.contractNo}
      description={`${PURCHASE_CONTRACT_STATUS_LABELS[status]} · ${contract.sellerLegalName}`}
      actions={<ContractListLink />}
    >
      {canEdit && options ? (
        <PurchaseContractForm
          contractId={contract.id}
          initialValues={toFormValues(contract)}
          companies={options.companies}
          suppliers={options.suppliers}
          products={options.products}
        />
      ) : (
        <PurchaseContractDetails contract={contract} />
      )}
      {canManage ? (
        <PurchaseContractStatusActions contractId={contract.id} status={status} />
      ) : null}
    </PurchaseContractShell>
  );
}

function toFormValues(
  contract: NonNullable<Awaited<ReturnType<typeof getPurchaseContractById>>>,
): ContractFormValues {
  return {
    contractNo: contract.contractNo,
    signingDate: contract.signingDate.toISOString().slice(0, 10),
    signingPlace: contract.signingPlace,
    companyId: contract.companyId,
    supplierId: contract.supplierId,
    deliveryDate: contract.deliveryDate?.toISOString().slice(0, 10) ?? null,
    deliveryAddress: contract.deliveryAddress,
    deliveryContactName: contract.deliveryContactName,
    deliveryContactPhone: contract.deliveryContactPhone,
    packagingTerms: contract.packagingTerms,
    inspectionTerms: contract.inspectionTerms,
    paymentTerms: contract.paymentTerms,
    shippingMethod: contract.shippingMethod,
    breachTerms: contract.breachTerms,
    qualityTerms: contract.qualityTerms,
    changeTerms: contract.changeTerms,
    disputeTerms: contract.disputeTerms,
    additionalTerms: contract.additionalTerms,
    items: contract.items.map((item) => ({
      itemId: item.id,
      productId: item.productId,
      quantity: item.quantity.toString(),
      unitPrice: item.unitPrice.toString(),
    })),
  };
}

function PurchaseContractDetails({
  contract,
}: {
  contract: NonNullable<Awaited<ReturnType<typeof getPurchaseContractById>>>;
}) {
  const status = contract.status as PurchaseContractStatus;
  const fields = [
    ["合同编号", contract.contractNo],
    ["状态", PURCHASE_CONTRACT_STATUS_LABELS[status]],
    ["签订日期", contract.signingDate.toISOString().slice(0, 10)],
    ["签订地点", contract.signingPlace],
    ["买方", contract.buyerLegalName],
    ["买方统一社会信用代码", contract.buyerUnifiedCreditCode],
    ["买方联系人", contract.buyerContactName],
    ["买方电话", contract.buyerPhone],
    ["买方地址", contract.buyerAddress],
    ["买方开户行", contract.buyerBankName],
    ["买方银行账号", contract.buyerBankAccount],
    ["卖方", contract.sellerLegalName],
    ["卖方统一社会信用代码", contract.sellerUnifiedCreditCode],
    ["卖方联系人", contract.sellerContactName],
    ["卖方电话", contract.sellerPhone],
    ["卖方地址", contract.sellerAddress],
    ["卖方开户行", contract.sellerBankName],
    ["卖方银行账号", contract.sellerBankAccount],
    ["包装要求", contract.packagingTerms],
    ["交货日期", contract.deliveryDate?.toISOString().slice(0, 10)],
    ["收货地址", contract.deliveryAddress],
    ["收货人", contract.deliveryContactName],
    ["收货电话", contract.deliveryContactPhone],
    ["验收条款", contract.inspectionTerms],
    ["付款条款", contract.paymentTerms],
    ["运输方式", contract.shippingMethod],
    ["违约/迟延条款", contract.breachTerms],
    ["质量条款", contract.qualityTerms],
    ["变更条款", contract.changeTerms],
    ["争议解决", contract.disputeTerms],
    ["补充条款", contract.additionalTerms],
  ];

  return (
    <div className="space-y-8">
      <dl className="grid gap-5 text-sm sm:grid-cols-2">
        {fields.map(([label, value]) => (
          <div key={label} className="space-y-1">
            <dt className="font-medium text-neutral-500">{label}</dt>
            <dd className="whitespace-pre-wrap">{value || "—"}</dd>
          </div>
        ))}
      </dl>
      <section className="space-y-3">
        <h2 className="text-base font-semibold">合同明细</h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b text-neutral-500">
                <th className="px-3 py-3 font-medium">产品代码</th>
                <th className="px-3 py-3 font-medium">产品名称</th>
                <th className="px-3 py-3 font-medium">规格/型号</th>
                <th className="px-3 py-3 font-medium">数量</th>
                <th className="px-3 py-3 font-medium">单位</th>
                <th className="px-3 py-3 font-medium">单价（元）</th>
                <th className="px-3 py-3 font-medium">金额（元）</th>
              </tr>
            </thead>
            <tbody>
              {contract.items.map((item) => (
                <tr key={item.id} className="border-b last:border-b-0">
                  <td className="px-3 py-3">{item.productCode}</td>
                  <td className="px-3 py-3">{item.productName}</td>
                  <td className="px-3 py-3">{item.specification ?? "—"}</td>
                  <td className="px-3 py-3">{item.quantity.toFixed(3)}</td>
                  <td className="px-3 py-3">{item.unit}</td>
                  <td className="px-3 py-3">{item.unitPrice.toFixed(4)}</td>
                  <td className="px-3 py-3">{item.amount.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t font-semibold">
                <td className="px-3 py-3 text-right" colSpan={6}>合同总金额</td>
                <td className="px-3 py-3">{contract.totalAmount.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </div>
  );
}

function ContractLoadError({ appName, email }: { appName: string; email: string }) {
  return (
    <PurchaseContractShell
      appName={appName}
      title="采购合同"
      description={email}
      actions={<ContractListLink />}
    >
      <p role="alert" className="text-sm text-red-700">
        采购合同信息暂时无法加载，请稍后重试。
      </p>
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
