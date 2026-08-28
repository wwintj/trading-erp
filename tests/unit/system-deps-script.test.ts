import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const scriptPath = resolve("scripts/install-system-deps.sh");

function runScript() {
  return spawnSync("/bin/bash", [scriptPath], {
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: "",
      PURCHASE_CONTRACT_PDF_FONT_PATH: "/unused/custom/font.otf",
    },
  });
}

describe("install-system-deps.sh", () => {
  it("reports that the current operating-system dependencies are satisfied", () => {
    const result = runScript();

    expect(result.status).toBe(0);
    expect(result.stdout).toBe("System dependencies: PASS\n");
    expect(result.stderr).toBe("");
  });

  it("is an idempotent no-op that does not require apt or a system font", () => {
    const first = runScript();
    const second = runScript();

    expect(first.status).toBe(0);
    expect(second.status).toBe(0);
    expect(first.stdout).toBe(second.stdout);
  });
});
