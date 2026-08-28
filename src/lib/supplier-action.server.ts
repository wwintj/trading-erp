import "server-only";

import { getCurrentSession } from "@/lib/auth-session";
import {
  createSupplier,
  updateSupplier,
} from "@/lib/supplier.server";
import {
  SUPPLIER_DUPLICATE_CODE_MESSAGE,
  SUPPLIER_FORBIDDEN_MESSAGE,
  type SupplierFormState,
  SUPPLIER_GENERIC_ERROR_MESSAGE,
  SUPPLIER_SIGN_IN_MESSAGE,
  isSupplierUniqueConstraintError,
  validateSupplierForm,
} from "@/lib/supplier";

type SupplierActionSession = {
  user: {
    role?: string | null;
  };
};

type SupplierActionDependencies = {
  getSession: () => Promise<SupplierActionSession | null>;
  create: typeof createSupplier;
  update: typeof updateSupplier;
};

const defaultDependencies: SupplierActionDependencies = {
  getSession: getCurrentSession,
  create: createSupplier,
  update: updateSupplier,
};

export async function executeSupplierSave(
  _previousState: SupplierFormState,
  formData: FormData,
  dependencies: SupplierActionDependencies = defaultDependencies,
): Promise<SupplierFormState> {
  const session = await dependencies.getSession();

  if (!session) {
    return { status: "error", message: SUPPLIER_SIGN_IN_MESSAGE };
  }

  if (session.user.role !== "admin") {
    return { status: "error", message: SUPPLIER_FORBIDDEN_MESSAGE };
  }

  const validation = validateSupplierForm(formData);
  if (!validation.ok) {
    return {
      status: "error",
      message: "请检查并修正标记的字段。",
      fieldErrors: validation.fieldErrors,
    };
  }

  const rawSupplierId = formData.get("supplierId");
  const supplierId =
    typeof rawSupplierId === "string" && rawSupplierId.trim()
      ? rawSupplierId.trim()
      : null;

  try {
    const supplier = supplierId
      ? await dependencies.update(supplierId, validation.input)
      : await dependencies.create(validation.input);

    return {
      status: "success",
      message: supplierId
        ? "供应商保存成功。"
        : "供应商创建成功。",
      supplierId: supplier.id,
    };
  } catch (error) {
    if (isSupplierUniqueConstraintError(error)) {
      return { status: "error", message: SUPPLIER_DUPLICATE_CODE_MESSAGE };
    }

    return { status: "error", message: SUPPLIER_GENERIC_ERROR_MESSAGE };
  }
}
