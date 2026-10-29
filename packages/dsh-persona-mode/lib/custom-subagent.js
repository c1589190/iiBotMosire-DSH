/**
 * Pure helpers for the parent-authored one-shot subagent.
 *
 * The child preset is generated at call time: the parent's `system_prompt`
 * becomes the `custom-persona` prefix, and the child receives the
 * Minimal tool group. No `@deepseek-ai/*` runtime import is needed.
 *
 * @module @mosire/dsh-persona-mode/lib/custom-subagent
 */
import { randomUUID } from 'node:crypto'

import { hashText } from './persona.js'

/** The Minimal preset's system prompt, used when the parent omits one. */
export const DEFAULT_SYSTEM_PROMPT = 'You are a helpful software engineer assistant.'

/** Upper bound for a parent-supplied system prompt. */
export const DEFAULT_MAX_SYSTEM_PROMPT_CHARS = 8000

/**
 * Resolve the child's system prompt.
 * @param {unknown} value - parent-supplied `system_prompt`.
 * @param {{fallback?: string, maxChars?: number}} [options] - defaults and cap.
 * @returns {string} trimmed prompt.
 * @throws {Error} when the prompt exceeds the cap.
 */
export function normalizeSystemPrompt(value, options = {}) {
  const fallback = options.fallback ?? DEFAULT_SYSTEM_PROMPT
  const maxChars = options.maxChars ?? DEFAULT_MAX_SYSTEM_PROMPT_CHARS
  const text = typeof value === 'string' ? value.trim() : ''
  const chosen = text === '' ? fallback : text
  if (chosen.length > maxChars) {
    throw new Error(`system_prompt 太长：${chosen.length} 字符，上限 ${maxChars}`)
  }
  return chosen
}

/**
 * Stable, unique preset id for one custom child.
 * @param {string} systemPrompt - resolved prompt.
 * @returns {string} lowercase id with a short prompt hash and a random suffix.
 */
export function customPresetId(systemPrompt) {
  return `custom-${hashText(systemPrompt).slice(0, 12)}-${randomUUID().slice(0, 6)}`
}

/**
 * Build the one-shot child preset.
 *
 * The child gets the Minimal tool group (read/read_image + persistent bash),
 * compaction, and the parent-supplied system prompt. It deliberately omits
 * `dsh-agent-instructions` (so `bot/AGENTS.md` cannot override the prompt) and
 * the custom-subagent tool itself (no recursion).
 *
 * @param {{id: string, systemPrompt: string}} input - preset identity and prompt.
 * @returns {object} `PresetDefinition`-shaped object for `agentPresets.register`.
 */
export function buildCustomPreset({ id, systemPrompt }) {
  return {
    id,
    name: `自定义子 Agent ${id}`,
    description: 'One-shot custom subagent with a parent-supplied system prompt.',
    plugins: [
      {
        id: 'persona',
        name: '@mosire/dsh-persona-mode/custom-persona',
        config: { prefix: systemPrompt },
      },
      {
        id: 'tool-fs',
        name: '@deepseek-ai/dsh-tool-fs',
        config: {
          read: true,
          readImage: true,
          write: false,
          edit: false,
        },
      },
      {
        id: 'persistent-shell',
        name: 'cordis:group',
        group: true,
        isolate: { terminals: true },
        config: [
          { id: 'pty', name: '@deepseek-ai/dsh-terminal' },
          {
            id: 'terminal-bash',
            name: '@deepseek-ai/dsh-terminal-bash',
            config: { timeoutMs: 300000 },
          },
          {
            id: 'persistent-bash',
            name: '@deepseek-ai/dsh-tool-bash-persistent',
            config: { timeoutMs: 300000 },
          },
        ],
      },
      {
        id: 'compaction',
        name: 'cordis:group',
        group: true,
        isolate: { compaction: true },
        config: [
          { id: 'compaction-basic', name: '@deepseek-ai/dsh-compaction-basic' },
          { id: 'command-compact', name: '@deepseek-ai/dsh-command-compact' },
        ],
      },
      { id: 'custom-guard', name: '@mosire/dsh-persona-mode/custom-guard' },
      { id: 'custom-restrict', name: '@mosire/dsh-persona-mode/custom-restrict' },
    ],
  }
}
