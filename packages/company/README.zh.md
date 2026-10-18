# 公司

[English](README.md) | 中文

公司专用插件，通过 `dsh --profile <profile>` 补丁层挂载。每条业务流从共享插件
（user-context、save-report、ldap-query）加上业务特定的工具与系统提示词，组装出
自己的 profile。

## 包

| 包 | 职责 |
|---|---|
| [`prompt-hr-specialist/`](prompt-hr-specialist/README.zh.md) | HR 专家系统提示词段（5 种模式：筛选、JD、候选人沟通、政策与 SOP、HR 行动审批） |
| [`tool-resume-parse/`](tool-resume-parse/README.zh.md) | PDF → Markdown 简历解析器（调用本地 markitdown-local OCR） |
| [`tool-save-report/`](tool-save-report/README.zh.md) | 写报告文件 + git add/commit/push，带 `pull --rebase` 重试 |

## Profile 组成

```yaml
# profiles/hr-profile/cordis.patch.yml
- plugin: @deepseek-ai/dsh-base
- plugin: @deepseek-ai/dsh-prompt-hr-specialist
- plugin: @deepseek-ai/dsh-tool-resume-parse
- plugin: @deepseek-ai/dsh-tool-save-report
```

## 数据隔离

每条业务流维护自己的工作目录（远端仓库的独立 `git clone`）。插件通过 cordis.yml
的 `config` 接收 `workbenchRoot`；没有任何插件硬编码路径。
