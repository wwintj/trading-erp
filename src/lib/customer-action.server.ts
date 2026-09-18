import "server-only";

import { getCurrentSession } from "@/lib/auth-session";
import {
  createCustomer,
  updateCustomer,
} from "@/lib/customer.server";
import {
  CUSTOMER_DUPLICATE_CODE_MESSAGE,
  CUSTOMER_FORBIDDEN_MESSAGE,
  type CustomerFormState,
  CUSTOMER_GENERIC_ERROR_MESSAGE,
  CUSTOMER_SIGN_IN_MESSAGE,
  isCustomerUniqueConstraintError,
  validateCustomerForm,
} from "@/lib/customer";

type CustomerActionSession = {
  user: {
    role?: string | null;
  };
};

type CustomerActionDependencies = {
  getSession: () => Promise<CustomerActionSession | null>;
  create: typeof createCustomer;
  update: typeof updateCustomer;
};

const defaultDependencies: CustomerActionDependencies = {
  getSession: getCurrentSession,
  create: createCustomer,
  update: updateCustomer,
};

export async function executeCustomerSave(
  _previousState: CustomerFormState,
  formData: FormData,
  dependencies: CustomerActionDependencies = defaultDependencies,
): Promise<CustomerFormState> {
  const session = await dependencies.getSession();

  if (!session) {
    return { status: "error", message: CUSTOMER_SIGN_IN_MESSAGE };
  }

  if (session.user.role !== "admin") {
    return { status: "error", message: CUSTOMER_FORBIDDEN_MESSAGE };
  }

  const validation = validateCustomerForm(formData);
  if (!validation.ok) {
    return {
      status: "error",
      message: "请检查并修正标记的字段。",
      fieldErrors: validation.fieldErrors,
    };
  }

  const rawCustomerId = formData.get("customerId");
  const customerId =
    typeof rawCustomerId === "string" && rawCustomerId.trim()
      ? rawCustomerId.trim()
      : null;

  try {
    const customer = customerId
      ? await dependencies.update(customerId, validation.input)
      : await dependencies.create(validation.input);

    return {
      status: "success",
      message: customerId ? "客户保存成功。" : "客户创建成功。",
      customerId: customer.id,
    };
  } catch (error) {
    if (isCustomerUniqueConstraintError(error)) {
      return { status: "error", message: CUSTOMER_DUPLICATE_CODE_MESSAGE };
    }

    return { status: "error", message: CUSTOMER_GENERIC_ERROR_MESSAGE };
  }
}
