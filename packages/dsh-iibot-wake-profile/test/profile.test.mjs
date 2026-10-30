import assert from 'node:assert/strict'
import test from 'node:test'

import { apply, IIBOT_PROFILE } from '../index.js'

test('the iibot wake profile is a zero-semantic compatibility alias', () => {
  assert.deepEqual(IIBOT_PROFILE, {})
  const serialized = JSON.stringify(IIBOT_PROFILE)
  assert.ok(!serialized.includes('qq_'))
  assert.ok(!serialized.includes('inbox_claim'))
  assert.ok(!serialized.includes('completeKinds'))
  assert.ok(!serialized.includes('businessTools'))
  assert.ok(!serialized.includes('programMcpWarning'))
})

test('apply registers only the legacy iibot profile name', () => {
  let captured
  const ctx = {
    inboxWakeProfiles: {
      register(name, profile) {
        captured = { name, profile }
        return () => {}
      },
    },
  }
  const dispose = apply(ctx)
  assert.equal(captured.name, 'iibot')
  assert.equal(captured.profile, IIBOT_PROFILE)
  assert.equal(typeof dispose, 'function')
})
