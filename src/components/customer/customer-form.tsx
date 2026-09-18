"use client";

import { useActionState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { saveCustomerAction } from "@/app/customers/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  CUSTOMER_FIELD_LIMITS,
  INITIAL_CUSTOMER_FORM_STATE,
  type CustomerField,
  type CustomerInput,
} from "@/lib/customer";
import { notifyCustomerSave } from "@/lib/customer-feedback";

export function CustomerForm({
  customerId,
  initialValues,
}: {
  customerId: string | null;
  initialValues: CustomerInput;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    saveCustomerAction,
    INITIAL_CUSTOMER_FORM_STATE,
  );

  useEffect(() => {
    notifyCustomerSave(state);

    if (!customerId && state.status === "success" && state.customerId) {
      router.replace(`/customers/${state.customerId}`);
    }
  }, [customerId, router, state]);

  return (
    <form action={formAction} className="space-y-8">
      {customerId ? (
        <input type="hidden" name="customerId" value={customerId} />
      ) : null}

      <FormSection title="基本信息">
        <CustomerInputField
          field="code"
          label="客户代码"
          value={initialValues.code}
          required
          pending={pending}
          error={state.fieldErrors?.code}
        />
        <CustomerInputField
          field="legalName"
          label="公司全称"
          value={initialValues.legalName}
          required
          pending={pending}
          error={state.fieldErrors?.legalName}
        />
        <CustomerInputField
          field="shortName"
          label="公司简称"
          value={initialValues.shortName}
          pending={pending}
          error={state.fieldErrors?.shortName}
        />
        <CustomerInputField
          field="unifiedCreditCode"
          label="统一社会信用代码"
          value={initialValues.unifiedCreditCode}
          pending={pending}
          error={state.fieldErrors?.unifiedCreditCode}
        />
      </FormSection>

      <FormSection title="联系信息">
        <CustomerInputField
          field="contactName"
          label="联系人"
          value={initialValues.contactName}
          pending={pending}
          error={state.fieldErrors?.contactName}
        />
        <CustomerInputField
          field="phone"
          label="电话"
          type="tel"
          value={initialValues.phone}
          pending={pending}
          error={state.fieldErrors?.phone}
        />
        <CustomerInputField
          field="email"
          label="邮箱"
          type="email"
          value={initialValues.email}
          pending={pending}
          error={state.fieldErrors?.email}
        />
        <CustomerTextareaField
          field="address"
          label="地址"
          value={initialValues.address}
          pending={pending}
          error={state.fieldErrors?.address}
        />
      </FormSection>

      <FormSection title="默认收货信息">
        <CustomerInputField
          field="defaultDeliveryContactName"
          label="默认收货人"
          value={initialValues.defaultDeliveryContactName}
          pending={pending}
          error={state.fieldErrors?.defaultDeliveryContactName}
        />
        <CustomerInputField
          field="defaultDeliveryPhone"
          label="默认收货电话"
          type="tel"
          value={initialValues.defaultDeliveryPhone}
          pending={pending}
          error={state.fieldErrors?.defaultDeliveryPhone}
        />
        <CustomerTextareaField
          field="defaultDeliveryAddress"
          label="默认收货地址"
          value={initialValues.defaultDeliveryAddress}
          pending={pending}
          error={state.fieldErrors?.defaultDeliveryAddress}
        />
      </FormSection>

      <FormSection title="其它">
        <CustomerTextareaField
          field="notes"
          label="备注"
          value={initialValues.notes}
          pending={pending}
          error={state.fieldErrors?.notes}
        />
      </FormSection>

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <Button variant="outline" asChild>
          <Link href="/customers">取消</Link>
        </Button>
        <Button type="submit" variant="default" disabled={pending}>
          {pending
            ? customerId
              ? "正在保存…"
              : "正在创建…"
            : customerId
              ? "保存客户"
              : "创建客户"}
        </Button>
      </div>
    </form>
  );
}

function FormSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <h2 className="border-b pb-2 text-base font-semibold text-neutral-900">
        {title}
      </h2>
      <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function CustomerInputField({
  field,
  label,
  value,
  type = "text",
  required = false,
  pending,
  error,
}: {
  field: CustomerField;
  label: string;
  value: string | null;
  type?: "text" | "email" | "tel";
  required?: boolean;
  pending: boolean;
  error?: string;
}) {
  const inputId = `customer-${field}`;
  const errorId = `${inputId}-error`;

  return (
    <div className="space-y-2">
      <Label htmlFor={inputId}>
        {label}
        {required ? " *" : null}
      </Label>
      <Input
        id={inputId}
        name={field}
        type={type}
        defaultValue={value ?? ""}
        maxLength={CUSTOMER_FIELD_LIMITS[field]}
        required={required}
        disabled={pending}
        aria-invalid={Boolean(error)}
        aria-describedby={errorId}
      />
      <FieldError id={errorId} message={error} />
    </div>
  );
}

function CustomerTextareaField({
  field,
  label,
  value,
  pending,
  error,
}: {
  field: "address" | "defaultDeliveryAddress" | "notes";
  label: string;
  value: string | null;
  pending: boolean;
  error?: string;
}) {
  const inputId = `customer-${field}`;
  const errorId = `${inputId}-error`;

  return (
    <div className="space-y-2 sm:col-span-2">
      <Label htmlFor={inputId}>{label}</Label>
      <Textarea
        id={inputId}
        name={field}
        defaultValue={value ?? ""}
        maxLength={CUSTOMER_FIELD_LIMITS[field]}
        disabled={pending}
        aria-invalid={Boolean(error)}
        aria-describedby={errorId}
      />
      <FieldError id={errorId} message={error} />
    </div>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  return (
    <p id={id} className="min-h-5 text-sm text-red-700">
      {message}
    </p>
  );
}
