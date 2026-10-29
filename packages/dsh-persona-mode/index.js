/**
 * `@mosire/dsh-persona-mode` — first-message persona contract for the
 * `persona-standard` agent preset.
 *
 * The preset's system prompt is only two lines; the actual character lives in
 * `PERSONA.md` under the session working directory. This Host plugin keeps the
 * contract visible on the model surface:
 *
 * - first request: inject `<persona-contract>` before the incoming message;
 * - compaction: the surface no longer carries it, so inject again;
 * - file edit: the hash changes, so inject the new version;
 * - resume with the old contract still visible: skip;
 * - missing or empty file: inject an operator notice and block outbound QQ
 *   sends so the mode never speaks without a persona.
 *
 * `qq_*` tools are Host MCP tools and are not declared by the preset.
 *
 * @module @mosire/dsh-persona-mode
 */
import {
  buildContractMessage,
  buildMissingMessage,
  isPersonaAgent,
  readPersona,
  surfaceHasContract,
  surfaceHasMissing,
} from './lib/persona.js'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'persona-mode-context'

/** The live-agent registry and the tool guard registry. */
export const inject = ['agents', 'tools']

/**
 * Wire persona injection for one Host profile.
 * @param {any} ctx - Cordis plugin context.
 * @param {{presetId?: string, file?: string, blockSend?: boolean}} [config] -
 * row configuration.
 */
export function apply(ctx, config = {}) {
  const presetId = config.presetId ?? 'persona-standard'
  const fileName = config.file ?? 'PERSONA.md'
  const blockSend = config.blockSend !== false

  ctx.on('agent/pre-step', async ({ agent }, next) => {
    const decision = await next()
    if (decision.kind === 'reject') return decision
    if (!isPersonaAgent(agent, presetId)) return decision
    if (decision.messages.length === 0) return decision

    const persona = readPersona(agent, fileName)
    const usable = persona !== undefined && persona.text.trim() !== ''

    if (!usable) {
      if (surfaceHasMissing(agent)) return decision
      return {
        ...decision,
        messages: [
          buildMissingMessage({ empty: persona !== undefined }),
          ...decision.messages,
        ],
      }
    }

    if (surfaceHasContract(agent, persona.hash)) return decision
    return {
      ...decision,
      messages: [buildContractMessage(persona), ...decision.messages],
    }
  })

  ctx.effect(() => ctx.tools.guard((exec) => {
    const depth = exec.agent?.session?.header?.delegationDepth ?? 0
    if (depth > 0 && (exec.name.startsWith('qq_') || exec.name.startsWith('inbox_'))) {
      return '子 Agent 不能直接使用 QQ/Inbox 工具；把结果返回给主 Agent。'
    }
    return undefined
  }))

  if (blockSend) {
    ctx.effect(() => ctx.tools.guard((exec) => {
      if (exec.name !== 'qq_conversation_send') return undefined
      if (!isPersonaAgent(exec.agent, presetId)) return undefined
      const persona = readPersona(exec.agent, fileName)
      if (persona !== undefined && persona.text.trim() !== '') return undefined
      return 'PERSONA.md 不存在或为空：人设扮演模式未启动，禁止外发。'
    }))
  }
}
