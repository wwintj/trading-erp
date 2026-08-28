import "server-only";

import { getCurrentSession } from "@/lib/auth-session";
import {
  PRODUCT_DUPLICATE_CODE_MESSAGE,
  PRODUCT_FORBIDDEN_MESSAGE,
  type ProductFormState,
  PRODUCT_GENERIC_ERROR_MESSAGE,
  PRODUCT_SIGN_IN_MESSAGE,
  isProductUniqueConstraintError,
  validateProductForm,
} from "@/lib/product";
import { createProduct, updateProduct } from "@/lib/product.server";

type ProductActionSession = {
  user: {
    role?: string | null;
  };
};

type ProductActionDependencies = {
  getSession: () => Promise<ProductActionSession | null>;
  create: typeof createProduct;
  update: typeof updateProduct;
};

const defaultDependencies: ProductActionDependencies = {
  getSession: getCurrentSession,
  create: createProduct,
  update: updateProduct,
};

export async function executeProductSave(
  _previousState: ProductFormState,
  formData: FormData,
  dependencies: ProductActionDependencies = defaultDependencies,
): Promise<ProductFormState> {
  const session = await dependencies.getSession();

  if (!session) {
    return { status: "error", message: PRODUCT_SIGN_IN_MESSAGE };
  }

  if (session.user.role !== "admin") {
    return { status: "error", message: PRODUCT_FORBIDDEN_MESSAGE };
  }

  const validation = validateProductForm(formData);
  if (!validation.ok) {
    return {
      status: "error",
      message: "请检查并修正标记的字段。",
      fieldErrors: validation.fieldErrors,
    };
  }

  const rawProductId = formData.get("productId");
  const productId =
    typeof rawProductId === "string" && rawProductId.trim()
      ? rawProductId.trim()
      : null;

  try {
    const product = productId
      ? await dependencies.update(productId, validation.input)
      : await dependencies.create(validation.input);

    return {
      status: "success",
      message: productId ? "产品保存成功。" : "产品创建成功。",
      productId: product.id,
    };
  } catch (error) {
    if (isProductUniqueConstraintError(error)) {
      return { status: "error", message: PRODUCT_DUPLICATE_CODE_MESSAGE };
    }

    return { status: "error", message: PRODUCT_GENERIC_ERROR_MESSAGE };
  }
}
