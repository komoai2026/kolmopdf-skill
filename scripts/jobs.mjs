#!/usr/bin/env node

/**
 * KolmoPDF Jobs API CLI Helper
 * Self-contained, Node.js 20+, zero dependencies.
 */

import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const BOOLEAN_FLAGS = new Set([
  "translate",
  "enable-translation",
  "images-as-url",
  "cross-page",
  "enable-cross-page-merge",
  "image-translation",
  "enable-image-translation",
  "table-translation",
  "enable-table-translation",
  "help",
]);

/**
 * Parse CLI arguments into command, targets, and options.
 */
export function parseArgs(rawArgs) {
  const args = Array.isArray(rawArgs) ? rawArgs : [];
  const options = {};
  const positional = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--") {
      positional.push(...args.slice(i + 1));
      break;
    }

    if (arg.startsWith("--")) {
      const eqIdx = arg.indexOf("=");
      if (eqIdx !== -1) {
        const key = arg.slice(2, eqIdx);
        const val = arg.slice(eqIdx + 1);
        if (val === "true") options[key] = true;
        else if (val === "false") options[key] = false;
        else options[key] = val;
      } else {
        const key = arg.slice(2);
        const next = args[i + 1];
        if (BOOLEAN_FLAGS.has(key)) {
          if (next === "true" || next === "false") {
            options[key] = next === "true";
            i++;
          } else {
            options[key] = true;
          }
        } else if (next !== undefined && !next.startsWith("-")) {
          options[key] = next;
          i++;
        } else {
          options[key] = true;
        }
      }
    } else if (arg.startsWith("-") && arg.length > 1) {
      const flag = arg.slice(1);
      if (flag === "o") {
        const next = args[i + 1];
        if (next !== undefined && !next.startsWith("-")) {
          options["output-dir"] = next;
          i++;
        } else {
          options["output-dir"] = true;
        }
      } else if (flag === "h") {
        options.help = true;
      } else {
        options[flag] = true;
      }
    } else {
      positional.push(arg);
    }
  }

  const command = positional[0] || "";
  let file;
  let taskId;

  if (command === "status") {
    taskId = positional[1] || options["task-id"] || options.taskId;
  } else if (["parse", "translate", "convert"].includes(command)) {
    file = positional[1] || options.file;
  }

  return { command, file, taskId, options, positional };
}

/**
 * Validate API key and recognize unexpanded template placeholders.
 */
export function validateApiKey(key) {
  if (typeof key !== "string") {
    return { valid: false, error: "KOLMOPDF_API_KEY is not set" };
  }
  const trimmed = key.trim();
  if (!trimmed) {
    return { valid: false, error: "KOLMOPDF_API_KEY is empty" };
  }
  if (
    trimmed === "${KOLMOPDF_API_KEY}" ||
    trimmed === "$KOLMOPDF_API_KEY" ||
    trimmed.includes("${KOLMOPDF_API_KEY}") ||
    trimmed.includes("$KOLMOPDF_API_KEY") ||
    /^\$\{[A-Z0-9_]+(?::-[^}]*)?\}$/.test(trimmed)
  ) {
    return { valid: false, error: "KOLMOPDF_API_KEY contains unexpanded template placeholder" };
  }
  return { valid: true, key: trimmed };
}

/** Resolve the API key from the process environment only. */
export function resolveApiKey(env = process.env) {
  return validateApiKey(env.KOLMOPDF_API_KEY);
}

/**
 * Sanitize filename and prevent directory traversal.
 */
export function sanitizeFilename(filename, defaultName = "result") {
  if (!filename || typeof filename !== "string") return defaultName;
  let clean = filename.trim();
  if (!clean) return defaultName;
  clean = clean.replaceAll("\\", "/");
  const base = path.posix.basename(clean);
  if (!base || base === "." || base === "..") return defaultName;
  return base;
}

/**
 * Detect file type from magic bytes (ZIP or PDF).
 */
