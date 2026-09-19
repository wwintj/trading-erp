import "server-only";
import { getCurrentSession } from "@/lib/auth-session";
import {
  SALES_DELIVERY_NOTE_DUPLICATE_NO_MESSAGE, SALES_DELIVERY_NOTE_FORBIDDEN_MESSAGE,
  SALES_DELIVERY_NOTE_GENERIC_ERROR_MESSAGE, SALES_DELIVERY_NOTE_IMMUTABLE_MESSAGE,
  SALES_DELIVERY_NOTE_SIGN_IN_MESSAGE, SALES_DELIVERY_NOTE_VALIDATION_MESSAGE,
  validateSalesDeliveryNoteForm, type SalesDeliveryNoteFormState, type SalesDeliveryNoteOperation,
} from "@/lib/sales-delivery-note";
import {
  SalesDeliveryNoteImmutableError, SalesDeliveryNoteValidationError,
  createSalesDeliveryNote, updateSalesDeliveryNote, finalizeSalesDeliveryNote,
  reopenSalesDeliveryNote, cancelSalesDeliveryNote,
} from "@/lib/sales-delivery-note.server";

type Session = { user: { role?: string | null } } | null;
type SaveDependencies = {
  getSession: () => Promise<Session>;
  create: typeof createSalesDeliveryNote;
  update: typeof updateSalesDeliveryNote;
};
const saveDependencies: SaveDependencies = {
  getSession: getCurrentSession, create: createSalesDeliveryNote, update: updateSalesDeliveryNote,
};
function safeError(error: unknown): SalesDeliveryNoteFormState {
  if (error instanceof SalesDeliveryNoteImmutableError) return { status: "error", message: SALES_DELIVERY_NOTE_IMMUTABLE_MESSAGE };
  if (error instanceof SalesDeliveryNoteValidationError) return {
    status: "error", message: SALES_DELIVERY_NOTE_VALIDATION_MESSAGE, fieldErrors: error.fieldErrors,
  };
  if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
    return { status: "error", message: SALES_DELIVERY_NOTE_DUPLICATE_NO_MESSAGE };
  }
  return { status: "error", message: SALES_DELIVERY_NOTE_GENERIC_ERROR_MESSAGE };
}
function authorizationError(session: Session): SalesDeliveryNoteFormState | null {
  if (!session) return { status: "error", message: SALES_DELIVERY_NOTE_SIGN_IN_MESSAGE };
  if (session.user.role !== "admin") return { status: "error", message: SALES_DELIVERY_NOTE_FORBIDDEN_MESSAGE };
  return null;
}
export async function executeSalesDeliveryNoteSave(
  _previous: SalesDeliveryNoteFormState, form: FormData, deps = saveDependencies,
): Promise<SalesDeliveryNoteFormState> {
  try {
    const denied = authorizationError(await deps.getSession());
    if (denied) return denied;
    const parsed = validateSalesDeliveryNoteForm(form);
    if (!parsed.ok) return { status: "error", message: SALES_DELIVERY_NOTE_VALIDATION_MESSAGE, fieldErrors: parsed.fieldErrors };
    const rawId = form.get("noteId");
    if (rawId !== null && (typeof rawId !== "string" || !rawId.trim())) return { status: "error", message: SALES_DELIVERY_NOTE_GENERIC_ERROR_MESSAGE };
    const noteId = typeof rawId === "string" ? rawId.trim() : null;
    const note = noteId ? await deps.update(noteId, parsed.input) : await deps.create(parsed.input);
    return {
      status: "success", message: noteId ? "销售送货单保存成功。" : "销售送货单创建成功。", noteId: note.id,
      items: note.items.map((item) => ({
        itemId: item.id, productId: item.productId, quantity: item.quantity.toFixed(3), remark: item.remark,
        snapshot: { id: item.productId, code: item.productCode, name: item.productName, specification: item.specification, unit: item.unit },
      })),
    };
  } catch (error) { return safeError(error); }
}
type StatusDependencies = {
  getSession: () => Promise<Session>;
  finalize: typeof finalizeSalesDeliveryNote;
  reopen: typeof reopenSalesDeliveryNote;
  cancel: typeof cancelSalesDeliveryNote;
};
const statusDependencies: StatusDependencies = {
  getSession: getCurrentSession, finalize: finalizeSalesDeliveryNote,
  reopen: reopenSalesDeliveryNote, cancel: cancelSalesDeliveryNote,
};
export async function executeSalesDeliveryNoteStatusChange(
  noteId: string, operation: SalesDeliveryNoteOperation, deps = statusDependencies,
): Promise<SalesDeliveryNoteFormState> {
  try {
    const denied = authorizationError(await deps.getSession());
    if (denied) return denied;
    if (!noteId || !["finalize", "reopen", "cancel"].includes(operation)) return { status: "error", message: SALES_DELIVERY_NOTE_IMMUTABLE_MESSAGE };
    await deps[operation](noteId);
    return {
      status: "success", noteId,
      message: operation === "finalize" ? "销售送货单已定稿。" : operation === "reopen" ? "销售送货单已重新打开为草稿。" : "销售送货单已作废。",
    };
  } catch (error) { return safeError(error); }
}
