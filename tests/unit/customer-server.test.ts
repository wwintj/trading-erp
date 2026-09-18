import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  findUnique: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    customer: mocks,
  },
}));

import {
  createCustomer,
  getCustomerById,
  listCustomers,
  updateCustomer,
} from "@/lib/customer.server";

const input = {
  code: "CUST001",
  legalName: "测试客户有限公司",
  shortName: null,
  unifiedCreditCode: null,
  contactName: null,
  phone: null,
  email: null,
  address: null,
  defaultDeliveryContactName: "张建英",
  defaultDeliveryPhone: null,
  defaultDeliveryAddress: null,
  notes: null,
};

describe("Customer persistence queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses deterministic ordering and selects only list fields", async () => {
    mocks.findMany.mockResolvedValue([]);

    await listCustomers();

    expect(mocks.findMany).toHaveBeenCalledWith({
      orderBy: [{ code: "asc" }, { legalName: "asc" }, { id: "asc" }],
      select: {
        id: true,
        code: true,
        legalName: true,
        shortName: true,
        contactName: true,
        phone: true,
        defaultDeliveryContactName: true,
      },
    });
  });

  it("reads, creates, and updates the independent Customer model", async () => {
    mocks.findUnique.mockResolvedValue(null);
    mocks.create.mockResolvedValue({ id: "customer-1" });
    mocks.update.mockResolvedValue({ id: "customer-1" });

    await getCustomerById("customer-1");
    await createCustomer(input);
    await updateCustomer("customer-1", input);

    expect(mocks.findUnique).toHaveBeenCalledWith({
      where: { id: "customer-1" },
    });
    expect(mocks.create).toHaveBeenCalledWith({ data: input });
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "customer-1" },
      data: input,
    });
  });
});
