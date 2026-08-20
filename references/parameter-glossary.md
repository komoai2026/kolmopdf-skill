# KolmoPDF Parameter Glossary

Full parameter reference for KolmoPDF tools / Jobs API v1. This file is not auto-loaded; the skill reads it on demand.

## Jobs API parse (`POST /api/v1/jobs/parse`) / `kolmopdf_parse_pdf`

| Parameter | Type | Legal values | Default | Billing impact |
| --- | --- | --- | --- | --- |
| `file` / `file_path` | file / string | PDF | — | — |
| `table_mode` | enum | `markdown`, `image` | `markdown` | none |
| `formula_format` | enum | `dollar`, `bracket` | `dollar` | none |
| `enable_translation` | boolean | `true`, `false` | `false` | `true` → 3 pts/page instead of 2 |
| `target_language` | enum | `zh`, `en`, `ja`, `ko`, `fr`, `de`, `es`, `ru` | `zh` | only when translation on |
| `output_options` | string[] | `original`, `translated`, `bilingual` | `original` | none |
| `images_as_url` | boolean | `true`, `false` | `false` | none — see download shape below |
| `skip_rotation_detection` | boolean | `true`, `false` | `false` | none |
| `enable_cross_page_merge` | boolean | `true`, `false` | `false` | none |
| `enrichment` | string | `none`, or comma list: `outline`,`summary`,`tables`,`verification` | server default `outline,summary` when configured | **0** extra points |
| `output_subdir` (MCP only) | string | dir name | `<task_id>` | none |

Cost: parse only = `pages × 2`; parse + translate = `pages × 3`. Enrichment is free.

### `enrichment` notes

- Omit field → server defaults (usually outline+summary) **if** server has LLM configured.
- `none` → no sidecars; download matches legacy shape.
- Sidecars never rewrite primary Markdown body.
- Text > 600k chars → AI features skipped; primary download unchanged.

### Download shape

| Case | Download |
| --- | --- |
| No sidecars, `images_as_url=false` | ZIP (md + images) or single md |
| No sidecars, `images_as_url=true` | Single markdown (public image URLs) |
| Sidecars produced (any `images_as_url`) | **ZIP**: primary parse entry + `outline.md` / `summary.md` / `enrichment_meta.json` / … |

After the job succeeds, `GET /api/v1/jobs/{id}` includes `result.filename`, `result.kind`, `result.content_type`, and zip `result.files`. Save the download as `result.filename`. Never hard-code `.zip` / `.pdf` / `.md`.

MCP / DSH tools sniff magic bytes (`PK` / `%PDF`) after download and rename; translate may return a ZIP of PDFs when both layout modes are requested.

MCP tool field `task_id` holds the Jobs API `id` (`job_...`).

### Idempotency

Send `Idempotency-Key` on create. **Retries of the same logical request must reuse the same key** to avoid double charge. MCP generates a new UUID per tool call (no auto-retry of create).

## `kolmopdf_translate_pdf`

| Parameter | Type | Legal values | Default |
| --- | --- | --- | --- |
| `file_path` | string | local path to a `.pdf` | — |
| `source_language` | string | language code | `en` |
| `target_language` | string | language code | `zh` |
| `layout_modes` | string[] | `translated_only`, `side_by_side` | `["translated_only"]` |
| `enable_image_translation` | boolean | `true`, `false` | `false` |
| `enable_table_translation` | boolean | `true`, `false` | `false` |
| `output_subdir` | string | any dir name | `<task_id>` |

Cost: `pages × 2`. No parse-stage enrichment.

## `kolmopdf_convert_markdown`

| Parameter | Type | Legal values | Default |
| --- | --- | --- | --- |
| `file_path` | string | `.md`, `.markdown`, or `.zip` | — |
| `target_format` | enum | `word`, `docx`, `html`, `pdf`, `latex`, `tex` | `word` |
| `output_subdir` | string | any dir name | `<task_id>` |

Extension mapping: `word|docx → .docx`, `html → .html`, `pdf → .pdf`, `latex|tex → .tex`.

Cost: 1 credit/task.

## Language codes

| Code | Language |
| --- | --- |
| `zh` | Chinese |
| `en` | English |
| `ja` | Japanese |
| `ko` | Korean |
| `fr` | French |
| `de` | German |
| `es` | Spanish |
| `ru` | Russian |

## Local extract layout (MCP)

```
<KOLMOPDF_OUTPUT_DIR>/<task_id>/
├── result.zip                 # when download is ZIP
├── <document>.md              # primary markdown (not outline/summary)
├── outline.md                 # optional sidecar
├── summary.md                 # optional sidecar
├── enrichment_meta.json       # optional
├── images/                    # if present
└── ...
```

Primary markdown is chosen by heuristic (longest non-sidecar `.md`), not “first entry in ZIP”.
