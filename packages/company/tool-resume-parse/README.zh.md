# @deepseek-ai/dsh-tool-resume-parse

[English](README.md) | 中文

面向模型的工具：通过本地 markitdown-local OCR 将简历 PDF 解析为 Markdown。

## 用途

把内置的 `scripts/markitdown_local.py`（使用 `markitdown[pdf]` +
`rapidocr-onnxruntime` 做离线中文 OCR）包装成 dsh 面向模型的工具。agent 可以调用
`parse_resume` 将候选人的 PDF 简历转换为 Markdown；结构重建、筛选与报告撰写由
下游工具或 agent 自行处理。

## 配置

```yaml
- plugin: @deepseek-ai/dsh-tool-resume-parse
  config:
    markitdownScript: ./packages/company/tool-resume-parse/scripts/markitdown_local.py
    uvBin: uv
```

两个字段均可选；默认指向内置脚本与 PATH 上的 `uv`。

## Python 环境

本包自带 `pyproject.toml`，声明 `markitdown[pdf]` 与 `rapidocr-onnxruntime`。
工具以本包根目录为 `cwd` 执行 `uv run python`，因此 uv 只从本包的
`pyproject.toml` 解析依赖——不依赖外部项目。

## 工具契约

| 字段 | 值 |
|---|---|
| `name` | `parse_resume` |
| `parameters` | `pdf_path: string`、`output_path: string` |
| `output.schema` | `{ markdown_path: string, markdown_content: string }` |
| `exec.signal` | 遵循（透传给 `execAsync`） |

## 已知限制与待办

- OCR 失败不重试（单次 `execAsync` 调用）。
- 返回的 `markdown_content` 无大小上限（面向模型的 `render` 会截断到 2000 字符，
  但规范值携带完整文本）。
- 不做结构重建；那属于独立的 `md-structure` 工具。