export function detectMagicKind(buf) {
  if (!buf || buf.length < 4) return "unknown";
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  if (b[0] === 0x50 && b[1] === 0x4b && (b[2] === 0x03 || b[2] === 0x05 || b[2] === 0x07)) {
    return "zip";
  }
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) {
    return "pdf";
  }
  return "unknown";
}

/** Preserve DOCX metadata even though DOCX uses the ZIP container format. */
export function detectResultKind(buf, filename = "") {
  const magicKind = detectMagicKind(buf);
  if (magicKind === "zip" && path.extname(sanitizeFilename(filename)).toLowerCase() === ".docx") {
    return "docx";
  }
  return magicKind;
}

/**
 * Correct filename extension based on magic bytes.
 */
export function correctExtension(filename, buf) {
  const safe = sanitizeFilename(filename);
  const kind = detectResultKind(buf, safe);
  if (kind === "unknown" || kind === "docx") return safe;
  const ext = path.extname(safe);
  const base = ext ? safe.slice(0, -ext.length) : safe;
  if (kind === "zip" && ext.toLowerCase() !== ".zip") {
    return `${base}.zip`;
  }
  if (kind === "pdf" && ext.toLowerCase() !== ".pdf") {
    return `${base}.pdf`;
  }
  return safe;
}

/**
 * Expand leading ~ to user home directory.
 */
export function expandHome(filePath) {
  if (!filePath || typeof filePath !== "string") return filePath;
  if (filePath === "~") return os.homedir();
  if (filePath.startsWith("~/") || filePath.startsWith("~\\")) {
    return path.join(os.homedir(), filePath.slice(2));
  }
  return filePath;
}

/**
 * Resolve output directory: --output-dir / KOLMOPDF_OUTPUT_DIR / ~/kolmopdf-output/<task_id>
 */
export function resolveOutputDir(options = {}, env = process.env, taskId = "") {
  const explicit = options.outputDir || options["output-dir"];
  if (explicit && typeof explicit === "string" && explicit.trim()) {
    return path.resolve(expandHome(explicit.trim()));
  }
  const root = env.KOLMOPDF_OUTPUT_DIR?.trim()
    ? path.resolve(expandHome(env.KOLMOPDF_OUTPUT_DIR.trim()))
    : path.join(os.homedir(), "kolmopdf-output");
  return taskId ? path.join(root, taskId) : root;
}

/**
 * Best-effort ZIP extraction via system unzip (mac/Linux) or tar (Windows).
 * Preserves archive and returns normally if extraction fails or tool unavailable.
 */
export function extractZipIfPossible(zipFilePath, destDir) {
  try {
    let res;
    if (process.platform === "win32") {
      res = spawnSync("tar", ["-xf", zipFilePath, "-C", destDir], {
        stdio: "ignore",
        windowsHide: true,
      });
    } else {
      res = spawnSync("unzip", ["-q", "-o", zipFilePath, "-d", destDir], {
        stdio: "ignore",
      });
      if (res.error || res.status !== 0) {
        res = spawnSync("tar", ["-xf", zipFilePath, "-C", destDir], {
          stdio: "ignore",
        });
      }
    }
    const extracted = Boolean(res && !res.error && res.status === 0);
    return { extracted, zipPath: zipFilePath };
  } catch {
    return { extracted: false, zipPath: zipFilePath };
  }
}

/**
 * Sanitize output objects to ensure API keys are never leaked in JSON.
 */
function writeJson(data) {
  process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
}

export function sanitizeOutput(data, apiKey = "") {
  if (data === null || data === undefined) return data;
  if (typeof data === "string") {
    if (apiKey && apiKey.length > 0 && data.includes(apiKey)) {
      return data.replaceAll(apiKey, "[REDACTED]");
    }
    return data;
  }
  if (Array.isArray(data)) {
    return data.map((item) => sanitizeOutput(item, apiKey));
  }
  if (typeof data === "object") {
    const res = {};
    for (const [key, value] of Object.entries(data)) {
      const lower = key.toLowerCase();
      if (
        lower === "api_key" ||
        lower === "apikey" ||
        lower === "x-api-key" ||
        lower === "authorization" ||
        lower === "token" ||
        lower === "secret"
      ) {
        continue;
      }
      res[key] = sanitizeOutput(value, apiKey);
    }
    return res;
  }
  return data;
}

