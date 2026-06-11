# KolmoPDF Parameter Glossary

Full parameter reference for the KolmoPDF tools. This file is not auto-loaded; the skill reads it on demand.

## `kolmopdf_parse_pdf`

| Parameter | Type | Legal values | Default | Billing impact |
| --- | --- | --- | --- | --- |
| `file_path` | string | local path to a `.pdf` | — | — |
| `table_mode` | enum | `markdown`, `image` | `markdown` | none |
| `formula_format` | enum | `dollar`, `bracket` | `dollar` | none |
| `enable_translation` | boolean | `true`, `false` | `false` | `true` → 3 pts/page instead of 2 |
| `target_language` | enum | `zh`, `en`, `ja`, `ko`, `fr`, `de`, `es`, `ru` | `zh` | only when `enable_translation=true` |
| `output_options` | string[] | `original`, `translated`, `bilingual` | `original` | none |
| `images_as_url` | boolean | `true`, `false` | `false` | none (`true` → single `.md` w/ 30-day URLs; `false` → ZIP) |
| `skip_rotation_detection` | boolean | `true`, `false` | `false` | none |
| `enable_cross_page_merge` | boolean | `true`, `false` | `false` | none (merges tables across ≤ 3 pages) |
| `output_subdir` | string | any dir name | `<task_id>` | none |

Cost: parse only = `pages × 2`; parse + translate = `pages × 3`.

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

Cost: `pages × 2`.

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

## ZIP output structure (`images_as_url=false`)

```
<KOLMOPDF_OUTPUT_DIR>/<task_id>/
├── <document>.md          # canonical markdown_path (first *.md found)
├── images/                # extracted figures → images_dir
│   ├── img-0001.png
│   └── ...
└── (other assets, flattened)
```

When `images_as_url=true`, the result is a single `result.md` with public image URLs (cached 30 days) and `images_dir = null`.
