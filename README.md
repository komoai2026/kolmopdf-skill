# KolmoPDF Skill

[![Latest release](https://img.shields.io/github/v/release/komoai2026/kolmopdf-skill)](https://github.com/komoai2026/kolmopdf-skill/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

PDF to Markdown, layout-preserving translation, Markdown export, and document reading through KolmoPDF Jobs API v1.

## Install

```bash
npx skills add komoai2026/kolmopdf-skill
```

Set your API key in the environment used to start the agent:

```bash
export KOLMOPDF_API_KEY=sk-xxxxxxxxxxxxxxxx
claude
```

PowerShell:

```powershell
$env:KOLMOPDF_API_KEY = 'sk-xxxxxxxxxxxxxxxx'
claude
```

Get a key at [API Management](https://www.kolmopdf.com/api-keys). On macOS, Finder/Dock-launched apps do not automatically inherit a Terminal `export`; use the client's private environment or launch the agent from that shell.

The skill includes `scripts/jobs.mjs`, a zero-dependency Node.js 20+ Jobs API helper for macOS, Linux, and Windows. It does not require `jq`, GNU `timeout`, or Homebrew coreutils. MCP is optional.

## Usage

- **“把 PDF 转成 Markdown”“翻译 PDF”**: use KolmoPDF with a credit estimate.
- **“总结这个 PDF”“分析这篇论文”**: reuse adequate text, or offer high-fidelity parsing with an estimate before uploading; then complete the reading task.

[SKILL.md](SKILL.md) contains the routing, cost, and helper commands. [Chain recipes](references/chain-recipes.md) cover multi-step operations, and the [parameter glossary](references/parameter-glossary.md) lists API fields. Helper outputs default to `~/kolmopdf-output/<task_id>/`.

## Links

- [Claude plugin and MCP server](https://github.com/komoai2026/claude-plugin)
- [API documentation](https://www.kolmopdf.com/api-docs)
- [Release history](https://github.com/komoai2026/kolmopdf-skill/releases) · [Changelog](CHANGELOG.md)

## License

[MIT](LICENSE)
