import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { PurchaseContractShell } from "@/components/purchase-contract/purchase-contract-shell";
import { Button } from "@/components/ui/button";
import { getCurrentSession } from "@/lib/auth-session";
import { getServerEnv } from "@/lib/env";
import {
  PURCHASE_CONTRACT_STATUS_LABELS,
  type PurchaseContractStatus,
} from "@/lib/purchase-contract";
import { listPurchaseContracts } from "@/lib/purchase-contract.server";

export const metadata: Metadata = { title: "采购合同" };

export default async function PurchaseContractsPage() {
  const session = await getCurrentSession();
  if (!session) {
    redirect("/login");
  }

  const { APP_NAME } = getServerEnv();
  const canEdit = session.user.role === "admin";
  const actions = (
    <>
      <Button variant="outline" size="sm" asChild>
        <Link href="/dashboard">返回仪表盘</Link>
      </Button>
      {canEdit ? (
        <Button size="sm" asChild>
          <Link href="/purchase-contracts/new">新建采购合同</Link>
        </Button>
      ) : null}
    </>
  );

  let contracts;
  try {
    contracts = await listPurchaseContracts();
  } catch {
    return (
      <PurchaseContractShell
        appName={APP_NAME}
        title="采购合同"
        description={session.user.email}
        actions={actions}
      >
        <p role="alert" className="text-sm text-red-700">
          采购合同信息暂时无法加载，请稍后重试。
        </p>
      </PurchaseContractShell>
    );
  }

  return (
    <PurchaseContractShell
      appName={APP_NAME}
      title="采购合同"
      description={session.user.email}
      actions={actions}
    >
      {contracts.length === 0 ? (
        <p className="text-sm text-neutral-600">暂无采购合同。</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b text-neutral-500">
                <th className="px-3 py-3 font-medium">合同编号</th>
                <th className="px-3 py-3 font-medium">签订日期</th>
                <th className="px-3 py-3 font-medium">卖方</th>
                <th className="px-3 py-3 font-medium">总金额（元）</th>
                <th className="px-3 py-3 font-medium">状态</th>
              </tr>
            </thead>
            <tbody>
              {contracts.map((contract) => (
                <tr
                  key={contract.id}
                  className="border-b transition-colors last:border-b-0 hover:bg-neutral-50 focus-within:bg-neutral-50"
                >
                  <td className="px-3 py-3 font-medium">
                    <ContractLink id={contract.id}>{contract.contractNo}</ContractLink>
                  </td>
                  <td className="px-3 py-3">{formatDate(contract.signingDate)}</td>
                  <td className="px-3 py-3">
                    <ContractLink id={contract.id}>
                      {contract.sellerLegalName}
                    </ContractLink>
                  </td>
                  <td className="px-3 py-3">{contract.totalAmount.toFixed(2)}</td>
                  <td className="px-3 py-3">
                    {PURCHASE_CONTRACT_STATUS_LABELS[
                      contract.status as PurchaseContractStatus
                    ]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PurchaseContractShell>
  );
}

function ContractLink({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <Link
      href={`/purchase-contracts/${id}`}
      className="cursor-pointer text-neutral-900 transition-colors hover:text-[#15803D] focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16A34A] focus-visible:ring-offset-2"
    >
      {children}
    </Link>
  );
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
