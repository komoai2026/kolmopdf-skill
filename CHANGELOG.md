# Changelog

All notable changes to the standalone KolmoPDF skill distribution are documented here.

## [Unreleased]

## [1.2.2] - 2026-09-21

### Fixed

- Added a bundled zero-dependency Node.js Jobs API helper for macOS, Linux, and Windows.
- Removed the processing workflow's dependency on `jq`, GNU `timeout`, and Homebrew coreutils.
- Added safe output filenames, ZIP/PDF magic-byte correction, bounded polling, key redaction, and stable `~/kolmopdf-output/<task_id>/` output paths.
- Added Linux, Windows, Apple Silicon Mac, and Intel Mac helper CI plus macOS environment guidance.
- Preserved DOCX outputs instead of renaming their ZIP container to `.zip`, with explicit helper paths for Claude Code, Codex, and Cursor.

## [1.2.1] - 2026-09-17

### Changed

- Consolidated routing, costs, and API instructions; shortened recipes and installation guidance.
- Made balance queries conditional and file-signature checks troubleshooting-only.
- Preserved conversion and reading routes, cost approval, and direct API support.
- Synchronized with the plugin and Codex/Cursor skill at v1.2.1.

## [1.2.0] - 2026-09-17

### Fixed

- Removed the requirement to name KolmoPDF for PDF conversion/parsing/translation and Markdown export.
- Added PDF reading, summarization, analysis, extraction, and Q&A to skill activation, with document-quality assessment and a cloud-parsing offer before upload when useful.
- Reuses adequate local/existing text and completes the original reading task after parsing.
- Applies the credit threshold to the whole workflow/batch, with one confirmation for already approved cloud processing; respects no-upload and provider choices.
- Reworked chain recipes for direct Jobs API use without MCP and clarified API-key handling and downloaded versus agent-generated summaries.
- Synchronized content with the Claude plugin and Codex/Cursor mirror at v1.2.0.

## [1.1.1] - 2026-09-16

### Changed

- Renamed the repository from `komolpdf-skill` to `kolmopdf-skill`.
- Corrected installation and project links.
- Added a canonical license, release history, and repository validation workflow.
- Established tagged GitHub Releases for the standalone skill distribution.

### Content

- The KolmoPDF skill instructions and references are unchanged from the `1.1.0` plugin distribution.
