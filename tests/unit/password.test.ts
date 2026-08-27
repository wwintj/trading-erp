import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "@/lib/password.server";

describe("Argon2id password helper", () => {
  it("hashes with the required parameters and verifies the password", async () => {
    const password = "a secure password with sufficient length";
    const hash = await hashPassword(password);

    expect(hash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
    await expect(verifyPassword(hash, password)).resolves.toBe(true);
    await expect(verifyPassword(hash, "an incorrect password")).resolves.toBe(false);
  });
});
