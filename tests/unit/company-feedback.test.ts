import { describe, expect, it, vi } from "vitest";

import { COMPANY_GENERIC_ERROR_MESSAGE } from "@/lib/company";
import { notifyCompanySave } from "@/lib/company-feedback";

describe("Company save Toast feedback", () => {
  it("triggers a success Toast for a successful save", () => {
    const notification = {
      success: vi.fn(),
      error: vi.fn(),
    };

    notifyCompanySave(
      { status: "success", message: "Company updated successfully." },
      notification,
    );

    expect(notification.success).toHaveBeenCalledWith(
      "Company updated successfully.",
    );
    expect(notification.error).not.toHaveBeenCalled();
  });

  it("triggers an error Toast with the generic failure message", () => {
    const notification = {
      success: vi.fn(),
      error: vi.fn(),
    };

    notifyCompanySave(
      { status: "error", message: COMPANY_GENERIC_ERROR_MESSAGE },
      notification,
    );

    expect(notification.error).toHaveBeenCalledWith(
      COMPANY_GENERIC_ERROR_MESSAGE,
    );
    expect(notification.success).not.toHaveBeenCalled();
  });
});
