import { describe, expect, it } from "vitest";

import { readEnv } from "@/lib/env";

const validEnv = {
  APP_NAME: "Trading ERP",
  APP_URL: "http://localhost:3000",
  BETTER_AUTH_SECRET: "test_secret_that_is_at_least_32_characters_long",
  BETTER_AUTH_URL: "http://localhost:3000",
  DATABASE_URL: "mysql://trading_erp:password@127.0.0.1:3306/trading_erp",
};

describe("environment configuration", () => {
  it("loads the required application configuration", () => {
    expect(readEnv(validEnv)).toEqual(validEnv);
  });

  it("fails clearly when a required variable is missing", () => {
    expect(() => readEnv({ ...validEnv, DATABASE_URL: undefined })).toThrow(
      "Missing required environment variable: DATABASE_URL",
    );
  });

  it("rejects an authentication secret shorter than 32 characters", () => {
    expect(() => readEnv({ ...validEnv, BETTER_AUTH_SECRET: "too-short" })).toThrow(
      "Environment variable BETTER_AUTH_SECRET must be at least 32 characters",
    );
  });
});
