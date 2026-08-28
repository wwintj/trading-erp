import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

const scriptPath = resolve("scripts/install-system-deps.sh");

type RunOptions = {
  command?: string;
  env?: Record<string, string>;
  path?: string;
};

describe("install-system-deps.sh", () => {
  let testRoot: string;
  let mockBin: string;
  let fontPath: string;
  let osReleasePath: string;
  let aptLogPath: string;

  beforeEach(() => {
    testRoot = mkdtempSync(join(tmpdir(), "trading-erp-system-deps-"));
    mockBin = join(testRoot, "bin");
    fontPath = join(testRoot, "fonts", "cwfs.ttf");
    osReleasePath = join(testRoot, "os-release");
    aptLogPath = join(testRoot, "apt.log");
    mkdirSync(mockBin);
  });

  afterEach(() => {
    rmSync(testRoot, { recursive: true, force: true });
  });

  function writeExecutable(name: string, contents: string) {
    const path = join(mockBin, name);
    writeFileSync(path, `#!/usr/bin/env bash\n${contents}`);
    chmodSync(path, 0o755);
  }

  function installAptMock(createFont: boolean) {
    writeExecutable(
      "apt-get",
      [
        'printf \'apt-get:%s\\n\' "$*" >> "$APT_LOG_PATH"',
        createFont
          ? 'if [[ "$1" == "install" ]]; then mkdir -p "$(dirname "$TEST_FONT_PATH")"; : > "$TEST_FONT_PATH"; chmod 644 "$TEST_FONT_PATH"; fi'
          : "",
      ].join("\n"),
    );
  }

  function installSudoMock() {
    writeExecutable(
      "sudo",
      'printf \'sudo:%s\\n\' "$*" >> "$APT_LOG_PATH"\nexec "$@"',
    );
  }

  function runScript(options: RunOptions = {}) {
    const path = options.path ?? `${mockBin}:${process.env.PATH ?? ""}`;
    const environment = {
      ...process.env,
      APT_LOG_PATH: aptLogPath,
      PURCHASE_CONTRACT_PDF_FONT_PATH: "",
      SCRIPT_PATH: scriptPath,
      TEST_FONT_PATH: fontPath,
      TEST_OS_RELEASE_PATH: osReleasePath,
      PATH: path,
      ...options.env,
    };

    if (options.command) {
      return spawnSync("/bin/bash", ["-c", options.command], {
        encoding: "utf8",
        env: environment,
      });
    }

    return spawnSync("/bin/bash", [scriptPath], {
      encoding: "utf8",
      env: environment,
    });
  }

  function sourcedMain(extraSetup = "") {
    return [
      'source "$SCRIPT_PATH"',
      'DEFAULT_FONT_PATH="$TEST_FONT_PATH"',
      'OS_RELEASE_PATH="$TEST_OS_RELEASE_PATH"',
      extraSetup,
      "main",
    ]
      .filter(Boolean)
      .join("\n");
  }

  function aptLog(): string {
    return existsSync(aptLogPath) ? readFileSync(aptLogPath, "utf8") : "";
  }

  it("accepts a readable custom font without calling apt", () => {
    mkdirSync(join(testRoot, "custom-font"));
    const customFont = join(testRoot, "custom-font", "fangsong.ttf");
    writeFileSync(customFont, "test font");
    installAptMock(false);

    const result = runScript({
      env: { PURCHASE_CONTRACT_PDF_FONT_PATH: customFont },
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Purchase Contract PDF font: PASS");
    expect(aptLog()).toBe("");
  });

  it("rejects a missing custom font without falling back to apt", () => {
    installAptMock(false);

    const result = runScript({
      env: {
        PURCHASE_CONTRACT_PDF_FONT_PATH: join(testRoot, "missing.ttf"),
      },
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      "Configured Purchase Contract PDF font is unavailable",
    );
    expect(aptLog()).toBe("");
  });

  it("accepts an existing default font without calling apt", () => {
    mkdirSync(join(testRoot, "fonts"));
    writeFileSync(fontPath, "test font");
    installAptMock(false);

    const result = runScript({ command: sourcedMain() });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Purchase Contract PDF font: PASS");
    expect(aptLog()).toBe("");
  });

  it("runs apt update and install when the default font is missing", () => {
    writeFileSync(osReleasePath, 'ID="ubuntu"\n');
    installAptMock(true);

    const result = runScript({
      command: sourcedMain("effective_uid() { printf '0\\n'; }"),
    });

    expect(result.status).toBe(0);
    expect(aptLog()).toBe(
      "apt-get:update\napt-get:install -y fonts-cwtex-fs\n",
    );
    expect(existsSync(fontPath)).toBe(true);
    expect(result.stdout).toContain("Purchase Contract PDF font: PASS");
  });

  it("fails when installation does not provide the expected font", () => {
    writeFileSync(osReleasePath, 'ID="ubuntu"\n');
    installAptMock(false);

    const result = runScript({
      command: sourcedMain("effective_uid() { printf '0\\n'; }"),
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      "Purchase Contract PDF font is still unavailable after installation",
    );
  });

  it("uses sudo for apt when installation is run by a non-root user", () => {
    writeFileSync(osReleasePath, 'ID="ubuntu"\n');
    installAptMock(true);
    installSudoMock();

    const result = runScript({
      command: sourcedMain("effective_uid() { printf '1000\\n'; }"),
    });

    expect(result.status).toBe(0);
    expect(aptLog()).toContain("sudo:apt-get update\n");
    expect(aptLog()).toContain(
      "sudo:apt-get install -y fonts-cwtex-fs\n",
    );
  });

  it("fails clearly when a non-root user has no sudo", () => {
    writeFileSync(osReleasePath, 'ID="ubuntu"\n');
    installAptMock(true);

    const result = runScript({
      command: sourcedMain("effective_uid() { printf '1000\\n'; }"),
      path: mockBin,
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      "requires root or an available sudo command",
    );
    expect(aptLog()).toBe("");
  });

  it("rejects unsupported non-Ubuntu systems without calling apt", () => {
    writeFileSync(osReleasePath, 'ID="debian"\n');
    installAptMock(true);

    const result = runScript({
      command: sourcedMain("effective_uid() { printf '0\\n'; }"),
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      "supports Ubuntu with apt/apt-get only",
    );
    expect(aptLog()).toBe("");
  });

  it("rejects Ubuntu without apt-get", () => {
    writeFileSync(osReleasePath, 'ID="ubuntu"\n');

    const result = runScript({
      command: sourcedMain("effective_uid() { printf '0\\n'; }"),
      path: mockBin,
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("apt-get is required");
  });

  it("does not repeat apt installation after the dependency exists", () => {
    writeFileSync(osReleasePath, 'ID="ubuntu"\n');
    installAptMock(true);

    const result = runScript({
      command: `${sourcedMain("effective_uid() { printf '0\\n'; }")}\nmain`,
    });

    expect(result.status).toBe(0);
    expect(aptLog()).toBe(
      "apt-get:update\napt-get:install -y fonts-cwtex-fs\n",
    );
    expect(result.stdout.match(/Purchase Contract PDF font: PASS/g)).toHaveLength(
      2,
    );
  });
});
