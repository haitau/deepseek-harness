# @deepseek-ai/dsh-tool-resume-parse

Model-facing tool: parse resume PDF to Markdown via local markitdown-local OCR.

## Purpose

Wraps the bundled `scripts/markitdown_local.py` (which uses `markitdown[pdf]` +
`rapidocr-onnxruntime` for offline Chinese OCR) as a dsh model-facing tool.
The agent can call `parse_resume` to convert a candidate's PDF resume to
Markdown; downstream tools or the agent itself then handle structure
rebuilding, screening, and report writing.

## Configuration

```yaml
- plugin: @deepseek-ai/dsh-tool-resume-parse
  config:
    markitdownScript: ./packages/company/tool-resume-parse/scripts/markitdown_local.py
    uvBin: uv
```

Both fields are optional; defaults point at the bundled script and `uv` on PATH.

## Python environment

This package ships its own `pyproject.toml` declaring `markitdown[pdf]` and
`rapidocr-onnxruntime`. The tool `exec`s `uv run python` with `cwd` set to
this package root, so uv resolves dependencies from this package's
`pyproject.toml` only — no external project dependency.

## Tool contract

| Field | Value |
|---|---|
| `name` | `parse_resume` |
| `parameters` | `pdf_path: string`, `output_path: string` |
| `output.schema` | `{ markdown_path: string, markdown_content: string }` |
| `exec.signal` | honored (passed to `execAsync`) |

## Known Limitations and Deferred Work

- No retry on OCR failure (a single `execAsync` call).
- No size cap on returned `markdown_content` (the model-facing `render`
  truncates to 2000 chars, but the canonical value carries the full text).
- No structure rebuilding; that belongs to a separate `md-structure` tool.
