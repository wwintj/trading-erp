"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { savePurchaseContractAction } from "@/app/purchase-contracts/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  INITIAL_PURCHASE_CONTRACT_FORM_STATE,
  PURCHASE_CONTRACT_FIELD_LIMITS,
  PURCHASE_CONTRACT_SAVE_INTENTS,
  calculateExactContractItemAmount,
  calculateExactContractTotal,
  type PurchaseContractInput,
} from "@/lib/purchase-contract";
import { notifyPurchaseContract } from "@/lib/purchase-contract-feedback";

export type ContractCompanyOption = { id: string; legalName: string };
export type ContractSupplierOption = {
  id: string;
  code: string;
  legalName: string;
};
export type ContractProductOption = {
  id: string;
  code: string;
  name: string;
  specification: string | null;
  unit: string;
};

export type ContractFormItem = {
  itemId?: string;
  productId: string;
  quantity: string;
  unitPrice: string;
};

export type ContractFormValues = Omit<PurchaseContractInput, "items"> & {
  items: ContractFormItem[];
};

type FormRow = ContractFormItem & { key: number };

export const PURCHASE_CONTRACT_SUPPLIER_REFRESH_CONFIRMATION =
  "将使用当前供应商主档覆盖本草稿中的卖方名称、地址、电话、联系人及银行资料。合同其它内容不会改变。是否继续？";

export function confirmPurchaseContractSupplierRefresh(
  confirm: (message: string) => boolean,
) {
  return confirm(PURCHASE_CONTRACT_SUPPLIER_REFRESH_CONFIRMATION);
}

