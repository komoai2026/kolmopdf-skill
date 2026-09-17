---
name: kolmopdf
description: Convert PDF to Markdown, parse or OCR PDFs, translate PDFs, and export Markdown to DOCX/HTML/PDF/LaTeX. Also use for PDF reading, summaries, paper analysis, information extraction, and Q&A, choosing between existing text and high-fidelity parsing. Matches requests such as "把PDF转成Markdown", "翻译PDF", "总结这个PDF", "分析这篇论文", "提取表格", "read this PDF", and "summarize this paper".
allowed-tools: Bash, Read, Write, mcp__kolmopdf__kolmopdf_parse_pdf, mcp__kolmopdf__kolmopdf_translate_pdf, mcp__kolmopdf__kolmopdf_convert_markdown, mcp__kolmopdf__kolmopdf_estimate_cost, mcp__kolmopdf__kolmopdf_check_balance, mcp__kolmopdf__kolmopdf_get_task_status
---

# KolmoPDF

Use Jobs API v1 through Bash/curl, or the corresponding MCP tools when configured.

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

## API workflow

1. Create a job using the endpoint and multipart fields below. Each logical job has its own `Idempotency-Key`; reuse that key when retrying the same submission.
2. Wait on `GET /api/v1/jobs/{id}/events` using SSE. If SSE is unavailable, poll `GET /api/v1/jobs/{id}` every 3 seconds for up to 30 minutes. Terminal states are `succeeded`, `failed`, and `cancelled`.
3. On success, download from `GET /api/v1/jobs/{id}/download` using `result.filename` and `result.kind`. Extract ZIP results. On failure/cancellation, report the returned status; on timeout, retain the job ID for a later status check.

| Operation | Create endpoint | Multipart fields |
| --- | --- | --- |
| Parse | `/api/v1/jobs/parse` | `file`, `table_mode`, `enable_translation`, `target_language`, `output_options`, `enrichment` |
| Translate PDF | `/api/v1/jobs/translate-pdf` | `file`, `sourceLanguage`, `targetLanguage`, `layoutModes`, `enableImageTranslation`, `enableTableTranslation` |
| Convert | `/api/v1/jobs/convert` | `file`, `targetFormat` |

Send booleans as `true`/`false` and lists as comma-separated values. The [parameter glossary](references/parameter-glossary.md) covers optional fields and MCP argument names. MCP tools wait and download internally; their `task_id` is the Jobs API `id`.

### Parse example

Run in a chosen output directory with `KOLMOPDF_API_KEY` already configured:

```bash
BASE=https://www.kolmopdf.com
IDEM="parse-$(date +%s)-$RANDOM"

JOB=$(curl -fsS "$BASE/api/v1/jobs/parse" \
  -H "Authorization: Bearer $KOLMOPDF_API_KEY" \
  -H "Idempotency-Key: $IDEM" \
  -F "file=@/path/to/doc.pdf" \
  -F "table_mode=markdown" | jq -er .id)

timeout 1800 curl -N -fsS \
  -H "Authorization: Bearer $KOLMOPDF_API_KEY" \
  -H "Accept: text/event-stream" \
  "$BASE/api/v1/jobs/$JOB/events"

META=$(curl -fsS -H "Authorization: Bearer $KOLMOPDF_API_KEY" \
  "$BASE/api/v1/jobs/$JOB")
if [ "$(printf '%s' "$META" | jq -r .status)" = succeeded ]; then
  NAME=$(printf '%s' "$META" | jq -er .result.filename)
  curl -fSL -H "Authorization: Bearer $KOLMOPDF_API_KEY" \
    "$BASE/api/v1/jobs/$JOB/download" -o "$NAME"
else
  printf '%s\n' "$META" | jq '{id, status, error}'
fi
```

## Results

Parse results may include images and optional `outline.md`/`summary.md` sidecars. `enrichment=none` disables these reading aids; see the glossary for download variants. Use primary Markdown as the source and sidecars as navigation aids. Distinguish downloaded artifacts from summaries you write yourself.

Return output paths for conversion tasks. For reading tasks, deliver the requested summary, analysis, extraction, or answer with page/section references where available. See [chain recipes](references/chain-recipes.md) for multi-step operations.

## Troubleshooting

- **401 / missing key:** configure `KOLMOPDF_API_KEY` using the API key page.
- **402 / insufficient credits:** report the required credits and account top-up guidance.
- **Page/file limit:** split the input into supported sizes.
- **File type mismatch or opening error:** inspect the downloaded file signature (`PK` = ZIP, `%PDF` = PDF), correct its extension, and open/extract the existing result.
