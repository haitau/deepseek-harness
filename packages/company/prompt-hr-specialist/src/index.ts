/**
 * HR Specialist system prompt section.
 *
 * Loads the bundled `assets/hr-specialist.md` (a dsh-side rewrite of the
 * original HR专员.md, with hr-resume-specific paths replaced by dsh
 * workbench conventions) and registers it as a deployment-persona section
 * (`order: 0`) in the system prompt assembly.
 *
 * @module @deepseek-ai/dsh-prompt-hr-specialist
 */

import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-system-prompt'
import z from '@deepseek-ai/schemastery'

export const name = 'company-prompt-hr-specialist'
export const inject = ['systemPrompt']

const __dirname = dirname(fileURLToPath(import.meta.url))
const DEFAULT_PROMPT_PATH = join(__dirname, '..', 'assets', 'hr-specialist.md')

/** Configuration for the HR specialist prompt section. */
export interface Config {
  /**
   * Absolute path to the HR specialist prompt markdown. Defaults to the
   * bundled `assets/hr-specialist.md`.
   */
  promptFile?: string
  /**
   * Whether this section becomes the complete system prompt (overriding the
   * harness identity). Default `false`: coexists with the harness identity
   * and other plugin sections.
   */
  complete?: boolean
}

/** Schemastery configuration schema. */
export const Config: z<Config> = z.object({
  promptFile: z.string(),
  complete: z.boolean(),
})

/**
 * Apply the plugin: load the HR specialist prompt and register it as a
 * system-prompt section.
 * @param ctx - Cordis context with `systemPrompt` injected.
 * @param config - user-supplied config from cordis.yml.
 */
export async function apply(ctx: Context, config: Config = {}) {
  const promptPath = config.promptFile ?? DEFAULT_PROMPT_PATH
  const promptText = await readFile(promptPath, 'utf8')

  ctx.systemPrompt.section({
    name: 'company:hr-specialist',
    order: 0,
    text: promptText,
    complete: config.complete ?? false,
  })
}
