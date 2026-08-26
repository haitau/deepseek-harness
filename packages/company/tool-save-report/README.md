# @deepseek-ai/dsh-tool-save-report

Model-facing tool: write a report file into the dsh workbench working tree,
then `git add` + `commit` + `push` with `pull --rebase` retry.

## Purpose

Wraps the "save report + git push" flow from the HR specialist prompt into a
tool the agent can call after producing a screening report, communication
draft, etc. Each call is one independent commit (no batch commits).

## Configuration

```yaml
- plugin: @deepseek-ai/dsh-tool-save-report
  config:
    workbenchRoot: ~/dsh-workbench
    gitAuthorEmail: dsh-bot@your-company.example.com
    gitAuthorName: dsh-workbench
```

`workbenchRoot` must be a `git clone` whose remote points at the shared
company git server. SSH credentials come from the local environment
(`~/.ssh/`); the plugin does not manage them.

## Git push semantics

| Stage | Behavior |
|---|---|
| `git add <relative_path>` | Add only the report file |
| `git commit -m "<message>"` | One commit per report |
| `git push` (first attempt) | Fast-forward push |
| On push failure | `git pull --rebase` then retry `git push` once |
| On rebase conflict | `git rebase --abort`, return `pushed: false`, keep local commit |

The retry handles the case where another client (e.g. Trae on another HR's
machine) pushed to the same remote between this client's last fetch and push.

## Tool contract

| Field | Value |
|---|---|
| `name` | `save_report` |
| `parameters` | `relative_path: string`, `content: string`, `commit_message: string` |
| `output.schema` | `{ saved_path: string, commit_hash: string, pushed: boolean, push_error?: string }` |
| `exec.signal` | honored (passed to all `execAsync` calls) |

## Known Limitations and Deferred Work

- No file lock; two concurrent `save_report` calls writing to the same path
  race. POC assumption: the agent processes one candidate at a time.
- No retry beyond the single rebase attempt; persistent network issues
  leave a local commit that requires manual `git push`.
- No signing (GPG / SSH commit signing).
