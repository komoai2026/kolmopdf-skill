---
name: kolmopdf
description: Use when the user explicitly wants KolmoPDF cloud processing of a PDF/Markdown file — parse PDF to Markdown, layout-preserving PDF translation, Markdown export (DOCX/HTML/PDF/LaTeX), or parse-time reading aids (outline/summary). Prefer Jobs API v1 via curl/Bash when MCP tools are unavailable. Do NOT invent outline/summary files without a successful download. Do NOT use for casual PDF chat unless the user asked for cloud parse or reading aids.
allowed-tools: Bash, Read, Write, mcp__kolmopdf__kolmopdf_parse_pdf, mcp__kolmopdf__kolmopdf_translate_pdf, mcp__kolmopdf__kolmopdf_convert_markdown, mcp__kolmopdf__kolmopdf_estimate_cost, mcp__kolmopdf__kolmopdf_check_balance, mcp__kolmopdf__kolmopdf_get_task_status
---

# KolmoPDF Skill (API-first)

KolmoPDF is a **paid cloud service**. Capabilities live on **Jobs API v1**. MCP tools are optional wrappers that wait internally.

Base URL: `https://www.kolmopdf.com`  
Auth: `Authorization: Bearer $KOLMOPDF_API_KEY` or `X-API-Key: $KOLMOPDF_API_KEY`  
Guide: https://www.kolmopdf.com/api-docs

Do **not** trigger only because a PDF was mentioned. Do **not** fabricate `summary.md` / `outline.md` without downloading job results.

## Preferred path: create → SSE wait → save by `result.filename`

Reuse the same `Idempotency-Key` if you retry create (avoid double charge). MCP tools mint a new key per invocation.

**Never hard-code `-o result.zip` / `translated.pdf` / `result.md`.** Parse, translate, and convert each return ZIP *or* a single file. A ZIP saved as `.pdf` opens as “file is damaged” even though the bytes are fine.

```bash
export KOLMOPDF_API_KEY=sk-...
export BASE=https://www.kolmopdf.com
export IDEM="parse-$(date +%s)"   # keep stable across retries of THIS job only

# 1) Create (HTTP 202, body.id like job_...)
JOB=$(curl -sS -X POST "$BASE/api/v1/jobs/parse" \
  -H "Authorization: Bearer $KOLMOPDF_API_KEY" \
  -H "Idempotency-Key: $IDEM" \
  -F "file=@/path/to/doc.pdf" \
  -F "table_mode=markdown" \
  -F "enable_translation=false" | jq -r .id)

# 2) Wait on ONE SSE connection (curl -N = no buffer). Stop on terminal event.
#    timeout wraps the wait (PDF jobs can take minutes).
timeout 1800 curl -N -sS \
  -H "Authorization: Bearer $KOLMOPDF_API_KEY" \
  -H "Accept: text/event-stream" \
  "$BASE/api/v1/jobs/$JOB/events"
# Look for: event: job.succeeded | job.failed | job.cancelled

# 3) Read declared filename/kind, then download under THAT name
META=$(curl -sS -H "Authorization: Bearer $KOLMOPDF_API_KEY" "$BASE/api/v1/jobs/$JOB")
NAME=$(echo "$META" | jq -r '.result.filename // "download.bin"')
KIND=$(echo "$META" | jq -r '.result.kind // "binary"')
curl -sSL -H "Authorization: Bearer $KOLMOPDF_API_KEY" \
  "$BASE/api/v1/jobs/$JOB/download" -o "$NAME"

# 4) Magic-byte check (do this even if KIND looks right)
HEAD=$(od -An -t x1 -N 4 "$NAME" | tr -d ' \n')
# 504b0304 / 504b0506 / 504b0708 = ZIP
# 25504446 = %PDF
```

If SSE is unavailable, poll with backoff (not a single GET):

```bash
while true; do
  ST=$(curl -sS -H "Authorization: Bearer $KOLMOPDF_API_KEY" "$BASE/api/v1/jobs/$JOB" | jq -r .status)
  case "$ST" in succeeded|failed|cancelled) break ;; esac
  sleep 3
done
```

Webhook (`webhook_url` on create) is for **your** HTTPS backend, not Claude Code. Do not invent a callback URL.

MCP tool field `task_id` is the Jobs API `id` (`job_...`). Prefer MCP when installed: it waits and sniffs internally.

### Status values

`queued` | `processing` | `succeeded` | `failed` | `cancelled`

