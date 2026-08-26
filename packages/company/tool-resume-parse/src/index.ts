/**
 * Model-facing tool: parse resume PDF to Markdown via local markitdown-local OCR.
 *
 * Calls the bundled Python script (`scripts/markitdown_local.py`) under its own
 * `pyproject.toml` environment (no hr-resume dependency). Returns the parsed
 * Markdown content and its absolute path so downstream tools (e.g. save_report)
 * can reference it.
 *
 * @module @deepseek-ai/dsh-tool-resume-parse
 */

import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import { readFile, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { defineTool } from '@deepseek-ai/dsh-tools'

const execAsync = promisify(exec)

export const name = 'company-tool-resume-parse'
export const inject = ['tools']

/** Configuration for the resume parse tool. */
export interface Config {
  /**
   * Absolute path to the markitdown_local.py script. Defaults to the bundled
   * copy in this package's `scripts/` directory.
   */
  markitdownScript?: string
  /** uv executable path. Defaults to `'uv'`. */
  uvBin?: string
}

/** Schemastery configuration schema. */
export const Config: z<Config> = z.object({
  markitdownScript: z.string(),
  uvBin: z.string(),
})

const __dirname = dirname(fileURLToPath(import.meta.url))
const DEFAULT_SCRIPT = join(__dirname, '..', 'scripts', 'markitdown_local.py')

/**
 * Apply the plugin: register the `parse_resume` model-facing tool.
 * @param ctx - Cordis context with `tools` injected.
 * @param config - user-supplied config from cordis.yml.
 */
export function apply(ctx: Context, config: Config = {}) {
  const scriptPath = config.markitdownScript ?? DEFAULT_SCRIPT
  const uvBin = config.uvBin ?? 'uv'

  ctx.tools.register(defineTool({
    name: 'parse_resume',
    description:
      '把简历 PDF/图片解析为 Markdown (调本地 markitdown-local OCR, 断网运行)。' +
      '返回粗 md 内容, 不做段内合并或字段结构化 (由下游 agent 处理)。' +
      '调用者决定输出路径; 本 tool 不负责 git 提交。',
    parameters: {
      pdf_path: {
        type: 'string',
        required: true,
        description: '待解析的 PDF 文件绝对路径',
      },
      output_path: {
        type: 'string',
        required: true,
        description: '解析后 md 文件的输出绝对路径 (由调用者决定, 通常符合 workbench 目录约定)',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          markdown_path: { type: 'string', required: true },
          markdown_content: { type: 'string', required: true },
        },
      },
      render: (_args, value) => [{
        type: 'text',
        text:
          `已解析到: ${value.markdown_path}\n\n` +
          value.markdown_content.slice(0, 2000) +
          (value.markdown_content.length > 2000 ? '\n...(截断, 完整内容见 markdown_path)' : ''),
      }],
    },
    async execute(args, exec) {
      // 确保输出目录存在
      await mkdir(dirname(args.output_path), { recursive: true })

      // 调 markitdown_local.py (cwd 指向本包根, 让 uv 找到本包的 pyproject.toml)
      const packageRoot = join(__dirname, '..')
      await execAsync(
        `${uvBin} run python ${scriptPath} "${args.pdf_path}" -o "${args.output_path}"`,
        {
          cwd: packageRoot,
          signal: exec.signal,
        },
      )

      const markdown_content = await readFile(args.output_path, 'utf8')

      return {
        markdown_path: args.output_path,
        markdown_content,
      }
    },
  }))
}
