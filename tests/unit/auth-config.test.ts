import { describe, expect, it } from "vitest";

import { auth } from "@/lib/auth-config";

describe("Better Auth configuration", () => {
  it("disables public sign-up and keeps database-backed sessions without cookie cache", () => {
    expect(auth.options.emailAndPassword).toMatchObject({
      enabled: true,
      disableSignUp: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
    });
    expect(auth.options).not.toHaveProperty("session.cookieCache.enabled", true);
  });

  it("enables only the built-in Admin plugin role behavior", () => {
    expect(auth.options.plugins?.map((plugin) => plugin.id)).toEqual(["admin"]);
  });
});
