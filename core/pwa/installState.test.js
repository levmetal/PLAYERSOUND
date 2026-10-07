import { test } from 'node:test'
import assert from 'node:assert/strict'
import installReducer, { initialInstall, canOffer } from './installState.js'

const run = (...types) => types.reduce((state, action) => installReducer(state, action), initialInstall)

test('nothing is offered at first', () => {
    assert.deepEqual(initialInstall, { available: false, installed: false })
    assert.equal(canOffer(initialInstall), false)
})

test('opened as the installed app, it is never offered', () => {
    const state = run({ type: 'STANDALONE' }, { type: 'PROMPT_AVAILABLE' })
    assert.equal(state.installed, true)
    assert.equal(canOffer(state), false)
})

test('the browser offering install makes it available', () => {
    const state = run({ type: 'PROMPT_AVAILABLE' })
    assert.deepEqual(state, { available: true, installed: false })
    assert.equal(canOffer(state), true)
})

test('accepting the prompt installs it and hides the offer', () => {
    const state = run({ type: 'PROMPT_AVAILABLE' }, { type: 'PROMPT_RESULT', payload: { outcome: 'accepted' } })
    assert.deepEqual(state, { available: false, installed: true })
})

test('dismissing the prompt hides the offer until the browser offers again', () => {
    const dismissed = run({ type: 'PROMPT_AVAILABLE' }, { type: 'PROMPT_RESULT', payload: { outcome: 'dismissed' } })
    assert.deepEqual(dismissed, { available: false, installed: false })
    assert.equal(canOffer(installReducer(dismissed, { type: 'PROMPT_AVAILABLE' })), true)
})

test('installing from the browser\'s own button hides the offer', () => {
    const state = run({ type: 'PROMPT_AVAILABLE' }, { type: 'INSTALLED' })
    assert.deepEqual(state, { available: false, installed: true })
})

test('an unknown event leaves the state alone', () => {
    const state = run({ type: 'PROMPT_AVAILABLE' })
    assert.equal(installReducer(state, { type: 'NOPE' }), state)
})
