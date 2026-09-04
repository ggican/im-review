#!/usr/bin/env node
/**
 * One-shot local Cursor SDK prompt (no cloud VM / no repo clone).
 * stdin JSON: { apiKey, prompt, modelId?, fast? }
 * stdout JSON: { ok, result?, status?, error? }
 */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stdin as input } from "node:process";
import { Agent } from "@cursor/sdk";

async function readStdin() {
  const chunks = [];
  for await (const chunk of input) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

function modelSelection(modelId, fast) {
  const id = modelId || "composer-2.5";
  if (fast === false) return { id };
  return { id, params: [{ id: "fast", value: "true" }] };
}

async function runOnce(apiKey, prompt, model) {
  const cwd = mkdtempSync(join(tmpdir(), "pr-helper-cursor-"));
  return Agent.prompt(prompt, {
    apiKey,
    model,
    local: { cwd },
  });
}

async function main() {
  let raw;
  try {
    raw = JSON.parse(await readStdin());
  } catch (e) {
    console.log(
      JSON.stringify({
        ok: false,
        error: `invalid stdin JSON: ${e?.message || e}`,
      }),
    );
    process.exit(1);
  }

  const apiKey = String(raw.apiKey || "").trim();
  const prompt = String(raw.prompt || "");
  if (!apiKey) {
    console.log(JSON.stringify({ ok: false, error: "apiKey is required" }));
    process.exit(1);
  }
  if (!prompt.trim()) {
    console.log(JSON.stringify({ ok: false, error: "prompt is empty" }));
    process.exit(1);
  }

  const preferred = modelSelection(raw.modelId, raw.fast !== false);
  let result;
  try {
    result = await runOnce(apiKey, prompt, preferred);
  } catch (firstErr) {
    // Retry without fast param / with auto if account rejects model selection.
    try {
      result = await runOnce(apiKey, prompt, { id: "composer-2.5" });
    } catch (secondErr) {
      const msg = [
        firstErr?.message || String(firstErr),
        secondErr?.message || String(secondErr),
      ].join(" | ");
      console.log(JSON.stringify({ ok: false, error: msg }));
      process.exit(1);
    }
  }

  if (result.status === "error") {
    console.log(
      JSON.stringify({
        ok: false,
        status: result.status,
        error: result.result || "local Cursor agent run failed",
      }),
    );
    process.exit(2);
  }

  console.log(
    JSON.stringify({
      ok: true,
      status: result.status,
      result: result.result ?? "",
    }),
  );
}

main().catch((e) => {
  console.log(
    JSON.stringify({
      ok: false,
      error: e?.message || String(e),
    }),
  );
  process.exit(1);
});
