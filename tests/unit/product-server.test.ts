import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    product: {
      findMany: mocks.findMany,
    },
  },
}));

import { listProducts } from "@/lib/product.server";

describe("Product persistence queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses deterministic code, name, and id ordering", async () => {
    mocks.findMany.mockResolvedValue([]);

    await listProducts();

    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ code: "asc" }, { name: "asc" }, { id: "asc" }],
      }),
    );
  });
});
