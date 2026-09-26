/**
 * A shuffled copy (Fisher–Yates). `rng` returns [0, 1) — Math.random in the
 * app, a fixed sequence in tests.
 * @template T
 * @param {T[]} list
 * @param {() => number} rng
 * @returns {T[]}
 */
export default function shuffle(list, rng) {
    const result = [...list]
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1))
        ;[result[i], result[j]] = [result[j], result[i]]
    }
    return result
}
