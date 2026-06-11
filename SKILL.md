---
name: kolmopdf
description: Use this skill ONLY when the user gives an explicit operational instruction to process a PDF or Markdown file. Specifically: (1) explicitly asks to parse/convert a PDF into Markdown, (2) explicitly asks for layout-preserving PDF translation to produce a new translated PDF, (3) explicitly asks to export/convert Markdown to DOCX/HTML/PDF/LaTeX, or (4) a combination of the above (e.g. "parse this PDF to Markdown, then translate it, then export to DOCX"). Do NOT trigger for general PDF reading, summarization, or Q&A unless the user explicitly requests Markdown extraction first. Triggers: "parse PDF to markdown", "convert PDF to markdown", "translate this PDF preserving layout", "export markdown to docx/html/pdf/latex", "PDF to markdown with tables as images", "parse and translate this PDF".
allowed-tools: mcp__kolmopdf__kolmopdf_parse_pdf, mcp__kolmopdf__kolmopdf_translate_pdf, mcp__kolmopdf__kolmopdf_convert_markdown, mcp__kolmopdf__kolmopdf_estimate_cost, mcp__kolmopdf__kolmopdf_check_balance, Read, Write
---

# KolmoPDF Skill

You have access to KolmoPDF tools (prefix `kolmopdf_*`) for high-fidelity PDF parsing and translation. These tools call a paid cloud service. Always follow the rules below.

## When to use

This skill triggers ONLY on explicit user instructions to perform a file operation:

- User explicitly asks to parse/convert a PDF into Markdown → `kolmopdf_parse_pdf`.
- User explicitly asks for layout-preserving PDF translation → `kolmopdf_translate_pdf`.
- User explicitly asks to export Markdown to DOCX/HTML/PDF/LaTeX → `kolmopdf_convert_markdown`.
- User requests a combination (e.g. "parse this PDF, translate it, then export to DOCX") → chain the tools in sequence.

Do NOT trigger when:
- User just wants to read or summarize a PDF without requesting Markdown output.
- User asks general questions about a PDF's content (use built-in Read instead).
- User mentions PDF in passing without an explicit processing instruction.

## Natural language parameter mapping

Users may describe parameters in natural language. Map their descriptions to tool parameters:

| User says | Parameter |
| --- | --- |
| "tables as images" / "keep table layout" | `table_mode="image"` |
| "use dollar signs for formulas" / "KaTeX format" | `formula_format="dollar"` |
| "use bracket notation" / "LaTeX-style delimiters" | `formula_format="bracket"` |
| "translate to Chinese/Japanese/..." | `enable_translation=true`, `target_language="zh"/"ja"/...` |
| "bilingual output" / "show both languages" | `output_options=["bilingual"]` |
| "images as URLs" / "don't download images" | `images_as_url=true` |
| "merge tables across pages" / "cross-page tables" | `enable_cross_page_merge=true` |
| "side by side translation" | `layout_modes=["side_by_side"]` |
| "translate images too" | `enable_image_translation=true` |
| "translate tables too" | `enable_table_translation=true` |
| "export to Word/DOCX/HTML/PDF/LaTeX" | `target_format` accordingly |

When the user's natural language is ambiguous, use sensible defaults from `references/parameter-glossary.md`. When the user specifies multiple preferences in one request, combine all applicable parameters in a single tool call.

## Cost-awareness protocol

Before running any operation that consumes credits:

1. Call `kolmopdf_estimate_cost` with the file path and intended operation.
2. If `sufficient` is false: stop and report `shortfall` and the top-up URL `https://www.kolmopdf.com/subscription` to the user. Do not proceed.
3. If `estimated_credits > 50`: tell the user the estimated cost and ask for confirmation before proceeding.
4. Otherwise: proceed.

## API key requirement

Tools require `KOLMOPDF_API_KEY` in the MCP server environment. If a tool returns `invalid_api_key`:

- Direct the user to https://www.kolmopdf.com/api-keys to create a key (requires Plus or Pro plan).
- Tell the user to set `KOLMOPDF_API_KEY` in their environment and restart Claude Code.
- Do not proceed with retries until the user confirms.

## Chained workflows

### PDF → DOCX/HTML/PDF/LaTeX (full pipeline)

1. `kolmopdf_estimate_cost(file, "parse")` → check balance.
2. `kolmopdf_parse_pdf(file)` → get `markdown_path`.
3. `kolmopdf_convert_markdown(markdown_path, target_format)` → final file.

If the PDF contains many images, pass the original directory (not just the markdown file) by zipping `output_root` first using your own tools, then pass the zip to convert. See `references/chain-recipes.md`.

### Read + ask Q&A about a paper

1. `kolmopdf_parse_pdf(file)` → get `markdown_path` and `preview`.
2. Use `Read` on `markdown_path` to load the full content.
3. Answer the user's question grounded in the markdown.

### Translate then convert to bilingual deliverable

Option A (PDF deliverable):
- `kolmopdf_translate_pdf(file, layout_modes=["side_by_side"])` → single PDF with side-by-side layout.

Option B (editable Markdown deliverable):
- `kolmopdf_parse_pdf(file, enable_translation=true, output_options=["bilingual"])` → bilingual markdown.

## Parameter guidance

See `references/parameter-glossary.md` for the full parameter table and defaults. Highlights:

- `formula_format=dollar` is the default and works with KaTeX/MathJax. Use `bracket` for LaTeX-strict downstream renderers.
- `enable_cross_page_merge=true` is recommended when the source PDF has tables spanning page breaks.
- `images_as_url=true` returns a single markdown file with 30-day URL references; use this for ephemeral pipelines. Default `false` returns a self-contained ZIP.

## Output handling

After successful tool calls, treat `output.markdown_path` / `output.translated_pdf_path` / `output.output_path` as the canonical local file paths and reference them in your reply to the user. Show the user the absolute path; do not re-print the entire file unless asked.

## Failure modes

| error_code | Action |
| --- | --- |
| `invalid_api_key` | Stop; follow API key requirement section above. |
| `insufficient_points` | Stop; report shortfall and top-up URL. |
| `parse_page_limit_exceeded`, `parse_file_too_large` | Stop; suggest splitting the PDF locally. |
| `parse_file_not_pdf`, `parse_file_invalid` | Stop; ask the user to re-export the PDF. |
| `parse_error`, `parse_timeout` | Server auto-refunds points. Suggest retry with smaller page range. |
| `client_polling_timeout` | Tell the user the task is still running server-side and suggest using `kolmopdf_get_task_status` with the task_id later. |
| Network/5xx | Tools auto-retry up to 3 times. If still failing, suggest checking https://www.kolmopdf.com/contact. |
