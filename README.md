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

## Releases

Git tags and GitHub Releases are the canonical version history for this standalone distribution. See [CHANGELOG.md](CHANGELOG.md).

## License

[MIT](LICENSE)
