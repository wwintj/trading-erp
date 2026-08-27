import "server-only";

import {
  COMPANY_ALREADY_EXISTS_MESSAGE,
  CompanyAlreadyExistsError,
  COMPANY_FORBIDDEN_MESSAGE,
  type CompanyFormState,
  COMPANY_GENERIC_ERROR_MESSAGE,
  COMPANY_SIGN_IN_MESSAGE,
  validateCompanyForm,
} from "@/lib/company";
import { getCurrentSession } from "@/lib/auth-session";
import { persistCompanySingleton } from "@/lib/company.server";

type CompanyActionSession = {
  user: {
    role?: string | null;
  };
};

type CompanyActionDependencies = {
  getSession: () => Promise<CompanyActionSession | null>;
  persist: typeof persistCompanySingleton;
};

const defaultDependencies: CompanyActionDependencies = {
  getSession: getCurrentSession,
  persist: persistCompanySingleton,
};

export async function executeCompanySave(
  _previousState: CompanyFormState,
  formData: FormData,
  dependencies: CompanyActionDependencies = defaultDependencies,
): Promise<CompanyFormState> {
  const session = await dependencies.getSession();

  if (!session) {
    return { status: "error", message: COMPANY_SIGN_IN_MESSAGE };
  }

  if (session.user.role !== "admin") {
    return { status: "error", message: COMPANY_FORBIDDEN_MESSAGE };
  }

  const validation = validateCompanyForm(formData);
  if (!validation.ok) {
    return {
      status: "error",
      message: "Please correct the highlighted fields.",
      fieldErrors: validation.fieldErrors,
    };
  }

  const rawCompanyId = formData.get("companyId");
  const companyId =
    typeof rawCompanyId === "string" && rawCompanyId.trim()
      ? rawCompanyId.trim()
      : null;

  try {
    await dependencies.persist(companyId, validation.input);
    return {
      status: "success",
      message: companyId
        ? "Company updated successfully."
        : "Company created successfully.",
    };
  } catch (error) {
    if (error instanceof CompanyAlreadyExistsError) {
      return { status: "error", message: COMPANY_ALREADY_EXISTS_MESSAGE };
    }

    return { status: "error", message: COMPANY_GENERIC_ERROR_MESSAGE };
  }
}
