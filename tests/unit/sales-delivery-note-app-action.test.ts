import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ save: vi.fn(), status: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/lib/sales-delivery-note-action.server", () => ({ executeSalesDeliveryNoteSave: mocks.save, executeSalesDeliveryNoteStatusChange: mocks.status }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
import { saveSalesDeliveryNoteAction, finalizeSalesDeliveryNoteAction, reopenSalesDeliveryNoteAction, cancelSalesDeliveryNoteAction } from "@/app/sales-delivery-notes/actions";
describe("Delivery app actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.save.mockResolvedValue({ status: "success", message: "", noteId: "n" });
    mocks.status.mockResolvedValue({ status: "success", message: "", noteId: "n" });
  });
  it.each([
    () => saveSalesDeliveryNoteAction({ status: "idle", message: "" }, new FormData()),
    () => finalizeSalesDeliveryNoteAction("n"), () => reopenSalesDeliveryNoteAction("n"), () => cancelSalesDeliveryNoteAction("n"),
  ])("only revalidates note list/detail after success", async (action) => {
    await action();
    expect(mocks.revalidate.mock.calls).toEqual([["/sales-delivery-notes"], ["/sales-delivery-notes/n"]]);
  });
  it("does not revalidate on failure", async () => {
    mocks.save.mockResolvedValue({ status: "error", message: "错误" });
    await saveSalesDeliveryNoteAction({ status: "idle", message: "" }, new FormData());
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
});
