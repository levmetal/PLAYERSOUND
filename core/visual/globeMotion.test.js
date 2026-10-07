import { test } from 'node:test'
import assert from 'node:assert/strict'
import { vuEnvelope, stepSpin, globePulse, BASE_SPIN } from './globeMotion.js'

const close = (actual, expected, label) => assert.ok(Math.abs(actual - expected) < 1e-9, `${label}: ${actual} ≠ ${expected}`)

// Runs stepSpin for `seconds` at 60 fps.
const run = (speed, playing, seconds) => {
    let s = speed
    for (let i = 0; i < Math.round(seconds * 60); i++) s = stepSpin(s, playing, 1 / 60)
    return s
}

test('the envelope follows the VU meter keyframes, linear between them', () => {
    close(vuEnvelope(0), 0.15, '0')
    close(vuEnvelope(0.2), 0.9, '0.2')
    close(vuEnvelope(0.1), 0.525, '0.1')
    close(vuEnvelope(0.5), 0.7, '0.5')
    close(vuEnvelope(1), 0.15, '1')
})

test('the envelope wraps around the cycle in both directions', () => {
    close(vuEnvelope(1.2), 0.9, '1.2')
    close(vuEnvelope(-0.8), 0.9, '-0.8')
})

test('playing spins up from rest to the base speed within half a second', () => {
    assert.ok(run(0, true, 0.5) >= BASE_SPIN * 0.95)
})

test('the spin never overshoots the base speed', () => {
    assert.ok(run(0, true, 3) <= BASE_SPIN)
})

test('pausing coasts down gradually instead of stopping at once', () => {
    assert.ok(run(BASE_SPIN, false, 0.25) >= BASE_SPIN * 0.3)
    assert.ok(run(BASE_SPIN, false, 1.5) < BASE_SPIN * 0.05)
})

test('a paused spin settles at exactly zero', () => {
    assert.equal(run(BASE_SPIN, false, 5), 0)
})

test('the pulse is still when the globe is stopped', () => {
    assert.deepEqual(globePulse(0, 0.22), { spin: 0, glow: 1 })
})

test('at full speed the pulse rides the meter: faster and brighter on its peaks', () => {
    const peak = globePulse(BASE_SPIN, 0.2 * 1.1)
    close(peak.spin, BASE_SPIN * (1 + 0.6 * 0.9), 'spin')
    close(peak.glow, 1 + 0.35 * 0.9, 'glow')
    assert.ok(globePulse(BASE_SPIN, 0).spin < peak.spin)
})

test('a coasting globe pulses less, in proportion to its speed', () => {
    const half = globePulse(BASE_SPIN / 2, 0.2 * 1.1)
    close(half.glow, 1 + 0.35 * 0.9 * 0.5, 'glow')
})
