import "server-only";

import { getCurrentSession } from "@/lib/auth-session";
import {
  PURCHASE_CONTRACT_DUPLICATE_NO_MESSAGE,
  PURCHASE_CONTRACT_FORBIDDEN_MESSAGE,
  type PurchaseContractFormState,
  PURCHASE_CONTRACT_GENERIC_ERROR_MESSAGE,
  PURCHASE_CONTRACT_IMMUTABLE_MESSAGE,
  PURCHASE_CONTRACT_SAVE_INTENTS,
  PURCHASE_CONTRACT_SIGN_IN_MESSAGE,
  PURCHASE_CONTRACT_VALIDATION_MESSAGE,
  isPurchaseContractUniqueConstraintError,
  validatePurchaseContractForm,
} from "@/lib/purchase-contract";
import {
  PurchaseContractImmutableError,
  PurchaseContractValidationError,
  cancelPurchaseContract,
  createPurchaseContract,
  finalizePurchaseContract,
  reopenPurchaseContract,
  updatePurchaseContract,
} from "@/lib/purchase-contract.server";

type ContractActionSession = {
  user: { role?: string | null };
};

type SaveDependencies = {
  getSession: () => Promise<ContractActionSession | null>;
  create: typeof createPurchaseContract;
  update: typeof updatePurchaseContract;
};

const defaultSaveDependencies: SaveDependencies = {
  getSession: getCurrentSession,
  create: createPurchaseContract,
  update: updatePurchaseContract,
};

export async function executePurchaseContractSave(
  _previousState: PurchaseContractFormState,
  formData: FormData,
  dependencies: SaveDependencies = defaultSaveDependencies,
): Promise<PurchaseContractFormState> {
  const session = await dependencies.getSession();
  if (!session) {
    return { status: "error", message: PURCHASE_CONTRACT_SIGN_IN_MESSAGE };
  }
  if (session.user.role !== "admin") {
    return { status: "error", message: PURCHASE_CONTRACT_FORBIDDEN_MESSAGE };
  }

  const validation = validatePurchaseContractForm(formData);
  if (!validation.ok) {
    return {
      status: "error",
      message: PURCHASE_CONTRACT_VALIDATION_MESSAGE,
      fieldErrors: validation.fieldErrors,
    };
  }

  const rawContractId = formData.get("contractId");
  const contractId =
    typeof rawContractId === "string" && rawContractId.trim()
      ? rawContractId.trim()
      : null;
  const refreshSupplierSnapshot =
    formData.get("intent") ===
    PURCHASE_CONTRACT_SAVE_INTENTS.refreshSupplierSnapshot;

  if (refreshSupplierSnapshot && !contractId) {
    return {
      status: "error",
      message: PURCHASE_CONTRACT_VALIDATION_MESSAGE,
    };
  }

  try {
    const contract = contractId
      ? refreshSupplierSnapshot
        ? await dependencies.update(contractId, validation.input, {
            refreshSellerSnapshot: true,
          })
        : await dependencies.update(contractId, validation.input)
      : await dependencies.create(validation.input);
    return {
      status: "success",
      message: refreshSupplierSnapshot
        ? "供应商资料已更新，并已保存当前草稿。"
        : contractId
          ? "采购合同保存成功。"
          : "采购合同创建成功。",
      contractId: contract.id,
    };
  } catch (error) {
    if (isPurchaseContractUniqueConstraintError(error)) {
      return { status: "error", message: PURCHASE_CONTRACT_DUPLICATE_NO_MESSAGE };
    }
    if (error instanceof PurchaseContractImmutableError) {
      return { status: "error", message: PURCHASE_CONTRACT_IMMUTABLE_MESSAGE };
    }
    if (error instanceof PurchaseContractValidationError) {
      return {
        status: "error",
        message: PURCHASE_CONTRACT_VALIDATION_MESSAGE,
        fieldErrors: error.fieldErrors,
      };
    }

    return { status: "error", message: PURCHASE_CONTRACT_GENERIC_ERROR_MESSAGE };
  }
}

type StatusDependencies = {
  getSession: () => Promise<ContractActionSession | null>;
  finalize: typeof finalizePurchaseContract;
  reopen: typeof reopenPurchaseContract;
  cancel: typeof cancelPurchaseContract;
};

const defaultStatusDependencies: StatusDependencies = {
  getSession: getCurrentSession,
  finalize: finalizePurchaseContract,
  reopen: reopenPurchaseContract,
  cancel: cancelPurchaseContract,
};

export async function executePurchaseContractStatusChange(
  contractId: string,
  operation: "finalize" | "reopen" | "cancel",
  dependencies: StatusDependencies = defaultStatusDependencies,
): Promise<PurchaseContractFormState> {
  const session = await dependencies.getSession();
  if (!session) {
    return { status: "error", message: PURCHASE_CONTRACT_SIGN_IN_MESSAGE };
  }
  if (session.user.role !== "admin") {
    return { status: "error", message: PURCHASE_CONTRACT_FORBIDDEN_MESSAGE };
  }

  try {
    if (operation === "finalize") {
      await dependencies.finalize(contractId);
      return { status: "success", message: "采购合同已定稿。", contractId };
    }
    if (operation === "reopen") {
      await dependencies.reopen(contractId);
      return {
        status: "success",
        message: "采购合同已重新打开为草稿。",
        contractId,
      };
    }

    await dependencies.cancel(contractId);
    return { status: "success", message: "采购合同已取消。", contractId };
  } catch (error) {
    if (error instanceof PurchaseContractImmutableError) {
      return { status: "error", message: PURCHASE_CONTRACT_IMMUTABLE_MESSAGE };
    }
    if (error instanceof PurchaseContractValidationError) {
      return {
        status: "error",
        message: PURCHASE_CONTRACT_VALIDATION_MESSAGE,
        fieldErrors: error.fieldErrors,
      };
    }

    return { status: "error", message: PURCHASE_CONTRACT_GENERIC_ERROR_MESSAGE };
  }
}
