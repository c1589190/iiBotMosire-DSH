import assert from 'node:assert/strict'
import test from 'node:test'

import { apply } from '../custom-subagent.js'
import { apply as applyPersona } from '../custom-persona.js'
import { apply as applyRestrict } from '../custom-restrict.js'
import {
  buildCustomPreset,
  customPresetId,
  DEFAULT_SYSTEM_PROMPT,
  normalizeSystemPrompt,
} from '../lib/custom-subagent.js'

/** Capture what the tool registers and starts. */
function makeContext() {
  const captured = {
    tool: undefined,
    preset: undefined,
    spec: undefined,
    disposed: false,
  }
  const ctx = {
    effect(fn) {
      return fn()
    },
    tools: {
      register(definition) {
        captured.tool = definition
        return () => {}
      },
    },
    agentPresets: {
      async register(definition) {
        captured.preset = definition
        return async () => {
          captured.disposed = true
        }
      },
    },
    subagents: {
      async startActivation(spec) {
        captured.spec = spec
        return { childId: 'child-1' }
      },
    },
  }
  return { ctx, captured }
}

/** Minimal Agent-shaped parent. */
function makeParent(delegationDepth = 0) {
  return { session: { header: { delegationDepth, agentPreset: 'persona-standard' } } }
}

test('normalizeSystemPrompt defaults, trims, and caps', () => {
  assert.equal(normalizeSystemPrompt(undefined), DEFAULT_SYSTEM_PROMPT)
  assert.equal(normalizeSystemPrompt('  '), DEFAULT_SYSTEM_PROMPT)
  assert.equal(normalizeSystemPrompt(' 你是检索员。 '), '你是检索员。')
  assert.throws(() => normalizeSystemPrompt('x'.repeat(9000)), /太长/)
})

test('the default system prompt matches the Minimal preset', () => {
  assert.equal(DEFAULT_SYSTEM_PROMPT, 'You are a helpful software engineer assistant.')
})

test('the tool teaches the parent to write the first user message', () => {
  const { ctx, captured } = makeContext()
  apply(ctx, {})
  assert.match(captured.tool.description, /第一条 user/)
  assert.match(captured.tool.parameters.properties.prompt.description, /第一条 user/)
  assert.match(captured.tool.parameters.properties.system_prompt.description, /极简模式/)
})

test('customPresetId is unique and id-shaped', () => {
  const a = customPresetId('p')
  const b = customPresetId('p')
  assert.match(a, /^custom-[0-9a-f]{12}-[0-9a-f]{6}$/)
  assert.notEqual(a, b)
})

test('buildCustomPreset carries the prompt and the Minimal tool group', () => {
  const preset = buildCustomPreset({ id: 'custom-x', systemPrompt: '你是检索员。' })
  assert.equal(preset.id, 'custom-x')
  const persona = preset.plugins.find((row) => row.id === 'persona')
  assert.equal(persona.config.prefix, '你是检索员。')
  assert.equal(persona.name, '@mosire/dsh-persona-mode/custom-persona')
  assert.ok(preset.plugins.some((row) => row.id === 'tool-fs'))
  assert.ok(preset.plugins.some((row) => row.id === 'persistent-shell'))
  assert.ok(preset.plugins.some((row) => row.id === 'compaction'))
  assert.ok(preset.plugins.some((row) => row.id === 'custom-guard'))
  assert.ok(preset.plugins.some((row) => row.id === 'custom-restrict'))
  assert.equal(preset.plugins.some((row) => row.id === 'tool-custom-subagent'), false)
})

test('subagent_custom starts a spawn child with the generated preset', async () => {
  const { ctx, captured } = makeContext()
  apply(ctx, {})
  const parent = makeParent()
  const result = await captured.tool.execute(
    { prompt: '查一下规则', description: 'rules lookup' },
    { agent: parent, signal: new AbortController().signal },
  )
  assert.deepEqual(result, { kind: 'activation', subagentId: 'child-1' })
  assert.equal(captured.preset.id, captured.spec.request.agentPreset)
  assert.equal(
    captured.preset.plugins.find((row) => row.id === 'persona').config.prefix,
    DEFAULT_SYSTEM_PROMPT,
  )
  assert.equal(captured.spec.provider, 'spawn')
  assert.equal(captured.spec.delivery, 'parent')
  assert.equal(captured.spec.label, 'rules lookup')
  assert.equal(captured.spec.request.parent, parent)
  assert.equal(captured.spec.request.maxDepth, 1)
  assert.equal(captured.spec.request.prompt[0].text, '查一下规则')
  assert.equal(captured.disposed, true)
})

test('subagent_custom forwards a parent-supplied system prompt', async () => {
  const { ctx, captured } = makeContext()
  apply(ctx, {})
  await captured.tool.execute(
    { prompt: '算一下', system_prompt: '你是规则裁判，只输出判定。' },
    { agent: makeParent(), signal: new AbortController().signal },
  )
  assert.equal(
    captured.preset.plugins.find((row) => row.id === 'persona').config.prefix,
    '你是规则裁判，只输出判定。',
  )
})

test('subagent_custom rejects nested delegation and empty prompts', async () => {
  const { ctx, captured } = makeContext()
  apply(ctx, {})
  await assert.rejects(
    captured.tool.execute(
      { prompt: 'x' },
      { agent: makeParent(1), signal: new AbortController().signal },
    ),
    /不能再创建/,
  )
  await assert.rejects(
    captured.tool.execute(
      { prompt: '   ' },
      { agent: makeParent(), signal: new AbortController().signal },
    ),
    /prompt 不能为空/,
  )
})

test('custom-persona registers a complete, non-interpolating section', () => {
  const sections = []
  let suppressed = 0
  const ctx = {
    effect(fn) {
      return fn()
    },
    systemPrompt: {
      section(section) {
        sections.push(section)
        return () => {}
      },
      suppressRuntimeContext() {
        suppressed += 1
        return () => {}
      },
    },
  }
  applyPersona(ctx, { prefix: '你是检索员 {{不插值}}' })
  assert.equal(sections[0].name, 'deployment:persona-prefix')
  assert.equal(sections[0].order, 0)
  assert.equal(sections[0].complete, true)
  assert.equal(sections[0].interpolate, false)
  assert.equal(sections[0].text, '你是检索员 {{不插值}}')
  assert.equal(suppressed, 1)
})

test('custom-restrict hides every global tool', () => {
  let filter
  const ctx = {
    effect(fn) {
      return fn()
    },
    tools: {
      restrict(value) {
        filter = value
        return () => {}
      },
      guard() {
        throw new Error('the fallback guard must not be used')
      },
    },
  }
  applyRestrict(ctx)
  assert.deepEqual(filter, { allow: [] })
})

test('custom-restrict falls back to an allowlist guard', () => {
  let guard
  const ctx = {
    effect(fn) {
      return fn()
    },
    tools: {
      restrict() {
        throw new Error('preset scope rejected the mask')
      },
      guard(value) {
        guard = value
        return () => {}
      },
    },
  }
  applyRestrict(ctx)
  assert.equal(guard({ name: 'read' }), undefined)
  assert.match(guard({ name: 'qq_conversation_send' }), /只能使用/)
})
