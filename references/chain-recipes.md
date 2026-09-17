# KolmoPDF Chain Recipes

Apply the task routing and cost protocol in `SKILL.md` before creating jobs. No recipe requires MCP: use Jobs API v1 via Bash/curl, or optional MCP tools when available. The user does not need to mention KolmoPDF.

## Recipe 1 — PDF → Markdown → DOCX/HTML/PDF/LaTeX

1. Estimate the complete workflow: `pages × 2 + 1` credits. Check balance and apply the total-cost confirmation threshold once.
2. Create `POST /api/v1/jobs/parse` with the PDF. Optional MCP equivalent: `kolmopdf_parse_pdf`.
3. Wait for success, save the download using `result.filename`, and extract it if it is a ZIP. Identify the primary Markdown separately from outline/summary sidecars.
4. If the primary Markdown references local images, package that Markdown and its referenced images with relative paths intact. Do not include unrelated sidecar summaries as conversion inputs.
5. Create `POST /api/v1/jobs/convert` with the Markdown or ZIP and `targetFormat`. Optional MCP equivalent: `kolmopdf_convert_markdown` with `target_format`.
6. Wait, download using that job's result metadata, and report the final path. For a PDF → Markdown request alone, stop after step 3; do not add a conversion job.

## Recipe 2 — Summarize, read, analyze, extract, or answer questions about a PDF

1. Activate the skill for requests such as "总结这个PDF", "分析这篇论文", or "extract the conclusions". Do not reject them because the user did not ask for conversion or name KolmoPDF.
2. Reuse existing readable text/Markdown. Otherwise assess local text quality and relevant document structure with a small inspection.
3. For scans, broken reading order, complex tables/formulas, multi-column layouts, or uncertain extraction quality, offer KolmoPDF cloud parsing to Markdown and state the estimated cost. Ask before upload, even below 50 credits, unless this workflow and cost are already approved.
4. If local reading is sufficient, or the user declines cloud processing, use local text and explain any limitations. Never disregard an offline/no-upload instruction.
5. After approval, parse via Jobs API v1 or optional MCP, then download and open the primary Markdown. Use available outline/summary sidecars as aids, not as a substitute for checking the source.
6. Complete the original summary/analysis/Q&A task, grounding claims in available text and figures with page/section references when possible. If you write a summary yourself, identify it as your summary, not a downloaded server artifact.

## Recipe 3 — Translate a PDF

A direct translation request triggers this route without the KolmoPDF brand name. Clarify the target language only if it cannot be inferred; do not silently choose the wrong language.

**PDF deliverable, layout preserved:**

1. Estimate `pages × 2`, check balance, and apply the cost protocol.
2. Create `POST /api/v1/jobs/translate-pdf` with `file`, `sourceLanguage`, `targetLanguage`, and `layoutModes`. Use `side_by_side` if requested, otherwise `translated_only`. Optional MCP equivalent: `kolmopdf_translate_pdf` with snake_case parameters.
3. Wait for success and download according to `result.filename` / `result.kind`. Multiple layouts may produce a ZIP; report the actual output paths.

**Editable translated/bilingual Markdown:**

1. Estimate `pages × 3` (plus 1 if a further conversion is requested), check balance, and apply the cost protocol to the total.
2. Create `POST /api/v1/jobs/parse` with `enable_translation=true`, `target_language`, and the requested `output_options` (for example `bilingual`). Optional MCP equivalent: `kolmopdf_parse_pdf`.
3. Wait, download, and identify the primary Markdown. Convert only if the user also requested another output format.

## Direct API form names

| Operation | Endpoint | Multipart fields |
| --- | --- | --- |
| Parse | `POST /api/v1/jobs/parse` | `file`, `table_mode`, `enable_translation`, `target_language`, `output_options`, `enrichment`; see parameter glossary |
| Translate PDF | `POST /api/v1/jobs/translate-pdf` | `file`, `sourceLanguage`, `targetLanguage`, `layoutModes`, `enableImageTranslation`, `enableTableTranslation` |
| Convert | `POST /api/v1/jobs/convert` | `file`, `targetFormat` |

Use `Authorization: Bearer $KOLMOPDF_API_KEY` and a stable `Idempotency-Key` for each logical job. Boolean form values are `true` / `false`; list form values are comma-separated. All three operations use the same create → SSE/status → download sequence from `SKILL.md`. Download only after success; never resubmit a paid job just because the result has an unexpected extension.