### `result` (after succeeded)

```json
{
  "filename": "paper.zip",
  "kind": "zip",
  "content_type": "application/zip",
  "bytes": 1843200,
  "sha256": "…",
  "files": [{ "name": "paper.md", "kind": "markdown" }],
  "download_url": "/api/v1/jobs/job_…/download"
}
```

`kind`: `zip` | `pdf` | `markdown` | `docx` | `html` | `latex` | `binary`

Download headers: `Content-Type`, `Content-Disposition` (`filename` / `filename*`), `X-Kolmo-Result-Kind`. `HEAD` returns the same headers.

### Download shape (do not guess)

| Job | Usually | Becomes ZIP when |
| --- | --- | --- |
| parse | ZIP (md + images) | always ZIP if enrichment sidecars exist (default `outline,summary`) |
| parse + `images_as_url=true` | single `.md` **only if** enrichment is `none` or skipped | ZIP if sidecars exist |
| translate-pdf | `.pdf` if one `layoutModes` | ZIP if both `translated_only` and `side_by_side` |
| convert | `.docx` / `.html` / `.pdf` / `.tex` | ZIP if input was ZIP and target is LaTeX |

### “File is damaged” — wrong extension, not a failed job

| Opener says corrupt | First bytes | Fix |
| --- | --- | --- |
| PDF app | `PK` (`50 4b`) | rename to `.zip` and unzip; **do not re-run** (would charge again) |
| unzip fails | `%PDF` (`25 50 44 46`) | rename to `.pdf` |
| editor garbage | `PK` | it is a ZIP, not markdown |

### Parse enrichment

- Default (omit field): server adds **outline.md** + **summary.md**. Primary Markdown is unchanged. Download is usually **ZIP**.
- `enrichment=none` — no aids.
- Text > **600,000** chars → AI aids skipped; parse still succeeds.
- Aids are **free**. Parse still costs 2 pts/page (3 with translation).

### Other endpoints

```text
POST /api/v1/jobs/translate-pdf
POST /api/v1/jobs/convert
GET  /api/v1/jobs/{id}
GET  /api/v1/jobs/{id}/events
GET  /api/v1/jobs/{id}/download
HEAD /api/v1/jobs/{id}/download
POST /api/v1/jobs/{id}/cancel
GET  /api/v1/balance
```

## Optional path: MCP tools

If `kolmopdf_*` tools are installed, use them instead of curl. They wait internally (SSE, poll fallback) and sniff ZIP vs PDF vs markdown before naming the file. Still open the **returned local path**; do not assume `translated_pdf_path` is always a PDF (check `output.kind` / extension).

## Cost protocol

1. Estimate pages × 2 (parse) or × 3 (parse+translate); convert = 1 credit.
2. Optional: `GET /api/v1/balance`.
3. If balance too low → stop; https://www.kolmopdf.com/subscription
4. If estimate > 50 credits → confirm with user before create.

## Natural language → parameters

| User says | Form field |
| --- | --- |
| tables as images | `table_mode=image` |
| dollar / bracket formulas | `formula_format=dollar\|bracket` |
| translate while parsing | `enable_translation=true` + `target_language` |
| no outline/summary | `enrichment=none` |
| also verification report | `enrichment=outline,summary,verification` |
| cross-page tables | `enable_cross_page_merge=true` |
| side-by-side PDF | `layoutModes=side_by_side` (ZIP if combined with translated_only) |

## Failure handling

| error_code / situation | Action |
| --- | --- |
| 401 / invalid_api_key | https://www.kolmopdf.com/api-keys |
| 402 / insufficient_points | top-up URL |
| parse_page_limit_exceeded / too large | split PDF locally |
| job failed | show message; do not invent output files |
| opener “damaged” + magic PK | rename to .zip; do not retry the paid job |
| enrichment skipped in meta | tell user primary parse is still valid |

## Output handling

After download, unzip if `kind=zip` / magic `PK`. Report absolute paths of:

- primary `*.md` (parse) or `*.pdf` (translate)
- `outline.md` / `summary.md` when present
- never dump entire files unless asked

## Chains

### PDF → Markdown → DOCX

1. parse job → download using `result.filename` → unzip if needed → markdown path  
2. convert job with that `.md` or zip of md+images  
3. download convert result using **that** job’s `result.filename`

### Read / Q&A

1. parse (default enrichment ok)  
2. Read primary markdown (and summary if present)  
3. Answer grounded in those files only  
