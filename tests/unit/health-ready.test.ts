import { afterEach, describe, expect, it, vi } from "vitest";

import { getReadinessResponse } from "@/app/api/health/ready/route";

describe("GET /api/health/ready", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reports ready when the database check succeeds", async () => {
    const databaseCheck = vi.fn().mockResolvedValue(undefined);

    const response = await getReadinessResponse(databaseCheck);

    expect(databaseCheck).toHaveBeenCalledOnce();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "ready", database: "ok" });
  });

  it("reports not ready without exposing an internal error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const databaseCheck = vi.fn().mockRejectedValue(new Error("secret connection details"));

    const response = await getReadinessResponse(databaseCheck);

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      status: "not_ready",
      database: "error",
    });
  });
});
