import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { pathToFileURL } from "node:url";
import {
  correctExtension,
  defaultResultFilename,
  detectMagicKind,
  detectResultKind,
  expandHome,
  isDirectExecution,
  parseArgs,
  resolveApiKey,
  resolveOutputDir,
  sanitizeFilename,
  sanitizeOutput,
  validateApiKey,
} from "../scripts/jobs.mjs";

describe("API Key Validation and Resolution", () => {
  it("rejects undefined or non-string keys", () => {
    assert.equal(validateApiKey(undefined).valid, false);
    assert.equal(validateApiKey(null).valid, false);
    assert.equal(validateApiKey(123).valid, false);
  });

  it("rejects empty or whitespace-only keys", () => {
    assert.equal(validateApiKey("").valid, false);
    assert.equal(validateApiKey("   ").valid, false);
  });

  it("identifies unexpanded ${KOLMOPDF_API_KEY} placeholders", () => {
    assert.equal(validateApiKey("${KOLMOPDF_API_KEY}").valid, false);
    assert.equal(validateApiKey("${KOLMOPDF_API_KEY:-}").valid, false);
    assert.equal(validateApiKey("  ${KOLMOPDF_API_KEY}  ").valid, false);
    assert.equal(validateApiKey("$KOLMOPDF_API_KEY").valid, false);
    assert.equal(validateApiKey("Bearer ${KOLMOPDF_API_KEY}").valid, false);
    assert.equal(validateApiKey("${CUSTOM_KEY_NAME}").valid, false);
  });

  it("accepts valid API keys and trims whitespace", () => {
    const res = validateApiKey("  sk-test-live-123456789  ");
    assert.equal(res.valid, true);
    assert.equal(res.key, "sk-test-live-123456789");
  });

  it("resolves the key only from the environment", () => {
    const resEnv = resolveApiKey({ KOLMOPDF_API_KEY: "sk-env-key" });
    assert.equal(resEnv.valid, true);
    assert.equal(resEnv.key, "sk-env-key");

    const resNone = resolveApiKey({});
    assert.equal(resNone.valid, false);
  });
});

describe("CLI Argument Parsing", () => {
  it("parses balance command", () => {
    const parsed = parseArgs(["balance"]);
    assert.equal(parsed.command, "balance");
  });

  it("parses status command with task_id", () => {
    const parsed = parseArgs(["status", "task_abc123"]);
    assert.equal(parsed.command, "status");
    assert.equal(parsed.taskId, "task_abc123");
  });

  it("parses parse command with all specified options", () => {
    const raw = [
      "parse",
      "sample.pdf",
      "--table-mode",
      "markdown",
      "--formula-format",
      "dollar",
      "--translate",
      "--target-lang",
      "zh",
      "--output-options",
      "bilingual",
      "--images-as-url",
      "--cross-page",
      "--enrichment",
      "none",
      "--output-dir",
      "./custom-out",
    ];
    const parsed = parseArgs(raw);
    assert.equal(parsed.command, "parse");
    assert.equal(parsed.file, "sample.pdf");
    assert.equal(parsed.options["table-mode"], "markdown");
    assert.equal(parsed.options["formula-format"], "dollar");
    assert.equal(parsed.options.translate, true);
    assert.equal(parsed.options["target-lang"], "zh");
    assert.equal(parsed.options["output-options"], "bilingual");
    assert.equal(parsed.options["images-as-url"], true);
    assert.equal(parsed.options["cross-page"], true);
    assert.equal(parsed.options.enrichment, "none");
    assert.equal(parsed.options["output-dir"], "./custom-out");
  });

  it("parses translate command with specified options", () => {
    const raw = [
      "translate",
      "doc.pdf",
      "--from",
      "en",
      "--to",
      "ja",
      "--mode",
      "side_by_side",
      "--image-translation",
      "--table-translation",
    ];
    const parsed = parseArgs(raw);
    assert.equal(parsed.command, "translate");
    assert.equal(parsed.file, "doc.pdf");
    assert.equal(parsed.options.from, "en");
    assert.equal(parsed.options.to, "ja");
    assert.equal(parsed.options.mode, "side_by_side");
    assert.equal(parsed.options["image-translation"], true);
    assert.equal(parsed.options["table-translation"], true);
  });

  it("parses convert command with format option", () => {
    const parsed = parseArgs(["convert", "input.md", "--format", "docx"]);
    assert.equal(parsed.command, "convert");
    assert.equal(parsed.file, "input.md");
    assert.equal(parsed.options.format, "docx");
  });

  it("supports --flag=value and -o shorthand", () => {
    const parsed = parseArgs(["convert", "notes.md", "--format=pdf", "-o", "/tmp/output"]);
    assert.equal(parsed.command, "convert");
    assert.equal(parsed.file, "notes.md");
    assert.equal(parsed.options.format, "pdf");
    assert.equal(parsed.options["output-dir"], "/tmp/output");
  });

  it("handles flags placed before positional command and file", () => {
    const parsed = parseArgs(["--output-dir", "./dist", "parse", "paper.pdf", "--translate"]);
    assert.equal(parsed.command, "parse");
    assert.equal(parsed.file, "paper.pdf");
    assert.equal(parsed.options["output-dir"], "./dist");
    assert.equal(parsed.options.translate, true);
  });

  it("handles boolean flags with explicit true/false", () => {
    const parsed = parseArgs(["parse", "doc.pdf", "--translate=false", "--images-as-url=true"]);
    assert.equal(parsed.options.translate, false);
    assert.equal(parsed.options["images-as-url"], true);
  });
});

