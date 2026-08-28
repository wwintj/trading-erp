"use client";

import { useActionState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { saveProductAction } from "@/app/products/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  INITIAL_PRODUCT_FORM_STATE,
  PRODUCT_FIELD_LIMITS,
  type ProductInput,
} from "@/lib/product";
import { notifyProductSave } from "@/lib/product-feedback";

export function ProductForm({
  productId,
  initialValues,
}: {
  productId: string | null;
  initialValues: ProductInput;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    saveProductAction,
    INITIAL_PRODUCT_FORM_STATE,
  );

  useEffect(() => {
    notifyProductSave(state);

    if (!productId && state.status === "success" && state.productId) {
      router.replace(`/products/${state.productId}`);
    }
  }, [productId, router, state]);

  return (
    <form action={formAction} className="space-y-5">
      {productId ? (
        <input type="hidden" name="productId" value={productId} />
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="product-code">产品代码</Label>
        <Input
          id="product-code"
          name="code"
          defaultValue={initialValues.code}
          maxLength={PRODUCT_FIELD_LIMITS.code}
          required
          disabled={pending}
          aria-invalid={Boolean(state.fieldErrors?.code)}
          aria-describedby="product-code-error"
        />
        <FieldError id="product-code-error" message={state.fieldErrors?.code} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="product-name">产品名称</Label>
        <Input
          id="product-name"
          name="name"
          defaultValue={initialValues.name}
          maxLength={PRODUCT_FIELD_LIMITS.name}
          required
          disabled={pending}
          aria-invalid={Boolean(state.fieldErrors?.name)}
          aria-describedby="product-name-error"
        />
        <FieldError id="product-name-error" message={state.fieldErrors?.name} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="product-specification">规格/型号</Label>
        <Input
          id="product-specification"
          name="specification"
          defaultValue={initialValues.specification ?? ""}
          maxLength={PRODUCT_FIELD_LIMITS.specification}
          disabled={pending}
          aria-invalid={Boolean(state.fieldErrors?.specification)}
          aria-describedby="product-specification-error"
        />
        <FieldError
          id="product-specification-error"
          message={state.fieldErrors?.specification}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="product-unit">单位</Label>
        <Input
          id="product-unit"
          name="unit"
          defaultValue={initialValues.unit}
          maxLength={PRODUCT_FIELD_LIMITS.unit}
          required
          disabled={pending}
          aria-invalid={Boolean(state.fieldErrors?.unit)}
          aria-describedby="product-unit-error"
        />
        <FieldError id="product-unit-error" message={state.fieldErrors?.unit} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="product-notes">备注</Label>
        <Textarea
          id="product-notes"
          name="notes"
          defaultValue={initialValues.notes ?? ""}
          maxLength={PRODUCT_FIELD_LIMITS.notes}
          disabled={pending}
          aria-invalid={Boolean(state.fieldErrors?.notes)}
          aria-describedby="product-notes-error"
        />
        <FieldError id="product-notes-error" message={state.fieldErrors?.notes} />
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <Button variant="outline" asChild>
          <Link href="/products">取消</Link>
        </Button>
        <Button type="submit" variant="default" disabled={pending}>
          {pending
            ? productId
              ? "正在保存…"
              : "正在创建…"
            : productId
              ? "保存产品"
              : "创建产品"}
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
