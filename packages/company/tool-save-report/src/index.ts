/**
 * Model-facing tool: write a report file into the dsh workbench working tree,
 * then `git add` + `git commit` + `git push` (with `git pull --rebase` retry on
 * non-fast-forward, and `git rebase --abort` cleanup on conflict).
 *
 * The workbench is an independent `git clone` of the shared remote; both Trae
 * (the historical hr-resume project) and dsh push to the same remote, so
 * concurrent pushes can collide. The retry-with-rebase handles that case.
 *
 * Git invocations use `execFile` with array arguments (never a shell string), so
 * `relative_path` and `commit_message` cannot inject shell metacharacters. The
 * tool refuses to run unless `~/.ssh/id_rsa.pub` is readable: that file is the
 * company-wide credential gate — no readable key means no push permission.
 *
 * @module @deepseek-ai/dsh-tool-save-report
 */

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { writeFile, mkdir, access, constants } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { homedir } from 'node:os'
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { defineTool } from '@deepseek-ai/dsh-tools'

const execFileAsync = promisify(execFile)

/** Absolute path to the user's SSH public key — the company-wide permission gate. */
const SSH_PUBKEY_PATH = join(homedir(), '.ssh', 'id_rsa.pub')

export const name = 'company-tool-save-report'
export const inject = ['tools']

/** Configuration for the save-report tool. */
export interface Config {
  /** Absolute path to the dsh workbench root (independent clone). */
  workbenchRoot: string
  /** Git author email for commits made by this tool. */
  gitAuthorEmail: string
  /** Git author name for commits made by this tool. */
  gitAuthorName: string
}

/** Schemastery configuration schema. */
export const Config: z<Config> = z.object({
  workbenchRoot: z.string().required(),
  gitAuthorEmail: z.string().required(),
  gitAuthorName: z.string().required(),
})

/**
 * Assert that `~/.ssh/id_rsa.pub` is readable. The company policy is: no
 * readable SSH public key on the local machine means no push permission, so the
 * tool refuses to start instead of failing mid-way through a commit.
 */
async function assertSshPermission(): Promise<void> {
  try {
    await access(SSH_PUBKEY_PATH, constants.R_OK)
  } catch {
    throw new Error(
      `save_report: 无 push 权限 — 未读到本地 SSH 公钥 ${SSH_PUBKEY_PATH}。` +
      `公司策略: ~/.ssh/id_rsa.pub 必须可读才允许执行 save_report。`,
    )
  }
}

/** Run `git <args...>` under the workbench root with the configured author. */
async function git(args: readonly string[], opts: {
  cwd: string
  signal: AbortSignal
  env: NodeJS.ProcessEnv
}): Promise<string> {
  const { stdout } = await execFileAsync('git', args as string[], {
    cwd: opts.cwd,
    signal: opts.signal,
    env: opts.env,
    maxBuffer: 10 * 1024 * 1024,
  })
  return stdout
}

/**
 * Apply the plugin: register the `save_report` model-facing tool.
 * @param ctx - Cordis context with `tools` injected.
 * @param config - user-supplied config from cordis.yml.
 */
export function apply(ctx: Context, config: Config) {
  const cfg = config

  ctx.tools.register(defineTool({
    name: 'save_report',
    description:
      '把报告内容写入 dsh 工作目录, 并执行 git add + commit + push。' +
      '每份报告独立一个 commit (不合并打包)。commit message 格式: "文档: {描述}"。' +
      'push 失败时自动 pull --rebase 后重试一次; rebase 冲突则 abort 并放弃 push, ' +
      '留 local commit 供人工处理。返回最终 commit hash 和 push 状态。' +
      '前置: 本机 ~/.ssh/id_rsa.pub 必须可读 (公司权限闸)。',
    parameters: {
      relative_path: {
        type: 'string',
        required: true,
        description:
          '输出文件相对路径 (相对于 workbenchRoot), 如 "03.初筛报告/人工智能部/AI产品工程师/2026-08-25黄浩-AI产品工程师-初筛.md"',
      },
      content: {
        type: 'string',
        required: true,
        description: '报告全文 (markdown)',
      },
      commit_message: {
        type: 'string',
        required: true,
        description: 'git commit message, 建议格式 "文档: {描述}"',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          saved_path: { type: 'string', required: true },
          commit_hash: { type: 'string', required: true },
          pushed: { type: 'boolean', required: true },
          push_error: { type: 'string' },
        },
      },
      render: (_args, value) => [{
        type: 'text',
        text: value.pushed
          ? `已保存: ${value.saved_path}\ncommit: ${value.commit_hash}\npushed: 成功`
          : `已保存: ${value.saved_path}\ncommit: ${value.commit_hash} (local only)\npush 失败: ${value.push_error ?? '未知原因'}`,
      }],
    },
    async execute(args, exec) {
      // 公司权限闸: SSH 公钥必须可读
      await assertSshPermission()

      const fullPath = join(cfg.workbenchRoot, args.relative_path)
      await mkdir(dirname(fullPath), { recursive: true })
      await writeFile(fullPath, args.content, 'utf8')

      const gitEnv = {
        ...process.env,
        GIT_AUTHOR_NAME: cfg.gitAuthorName,
        GIT_AUTHOR_EMAIL: cfg.gitAuthorEmail,
        GIT_COMMITTER_NAME: cfg.gitAuthorName,
        GIT_COMMITTER_EMAIL: cfg.gitAuthorEmail,
      }
      const gitOpts = {
        cwd: cfg.workbenchRoot,
        signal: exec.signal,
        env: gitEnv,
      }

      // 1. add + commit (本地操作, execFile 数组参数, 无 shell 注入风险)
      await git(['add', '--', args.relative_path], gitOpts)
      await git(['commit', '-m', args.commit_message, '--', args.relative_path], gitOpts)

      // 2. push (带 pull --rebase 重试一次)
      let pushed = false
      let push_error: string | undefined

      try {
        await git(['push'], gitOpts)
        pushed = true
      } catch {
        // 第一次 push 失败, 尝试 pull --rebase 后重试
        try {
          await git(['pull', '--rebase'], gitOpts)
          await git(['push'], gitOpts)
          pushed = true
        } catch (rebaseErr) {
          // rebase 冲突或 push 仍失败: abort 还原状态, 放弃 push, 留 local commit
          try {
            await git(['rebase', '--abort'], gitOpts)
          } catch {
            // 已经不在 rebase 状态, 无需 abort
          }
          const errMsg = rebaseErr instanceof Error ? rebaseErr.message : String(rebaseErr)
          push_error = `pull --rebase 失败: ${errMsg.slice(0, 500)}`
        }
      }

      // 3. 读最终 commit hash (rebase 后 hash 会变)
      let commit_hash = ''
      try {
        commit_hash = (await git(['rev-parse', 'HEAD'], gitOpts)).trim()
      } catch {
        commit_hash = 'unknown'
      }

      return {
        saved_path: fullPath,
        commit_hash,
        pushed,
        ...(push_error !== undefined ? { push_error } : {}),
      }
    },
  }))
}
