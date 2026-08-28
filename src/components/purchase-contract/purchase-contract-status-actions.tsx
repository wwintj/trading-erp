"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  cancelPurchaseContractAction,
  finalizePurchaseContractAction,
  reopenPurchaseContractAction,
} from "@/app/purchase-contracts/actions";
import { Button } from "@/components/ui/button";
import type {
  PurchaseContractFormState,
  PurchaseContractStatus,
} from "@/lib/purchase-contract";
import { notifyPurchaseContract } from "@/lib/purchase-contract-feedback";

type StatusOperation = "finalize" | "reopen" | "cancel";

export const PURCHASE_CONTRACT_STATUS_CONFIRMATIONS: Record<
  StatusOperation,
  string
> = {
  finalize: "确认将采购合同定稿？定稿后合同内容不可修改。",
  reopen: "确认重新打开该采购合同？重新打开后合同将恢复为草稿状态并可继续修改。",
  cancel: "确认取消采购合同？取消后不可恢复。",
};

type StatusActionDependencies = {
  confirm: (message: string) => boolean;
  finalize: (contractId: string) => Promise<PurchaseContractFormState>;
  reopen: (contractId: string) => Promise<PurchaseContractFormState>;
  cancel: (contractId: string) => Promise<PurchaseContractFormState>;
};

export async function requestPurchaseContractStatusChange(
  contractId: string,
  operation: StatusOperation,
  dependencies: StatusActionDependencies,
) {
  if (!dependencies.confirm(PURCHASE_CONTRACT_STATUS_CONFIRMATIONS[operation])) {
    return null;
  }

  return dependencies[operation](contractId);
}

export function PurchaseContractStatusActions({
  contractId,
  status,
}: {
  contractId: string;
  status: PurchaseContractStatus;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run(operation: StatusOperation) {
    startTransition(async () => {
      const result = await requestPurchaseContractStatusChange(
        contractId,
        operation,
        {
          confirm: (message) => window.confirm(message),
          finalize: finalizePurchaseContractAction,
          reopen: reopenPurchaseContractAction,
          cancel: cancelPurchaseContractAction,
        },
      );
      if (!result) {
        return;
      }
      notifyPurchaseContract(result);
      if (result.status === "success") {
        router.refresh();
      }
    });
  }

  if (status === "CANCELLED") {
    return null;
  }

  return (
    <div className="mt-8 flex flex-wrap gap-3 border-t pt-6">
      {status === "DRAFT" ? (
        <Button type="button" disabled={pending} onClick={() => run("finalize")}>
          {pending ? "处理中…" : "定稿采购合同"}
        </Button>
      ) : null}
      {status === "FINAL" ? (
        <Button type="button" disabled={pending} onClick={() => run("reopen")}>
          {pending ? "处理中…" : "重新打开为草稿"}
        </Button>
      ) : null}
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        onClick={() => run("cancel")}
      >
        {pending ? "处理中…" : "取消采购合同"}
      </Button>
    </div>
  );
}
