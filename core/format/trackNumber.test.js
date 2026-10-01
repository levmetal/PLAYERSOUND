import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatTrackNumber } from './trackNumber.js'

const cases = [
    [[3, 20], '03'],
    [[3, 5], '03'],
    [[12, 20], '12'],
    [[7, 120], '007'],
    [[100, 100], '100'],
    [[1], '01'],
]

for (const [args, expected] of cases) {
    test(`position ${args[0]} of ${args[1] ?? 'unknown'} reads ${expected}`, () => {
        assert.equal(formatTrackNumber(...args), expected)
    })
}

test('a position that is not a real track number reads --, never a fake number', () => {
    for (const bad of [0, -2, NaN, undefined, 2.5]) {
        assert.equal(formatTrackNumber(bad, 20), '--')
    }
})
