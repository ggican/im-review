import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  buildRuntimePackageJson,
  candidateRuntimeScriptPaths,
  readSdkVersion,
  repoRoot,
  RUNTIME_SCRIPT_NAME,
  sourceScriptPath,
  writeRuntimeScaffold,
} from "./prepare-cursor-runtime.mjs";

const root = repoRoot(path.dirname(fileURLToPath(import.meta.url)));

describe("prepare-cursor-runtime", () => {
  it("UNIT-CURSOR-RUNTIME-001 reads @cursor/sdk version from package.json", () => {
    const version = readSdkVersion(root);
    assert.match(version, /^\d+\.\d+\.\d+/);
  });

  it("UNIT-CURSOR-RUNTIME-002 builds runtime package.json for Node 22+", () => {
    const pkg = buildRuntimePackageJson("1.0.30");
    assert.equal(pkg.type, "module");
    assert.equal(pkg.dependencies["@cursor/sdk"], "1.0.30");
    assert.equal(pkg.engines.node, ">=22.13");
  });

  it("UNIT-CURSOR-RUNTIME-003 lists packaged and dev script candidates", () => {
    const paths = candidateRuntimeScriptPaths(
      "/App/Contents/Resources",
      "/repo",
    );
    assert.deepEqual(paths, [
      `/App/Contents/Resources/cursor-runtime/${RUNTIME_SCRIPT_NAME}`,
      `/App/Contents/Resources/resources/cursor-runtime/${RUNTIME_SCRIPT_NAME}`,
      `/repo/scripts/${RUNTIME_SCRIPT_NAME}`,
    ]);
  });

  it("UNIT-CURSOR-RUNTIME-004 scaffolds runtime without npm install", () => {
    const outDir = mkdtempSync(path.join(tmpdir(), "im-review-cursor-"));
    try {
      const result = writeRuntimeScaffold({
        outDir,
        sdkVersion: "1.0.30",
        scriptSrc: sourceScriptPath(root),
        skipInstall: true,
      });
      assert.equal(result.skipInstall, true);
      const pkg = JSON.parse(
        readFileSync(path.join(outDir, "package.json"), "utf8"),
      );
      assert.equal(pkg.dependencies["@cursor/sdk"], "1.0.30");
      const script = readFileSync(result.scriptOut, "utf8");
      assert.match(script, /@cursor\/sdk/);
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  });

  it("UNIT-CURSOR-RUNTIME-005 fails when source script is missing", () => {
    const outDir = mkdtempSync(path.join(tmpdir(), "im-review-cursor-"));
    const missing = path.join(outDir, "missing.mjs");
    try {
      assert.throws(
        () =>
          writeRuntimeScaffold({
            outDir: path.join(outDir, "runtime"),
            sdkVersion: "1.0.30",
            scriptSrc: missing,
            skipInstall: true,
          }),
        /missing Cursor script source/,
      );
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  });
});
