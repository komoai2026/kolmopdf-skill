# KolmoPDF Chain Recipes

Use the routing and cost rules in [SKILL.md](../SKILL.md). Prefer MCP tools; otherwise run the bundled `scripts/jobs.mjs` helper rather than reconstructing HTTP polling in shell.

## PDF → Markdown → DOCX/HTML/PDF/LaTeX

Cost: `pages × 2 + 1` credits.

1. Create a parse job and download its result.
2. Extract the primary Markdown and images. For a Markdown-only request, this is the deliverable.
3. For a further conversion, submit the primary Markdown to `/api/v1/jobs/convert` with `targetFormat`. If it references local images, package that Markdown and its images as a ZIP with relative paths intact.
4. Download the converted result and return its path.

## Reading a parsed PDF

After choosing the reading route in `SKILL.md`:

1. Open the primary Markdown or existing source text. Use available outline/summary files to locate relevant sections.
2. Read the sections, tables, formulas, and figures needed for the question.
3. Complete the requested summary, analysis, extraction, or Q&A with source references where available.

## PDF translation

Infer the target language from the request; ask if it is unspecified.

| Deliverable | Operation | Parameters | Cost |
| --- | --- | --- | --- |
| Translated PDF | `/api/v1/jobs/translate-pdf` | `sourceLanguage`, `targetLanguage`, `layoutModes=translated_only` | pages × 2 |
| Side-by-side PDF | `/api/v1/jobs/translate-pdf` | Same, with `layoutModes=side_by_side` | pages × 2 |
| Translated/bilingual Markdown | `/api/v1/jobs/parse` | `enable_translation=true`, `target_language`, requested `output_options` | pages × 3 |

Download the result using its metadata; requesting both PDF layouts produces a ZIP. For editable formats such as DOCX, convert the translated Markdown as in the first recipe (1 additional credit).
