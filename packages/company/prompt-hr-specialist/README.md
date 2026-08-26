# @deepseek-ai/dsh-prompt-hr-specialist

HR Specialist system prompt section: 5 modes (screening, JD drafting,
candidate communication, policy & SOP, HR action approval).

## Purpose

Registers a deployment-persona section (`order: 0`) in the system prompt
assembly. The section text is the dsh-side rewrite of the original HR专员.md,
with all hr-resume-project-specific paths and commands replaced by dsh
workbench conventions:

- "调 markitdown-local skill" → "调 `parse_resume` 工具"
- "每份产出文件写入完成后 git push" → "调 `save_report` 工具持久化"
- Removed references to downstream skills not yet available in dsh
  (`md-structure`, `interview-designer`, `paper-audit`, `osint-check`,
  `datapro`, `doubao-search`)
- Compliance red lines and the 5-mode routing structure are preserved verbatim

## Configuration

```yaml
- plugin: @deepseek-ai/dsh-prompt-hr-specialist
  config:
    promptFile: ./packages/company/prompt-hr-specialist/assets/hr-specialist.md
    complete: false
```

Both fields are optional. `promptFile` defaults to the bundled asset;
`complete` defaults to `false` (coexists with the harness identity).

## System-prompt contract

| Field | Value |
|---|---|
| `name` | `company:hr-specialist` |
| `order` | `0` (deployment persona band) |
| `text` | loaded from `assets/hr-specialist.md` at plugin apply time |
| `complete` | `false` by default |

## Known Limitations and Deferred Work

- The prompt loads once at plugin apply; editing the markdown requires a dsh
  restart. Live reload is not supported.
- The rewritten prompt dropped references to L1 background-check skills
  (paper-audit / osint-check) that have no dsh-side equivalents yet.
  Re-add them as dsh tool plugins when available.
- JD mode references a `01.岗位需求/_模板/JD模板.md` template; the workbench
  data repo must provide this file or the agent will note its absence.