describe("Filename Sanitization and Directory Traversal Prevention", () => {
  it("strips path traversal sequences (POSIX and Windows)", () => {
    assert.equal(sanitizeFilename("../../etc/passwd"), "passwd");
    assert.equal(sanitizeFilename("..\\..\\windows\\win.ini"), "win.ini");
    assert.equal(sanitizeFilename("../sub/nested/file.pdf"), "file.pdf");
  });

  it("falls back to default name for dangerous or empty filenames", () => {
    assert.equal(sanitizeFilename(""), "result");
    assert.equal(sanitizeFilename("   "), "result");
    assert.equal(sanitizeFilename("."), "result");
    assert.equal(sanitizeFilename(".."), "result");
    assert.equal(sanitizeFilename("/"), "result");
    assert.equal(sanitizeFilename(null, "fallback.bin"), "fallback.bin");
  });

  it("preserves safe filenames", () => {
    assert.equal(sanitizeFilename("report_2026.pdf"), "report_2026.pdf");
    assert.equal(sanitizeFilename("result.zip"), "result.zip");
  });
});

describe("Magic Byte Detection and Extension Correction", () => {
  const zipHeader1 = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);
  const zipHeader2 = Buffer.from([0x50, 0x4b, 0x05, 0x06, 0x00, 0x00]);
  const pdfHeader = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]);
  const txtHeader = Buffer.from("Hello, world! This is plain text.");

  it("identifies ZIP signatures", () => {
    assert.equal(detectMagicKind(zipHeader1), "zip");
    assert.equal(detectMagicKind(zipHeader2), "zip");
  });

  it("identifies PDF signatures", () => {
    assert.equal(detectMagicKind(pdfHeader), "pdf");
  });

  it("identifies other bytes as unknown", () => {
    assert.equal(detectMagicKind(txtHeader), "unknown");
    assert.equal(detectMagicKind(Buffer.from([0x00, 0x01])), "unknown");
    assert.equal(detectMagicKind(null), "unknown");
  });

  it("corrects file extension to .zip when magic bytes are ZIP", () => {
    assert.equal(correctExtension("document.md", zipHeader1), "document.zip");
    assert.equal(correctExtension("document.pdf", zipHeader1), "document.zip");
    assert.equal(correctExtension("document.bin", zipHeader1), "document.zip");
    assert.equal(correctExtension("document", zipHeader1), "document.zip");
    assert.equal(correctExtension("document.zip", zipHeader1), "document.zip");
  });

  it("preserves DOCX files instead of treating their ZIP container as an archive", () => {
    assert.equal(detectResultKind(zipHeader1, "document.docx"), "docx");
    assert.equal(correctExtension("document.docx", zipHeader1), "document.docx");
  });

  it("corrects file extension to .pdf when magic bytes are PDF", () => {
    assert.equal(correctExtension("document.bin", pdfHeader), "document.pdf");
    assert.equal(correctExtension("document.zip", pdfHeader), "document.pdf");
    assert.equal(correctExtension("document", pdfHeader), "document.pdf");
    assert.equal(correctExtension("document.pdf", pdfHeader), "document.pdf");
  });

  it("leaves extension untouched when file kind is unknown", () => {
    assert.equal(correctExtension("readme.md", txtHeader), "readme.md");
    assert.equal(correctExtension("data.json", txtHeader), "data.json");
  });

  it("combines directory traversal prevention with extension correction", () => {
    assert.equal(correctExtension("../../etc/passwd.md", zipHeader1), "passwd.zip");
    assert.equal(correctExtension("..\\..\\secret.bin", pdfHeader), "secret.pdf");
  });
});

