# @deepseek-ai/dsh-tool-save-report

[English](README.md) | 中文

面向模型的工具：把报告文件写进 dsh workbench 工作树，然后 `git add` +
`commit` + `push`，失败时带 `pull --rebase` 重试。

## 用途

把 HR 专家提示词里的"保存报告 + git push"流程包装成工具，agent 在产出筛选报告、
沟通草稿等之后即可调用。每次调用是一个独立提交（不做批量提交）。

## 配置

```yaml
- plugin: @deepseek-ai/dsh-tool-save-report
  config:
    workbenchRoot: ~/dsh-workbench
    gitAuthorEmail: dsh-bot@your-company.example.com
    gitAuthorName: dsh-workbench
```

`workbenchRoot` 必须是一个 `git clone`，其 remote 指向公司共享 git 服务器。SSH
凭据来自本地环境（`~/.ssh/`）；插件不管理它们。

## Git push 语义

| 阶段 | 行为 |
|---|---|
| `git add <relative_path>` | 只添加报告文件 |
| `git commit -m "<message>"` | 每份报告一个提交 |
| `git push`（首次尝试） | 快进推送 |
| 推送失败时 | `git pull --rebase` 后重试 `git push` 一次 |
| rebase 冲突时 | `git rebase --abort`，返回 `pushed: false`，保留本地提交 |

重试用于处理以下情况：另一个客户端（如其他 HR 机器上的 Trae）在本地上次 fetch
与本次 push 之间向同一 remote 推了提交。

## 工具契约

| 字段 | 值 |
|---|---|
| `name` | `save_report` |
| `parameters` | `relative_path: string`、`content: string`、`commit_message: string` |
| `output.schema` | `{ saved_path: string, commit_hash: string, pushed: boolean, push_error?: string }` |
| `exec.signal` | 遵循（透传给所有 `execAsync` 调用） |

## 已知限制与待办

- 无文件锁；两个并发 `save_report` 调用写同一路径会竞争。POC 假设：agent
  一次只处理一个候选人。
- 除单次 rebase 尝试外不重试；持续的网络问题会留下需要手动 `git push` 的
  本地提交。
- 不签名（GPG / SSH 提交签名）。
