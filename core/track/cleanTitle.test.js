import { test } from 'node:test'
import assert from 'node:assert/strict'
import cleanTitle from './cleanTitle.js'

// Inputs are real YouTube titles returned by the search endpoint.
const cases = [
    ['drops a bracketed "Official Video"', 'Daft Punk - Digital Love (Official Video)', 'Daft Punk - Digital Love'],
    ['strips trailing noise words outside brackets', 'Daft Punk - Digital Love video oficial HD', 'Daft Punk - Digital Love'],
    ['drops everything after " | "', 'Bad Bunny - Tití Me Preguntó (Official Video) | Un Verano Sin Ti', 'Bad Bunny - Tití Me Preguntó'],
    ['removes quotes around the track', "Tame Impala - 'The Less I Know The Better' (live for Like A Version)", 'Tame Impala - The Less I Know The Better'],
    ['strips a trailing noise segment and its dash', 'De Musica Ligera - Soda Stereo - Video Oficial (4K Remasterizado)', 'De Musica Ligera - Soda Stereo'],
    ['drops a featured artist', 'Daft Punk - Instant Crush (Official Video) ft. Julian Casablancas', 'Daft Punk - Instant Crush'],
    ['collapses repeated whitespace', 'Arctic Monkeys - Do I Wanna Know?  (Live)', 'Arctic Monkeys - Do I Wanna Know?'],
    ['drops a remaster note from a bare track title', 'Dreams (2004 Remaster)', 'Dreams'],
    ['keeps apostrophes inside words', "Don't Stop Me Now (Official Video)", "Don't Stop Me Now"],
    ['keeps a year that is the track title', 'Prince - 1999', 'Prince - 1999'],
    ['returns an empty string for an empty title', '', ''],
]

for (const [name, input, expected] of cases) {
    test(`cleanTitle ${name}`, () => {
        assert.equal(cleanTitle(input), expected)
    })
}
