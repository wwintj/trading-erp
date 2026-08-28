import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    supplier: {
      findMany: mocks.findMany,
    },
  },
}));

import { listSuppliers } from "@/lib/supplier.server";

describe("Supplier persistence queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses deterministic code, legal name, and id ordering", async () => {
    mocks.findMany.mockResolvedValue([]);

    await listSuppliers();

    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ code: "asc" }, { legalName: "asc" }, { id: "asc" }],
      }),
    );
  });
});