export function PurchaseContractForm({
  contractId,
  initialValues,
  companies,
  suppliers,
  products,
}: {
  contractId: string | null;
  initialValues: ContractFormValues;
  companies: ContractCompanyOption[];
  suppliers: ContractSupplierOption[];
  products: ContractProductOption[];
}) {
  const router = useRouter();
  const nextKey = useRef(initialValues.items.length);
  const [rows, setRows] = useState<FormRow[]>(() =>
    initialValues.items.map((item, index) => ({ ...item, key: index })),
  );
  const [state, formAction, pending] = useActionState(
    savePurchaseContractAction,
    INITIAL_PURCHASE_CONTRACT_FORM_STATE,
  );

  useEffect(() => {
    notifyPurchaseContract(state);
    if (!contractId && state.status === "success" && state.contractId) {
      router.replace(`/purchase-contracts/${state.contractId}`);
    }
  }, [contractId, router, state]);

  function updateRow(index: number, values: Partial<ContractFormItem>) {
    setRows((current) =>
      current.map((row, rowIndex) =>
        rowIndex === index ? { ...row, ...values } : row,
      ),
    );
  }

  function addRow() {
    const productId = products[0]?.id ?? "";
    setRows((current) => [
      ...current,
      { key: nextKey.current++, productId, quantity: "", unitPrice: "" },
    ]);
  }

  function removeRow(index: number) {
    setRows((current) =>
      current.length === 1
        ? current
        : current.filter((_, rowIndex) => rowIndex !== index),
    );
  }

  const serializedItems = JSON.stringify(
    rows.map(({ itemId, productId, quantity, unitPrice }) => ({
      ...(itemId ? { itemId } : {}),
      productId,
      quantity,
      unitPrice,
    })),
  );
  const displayedTotal = calculateExactContractTotal(rows)?.totalAmount ?? "—";

  return (
    <form action={formAction} className="space-y-8">
      {contractId ? <input type="hidden" name="contractId" value={contractId} /> : null}
      <input type="hidden" name="itemsJson" value={serializedItems} />

      <FormSection title="基本信息">
        <FormField label="合同编号" error={state.fieldErrors?.contractNo}>
          <Input
            name="contractNo"
            defaultValue={initialValues.contractNo}
            maxLength={PURCHASE_CONTRACT_FIELD_LIMITS.contractNo}
            required
            disabled={pending}
          />
        </FormField>
        <FormField label="签订日期" error={state.fieldErrors?.signingDate}>
          <Input
            name="signingDate"
            type="date"
            defaultValue={initialValues.signingDate}
            required
            disabled={pending}
          />
        </FormField>
        <FormField label="签订地点" error={state.fieldErrors?.signingPlace}>
          <Input
            name="signingPlace"
            defaultValue={initialValues.signingPlace ?? ""}
            maxLength={PURCHASE_CONTRACT_FIELD_LIMITS.signingPlace}
            disabled={pending}
          />
        </FormField>
      </FormSection>

      <FormSection title="买卖双方">
        <FormField label="买方" error={state.fieldErrors?.companyId}>
          <NativeSelect
            name="companyId"
            defaultValue={initialValues.companyId}
            disabled={pending}
          >
            <option value="">请选择买方</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.legalName}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField label="卖方" error={state.fieldErrors?.supplierId}>
          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-0 flex-1">
              <NativeSelect
                name="supplierId"
                defaultValue={initialValues.supplierId}
                disabled={pending}
              >
                <option value="">请选择卖方</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.code} — {supplier.legalName}
                  </option>
                ))}
              </NativeSelect>
            </div>
            {contractId ? (
              <Button
                type="submit"
                name="intent"
                value={PURCHASE_CONTRACT_SAVE_INTENTS.refreshSupplierSnapshot}
                variant="outline"
                disabled={pending}
                onClick={(event) => {
                  if (
                    !confirmPurchaseContractSupplierRefresh((message) =>
                      window.confirm(message),
                    )
                  ) {
                    event.preventDefault();
                  }
                }}
              >
                更新供应商资料
              </Button>
            ) : null}
          </div>
        </FormField>
      </FormSection>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold">合同明细</h2>
          <Button type="button" variant="outline" size="sm" onClick={addRow} disabled={pending}>
            添加明细
          </Button>
        </div>
        <FieldError message={state.fieldErrors?.items} />
        <div className="space-y-4">
          {rows.map((row, index) => {
            const product = products.find((option) => option.id === row.productId);
            const calculated = calculateExactContractItemAmount(
              row.quantity,
              row.unitPrice,
            );
            return (
              <div key={row.key} className="rounded-md border p-4">
                <div className="grid gap-4 lg:grid-cols-[2fr_1fr_1fr_1fr_auto] lg:items-start">
                  <FormField
                    label={`产品 ${index + 1}`}
                    error={state.fieldErrors?.[`items.${index}.productId`]}
                  >
                    <NativeSelect
                      value={row.productId}
                      onChange={(event) =>
                        updateRow(index, { productId: event.target.value })
                      }
                      disabled={pending}
                    >
                      <option value="">请选择产品</option>
                      {products.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.code} — {option.name}
                        </option>
                      ))}
                    </NativeSelect>
                  </FormField>
                  <FormField
                    label="数量"
                    error={state.fieldErrors?.[`items.${index}.quantity`]}
                  >
                    <Input
                      inputMode="decimal"
                      value={row.quantity}
                      onChange={(event) => updateRow(index, { quantity: event.target.value })}
                      disabled={pending}
                    />
                  </FormField>
                  <FormField
                    label="单价（元）"
                    error={state.fieldErrors?.[`items.${index}.unitPrice`]}
                  >
                    <Input
                      inputMode="decimal"
                      value={row.unitPrice}
                      onChange={(event) => updateRow(index, { unitPrice: event.target.value })}
                      disabled={pending}
                    />
                  </FormField>
                  <div className="space-y-2">
                    <Label>金额（元）</Label>
                    <p className="h-9 rounded-md border bg-neutral-50 px-3 py-2 text-sm">
                      {calculated?.amount ?? "—"}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => removeRow(index)}
                    disabled={pending || rows.length === 1}
                  >
                    删除行
                  </Button>
                </div>
                {product ? (
                  <p className="mt-3 text-xs text-neutral-500">
                    {product.code} · {product.name} · {product.specification ?? "无规格/型号"} · {product.unit}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
        <p className="text-right text-sm font-semibold">
          合同总金额（元）：{displayedTotal}
        </p>
      </section>

      <FormSection title="交货与验收">
        <FormField label="包装要求" error={state.fieldErrors?.packagingTerms} wide>
          <ContractTextarea name="packagingTerms" value={initialValues.packagingTerms} disabled={pending} />
        </FormField>
        <FormField label="交货日期" error={state.fieldErrors?.deliveryDate}>
          <Input name="deliveryDate" type="date" defaultValue={initialValues.deliveryDate ?? ""} disabled={pending} />
        </FormField>
        <FormField label="收货地址" error={state.fieldErrors?.deliveryAddress} wide>
          <ContractTextarea name="deliveryAddress" value={initialValues.deliveryAddress} disabled={pending} />
        </FormField>
        <FormField label="收货人" error={state.fieldErrors?.deliveryContactName}>
          <Input name="deliveryContactName" defaultValue={initialValues.deliveryContactName ?? ""} maxLength={PURCHASE_CONTRACT_FIELD_LIMITS.deliveryContactName} disabled={pending} />
        </FormField>
        <FormField label="收货电话" error={state.fieldErrors?.deliveryContactPhone}>
          <Input name="deliveryContactPhone" defaultValue={initialValues.deliveryContactPhone ?? ""} maxLength={PURCHASE_CONTRACT_FIELD_LIMITS.deliveryContactPhone} disabled={pending} />
        </FormField>
        <FormField label="验收条款" error={state.fieldErrors?.inspectionTerms} wide>
          <ContractTextarea name="inspectionTerms" value={initialValues.inspectionTerms} disabled={pending} />
        </FormField>
      </FormSection>

      <FormSection title="付款与运输">
        <FormField label="付款条款" error={state.fieldErrors?.paymentTerms} wide>
          <ContractTextarea name="paymentTerms" value={initialValues.paymentTerms} disabled={pending} />
        </FormField>
        <FormField label="运输方式" error={state.fieldErrors?.shippingMethod} wide>
          <ContractTextarea name="shippingMethod" value={initialValues.shippingMethod} disabled={pending} />
        </FormField>
      </FormSection>

      <FormSection title="合同条款">
        {([
          ["breachTerms", "违约/迟延条款"],
          ["qualityTerms", "质量条款"],
          ["changeTerms", "合同变更"],
          ["disputeTerms", "争议解决"],
          ["additionalTerms", "补充条款"],
        ] as const).map(([name, label]) => (
          <FormField key={name} label={label} error={state.fieldErrors?.[name]} wide>
            <ContractTextarea name={name} value={initialValues[name]} disabled={pending} />
          </FormField>
        ))}
        <FormField
          label="特别注意"
          error={state.fieldErrors?.specialNotice}
          wide
        >
          <ContractTextarea
            name="specialNotice"
            value={initialValues.specialNotice}
            disabled={pending}
          />
          <p className="text-sm text-neutral-500">
            可选。填写后将在采购合同 PDF 中以加粗重点说明显示。
          </p>
        </FormField>
      </FormSection>

      <div className="flex flex-wrap items-center gap-3 border-t pt-6">
        <Button variant="outline" asChild>
          <Link href="/purchase-contracts">取消</Link>
        </Button>
        <Button
          type="submit"
          name="intent"
          value={PURCHASE_CONTRACT_SAVE_INTENTS.save}
          disabled={pending}
        >
          {pending
            ? contractId
              ? "正在保存…"
              : "正在创建…"
            : contractId
              ? "保存采购合同"
              : "创建采购合同"}
        </Button>
      </div>
    </form>
  );
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="border-b pb-2 text-base font-semibold">{title}</h2>
      <div className="grid gap-5 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function FormField({
  label,
  error,
  wide = false,
  children,
}: {
  label: string;
  error?: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`space-y-2${wide ? " sm:col-span-2" : ""}`}>
      <Label>{label}</Label>
      {children}
      <FieldError message={error} />
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  return <p className="min-h-5 text-sm text-red-700">{message}</p>;
}

function NativeSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className="h-9 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#16A34A] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      {...props}
    />
  );
}

function ContractTextarea({
  name,
  value,
  disabled,
}: {
  name: keyof typeof PURCHASE_CONTRACT_FIELD_LIMITS;
  value: string | null;
  disabled: boolean;
}) {
  return (
    <Textarea
      name={name}
      defaultValue={value ?? ""}
      maxLength={PURCHASE_CONTRACT_FIELD_LIMITS[name]}
      disabled={disabled}
    />
  );
}
