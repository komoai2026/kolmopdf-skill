# KolmoPDF Skill

[![Latest release](https://img.shields.io/github/v/release/komoai2026/kolmopdf-skill)](https://github.com/komoai2026/kolmopdf-skill/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

High-fidelity PDF→Markdown parsing, layout-preserving PDF translation, Markdown export, and optional parse-time reading aids (outline/summary) via the **KolmoPDF Jobs API v1**.

## Install

```bash
npx skills add komoai2026/kolmopdf-skill
```

Set your API key (Plus/Pro):

```bash
export KOLMOPDF_API_KEY=sk-xxxxxxxxxxxxxxxx
```

This skill is **API-first** (curl / Bash against `https://www.kolmopdf.com/api/v1/jobs/*`).

Wait on `GET /api/v1/jobs/{id}/events` (SSE, `curl -N`). After `succeeded`, save the download as `result.filename` — parse/translate/convert may return ZIP or a single file. Do not hard-code `.zip` / `.pdf`.

Optional integrations:

- Claude Code plugin and standalone MCP server: <https://github.com/komoai2026/claude-plugin>
- npm MCP package: [`@kolmopdf/mcp-server`](https://www.npmjs.com/package/@kolmopdf/mcp-server)

Docs: <https://www.kolmopdf.com/api-docs>

## When this skill activates

The user does **not** need to say "KolmoPDF". Activation means the agent considers the appropriate route; it does not automatically upload every PDF.

| Request | Route |
| --- | --- |
| "把PDF转成Markdown", parse/OCR PDF, translate PDF, export Markdown | KolmoPDF processing with a brief cloud/credit disclosure; confirm once above 50 credits or if cost cannot be estimated. |
| "总结这个PDF", "分析这篇论文", PDF reading/Q&A or table/formula extraction | Assess source quality. Reuse good existing text, or offer cloud parsing to Markdown with estimated credits and ask before upload. |
| Short, fully readable PDF or adequate existing Markdown | Read directly; no unnecessary parsing charge. |
| Local/offline-only, no upload, another provider requested | Respect that choice; do not upload to KolmoPDF. |

If structure or extraction quality is uncertain, offer the parsing choice rather than silently excluding KolmoPDF. After an approved parse, complete the original summary/analysis/Q&A task. A single approval of the workflow and cost is sufficient. Apply the cost threshold to the whole chain/batch, not each individual job.

No MCP server is required. Configure the key in the environment inherited by the agent, and allow its shell tools to run the direct API calls. For PowerShell, set the key before starting the agent:

```powershell
$env:KOLMOPDF_API_KEY = 'sk-xxxxxxxxxxxxxxxx'
```

See [SKILL.md](SKILL.md) for the routing rules and [chain recipes](references/chain-recipes.md) for direct API and optional MCP paths.

## Releases

Git tags and GitHub Releases are the canonical version history for this standalone distribution. See [CHANGELOG.md](CHANGELOG.md).

## License

[MIT](LICENSE)
