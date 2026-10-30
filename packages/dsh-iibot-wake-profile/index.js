/**
 * `@mosire/dsh-iibot-wake-profile` — legacy zero-semantic compatibility alias.
 *
 * The generic InboxMosire adapter now renders view-ack rows from generic facts:
 * source, opaque kind, summary, and truncation state. Program workflows and
 * tool names live exclusively in the program-owned MCP descriptions.
 *
 * This bundle intentionally exposes no business tool names, business kinds,
 * readiness warning, or workflow copy. It only registers the `iibot` profile
 * name so existing profile configs keep resolving during migration.
 *
 * @module @mosire/dsh-iibot-wake-profile
 */

/** Cordis plugin name used by loader diagnostics. */
export const name = 'iibot-wake-profile'

/** The InboxMosire wake-profile registry. */
export const inject = ['inboxWakeProfiles']

/** Zero-semantic compatibility profile; generic bodies are supplied by the adapter. */
export const IIBOT_PROFILE = Object.freeze({})

/**
 * Register the legacy `iibot` profile name with the adapter's registry.
 * @param {any} ctx - Cordis plugin context.
 * @returns {() => void} registration disposer.
 */
export function apply(ctx) {
  return ctx.inboxWakeProfiles.register('iibot', IIBOT_PROFILE)
}
