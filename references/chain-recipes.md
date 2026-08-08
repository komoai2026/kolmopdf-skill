# KolmoPDF Chain Recipes

Expanded, step-by-step playbooks for the chained workflows summarized in `SKILL.md`.

## Recipe 1 — PDF → DOCX/HTML/PDF/LaTeX (full pipeline)

1. `kolmopdf_estimate_cost({ file_path, operation: "parse" })`.
   - If `sufficient=false` → stop; report `shortfall` + https://www.kolmopdf.com/subscription.
   - If `estimated_credits > 50` → ask the user to confirm.
2. `kolmopdf_parse_pdf({ file_path })` → capture `output.markdown_path` and `output.output_root`.
3. Decide the convert input:
   - **Markdown has no local images** (or `images_as_url=true` was used): pass `output.markdown_path` directly.
   - **Markdown references local images**: zip `output.output_root` with your own tools (`Write`/shell), then pass the `.zip` path so figures survive conversion.
4. `kolmopdf_convert_markdown({ file_path: <md-or-zip>, target_format })`.
5. Report `output.output_path` to the user (absolute path).

Total cost ≈ `pages × 2 + 1`.

## Recipe 2 — Read + Q&A about a paper

1. Parse via Jobs API v1 or MCP (`enrichment` default adds `outline.md` + `summary.md` sidecars; primary MD unchanged).
2. Unzip download if needed; `Read` primary markdown and optional `summary.md` / `outline.md`.
3. Answer grounded strictly in those files. Do not invent sidecars without download.

## Recipe 3 — Translate then deliver bilingual

**Option A — PDF deliverable (layout preserved):**
1. `kolmopdf_estimate_cost({ file_path, operation: "translate" })`.
2. `kolmopdf_translate_pdf({ file_path, source_language, target_language, layout_modes: ["side_by_side"] })`.
3. Report `output.translated_pdf_path`.

**Option B — editable Markdown deliverable:**
1. `kolmopdf_estimate_cost({ file_path, operation: "parse_translate" })`.
2. `kolmopdf_parse_pdf({ file_path, enable_translation: true, target_language, output_options: ["bilingual"] })`.
3. Report `output.markdown_path`. Optionally chain Recipe 1 step 4 to produce a bilingual DOCX.
