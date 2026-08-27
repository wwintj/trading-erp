"use client";

import { useActionState, useEffect } from "react";

import { saveCompanyAction } from "@/app/company/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  COMPANY_FIELD_LIMITS,
  INITIAL_COMPANY_FORM_STATE,
  type CompanyInput,
} from "@/lib/company";
import { notifyCompanySave } from "@/lib/company-feedback";

type CompanyFormProps = {
  companyId: string | null;
  initialValues: CompanyInput;
};

export function CompanyForm({ companyId, initialValues }: CompanyFormProps) {
  const [state, formAction, pending] = useActionState(
    saveCompanyAction,
    INITIAL_COMPANY_FORM_STATE,
  );

  useEffect(() => {
    notifyCompanySave(state);
  }, [state]);

  return (
    <form action={formAction} className="space-y-5">
      {companyId ? (
        <input type="hidden" name="companyId" value={companyId} />
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="legal-name">Legal name / 公司全称</Label>
        <Input
          id="legal-name"
          name="legalName"
          defaultValue={initialValues.legalName}
          maxLength={COMPANY_FIELD_LIMITS.legalName}
          required
          disabled={pending}
          aria-invalid={Boolean(state.fieldErrors?.legalName)}
          aria-describedby="legal-name-error"
        />
        <FieldError id="legal-name-error" message={state.fieldErrors?.legalName} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="short-name">Short name / 公司简称</Label>
        <Input
          id="short-name"
          name="shortName"
          defaultValue={initialValues.shortName ?? ""}
          maxLength={COMPANY_FIELD_LIMITS.shortName}
          disabled={pending}
          aria-invalid={Boolean(state.fieldErrors?.shortName)}
          aria-describedby="short-name-error"
        />
        <FieldError id="short-name-error" message={state.fieldErrors?.shortName} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="unified-credit-code">
          Unified social credit code / 统一社会信用代码
        </Label>
        <Input
          id="unified-credit-code"
          name="unifiedCreditCode"
          defaultValue={initialValues.unifiedCreditCode ?? ""}
          maxLength={COMPANY_FIELD_LIMITS.unifiedCreditCode}
          disabled={pending}
          aria-invalid={Boolean(state.fieldErrors?.unifiedCreditCode)}
          aria-describedby="unified-credit-code-error"
        />
        <FieldError
          id="unified-credit-code-error"
          message={state.fieldErrors?.unifiedCreditCode}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="contact-name">Contact name / 联系人</Label>
        <Input
          id="contact-name"
          name="contactName"
          defaultValue={initialValues.contactName ?? ""}
          maxLength={COMPANY_FIELD_LIMITS.contactName}
          disabled={pending}
          aria-invalid={Boolean(state.fieldErrors?.contactName)}
          aria-describedby="contact-name-error"
        />
        <FieldError id="contact-name-error" message={state.fieldErrors?.contactName} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone">Phone / 电话</Label>
        <Input
          id="phone"
          name="phone"
          type="tel"
          defaultValue={initialValues.phone ?? ""}
          maxLength={COMPANY_FIELD_LIMITS.phone}
          disabled={pending}
          aria-invalid={Boolean(state.fieldErrors?.phone)}
          aria-describedby="phone-error"
        />
        <FieldError id="phone-error" message={state.fieldErrors?.phone} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="company-email">Email / 邮箱</Label>
        <Input
          id="company-email"
          name="email"
          type="email"
          defaultValue={initialValues.email ?? ""}
          maxLength={COMPANY_FIELD_LIMITS.email}
          disabled={pending}
          aria-invalid={Boolean(state.fieldErrors?.email)}
          aria-describedby="company-email-error"
        />
        <FieldError id="company-email-error" message={state.fieldErrors?.email} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="address">Address / 地址</Label>
        <Textarea
          id="address"
          name="address"
          defaultValue={initialValues.address ?? ""}
          maxLength={COMPANY_FIELD_LIMITS.address}
          disabled={pending}
          aria-invalid={Boolean(state.fieldErrors?.address)}
          aria-describedby="address-error"
        />
        <FieldError id="address-error" message={state.fieldErrors?.address} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="bank-name">Bank name / 开户行</Label>
        <Input
          id="bank-name"
          name="bankName"
          defaultValue={initialValues.bankName ?? ""}
          maxLength={COMPANY_FIELD_LIMITS.bankName}
          disabled={pending}
          aria-invalid={Boolean(state.fieldErrors?.bankName)}
          aria-describedby="bank-name-error"
        />
        <FieldError id="bank-name-error" message={state.fieldErrors?.bankName} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="bank-account">Bank account / 银行账号</Label>
        <Input
          id="bank-account"
          name="bankAccount"
          defaultValue={initialValues.bankAccount ?? ""}
          maxLength={COMPANY_FIELD_LIMITS.bankAccount}
          disabled={pending}
          aria-invalid={Boolean(state.fieldErrors?.bankAccount)}
          aria-describedby="bank-account-error"
        />
        <FieldError id="bank-account-error" message={state.fieldErrors?.bankAccount} />
      </div>

      <Button type="submit" variant="default" disabled={pending}>
        {pending ? "Saving…" : companyId ? "Save Company" : "Create Company"}
      </Button>
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
