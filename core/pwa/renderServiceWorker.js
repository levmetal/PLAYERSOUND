// Joins the cache policy and the worker's glue code into one classic script
// (service workers registered without `type: 'module'` can't use exports).

/**
 * @param {{ policySource: string, glueSource: string, version: string }} parts
 * @returns {string}
 */
export function renderServiceWorker({ policySource, glueSource, version }) {
    if (/^\s*import\b/m.test(policySource)) {
        throw new Error('The cache policy must be self-contained: no imports')
    }
    const policy = policySource.replace(/^export\s+(?=(?:async\s+)?function\b|const\b|let\b)/gm, '')
    return [
        `const VERSION = ${JSON.stringify(version)}`,
        policy.trim(),
        glueSource.trim(),
        '',
    ].join('\n\n')
}
