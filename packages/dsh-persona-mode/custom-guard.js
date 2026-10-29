/**
 * `custom-guard` — mounted inside every generated child preset.
 *
 * The child must not touch the QQ surface: speaking and acking belong to the
 * top-level persona agent. This scoped guard denies every `qq_*`/`inbox_*` tool
 * call inside the child, independent of the Host-wide fallback guard.
 *
 * @module @mosire/dsh-persona-mode/custom-guard
 */

/** Cordis plugin name used by loader diagnostics. */
export const name = 'persona-custom-guard'

/** Only the tool guard registry is required. */
export const inject = ['tools']

/** Register the child-scoped QQ/Inbox denial. */
export function apply(ctx) {
  ctx.effect(() => ctx.tools.guard((exec) => {
    if (exec.name.startsWith('qq_') || exec.name.startsWith('inbox_')) {
      return '子 Agent 不能使用 QQ/Inbox 工具；把结果返回给主 Agent。'
    }
    return undefined
  }))
}
