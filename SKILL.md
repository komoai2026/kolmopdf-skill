---
name: kolmopdf
description: Convert PDF to Markdown, parse or OCR PDFs, translate PDFs, and export Markdown to DOCX/HTML/PDF/LaTeX. Also use for PDF reading, summaries, paper analysis, information extraction, and Q&A, choosing between existing text and high-fidelity parsing. Matches requests such as "把PDF转成Markdown", "翻译PDF", "总结这个PDF", "分析这篇论文", "提取表格", "read this PDF", and "summarize this paper".
allowed-tools: Bash, Read, Write, mcp__kolmopdf__kolmopdf_parse_pdf, mcp__kolmopdf__kolmopdf_translate_pdf, mcp__kolmopdf__kolmopdf_convert_markdown, mcp__kolmopdf__kolmopdf_estimate_cost, mcp__kolmopdf__kolmopdf_check_balance, mcp__kolmopdf__kolmopdf_get_task_status
---

# KolmoPDF

Prefer the corresponding MCP tools when configured. Otherwise run the bundled Node.js Jobs API helper; do not rebuild the workflow with `jq`, GNU `timeout`, or platform-specific shell one-liners.

- Base URL: `https://www.kolmopdf.com`
- Authentication: `Authorization: Bearer $KOLMOPDF_API_KEY` from the environment
- API key setup: https://www.kolmopdf.com/api-keys
- API docs: https://www.kolmopdf.com/api-docs

## Choose the route

**Conversion, parsing/OCR, translation, and Markdown export:** use KolmoPDF. State the cloud-processing cost estimate and proceed under the cost rules below.

**Reading, summaries, analysis, extraction, and Q&A:** reuse adequate existing Markdown or local text. For scans, multi-column layouts, complex formulas/tables, missing text, or uncertain extraction quality, offer KolmoPDF parsing to Markdown with an estimate and ask before uploading. For example: "建议先用 KolmoPDF 将这份 PDF 解析成 Markdown，以提高内容提取和总结的准确性，预计 X credits。是否先解析？" After approval, parse and complete the original task. If declined, work with available text and explain relevant limitations.

Follow explicit local-only/no-upload instructions or the user's choice of another service.

## Cost

| Operation | Credits |
| --- | --- |
| Parse PDF | pages × 2 |
| Parse with translation | pages × 3 |
| Layout-preserving PDF translation | pages × 2 |
| Convert Markdown | 1 per job |

Estimate the whole chain or batch using local page metadata or `kolmopdf_estimate_cost`. For direct processing requests, confirm if the total exceeds 50 credits or cannot be estimated. Reading tasks use the approval described above. An approval covering the workflow and cost remains valid unless the scope or cost materially increases.

Reuse available balance information; query `GET /api/v1/balance` when needed. If the balance is insufficient, report the shortfall and account top-up guidance.

## Execution

### Preferred: MCP tools

Use `kolmopdf_estimate_cost`, then the requested processing tool. MCP waits, downloads, detects the real file type, extracts ZIP results, and returns absolute local paths.

### Portable fallback: bundled Node.js helper

The Skill includes `scripts/jobs.mjs`. It requires only Node.js 20+, works on macOS/Linux/Windows, and does not require `jq`, GNU `timeout`, or Homebrew coreutils. It reads the key only from `KOLMOPDF_API_KEY`; never pass credentials on the command line.

Resolve the helper to an absolute path before running it:

| Client | Helper path |
| --- | --- |
| Claude Code | `${CLAUDE_SKILL_DIR}/scripts/jobs.mjs` (expanded by Claude Code) |
| Codex | `~/.codex/skills/kolmopdf/scripts/jobs.mjs` for the standard global install |
| Cursor | `~/.cursor/skills/kolmopdf/scripts/jobs.mjs` for the standard global install |
| Other | Locate `scripts/jobs.mjs` next to this `SKILL.md` |

Replace `<HELPER_PATH>` below with that absolute path. Do not copy a secret or generated helper into the project.

```bash
node "<HELPER_PATH>" balance
node "<HELPER_PATH>" parse "/absolute/path/to/doc.pdf" --table-mode markdown
node "<HELPER_PATH>" translate "/absolute/path/to/doc.pdf" --from ja --to en --mode side_by_side
node "<HELPER_PATH>" convert "/absolute/path/to/doc.md" --format docx
```

The helper creates one idempotent job, polls every 3 seconds for up to `KOLMOPDF_MAX_POLL_MINUTES` (default 30), downloads using the server filename, checks ZIP/PDF magic bytes, and writes JSON to stdout. Outputs default to `~/kolmopdf-output/<task_id>/`; override with `KOLMOPDF_OUTPUT_DIR` or `--output-dir`. If `extracted=false`, keep the downloaded archive and extract it once with the platform's archive tool; do not rerun the paid job.

Use `status <task_id>` after a timeout:

```bash
node "<HELPER_PATH>" status "job_..."
```

The [parameter glossary](references/parameter-glossary.md) covers all MCP and helper argument names.

## Results

Parse results may include images and optional `outline.md`/`summary.md` sidecars. `enrichment=none` disables these reading aids; see the glossary for download variants. Use primary Markdown as the source and sidecars as navigation aids. Distinguish downloaded artifacts from summaries you write yourself.

Return output paths for conversion tasks. For reading tasks, deliver the requested summary, analysis, extraction, or answer with page/section references where available. See [chain recipes](references/chain-recipes.md) for multi-step operations.

## Troubleshooting

- **401 / missing key:** configure `KOLMOPDF_API_KEY` using the API key page.
- **402 / insufficient credits:** report the required credits and account top-up guidance.
- **Page/file limit:** split the input into supported sizes.
- **File type mismatch or opening error:** inspect the downloaded file signature (`PK` = ZIP, `%PDF` = PDF), correct its extension, and open/extract the existing result.
