# KolmoPDF Skill

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

High-fidelity PDF→Markdown parsing, layout-preserving PDF translation, Markdown export, and optional parse-time reading aids (outline/summary) via the **KolmoPDF Jobs API v1**.

## Install

```bash
npx skills add komoai2026/komolpdf-skill
```

Set your API key (Plus/Pro):

```bash
export KOLMOPDF_API_KEY=sk-xxxxxxxxxxxxxxxx
```

This skill is **API-first** (curl / Bash against `https://www.kolmopdf.com/api/v1/jobs/*`).

Wait on `GET /api/v1/jobs/{id}/events` (SSE, `curl -N`). After `succeeded`, save the download as `result.filename` — parse/translate/convert may return ZIP or a single file. Do not hard-code `.zip` / `.pdf`.

Optional: install the MCP server `@kolmopdf/mcp-server` for tool wrappers.

Docs: https://www.kolmopdf.com/api-docs

## License

MIT
