/**
 * `custom-persona` — the generated child preset's system prompt row.
 *
 * It shadows the deployment persona with the parent-supplied text and sets
 * `interpolate: false`, so a prompt containing `{{...}}` (templates, code,
 * JSON examples) reaches the model literally instead of failing assembly.
 * `complete: true` makes the text the sole system prompt; runtime context is
 * suppressed to match the Minimal preset.
 *
 * @module @mosire/dsh-persona-mode/custom-persona
 */

/** Cordis plugin name used by loader diagnostics. */
export const name = 'persona-custom-persona'

/** The prompt registry is the only required service. */
export const inject = ['systemPrompt']

/**
 * Register the custom persona section.
 * @param {any} ctx - Cordis plugin context.
 * @param {{prefix?: string}} [config] - row configuration.
 */
export function apply(ctx, config = {}) {
  const prefix = typeof config.prefix === 'string' ? config.prefix : ''
  ctx.effect(() => ctx.systemPrompt.section({
    name: 'deployment:persona-prefix',
    order: 0,
    text: prefix,
    complete: true,
    interpolate: false,
  }))
  ctx.effect(() => ctx.systemPrompt.suppressRuntimeContext())
}
