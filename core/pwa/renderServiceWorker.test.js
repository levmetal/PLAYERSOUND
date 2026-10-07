import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { renderServiceWorker } from './renderServiceWorker.js'

const policySource = readFileSync(new URL('./cachePolicy.js', import.meta.url), 'utf8')
const glueSource = 'self.addEventListener("fetch", () => strategyFor)\n'

// Runs the rendered worker with a fake `self` and hands back what it defined.
const evaluate = (source, self = { addEventListener() {} }) =>
    new Function('self', `${source}\nreturn { VERSION, strategyFor, cacheNames, staleCaches }`)(self)

test('the worker is a classic script with no exports', () => {
    const out = renderServiceWorker({ policySource, glueSource, version: 'b2' })
    assert.doesNotMatch(out, /^\s*export\b/m)
    assert.doesNotThrow(() => new Function(out))
})

test('the worker carries the version, the policy functions and the glue', () => {
    const out = renderServiceWorker({ policySource, glueSource, version: 'b2' })
    const listeners = []
    const worker = evaluate(out, { addEventListener: (type) => listeners.push(type) })
    assert.equal(worker.VERSION, 'b2')
    assert.deepEqual(worker.cacheNames(worker.VERSION), { static: 'playersound-static-b2', pages: 'playersound-pages-b2' })
    assert.equal(worker.strategyFor({ url: 'https://x.app/api/search/a', method: 'GET', mode: 'cors' }, 'https://x.app'), 'network')
    assert.deepEqual(listeners, ['fetch'])
})

test('a version with quotes cannot break out of its string', () => {
    const out = renderServiceWorker({ policySource, glueSource, version: `a"b'c` })
    assert.equal(evaluate(out).VERSION, `a"b'c`)
})

test('a policy that imports something is refused', () => {
    assert.throws(
        () => renderServiceWorker({ policySource: "import x from './x.js'\nexport const a = 1", glueSource, version: 'b2' }),
        /self-contained/,
    )
})