describe("Default Result Filenames", () => {
  it("uses operation-specific extensions when result metadata is absent", () => {
    assert.equal(defaultResultFilename("parse"), "result.md");
    assert.equal(defaultResultFilename("translate"), "translated.pdf");
    assert.equal(defaultResultFilename("convert", { format: "word" }), "result.docx");
    assert.equal(defaultResultFilename("convert", { format: "latex" }), "result.tex");
    assert.equal(defaultResultFilename("convert", { format: "html" }), "result.html");
  });
});

describe("Output Directory Resolution", () => {
  it("expands leading ~ to user home directory", () => {
    const home = os.homedir();
    assert.equal(expandHome("~"), home);
    assert.equal(expandHome("~/output"), path.join(home, "output"));
    assert.equal(expandHome("~\\output"), path.join(home, "output"));
    assert.equal(expandHome("./local/dir"), "./local/dir");
  });

  it("prioritizes --output-dir over env and fallback", () => {
    const out = resolveOutputDir(
      { "output-dir": "./custom-dir" },
      { KOLMOPDF_OUTPUT_DIR: "/tmp/env-dir" },
      "task_999",
    );
    assert.equal(out, path.resolve("./custom-dir"));
  });

  it("uses KOLMOPDF_OUTPUT_DIR when --output-dir is absent", () => {
    const out = resolveOutputDir({}, { KOLMOPDF_OUTPUT_DIR: "~/env-kolmopdf" }, "task_999");
    assert.equal(out, path.resolve(path.join(os.homedir(), "env-kolmopdf", "task_999")));
  });

  it("falls back to ~/kolmopdf-output/<task_id> when no custom dir provided", () => {
    const out = resolveOutputDir({}, {}, "task_999");
    assert.equal(out, path.join(os.homedir(), "kolmopdf-output", "task_999"));
  });
});

describe("Secret Redaction and Output Sanitization", () => {
  it("strips apiKey, api_key, authorization, x-api-key fields completely", () => {
    const input = {
      success: true,
      points: 100,
      api_key: "sk-secret-key-123",
      apiKey: "sk-secret-key-123",
      authorization: "Bearer sk-secret-key-123",
      "x-api-key": "sk-secret-key-123",
      nested: {
        api_key: "sk-secret-key-123",
        name: "result.pdf",
      },
    };
    const sanitized = sanitizeOutput(input, "sk-secret-key-123");
    assert.equal(sanitized.api_key, undefined);
    assert.equal(sanitized.apiKey, undefined);
    assert.equal(sanitized.authorization, undefined);
    assert.equal(sanitized["x-api-key"], undefined);
    assert.equal(sanitized.nested.api_key, undefined);
    assert.equal(sanitized.nested.name, "result.pdf");
    assert.equal(sanitized.points, 100);
  });

  it("redacts API key substring from message strings", () => {
    const input = {
      success: false,
      error: "Authentication failed with key sk-secret-key-123",
    };
    const sanitized = sanitizeOutput(input, "sk-secret-key-123");
    assert.equal(sanitized.error, "Authentication failed with key [REDACTED]");
  });
});

describe("Execution Mode Detection", () => {
  it("detects when module is imported vs executed directly", () => {
    const samePath = path.join(os.tmpdir(), "KolmoPDF 测试", "jobs.mjs");
    const differentPath = path.join(os.tmpdir(), "KolmoPDF 测试", "other.mjs");
    const dummyMeta = pathToFileURL(samePath).href;
    assert.equal(isDirectExecution(dummyMeta, samePath), true);
    assert.equal(isDirectExecution(dummyMeta, differentPath), false);
    assert.equal(isDirectExecution(dummyMeta, undefined), false);
  });
});
