import assert from 'node:assert/strict'
import test from 'node:test'

import { apply, IIBOT_PROFILE } from '../index.js'

test('the iibot profile names qq read/ack and the Chinese body', () => {
  assert.deepEqual(IIBOT_PROFILE.businessTools, [
    'qq_conversation_read',
    'qq_conversation_ack',
  ])
  assert.match(IIBOT_PROFILE.programMcpWarning, /qq_conversation_read\/ack/)
  assert.match(IIBOT_PROFILE.viewAckBody.join('\n'), /qq_conversation_read\(source\)/)
  assert.match(IIBOT_PROFILE.viewAckSummaryBody.join('\n'), /qq_conversation_ack\(source\)/)
  assert.ok(!IIBOT_PROFILE.viewAckBody.join('\n').includes('inbox_claim'))
})

test('apply registers the iibot profile', () => {
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
