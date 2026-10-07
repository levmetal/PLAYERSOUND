// The web app manifest is a static file, checked here against what browsers
// need before they offer to install the app.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'

const publicDir = new URL('../../public/', import.meta.url)
const manifest = JSON.parse(readFileSync(new URL('manifest.webmanifest', publicDir), 'utf8'))
const tokens = readFileSync(new URL('../../styles/tokens.css', import.meta.url), 'utf8')

test('the manifest names the app and opens it standalone at the root', () => {
    assert.equal(manifest.name, 'PlayerSound')
    assert.equal(manifest.short_name, 'PlayerSound')
    assert.equal(manifest.id, '/')
    assert.equal(manifest.start_url, '/')
    assert.equal(manifest.display, 'standalone')
})

test('the manifest colours are the CRT black tint from the tokens', () => {
    const tint = tokens.match(/--crt-black-tint:\s*(#[0-9A-Fa-f]{6})/)[1].toLowerCase()
    assert.equal(manifest.theme_color.toLowerCase(), tint)
    assert.equal(manifest.background_color.toLowerCase(), tint)
})

test('the manifest has 192 and 512 PNG icons and a maskable one, and the files exist', () => {
    const find = (size, purpose) => manifest.icons.find((icon) =>
        icon.sizes === size && icon.type === 'image/png' && (icon.purpose ?? 'any').split(' ').includes(purpose))
    assert.ok(find('192x192', 'any'), '192 any')
    assert.ok(find('512x512', 'any'), '512 any')
    assert.ok(find('512x512', 'maskable'), '512 maskable')
    for (const icon of manifest.icons) {
        assert.ok(existsSync(new URL('.' + icon.src, publicDir)), icon.src)
    }
})

test('the apple touch icon exists', () => {
    assert.ok(existsSync(new URL('icons/apple-touch-icon.png', publicDir)))
})
