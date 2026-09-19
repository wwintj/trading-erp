"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { saveSalesDeliveryNoteAction } from "@/app/sales-delivery-notes/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  deliveryDefaults, INITIAL_SALES_DELIVERY_NOTE_FORM_STATE, SALES_DELIVERY_NOTE_FIELD_LIMITS,
  SALES_DELIVERY_NOTE_ITEM_REMARK_LIMIT,
  type DeliveryCustomerOption, type DeliveryFormItem, type DeliveryProductOption,
  type SalesDeliveryNoteFormValues, type SalesDeliveryNoteFormState,
} from "@/lib/sales-delivery-note";
import { notifySalesDeliveryNote } from "@/lib/sales-delivery-note-feedback";

export type DeliveryFormRow = DeliveryFormItem & { key: number };
export function synchronizeDeliveryRows(rows: DeliveryFormRow[], items: DeliveryFormItem[], allocate: () => number) {
  const byId = new Map(rows.filter((row) => row.itemId).map((row) => [row.itemId, row.key]));
  const used = new Set<number>();
  return items.map((item, index) => {
    const candidate = (item.itemId ? byId.get(item.itemId) : undefined) ?? rows[index]?.key;
    const key = candidate !== undefined && !used.has(candidate) ? candidate : allocate();
    used.add(key);
    return { ...item, key };
  });
}
export function deliveryRowProduct(row: DeliveryFormItem, products: DeliveryProductOption[]) {
  return row.snapshot?.id === row.productId ? row.snapshot : products.find((product) => product.id === row.productId);
}
export function removeDeliveryRow(rows: DeliveryFormRow[], index: number, products: DeliveryProductOption[], confirm: (message: string) => boolean) {
  const row = rows[index];
  if (!row) return rows;
  const product = deliveryRowProduct(row, products);
  if (row.productId && !confirm(`确定从本送货单中删除“${product ? product.code + " — " + product.name : row.productId}”吗？保存送货单后生效。`)) return rows;
  return rows.filter((_, current) => current !== index);
}
export function changeDeliveryCustomer(values: SalesDeliveryNoteFormValues, customerId: string, customers: DeliveryCustomerOption[]) {
  if (values.customerId === customerId) return values;
  return { ...values, customerId, ...deliveryDefaults(customers.find((customer) => customer.id === customerId)) };
}
export function deliverySaveNavigation(noteId: string | null, state: SalesDeliveryNoteFormState) {
  if (state.status !== "success") return null;
  return noteId ? { type: "refresh" as const } : state.noteId ? { type: "replace" as const, href: `/sales-delivery-notes/${state.noteId}` } : null;
}
const selectStyle = "h-9 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16A34A] disabled:opacity-50";
export function SalesDeliveryNoteForm({ noteId, initialValues, companies, customers, products }: {
  noteId: string | null;
  initialValues: SalesDeliveryNoteFormValues;
  companies: { id: string; legalName: string }[];
  customers: DeliveryCustomerOption[];
  products: DeliveryProductOption[];
}) {
  const router = useRouter();
  const [values, setValues] = useState(initialValues);
  const [rows, setRows] = useState<DeliveryFormRow[]>(() => initialValues.items.map((item, key) => ({ ...item, key })));
  const nextKey = useRef(rows.length);
  const [state, formAction, pending] = useActionState(saveSalesDeliveryNoteAction, INITIAL_SALES_DELIVERY_NOTE_FORM_STATE);
  const handled = useRef(state);
  useEffect(() => {
    if (pending || handled.current === state) return;
    handled.current = state;
    notifySalesDeliveryNote(state);
    // Sync the transaction's canonical result, including new IDs, without relying on remount.
    if (state.status === "success" && state.items) {
      setRows((current) => synchronizeDeliveryRows(current, state.items!, () => nextKey.current++));
    }
    const navigation = deliverySaveNavigation(noteId, state);
    if (navigation?.type === "refresh") router.refresh();
    else if (navigation?.type === "replace") router.replace(navigation.href);
  }, [noteId, pending, router, state]);

  function updateRow(index: number, update: Partial<DeliveryFormItem>) {
    setRows((current) => current.map((row, position) => position === index ? { ...row, ...update } : row));
  }
  function textField(field: keyof typeof SALES_DELIVERY_NOTE_FIELD_LIMITS | "deliveryDate", label: string, multiline = false) {
    const id = `delivery-${field}`;
    const props = {
      id, name: field, value: values[field] ?? "", disabled: pending,
      onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setValues((current) => ({ ...current, [field]: event.target.value })),
      "aria-invalid": Boolean(state.fieldErrors?.[field]), "aria-describedby": `${id}-error`,
      maxLength: field === "deliveryDate" ? undefined : SALES_DELIVERY_NOTE_FIELD_LIMITS[field],
    };
    return <Field id={id} label={label} error={state.fieldErrors?.[field]} wide={multiline}>
      {multiline ? <Textarea {...props} /> : <Input {...props} type={field === "deliveryDate" ? "date" : "text"} required={field === "deliveryDate" || field === "deliveryNo"} />}
    </Field>;
  }
  return (
    <form action={formAction} className="space-y-8" onSubmit={(event) => { if (pending || rows.length === 0) event.preventDefault(); }}>
      {noteId ? <input type="hidden" name="noteId" value={noteId} /> : null}
      <input type="hidden" name="itemsJson" value={JSON.stringify(rows.map(({ itemId, productId, quantity, remark }) => ({
        ...(itemId ? { itemId } : {}), productId, quantity, remark,
      })))} />
      <Section title="基本信息">
        {textField("deliveryNo", "送货单号")}
        {textField("deliveryDate", "送货日期")}
        <Field id="delivery-company" label="发货方" error={state.fieldErrors?.companyId}>
          <select id="delivery-company" name="companyId" className={selectStyle} value={values.companyId} disabled={pending} required aria-invalid={Boolean(state.fieldErrors?.companyId)} aria-describedby="delivery-company-error"
            onChange={(event) => setValues((current) => ({ ...current, companyId: event.target.value }))}>
            <option value="">请选择发货方</option>
            {companies.map((company) => <option key={company.id} value={company.id}>{company.legalName}</option>)}
          </select>
        </Field>
        <Field id="delivery-customer" label="客户" error={state.fieldErrors?.customerId}>
          <select id="delivery-customer" name="customerId" className={selectStyle} value={values.customerId} disabled={pending} required aria-invalid={Boolean(state.fieldErrors?.customerId)} aria-describedby="delivery-customer-error"
            onChange={(event) => setValues((current) => changeDeliveryCustomer(current, event.target.value, customers))}>
            <option value="">请选择客户</option>
            {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.code} — {customer.legalName}</option>)}
          </select>
          <p className="text-sm text-neutral-500">更换客户时会带入该客户当前的默认收货信息，之后可在本送货单中单独修改。</p>
        </Field>
        {textField("customerPoNo", "客户订单号 / PO No.")}
      </Section>
      <Section title="收货信息">
        {textField("deliveryContactName", "收货人")}
        {textField("deliveryContactPhone", "联系电话")}
        {textField("deliveryAddress", "收货地址", true)}
      </Section>
      <Section title="物流信息">
        {textField("shippingMethod", "运输方式")}
        {textField("logisticsCompany", "物流公司")}
        {textField("trackingNo", "物流单号")}
      </Section>
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold">送货明细</h2>
          <Button type="button" variant="outline" disabled={pending} onClick={() => {
            const key = nextKey.current++;
            setRows((current) => [...current, { key, productId: "", quantity: "", remark: null }]);
          }}>添加产品</Button>
        </div>
        <p role="alert" className="text-sm text-red-700">{state.fieldErrors?.items}</p>
        {rows.length === 0 ? (
          <div className="rounded-md border border-dashed p-6 text-center">
            <p>暂无送货明细</p>
            <p className="text-sm text-neutral-600">请点击“添加产品”添加至少一条送货明细。</p>
            <p role="alert" className="mt-3 text-sm text-red-700">请至少添加一条送货明细后再保存。</p>
          </div>
        ) : rows.map((row, index) => {
          const product = deliveryRowProduct(row, products);
          const fieldError = (field: string) => state.fieldErrors?.[`items.${index}.${field}`];
          const id = `delivery-item-${row.key}`;
          return <div key={row.key} className="space-y-4 rounded-md border p-4">
            <div className="flex items-start justify-between gap-4 border-b pb-4">
              <div>
                <p className="text-sm text-neutral-500">明细 {index + 1}</p>
                <p className="text-base font-semibold">{product ? `${product.code} — ${product.name}` : "尚未选择产品"}</p>
                {product ? <p className="text-sm text-neutral-600">规格/型号：{product.specification ?? "未填写"} · 单位：{product.unit}</p> : null}
              </div>
              <Button type="button" variant="outline" className="border-red-200 text-red-700 hover:bg-red-50 focus-visible:ring-red-600" disabled={pending}
                onClick={() => { const next = removeDeliveryRow(rows, index, products, (message) => window.confirm(message)); setRows(next); }}>删除明细</Button>
            </div>
            <p role="alert" className="text-sm text-red-700">{fieldError("itemId")}</p>
            <Field id={id} label="产品（可更换）" error={fieldError("productId")}>
              <select id={id} className={selectStyle} value={row.productId} disabled={pending} aria-invalid={Boolean(fieldError("productId"))} aria-describedby={`${id}-error`}
                onChange={(event) => updateRow(index, { productId: event.target.value })}>
                <option value="">请选择产品</option>
                {products.map((option) => <option key={option.id} value={option.id}>{option.code} — {option.name}</option>)}
              </select>
              <p className="text-sm text-neutral-500">选择其它产品即可更换本条送货明细。</p>
            </Field>
            <Field id={`${id}-quantity`} label="送货数量" error={fieldError("quantity")}>
              <Input id={`${id}-quantity`} inputMode="decimal" value={row.quantity} disabled={pending} aria-invalid={Boolean(fieldError("quantity"))} aria-describedby={`${id}-quantity-error`}
                onChange={(event) => updateRow(index, { quantity: event.target.value })} />
            </Field>
            <Field id={`${id}-remark`} label="明细备注" error={fieldError("remark")}>
              <Textarea id={`${id}-remark`} value={row.remark ?? ""} disabled={pending} maxLength={SALES_DELIVERY_NOTE_ITEM_REMARK_LIMIT} aria-invalid={Boolean(fieldError("remark"))} aria-describedby={`${id}-remark-error`}
                onChange={(event) => updateRow(index, { remark: event.target.value })} />
            </Field>
          </div>;
        })}
      </section>
      <Section title="备注">{textField("notes", "备注", true)}</Section>
      <div className="flex gap-3">
        <Button variant="outline" asChild><Link href="/sales-delivery-notes">取消</Link></Button>
        <Button type="submit" disabled={pending || rows.length === 0}>{pending ? "正在保存…" : noteId ? "保存销售送货单" : "创建销售送货单"}</Button>
      </div>
    </form>
  );
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="space-y-4"><h2 className="border-b pb-2 text-base font-semibold">{title}</h2><div className="grid gap-4 sm:grid-cols-2">{children}</div></section>;
}
function Field({ id, label, error, wide, children }: { id: string; label: string; error?: string; wide?: boolean; children: React.ReactNode }) {
  return <div className={wide ? "space-y-2 sm:col-span-2" : "space-y-2"}>
    <label htmlFor={id} className="text-sm font-medium">{label}</label>{children}
    <p id={`${id}-error`} className="min-h-5 text-sm text-red-700">{error}</p>
  </div>;
}
