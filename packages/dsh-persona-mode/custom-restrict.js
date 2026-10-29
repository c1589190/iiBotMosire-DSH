/**
 * `custom-restrict` — mounted inside every generated child preset.
 *
 * The child's contract is exactly three tools: `read`, `read_image`, `bash`.
 * Global (Host-registered) tools — QQ/Inbox MCP, search plugins, context
 * helpers — must not leak into the child's catalog, both for token cost and for
 * execution safety. Scoped registrations from this preset stay visible, so an
 * empty `allow` mask leaves the three mounted tools intact.
 *
 * If the registry rejects a preset-scoped mask, the fallback guard still denies
 * every other tool at execution time (without the schema saving).
 *
 * @module @mosire/dsh-persona-mode/custom-restrict
 */

/** Cordis plugin name used by loader diagnostics. */
export const name = 'persona-custom-restrict'

/** Only the tool registry is required. */
export const inject = ['tools']

/** The only tools a custom child may use. */
const ALLOWED = new Set(['read', 'read_image', 'bash'])

/** Register the child-scoped tool mask. */
export function apply(ctx) {
  try {
    ctx.effect(() => ctx.tools.restrict({ allow: [] }))
  } catch {
    ctx.effect(() => ctx.tools.guard((exec) => (
      ALLOWED.has(exec.name)
        ? undefined
        : '子 Agent 只能使用 read/read_image/bash。'
    )))
  }
}
