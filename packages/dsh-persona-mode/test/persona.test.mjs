import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { apply } from '../index.js'
import {
  buildContractMessage,
  buildMissingMessage,
  hashText,
  isPersonaAgent,
  personaPath,
  readPersona,
  surfaceHasContract,
  surfaceHasMissing,
} from '../lib/persona.js'

/** Build a minimal Agent-shaped object for pure helpers and the wiring. */
function makeAgent({
  messages = [],
  preset = 'persona-standard',
  cwd = '/tmp/bot',
  depth = 0,
} = {}) {
  return {
    session: {
      header: { agentPreset: preset, cwd, delegationDepth: depth },
      surface: { nodes: messages.map((_, index) => index) },
      eventAt: (seq) => ({ type: 'user/message', data: messages[seq] }),
    },
  }
}

/** Capture the plugin's listener and guard registrations. */
function makeContext() {
  const listeners = []
  const guards = []
  return {
    listeners,
    guards,
    effect(fn) {
      return fn()
    },
    on(event, handler) {
      listeners.push({ event, handler })
      return () => {}
    },
    tools: {
      guard(handler) {
        guards.push(handler)
        return () => {}
      },
    },
  }
}

/** Run the one registered pre-step listener with a wake message. */
async function runPreStep(context, agent, wakeText = '[INBOX_HOST_EVENT]') {
  const wake = {
    id: 'wake-1',
    role: 'user',
    content: [{ type: 'text', text: wakeText }],
    source: { kind: 'inbox-mosire' },
  }
  const handler = context.listeners.find((entry) => entry.event === 'agent/pre-step').handler
  return handler({ agent }, async () => ({ kind: 'enter', messages: [wake] }))
}

test('hashText is stable and distinguishes edits', () => {
  assert.equal(hashText('abc'), hashText('abc'))
  assert.notEqual(hashText('abc'), hashText('abd'))
})

test('isPersonaAgent matches only the configured preset', () => {
  assert.equal(isPersonaAgent(makeAgent(), 'persona-standard'), true)
  assert.equal(isPersonaAgent(makeAgent({ preset: 'minimal' }), 'persona-standard'), false)
})

test('personaPath resolves against the session cwd', () => {
  assert.equal(
    personaPath(makeAgent({ cwd: '/tmp/bot' }), 'PERSONA.md'),
    '/tmp/bot/PERSONA.md',
  )
})

test('contract message is a user message carrying a hashed contract', () => {
  const text = '你是测试角色。'
  const hash = hashText(text)
  const message = buildContractMessage({ text, hash })
  assert.equal(message.role, 'user')
  assert.equal(message.source.kind, 'persona-contract')
  assert.equal(message.source.hash, hash)
  assert.equal(message.source.form, 'snapshot')
  assert.equal(message.source.sections[0].text, text)
  assert.match(message.content[0].text, /<persona-contract>/)
  assert.match(message.content[0].text, /你是测试角色。/)
})

test('missing message distinguishes absent and empty files', () => {
  const absent = buildMissingMessage()
  const empty = buildMissingMessage({ empty: true })
  assert.equal(absent.source.kind, 'persona-missing')
  assert.match(absent.content[0].text, /没有 PERSONA\.md/)
  assert.match(empty.content[0].text, /空文件/)
})

test('surface helpers find the exact contract and the missing notice', () => {
  const hash = hashText('角色')
  const contract = buildContractMessage({ text: '角色', hash })
  const missing = buildMissingMessage()
  assert.equal(surfaceHasContract(makeAgent({ messages: [contract] }), hash), true)
  assert.equal(surfaceHasContract(makeAgent({ messages: [contract] }), hashText('别人')), false)
  assert.equal(surfaceHasContract(makeAgent(), hash), false)
  assert.equal(surfaceHasMissing(makeAgent({ messages: [missing] })), true)
  assert.equal(surfaceHasMissing(makeAgent({ messages: [contract] })), false)
})

test('readPersona reads the session file and reports absence', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'persona-'))
  try {
    writeFileSync(join(cwd, 'PERSONA.md'), '角色设定\n', 'utf8')
    const persona = readPersona(makeAgent({ cwd }), 'PERSONA.md')
    assert.equal(persona.text, '角色设定\n')
    assert.equal(persona.hash, hashText('角色设定\n'))
    assert.equal(readPersona(makeAgent({ cwd }), 'MISSING.md'), undefined)
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})

test('pre-step injects the contract before the wake message', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'persona-'))
  try {
    writeFileSync(join(cwd, 'PERSONA.md'), '你是测试角色。\n', 'utf8')
    const context = makeContext()
    apply(context, { presetId: 'persona-standard' })
    const decision = await runPreStep(context, makeAgent({ cwd }))
    assert.equal(decision.messages.length, 2)
    assert.equal(decision.messages[0].source.kind, 'persona-contract')
    assert.equal(decision.messages[1].source.kind, 'inbox-mosire')
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})

test('pre-step leaves other presets untouched', async () => {
  const context = makeContext()
  apply(context, { presetId: 'persona-standard' })
  const decision = await runPreStep(context, makeAgent({ preset: 'minimal' }))
  assert.equal(decision.messages.length, 1)
  assert.equal(decision.messages[0].source.kind, 'inbox-mosire')
})

test('pre-step skips when the same contract is already visible', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'persona-'))
  try {
    writeFileSync(join(cwd, 'PERSONA.md'), '你是测试角色。\n', 'utf8')
    const contract = buildContractMessage({ text: '你是测试角色。\n', hash: hashText('你是测试角色。\n') })
    const context = makeContext()
    apply(context, { presetId: 'persona-standard' })
    const agent = makeAgent({ cwd, messages: [contract] })
    const decision = await runPreStep(context, agent)
    assert.equal(decision.messages.length, 1)
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})

test('pre-step injects the missing notice and blocks outbound sends', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'persona-'))
  try {
    const context = makeContext()
    apply(context, { presetId: 'persona-standard' })
    const agent = makeAgent({ cwd })
    const decision = await runPreStep(context, agent)
    assert.equal(decision.messages[0].source.kind, 'persona-missing')
    const sendGuard = context.guards.at(-1)
    const denial = sendGuard({ name: 'qq_conversation_send', agent })
    assert.match(denial, /PERSONA\.md/)
    assert.equal(sendGuard({ name: 'qq_conversation_ack', agent }), undefined)
    assert.equal(
      sendGuard({ name: 'qq_conversation_send', agent: makeAgent({ preset: 'minimal' }) }),
      undefined,
    )
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})

test('the guard allows sends once the file exists', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'persona-'))
  try {
    writeFileSync(join(cwd, 'PERSONA.md'), '角色\n', 'utf8')
    const context = makeContext()
    apply(context, { presetId: 'persona-standard' })
    assert.equal(
      context.guards.at(-1)({ name: 'qq_conversation_send', agent: makeAgent({ cwd }) }),
      undefined,
    )
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})

test('subagents cannot call QQ or Inbox tools', () => {
  const context = makeContext()
  apply(context, {})
  const guard = context.guards[0]
  assert.match(
    guard({ name: 'qq_conversation_send', agent: makeAgent({ depth: 1 }) }),
    /子 Agent/,
  )
  assert.match(
    guard({ name: 'inbox_adapter_status', agent: makeAgent({ depth: 1 }) }),
    /子 Agent/,
  )
  assert.equal(guard({ name: 'read', agent: makeAgent({ depth: 1 }) }), undefined)
  assert.equal(guard({ name: 'qq_conversation_send', agent: makeAgent() }), undefined)
})
