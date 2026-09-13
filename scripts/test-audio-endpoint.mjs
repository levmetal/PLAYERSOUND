#!/usr/bin/env node
// Deterministic smoke test for the audio stream resolver (/api/soundplayer/[id]).
//
// Flow:
//   1. Pull real video ids from the local search endpoint (a handful of varied
//      queries: official VEVO, live performance, cover, auto-generated/topic
//      style, non-English) instead of hardcoding ids that may rot over time.
//   2. Hit /api/soundplayer/<id> for each one, plus one deliberately invalid id.
//   3. For each: record status, headers, timing, and body (error message on
//      failure). On success, save the bytes and validate them with ffprobe
//      (duration > 0, no corruption) instead of just trusting a 200/206.
//   4. Re-request one successful id with a Range header to confirm partial
//      content still works.
//   5. Print a pass/fail table with the exact failure reason per video, so a
//      broken video can be diagnosed without grepping server logs by hand.
//
// Usage: node scripts/test-audio-endpoint.mjs [baseUrl]
// Requires the Next.js dev server already running (npm run dev) and ffprobe
// on PATH (part of ffmpeg) for audio validation; validation is skipped with a
// warning if ffprobe isn't found.

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

const execFileAsync = promisify(execFile)
const baseUrl = process.argv[2] || 'http://localhost:3000'

const QUERIES = [
  'queen bohemian rhapsody',
  'eminem lose yourself',
  'despacito luis fonsi',
  'adele hello live',
  'lofi hip hop radio',
]

async function hasFfprobe() {
  try {
    await execFileAsync('ffprobe', ['-version'])
    return true
  } catch {
    return false
  }
}

async function fetchCandidates() {
  const candidates = []
  for (const q of QUERIES) {
    try {
      const res = await fetch(`${baseUrl}/api/search/${encodeURIComponent(q)}`)
      if (!res.ok) {
        console.warn(`[warn] search failed for "${q}": HTTP ${res.status}`)
        continue
      }
      const videos = await res.json()
      const top = videos?.[0]
      if (top?.id) {
        candidates.push({ id: top.id, title: top.title, query: q })
      }
    } catch (err) {
      console.warn(`[warn] search errored for "${q}": ${err.message}`)
    }
  }
  // deliberately broken id to confirm the endpoint fails fast and clearly
  candidates.push({ id: 'xxxxxxxxxxx', title: '(invalid id, expected to fail)', query: null })
  return candidates
}

async function probeAudio(filePath) {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration,format_name',
    '-of', 'json',
    filePath,
  ])
  const parsed = JSON.parse(stdout)
  const duration = parseFloat(parsed.format?.duration || '0')
  return { ok: duration > 1, duration, format_name: parsed.format?.format_name }
}

async function testOne(candidate, tmpDir, ffprobeAvailable) {
  const url = `${baseUrl}/api/soundplayer/${candidate.id}`
  const start = Date.now()
  const result = { ...candidate, url, ok: false }

  let res
  try {
    res = await fetch(url)
  } catch (err) {
    result.error = `network error: ${err.message}`
    result.elapsedMs = Date.now() - start
    return result
  }

  result.status = res.status
  result.contentType = res.headers.get('content-type')
  result.contentLength = res.headers.get('content-length')

  if (!res.ok) {
    try {
      result.error = (await res.text()).slice(0, 300)
    } catch (err) {
      result.error = `HTTP ${res.status}, and failed to read error body: ${err.message}`
    }
    result.elapsedMs = Date.now() - start
    return result
  }

  let buf
  try {
    buf = Buffer.from(await res.arrayBuffer())
  } catch (err) {
    // Connection dropped mid-stream (e.g. the resolver's upstream fetch to
    // googlevideo failed after headers were already sent to us).
    result.error = `connection dropped while reading body (likely failed mid-stream on the server): ${err.message}`
    result.elapsedMs = Date.now() - start
    return result
  }
  result.bytesReceived = buf.length
  result.elapsedMs = Date.now() - start

  if (result.contentLength && Number(result.contentLength) !== buf.length) {
    result.error = `Content-Length header (${result.contentLength}) doesn't match bytes received (${buf.length})`
    return result
  }

  if (ffprobeAvailable) {
    const filePath = path.join(tmpDir, `${candidate.id}.audio`)
    await writeFile(filePath, buf)
    try {
      const probe = await probeAudio(filePath)
      result.duration = probe.duration
      result.format_name = probe.format_name
      if (!probe.ok) {
        result.error = `ffprobe reports invalid/empty audio (duration=${probe.duration})`
        return result
      }
    } catch (err) {
      result.error = `ffprobe failed to parse response as audio: ${err.message}`
      return result
    }
  }

  result.ok = true
  return result
}

async function testRange(candidate) {
  if (!candidate?.ok) return null
  const url = `${baseUrl}/api/soundplayer/${candidate.id}`
  const res = await fetch(url, { headers: { Range: 'bytes=100000-200000' } })
  return {
    id: candidate.id,
    status: res.status,
    contentRange: res.headers.get('content-range'),
    ok: res.status === 206 && !!res.headers.get('content-range'),
  }
}

async function main() {
  const ffprobeAvailable = await hasFfprobe()
  if (!ffprobeAvailable) {
    console.warn('[warn] ffprobe not found on PATH — skipping audio validity checks, only checking HTTP status/bytes.\n')
  }

  console.log(`Testing audio resolver at ${baseUrl}/api/soundplayer/<id>\n`)

  const candidates = await fetchCandidates()
  const tmpDir = await mkdtemp(path.join(tmpdir(), 'playersound-audio-test-'))
  const results = []

  for (const candidate of candidates) {
    process.stdout.write(`- ${candidate.id} (${candidate.title})... `)
    let result
    try {
      result = await testOne(candidate, tmpDir, ffprobeAvailable)
    } catch (err) {
      result = { ...candidate, ok: false, error: `test crashed: ${err.message}` }
    }
    results.push(result)
    console.log(result.ok ? `OK (${result.elapsedMs}ms, ${result.duration ? result.duration.toFixed(1) + 's' : result.bytesReceived + ' bytes'})` : `FAIL — ${result.error}`)
  }

  const firstOk = results.find(r => r.ok)
  const rangeResult = await testRange(firstOk)

  await rm(tmpDir, { recursive: true, force: true })

  console.log('\n--- Summary ---')
  const passed = results.filter(r => r.ok).length
  console.log(`${passed}/${results.length} videos resolved and streamed valid audio.`)
  if (rangeResult) {
    console.log(`Range/206 support: ${rangeResult.ok ? 'OK' : 'FAIL'} (status ${rangeResult.status}, Content-Range: ${rangeResult.contentRange})`)
  }

  const failures = results.filter(r => !r.ok)
  if (failures.length) {
    console.log('\nFailures (for triage against server logs):')
    for (const f of failures) {
      console.log(`  [${f.status ?? 'n/a'}] ${f.id} (${f.title}): ${f.error}`)
    }
    process.exitCode = 1
  }
}

main().catch(err => {
  console.error('Test script crashed:', err)
  process.exitCode = 1
})
