"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  cancelPurchaseContractAction,
  finalizePurchaseContractAction,
} from "@/app/purchase-contracts/actions";
import { Button } from "@/components/ui/button";
import type { PurchaseContractStatus } from "@/lib/purchase-contract";
import { notifyPurchaseContract } from "@/lib/purchase-contract-feedback";

export function PurchaseContractStatusActions({
  contractId,
  status,
}: {
  contractId: string;
  status: PurchaseContractStatus;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run(operation: "finalize" | "cancel") {
    const prompt =
      operation === "finalize"
        ? "确认将采购合同定稿？定稿后合同内容不可修改。"
        : "确认取消采购合同？取消后不可恢复。";
    if (!window.confirm(prompt)) {
      return;
    }

    startTransition(async () => {
      const result =
        operation === "finalize"
          ? await finalizePurchaseContractAction(contractId)
          : await cancelPurchaseContractAction(contractId);
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
