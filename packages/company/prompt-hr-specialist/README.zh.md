# @deepseek-ai/dsh-prompt-hr-specialist

[English](README.md) | 中文

HR 专家系统提示词段：5 种模式（筛选、JD 起草、候选人沟通、政策与 SOP、HR 行动审批）。

## 用途

在系统提示词组装中注册一个部署人设段（`order: 0`）。该段文本是原始 HR专员.md 的
dsh 侧改写版，所有 hr-resume-project 专用的路径与命令都已替换为 dsh workbench 约定：

- "调 markitdown-local skill" → "调 `parse_resume` 工具"
- "每份产出文件写入完成后 git push" → "调 `save_report` 工具持久化"
- 移除了对 dsh 中尚不可用的下游技能的引用
  （`md-structure`、`interview-designer`、`paper-audit`、`osint-check`、
  `datapro`、`doubao-search`）
- 合规红线与 5 模式路由结构原样保留

## 配置

```yaml
- plugin: @deepseek-ai/dsh-prompt-hr-specialist
  config:
    promptFile: ./packages/company/prompt-hr-specialist/assets/hr-specialist.md
    complete: false
```

两个字段均可选。`promptFile` 默认指向内置 asset；`complete` 默认为 `false`
（与 harness 身份共存）。

## 系统提示词契约

| 字段 | 值 |
|---|---|
| `name` | `company:hr-specialist` |
| `order` | `0`（部署人设带） |
| `text` | 插件 apply 时从 `assets/hr-specialist.md` 加载 |
| `complete` | 默认 `false` |

## 已知限制与待办

- 提示词在插件 apply 时只加载一次；编辑 markdown 后需要重启 dsh，不支持热重载。
- 改写版丢弃了对 L1 背景调查技能（paper-audit / osint-check）的引用，dsh 侧
  尚无对应实现；可用时以 dsh 工具插件形式补回。
- JD 模式引用 `01.岗位需求/_模板/JD模板.md` 模板；workbench 数据仓库必须提供
  该文件，否则 agent 会记录其缺失。
