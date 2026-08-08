---
name: kolmopdf
description: Use when the user explicitly wants KolmoPDF cloud processing of a PDF/Markdown file — parse PDF to Markdown, layout-preserving PDF translation, Markdown export (DOCX/HTML/PDF/LaTeX), or parse-time reading aids (outline/summary). Prefer the public Jobs API v1 via curl/Bash when MCP tools are unavailable. Do NOT invent outline/summary/verification files without a successful API download. Do NOT use for casual PDF chat unless the user asked for cloud parse or reading aids.
allowed-tools: Bash, Read, Write, mcp__kolmopdf__kolmopdf_parse_pdf, mcp__kolmopdf__kolmopdf_translate_pdf, mcp__kolmopdf__kolmopdf_convert_markdown, mcp__kolmopdf__kolmopdf_estimate_cost, mcp__kolmopdf__kolmopdf_check_balance, mcp__kolmopdf__kolmopdf_get_task_status
---

# KolmoPDF Skill (API-first)

KolmoPDF is a **paid cloud service** (Plus/Pro API key). Capabilities live on **Jobs API v1**. MCP tools are optional convenience wrappers.

Base URL: `https://www.kolmopdf.com`  
Auth: `Authorization: Bearer $KOLMOPDF_API_KEY` or `X-API-Key: $KOLMOPDF_API_KEY`

Official guide: https://www.kolmopdf.com/api-docs

## When to use

| User intent | Action |
| --- | --- |
| Parse / convert PDF → Markdown | `POST /api/v1/jobs/parse` |
| Layout-preserving PDF translation | `POST /api/v1/jobs/translate-pdf` |
| Markdown → DOCX/HTML/PDF/LaTeX | `POST /api/v1/jobs/convert` |
| Outline / reading summary with parse | Same parse job; default sidecars `outline`+`summary` |
| Disable reading aids | `enrichment=none` on parse |
| Optional verification report | `enrichment=outline,summary,verification` |

Do **not** trigger only because a PDF was mentioned. Do **not** fabricate `summary.md` / `outline.md` without downloading job results.

## Preferred path: Jobs API v1 (no MCP required)

Reuse the **same** `Idempotency-Key` if you retry the create call (avoid double charge). MCP tools mint a new key per invocation.

```bash
export KOLMOPDF_API_KEY=sk-...
export BASE=https://www.kolmopdf.com
export IDEM="parse-$(date +%s)"   # keep stable across retries of THIS job only

# 1) Create parse job (default enrichment = outline,summary when server configured)
curl -sS -X POST "$BASE/api/v1/jobs/parse" \
  -H "Authorization: Bearer $KOLMOPDF_API_KEY" \
  -H "Idempotency-Key: $IDEM" \
  -F "file=@/path/to/doc.pdf" \
  -F "table_mode=markdown" \
  -F "enable_translation=false"
# → HTTP 202, body.id like job_...

# 2) Poll until status is succeeded | failed | cancelled
curl -sS -H "Authorization: Bearer $KOLMOPDF_API_KEY" \
  "$BASE/api/v1/jobs/job_..."

# 3) Download (often ZIP when sidecars exist — even with images_as_url)
curl -sSL -H "Authorization: Bearer $KOLMOPDF_API_KEY" \
  "$BASE/api/v1/jobs/job_.../download" -o result.bin
# sniff: file result.bin  → zip or markdown
```

MCP tool responses use field name `task_id` whose value is the Jobs API `id` (`job_...`).

### Status values (v1)

`queued` | `processing` | `succeeded` | `failed` | `cancelled`

### Parse enrichment (sidecars only)

- Default (omit field): server adds **outline.md** + **summary.md** (and meta). **Primary Markdown is unchanged.**
- `enrichment=none` — no aids.
- Download is often a **ZIP**: original parse files + sidecars.
- Text longer than **600,000** characters → AI aids skipped; parse still succeeds.
- Aids are **free** (0 extra points). Parse still costs 2 pts/page (3 with translation).

### Other endpoints

```text
POST /api/v1/jobs/translate-pdf
POST /api/v1/jobs/convert
GET  /api/v1/jobs/{id}
GET  /api/v1/jobs/{id}/download
POST /api/v1/jobs/{id}/cancel
GET  /api/v1/balance
```

## Optional path: MCP tools

If `kolmopdf_*` MCP tools are installed and healthy, you may use them instead of curl. Prefer API v1 semantics if tool results look like legacy `task_id`/`completed` — still download and open local paths returned.

## Cost protocol

1. Estimate pages × 2 (parse) or × 3 (parse+translate); convert = 1 credit.
2. Optional: `GET /api/v1/balance`.
3. If balance too low → stop; send user to https://www.kolmopdf.com/subscription.
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

## Failure handling

| error_code / situation | Action |
| --- | --- |
| 401 / invalid_api_key | https://www.kolmopdf.com/api-keys (Plus/Pro) |
| 402 / insufficient_points | top-up URL |
| parse_page_limit_exceeded / too large | split PDF locally |
| job failed | show message; do not invent output files |
| enrichment skipped in meta | tell user primary parse is still valid |

## Output handling

After download, unzip if needed. Report absolute paths of:

- primary `*.md` (parse)
- `outline.md` / `summary.md` when present
- never dump entire files unless asked

## Chains

### PDF → Markdown → DOCX

1. parse job → download → find markdown path  
2. convert job with that `.md` or zip of md+images  
3. download convert result  

### Read / Q&A

1. parse (default enrichment ok)  
2. Read primary markdown (and summary if present)  
3. Answer grounded in those files only  
