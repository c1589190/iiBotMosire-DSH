/**
 * `subagent_custom` — the parent-authored one-shot subagent.
 *
 * The parent supplies the child's complete system prompt. The tool registers a
 * throwaway preset whose `dsh-persona` prefix is that prompt, starts an
 * in-process `spawn` child with the Minimal tool group, and disposes the preset
 * declaration once the child is published. The live child keeps its composition
 * revision; a cold resume after restart is intentionally not supported.
 *
 * The child cannot use QQ/Inbox tools: `persona-mode-context` denies every
 * `qq_*`/`inbox_*` call from a session with `delegationDepth > 0`.
 *
 * @module @mosire/dsh-persona-mode/custom-subagent
 */
import {
  buildCustomPreset,
  customPresetId,
  DEFAULT_MAX_SYSTEM_PROMPT_CHARS,
  DEFAULT_SYSTEM_PROMPT,
  normalizeSystemPrompt,
} from './lib/custom-subagent.js'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'persona-custom-subagent'

/** Host services this preset child resolves. */
export const inject = ['agentPresets', 'subagents', 'tools']

/** Model-facing parameter schema. */
const PARAMETERS = {
  type: 'object',
  properties: {
    prompt: {
      type: 'string',
      minLength: 1,
      description:
        '子 Agent 的第一条 user 消息。写清：它是谁/要做什么、任务、必要上下文、输出格式。系统提示词默认是极简模式那句，角色细节应写在这里，不要只写“帮我查一下”。',
    },
    system_prompt: {
      type: 'string',
      description:
        '可选。子 Agent 的完整系统提示词；省略时使用极简模式同款 "You are a helpful software engineer assistant."。一次性任务建议省略，把角色写进 prompt。',
    },
    description: {
      type: 'string',
      description: '任务短标签，显示在子会话列表里。',
    },
    cwd: {
      type: 'string',
      description: '子 Agent 的初始工作目录；省略则继承父 Agent 当前目录。',
    },
  },
  required: ['prompt'],
  additionalProperties: false,
}

/** Canonical result: the child id, not its eventual answer. */
const OUTPUT = {
  schema: {
    type: 'object',
    properties: {
      kind: { type: 'string' },
      subagentId: { type: 'string' },
    },
    required: ['kind', 'subagentId'],
    additionalProperties: false,
  },
  render(_args, value) {
    return [{ type: 'text', text: `started subagent ${value.subagentId}` }]
  },
}

const DESCRIPTION = [
  '把一个自包含的任务交给一次性子 Agent。',
  '子 Agent 的系统提示词默认是极简模式同款（You are a helpful software engineer assistant.），也可以用 system_prompt 覆盖。',
  'prompt 会成为子 Agent 的第一条 user 消息：角色、任务、必要上下文、输出格式都写进去。',
  '示例 prompt：“你是规则检索员。任务：在 wenyu/rules 中查找夜袭判定。上下文：群 1104560326 的当前回合。输出：三条原文引用 + 一句结论。”',
  '它看不到当前对话，不要只写“帮我查一下”。',
  '它挂 Minimal 工具组（read、read_image、bash），不能使用 QQ/Inbox 工具，也不能再创建子 Agent。',
  '它完成后会把最终答复作为完成通知返回给你；由你决定要不要发到群里。',
  '每次调用都会启动一条独立模型循环，只在重活时使用。',
].join('')

/**
 * Register `subagent_custom` in the persona preset.
 * @param {any} ctx - Cordis plugin context.
 * @param {{provider?: string, toolName?: string, defaultSystemPrompt?: string,
 * maxSystemPromptChars?: number}} [config] - row configuration.
 */
export function apply(ctx, config = {}) {
  const provider = config.provider ?? 'spawn'
  const toolName = config.toolName ?? 'subagent_custom'
  const fallbackPrompt = config.defaultSystemPrompt ?? DEFAULT_SYSTEM_PROMPT
  const maxChars = config.maxSystemPromptChars ?? DEFAULT_MAX_SYSTEM_PROMPT_CHARS

  const tool = {
    name: toolName,
    description: DESCRIPTION,
    parameters: PARAMETERS,
    output: OUTPUT,
    async execute(args, exec) {
      const prompt = typeof args?.prompt === 'string' ? args.prompt.trim() : ''
      if (prompt === '') throw new Error('prompt 不能为空')

      const parent = exec.agent
      if (parent === undefined) throw new Error('缺少父 Agent 上下文，无法创建子 Agent')
      if ((parent.session?.header?.delegationDepth ?? 0) > 0) {
        throw new Error('子 Agent 不能再创建子 Agent')
      }

      const systemPrompt = normalizeSystemPrompt(args.system_prompt, {
        fallback: fallbackPrompt,
        maxChars,
      })
      const id = customPresetId(systemPrompt)
      const dispose = await ctx.agentPresets.register(buildCustomPreset({ id, systemPrompt }))
      try {
        const activation = await ctx.subagents.startActivation({
          provider,
          label:
            typeof args.description === 'string' && args.description.trim() !== ''
              ? args.description.trim()
              : 'custom subagent',
          request: {
            ...(typeof args.cwd === 'string' && args.cwd.trim() !== ''
              ? { cwd: args.cwd.trim() }
              : {}),
            prompt: [{ type: 'text', text: prompt }],
            parent,
            agentPreset: id,
            maxDepth: 1,
          },
          signal: exec.signal,
          delivery: 'parent',
        })
        return { kind: 'activation', subagentId: activation.childId }
      } finally {
        await dispose()
      }
    },
  }

  ctx.effect(() => ctx.tools.register(tool))
}