async function executeBalance(apiKey, baseUrl) {
  const res = await fetch(`${baseUrl}/api/v1/balance`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "X-API-Key": apiKey,
    },
  });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`HTTP ${res.status}: Non-JSON response`);
  }
  if (!res.ok || body.success === false) {
    throw new Error(body.message || body.error?.message || body.error || `HTTP ${res.status}`);
  }
  return {
    success: true,
    points: body.points ?? body.data?.points ?? 0,
  };
}

async function executeStatus(taskId, apiKey, baseUrl) {
  if (!taskId) {
    throw new Error("Task ID is required for status command");
  }
  const res = await fetch(`${baseUrl}/api/v1/jobs/${encodeURIComponent(taskId)}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "X-API-Key": apiKey,
    },
  });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`HTTP ${res.status}: Non-JSON response`);
  }
  if (!res.ok || body.success === false) {
    throw new Error(body.message || body.error?.message || body.error || `HTTP ${res.status}`);
  }
  return {
    success: true,
    task_id: taskId,
    status: body.status,
    points_deducted: body.points_deducted,
    remaining_points: body.remaining_points,
    result: body.result,
    queue: body.queue,
  };
}

export function defaultResultFilename(command, options = {}) {
  if (command === "parse") return "result.md";
  if (command === "translate") return "translated.pdf";
  const format = String(options.format || options["target-format"] || "word").toLowerCase();
  if (format === "word" || format === "docx") return "result.docx";
  if (format === "latex" || format === "tex") return "result.tex";
  if (format === "html") return "result.html";
  if (format === "pdf") return "result.pdf";
  return "result.bin";
}

async function executeProcessJob(command, filePath, options, apiKey, baseUrl, env = process.env) {
  if (!filePath) {
    throw new Error(`File path is required for ${command} command`);
  }
  const resolvedPath = path.resolve(filePath);
  let fileBuffer;
  try {
    fileBuffer = await readFile(resolvedPath);
  } catch (err) {
    throw new Error(`Failed to read file "${resolvedPath}": ${err.message}`);
  }

  const form = new FormData();
  const filename = path.basename(resolvedPath);
  form.append("file", new Blob([fileBuffer]), filename);

  let endpoint;
  if (command === "parse") {
    endpoint = "/api/v1/jobs/parse";
    if (options["table-mode"]) form.append("table_mode", options["table-mode"]);
    if (options["formula-format"]) form.append("formula_format", options["formula-format"]);
    const isTranslate = Boolean(options.translate || options["enable-translation"]);
    if (isTranslate || options["enable-translation"] !== undefined) {
      form.append("enable_translation", String(isTranslate));
    }
    const targetLang =
      options["target-lang"] || options["target-language"] || (isTranslate ? "zh" : undefined);
    if (targetLang) form.append("target_language", targetLang);
    const outputOpts = options["output-options"] || (isTranslate ? "bilingual" : undefined);
    if (outputOpts) {
      form.append("output_options", Array.isArray(outputOpts) ? outputOpts.join(",") : outputOpts);
    }
    if (options["images-as-url"] !== undefined) {
      form.append("images_as_url", String(options["images-as-url"]));
    }
    if (options["cross-page"] !== undefined || options["enable-cross-page-merge"] !== undefined) {
      form.append(
        "enable_cross_page_merge",
        String(options["cross-page"] ?? options["enable-cross-page-merge"]),
      );
    }
    if (options.enrichment !== undefined) {
      form.append("enrichment", options.enrichment);
    }
  } else if (command === "translate") {
    endpoint = "/api/v1/jobs/translate-pdf";
    form.append("sourceLanguage", options.from || options["source-language"] || "en");
    form.append("targetLanguage", options.to || options["target-language"] || "zh");
    form.append("layoutModes", options.mode || options["layout-modes"] || "translated_only");
    if (
      options["image-translation"] !== undefined ||
      options["enable-image-translation"] !== undefined
    ) {
      form.append(
        "enableImageTranslation",
        String(options["image-translation"] ?? options["enable-image-translation"]),
      );
    }
    if (
      options["table-translation"] !== undefined ||
      options["enable-table-translation"] !== undefined
    ) {
      form.append(
        "enableTableTranslation",
        String(options["table-translation"] ?? options["enable-table-translation"]),
      );
    }
  } else if (command === "convert") {
    endpoint = "/api/v1/jobs/convert";
    form.append("targetFormat", options.format || options["target-format"] || "word");
  }

  // Submit job with Idempotency-Key
  const submitRes = await fetch(`${baseUrl}${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "X-API-Key": apiKey,
      "Idempotency-Key": randomUUID(),
    },
    body: form,
  });

  const submitText = await submitRes.text();
  let submitBody;
  try {
    submitBody = submitText ? JSON.parse(submitText) : {};
  } catch {
    throw new Error(`HTTP ${submitRes.status}: Non-JSON response`);
  }

  if (!submitRes.ok || submitBody.success === false) {
    throw new Error(
      submitBody.message ||
        submitBody.error?.message ||
        submitBody.error ||
        `HTTP ${submitRes.status}`,
    );
  }

  const taskId = String(submitBody.id ?? submitBody.task_id ?? submitBody.legacy_task_id ?? "");
  if (!taskId) {
    throw new Error("No job ID received in submission response");
  }

  // Poll loop: every 3s, up to KOLMOPDF_MAX_POLL_MINUTES (default 30)
  const pollIntervalMs = Math.max(1000, Number(env.KOLMOPDF_POLL_INTERVAL_MS) || 3000);
  const maxPollMinutes = Math.max(1, Number(env.KOLMOPDF_MAX_POLL_MINUTES) || 30);
  const timeoutMs = maxPollMinutes * 60 * 1000;
  const startTime = Date.now();

  let jobStatus = submitBody.status || "queued";
  let statusData = submitBody;

  while (true) {
    const normalized = String(jobStatus).toLowerCase();
    if (normalized === "succeeded" || normalized === "completed") {
      break;
    }
    if (normalized === "failed" || normalized === "cancelled") {
      const errMessage =
        statusData.message || statusData.error?.message || statusData.error || `Job ${normalized}`;
      const err = new Error(errMessage);
      err.task_id = taskId;
      err.status = normalized;
      throw err;
    }

    if (Date.now() - startTime >= timeoutMs) {
      const err = new Error(`Job timed out after ${maxPollMinutes} minutes`);
      err.task_id = taskId;
      err.status = "timeout";
      throw err;
    }

    await new Promise((r) => setTimeout(r, pollIntervalMs));

    const pollRes = await fetch(`${baseUrl}/api/v1/jobs/${encodeURIComponent(taskId)}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "X-API-Key": apiKey,
      },
    });
    const pollText = await pollRes.text();
    try {
      statusData = pollText ? JSON.parse(pollText) : {};
    } catch {
      continue;
    }
    if (pollRes.ok && statusData) {
      jobStatus = statusData.status || jobStatus;
    }
  }

  // Download result
  const downloadRes = await fetch(`${baseUrl}/api/v1/jobs/${encodeURIComponent(taskId)}/download`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "X-API-Key": apiKey,
    },
  });

  if (!downloadRes.ok) {
    const err = new Error(`Download failed with HTTP ${downloadRes.status}`);
    err.task_id = taskId;
    throw err;
  }

  const arrayBuf = await downloadRes.arrayBuffer();
  const buf = Buffer.from(arrayBuf);

  const destDir = resolveOutputDir(options, env, taskId);
  await mkdir(destDir, { recursive: true });

  const serverFilename = statusData.result?.filename;
  const safeName = sanitizeFilename(serverFilename || defaultResultFilename(command, options));
  const finalFilename = correctExtension(safeName, buf);
  const destFilePath = path.join(destDir, finalFilename);

  await writeFile(destFilePath, buf);

  const resultKind = detectResultKind(buf, finalFilename);
  const isZip = resultKind === "zip";
  let extracted = false;
  if (isZip) {
    const extractResult = extractZipIfPossible(destFilePath, destDir);
    extracted = extractResult.extracted;
  }

  return {
    success: true,
    task_id: taskId,
    status: "succeeded",
    points_deducted: statusData.points_deducted ?? submitBody.points_deducted ?? 0,
    remaining_points: statusData.remaining_points ?? submitBody.remaining_points,
    output_dir: destDir,
    file: destFilePath,
    filename: finalFilename,
    kind: resultKind !== "unknown" ? resultKind : statusData.result?.kind || "file",
    extracted,
  };
}

/**
 * Main entry point for CLI execution.
 */
export async function main(rawArgs = process.argv.slice(2), env = process.env) {
  const parsed = parseArgs(rawArgs);
  const { command, file, taskId, options } = parsed;

  if (!command || options.help || options.h) {
    const helpObj = {
      usage: "jobs.mjs <balance|status|parse|translate|convert> [file|task_id] [options]",
      commands: {
        balance: "Check account credit balance",
        status: "jobs.mjs status <task_id>",
        parse:
          "jobs.mjs parse <file> [--table-mode markdown|image] [--formula-format dollar|bracket] [--translate] [--target-lang <lang>] [--output-options <opts>] [--images-as-url] [--cross-page] [--enrichment <items>]",
        translate:
          "jobs.mjs translate <file> [--from <lang>] [--to <lang>] [--mode translated_only|side_by_side] [--image-translation] [--table-translation]",
        convert: "jobs.mjs convert <file> [--format word|docx|html|pdf|latex|tex]",
      },
      options: {
        "--output-dir, -o": "Output directory",
        "--base-url": "API base URL (default: https://www.kolmopdf.com)",
      },
    };
    writeJson(helpObj);
    return 0;
  }

  const keyResult = resolveApiKey(env);
  if (!keyResult.valid) {
    const errObj = {
      success: false,
      error: keyResult.error,
      code: "auth_missing_key",
    };
    writeJson(errObj);
    return 1;
  }
  const apiKey = keyResult.key;

  const baseUrl = (
    options["base-url"] ||
    env.KOLMOPDF_BASE_URL ||
    "https://www.kolmopdf.com"
  ).replace(/\/+$/, "");

  try {
    let result;
    if (command === "balance") {
      result = await executeBalance(apiKey, baseUrl);
    } else if (command === "status") {
      result = await executeStatus(taskId, apiKey, baseUrl);
    } else if (["parse", "translate", "convert"].includes(command)) {
      result = await executeProcessJob(command, file, options, apiKey, baseUrl, env);
    } else {
      const errObj = {
        success: false,
        error: `Unknown command: ${command}`,
        valid_commands: ["balance", "status", "parse", "translate", "convert"],
      };
      writeJson(errObj);
      return 1;
    }

    const sanitized = sanitizeOutput(result, apiKey);
    writeJson(sanitized);
    return 0;
  } catch (err) {
    const errObj = {
      success: false,
      error: err.message || String(err),
    };
    if (err.task_id) errObj.task_id = err.task_id;
    if (err.status) errObj.status = err.status;
    const sanitized = sanitizeOutput(errObj, apiKey);
    writeJson(sanitized);
    return 1;
  }
}

/**
 * Detect whether the module is being directly executed vs imported.
 */
export function isDirectExecution(importMetaUrl = import.meta.url, argv1 = process.argv[1]) {
  if (!argv1) return false;
  try {
    const thisFile = path.resolve(fileURLToPath(importMetaUrl));
    const execFile = path.resolve(argv1);
    if (thisFile === execFile) return true;
    return thisFile.toLowerCase() === execFile.toLowerCase();
  } catch {
    return false;
  }
}

if (isDirectExecution()) {
  main()
    .then((code) => {
      if (typeof code === "number" && code !== 0) {
        process.exit(code);
      }
    })
    .catch((err) => {
      writeJson({ success: false, error: err.message || String(err) });
      process.exit(1);
    });
}
