"use client";

import { useActionState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { saveSupplierAction } from "@/app/suppliers/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  INITIAL_SUPPLIER_FORM_STATE,
  SUPPLIER_FIELD_LIMITS,
  type SupplierInput,
} from "@/lib/supplier";
import { notifySupplierSave } from "@/lib/supplier-feedback";

export function SupplierForm({
  supplierId,
  initialValues,
}: {
  supplierId: string | null;
  initialValues: SupplierInput;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    saveSupplierAction,
    INITIAL_SUPPLIER_FORM_STATE,
  );

  useEffect(() => {
    notifySupplierSave(state);

    if (!supplierId && state.status === "success" && state.supplierId) {
      router.replace(`/suppliers/${state.supplierId}`);
    }
  }, [router, state, supplierId]);

  return (
    <form action={formAction} className="space-y-5">
      {supplierId ? (
        <input type="hidden" name="supplierId" value={supplierId} />
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="supplier-code">供应商代码</Label>
        <Input
          id="supplier-code"
          name="code"
          defaultValue={initialValues.code}
          maxLength={SUPPLIER_FIELD_LIMITS.code}
          required
          disabled={pending}
          aria-invalid={Boolean(state.fieldErrors?.code)}
          aria-describedby="supplier-code-error"
        />
        <FieldError id="supplier-code-error" message={state.fieldErrors?.code} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="supplier-legal-name">公司全称</Label>
        <Input
          id="supplier-legal-name"
          name="legalName"
          defaultValue={initialValues.legalName}
          maxLength={SUPPLIER_FIELD_LIMITS.legalName}
          required
          disabled={pending}
          aria-invalid={Boolean(state.fieldErrors?.legalName)}
          aria-describedby="supplier-legal-name-error"
        />
        <FieldError
          id="supplier-legal-name-error"
          message={state.fieldErrors?.legalName}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="supplier-short-name">公司简称</Label>
        <Input
          id="supplier-short-name"
          name="shortName"
          defaultValue={initialValues.shortName ?? ""}
          maxLength={SUPPLIER_FIELD_LIMITS.shortName}
          disabled={pending}
          aria-invalid={Boolean(state.fieldErrors?.shortName)}
          aria-describedby="supplier-short-name-error"
        />
        <FieldError
          id="supplier-short-name-error"
          message={state.fieldErrors?.shortName}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="supplier-unified-credit-code">统一社会信用代码</Label>
        <Input
          id="supplier-unified-credit-code"
          name="unifiedCreditCode"
          defaultValue={initialValues.unifiedCreditCode ?? ""}
          maxLength={SUPPLIER_FIELD_LIMITS.unifiedCreditCode}
          disabled={pending}
          aria-invalid={Boolean(state.fieldErrors?.unifiedCreditCode)}
          aria-describedby="supplier-unified-credit-code-error"
        />
        <FieldError
          id="supplier-unified-credit-code-error"
          message={state.fieldErrors?.unifiedCreditCode}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="supplier-contact-name">联系人</Label>
        <Input
          id="supplier-contact-name"
          name="contactName"
          defaultValue={initialValues.contactName ?? ""}
          maxLength={SUPPLIER_FIELD_LIMITS.contactName}
          disabled={pending}
          aria-invalid={Boolean(state.fieldErrors?.contactName)}
          aria-describedby="supplier-contact-name-error"
        />
        <FieldError
          id="supplier-contact-name-error"
          message={state.fieldErrors?.contactName}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="supplier-phone">电话</Label>
        <Input
          id="supplier-phone"
          name="phone"
          type="tel"
          defaultValue={initialValues.phone ?? ""}
          maxLength={SUPPLIER_FIELD_LIMITS.phone}
          disabled={pending}
          aria-invalid={Boolean(state.fieldErrors?.phone)}
          aria-describedby="supplier-phone-error"
        />
        <FieldError id="supplier-phone-error" message={state.fieldErrors?.phone} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="supplier-email">邮箱</Label>
        <Input
          id="supplier-email"
          name="email"
          type="email"
          defaultValue={initialValues.email ?? ""}
          maxLength={SUPPLIER_FIELD_LIMITS.email}
          disabled={pending}
          aria-invalid={Boolean(state.fieldErrors?.email)}
          aria-describedby="supplier-email-error"
        />
        <FieldError id="supplier-email-error" message={state.fieldErrors?.email} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="supplier-address">地址</Label>
        <Textarea
          id="supplier-address"
          name="address"
          defaultValue={initialValues.address ?? ""}
          maxLength={SUPPLIER_FIELD_LIMITS.address}
          disabled={pending}
          aria-invalid={Boolean(state.fieldErrors?.address)}
          aria-describedby="supplier-address-error"
        />
        <FieldError
          id="supplier-address-error"
          message={state.fieldErrors?.address}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="supplier-bank-name">开户行</Label>
        <Input
          id="supplier-bank-name"
          name="bankName"
          defaultValue={initialValues.bankName ?? ""}
          maxLength={SUPPLIER_FIELD_LIMITS.bankName}
          disabled={pending}
          aria-invalid={Boolean(state.fieldErrors?.bankName)}
          aria-describedby="supplier-bank-name-error"
        />
        <FieldError
          id="supplier-bank-name-error"
          message={state.fieldErrors?.bankName}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="supplier-bank-account">银行账号</Label>
        <Input
          id="supplier-bank-account"
          name="bankAccount"
          defaultValue={initialValues.bankAccount ?? ""}
          maxLength={SUPPLIER_FIELD_LIMITS.bankAccount}
          disabled={pending}
          aria-invalid={Boolean(state.fieldErrors?.bankAccount)}
          aria-describedby="supplier-bank-account-error"
        />
        <FieldError
          id="supplier-bank-account-error"
          message={state.fieldErrors?.bankAccount}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="supplier-notes">备注</Label>
        <Textarea
          id="supplier-notes"
          name="notes"
          defaultValue={initialValues.notes ?? ""}
          maxLength={SUPPLIER_FIELD_LIMITS.notes}
          disabled={pending}
          aria-invalid={Boolean(state.fieldErrors?.notes)}
          aria-describedby="supplier-notes-error"
        />
        <FieldError id="supplier-notes-error" message={state.fieldErrors?.notes} />
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <Button variant="outline" asChild>
          <Link href="/suppliers">取消</Link>
        </Button>
        <Button type="submit" variant="default" disabled={pending}>
          {pending
            ? supplierId
              ? "正在保存…"
              : "正在创建…"
            : supplierId
              ? "保存供应商"
              : "创建供应商"}
        </Button>
      </div>
    </form>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  return (
    <p id={id} className="min-h-5 text-sm text-red-700">
      {message}
    </p>
  );
}
