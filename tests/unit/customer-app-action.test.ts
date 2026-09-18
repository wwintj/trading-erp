import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  executeCustomerSave: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/customer-action.server", () => ({
  executeCustomerSave: mocks.executeCustomerSave,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

import { saveCustomerAction } from "@/app/customers/actions";
import { INITIAL_CUSTOMER_FORM_STATE } from "@/lib/customer";

describe("Customer app action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("revalidates only the Customer list and saved detail", async () => {
    mocks.executeCustomerSave.mockResolvedValue({
      status: "success",
      message: "客户创建成功。",
      customerId: "customer-1",
    });

    const result = await saveCustomerAction(
      INITIAL_CUSTOMER_FORM_STATE,
      new FormData(),
    );

    expect(result.customerId).toBe("customer-1");
    expect(mocks.revalidatePath.mock.calls).toEqual([
      ["/customers"],
      ["/customers/customer-1"],
    ]);
  });

  it("does not revalidate after a failed save", async () => {
    mocks.executeCustomerSave.mockResolvedValue({
      status: "error",
      message: "客户保存失败，请稍后重试。",
    });

    await saveCustomerAction(INITIAL_CUSTOMER_FORM_STATE, new FormData());

    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
