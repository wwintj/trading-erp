import { describe, expect, it, vi } from "vitest";

import {
  COMPANY_FORBIDDEN_MESSAGE,
  COMPANY_GENERIC_ERROR_MESSAGE,
  INITIAL_COMPANY_FORM_STATE,
} from "@/lib/company";
import { executeCompanySave } from "@/lib/company-action.server";

function companyForm(overrides: Record<string, string> = {}) {
  const formData = new FormData();
  formData.set("legalName", "  天津纬信科技有限公司  ");
  formData.set("shortName", "   ");
  formData.set("unifiedCreditCode", "  1234567890  ");
  formData.set("contactName", "   ");
  formData.set("phone", "   ");
  formData.set("email", "   ");
  formData.set("address", "   ");
  formData.set("bankName", "   ");
  formData.set("bankAccount", "   ");

  for (const [field, value] of Object.entries(overrides)) {
    formData.set(field, value);
  }

  return formData;
}

describe("Company save action", () => {
  it("prevents a user role from mutating Company server-side", async () => {
    const persist = vi.fn();

    const result = await executeCompanySave(
      INITIAL_COMPANY_FORM_STATE,
      companyForm(),
      {
        getSession: vi.fn().mockResolvedValue({ user: { role: "user" } }),
        persist,
      },
    );

    expect(result).toEqual({ status: "error", message: COMPANY_FORBIDDEN_MESSAGE });
    expect(persist).not.toHaveBeenCalled();
  });

  it("allows an admin to create Company with normalized values", async () => {
    const persist = vi.fn().mockResolvedValue({ id: "company-1" });

    const result = await executeCompanySave(
      INITIAL_COMPANY_FORM_STATE,
      companyForm(),
      {
        getSession: vi.fn().mockResolvedValue({ user: { role: "admin" } }),
        persist,
      },
    );

    expect(result).toEqual({
      status: "success",
      message: "Company created successfully.",
    });
    expect(persist).toHaveBeenCalledWith(null, {
      legalName: "天津纬信科技有限公司",
      shortName: null,
      unifiedCreditCode: "1234567890",
      contactName: null,
      phone: null,
      email: null,
      address: null,
      bankName: null,
      bankAccount: null,
    });
  });

  it("allows an admin to update the existing Company", async () => {
    const persist = vi.fn().mockResolvedValue({ id: "company-1" });

    const result = await executeCompanySave(
      INITIAL_COMPANY_FORM_STATE,
      companyForm({ companyId: "company-1" }),
      {
        getSession: vi.fn().mockResolvedValue({ user: { role: "admin" } }),
        persist,
      },
    );

    expect(result).toEqual({
      status: "success",
      message: "Company updated successfully.",
    });
    expect(persist).toHaveBeenCalledWith("company-1", expect.any(Object));
  });

  it("returns field errors without writing invalid input", async () => {
    const persist = vi.fn();

    const result = await executeCompanySave(
      INITIAL_COMPANY_FORM_STATE,
      companyForm({ legalName: "", email: "invalid" }),
      {
        getSession: vi.fn().mockResolvedValue({ user: { role: "admin" } }),
        persist,
      },
    );

    expect(result).toMatchObject({
      status: "error",
      fieldErrors: {
        legalName: "Legal name is required.",
        email: "Enter a valid email address.",
      },
    });
    expect(persist).not.toHaveBeenCalled();
  });

  it("maps database failures to a generic error", async () => {
    const result = await executeCompanySave(
      INITIAL_COMPANY_FORM_STATE,
      companyForm(),
      {
        getSession: vi.fn().mockResolvedValue({ user: { role: "admin" } }),
        persist: vi.fn().mockRejectedValue(new Error("MySQL connection details")),
      },
    );

    expect(result).toEqual({
      status: "error",
      message: COMPANY_GENERIC_ERROR_MESSAGE,
    });
    expect(result.message).not.toContain("MySQL");
  });
});
