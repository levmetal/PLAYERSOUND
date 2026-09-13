#!/usr/bin/env node
// Wraps `next dev` and drops one specific, confirmed-harmless log line:
// "Watchpack Error (initial scan): Error: EINVAL: invalid argument, lstat '...'"
// for Windows-protected files at the drive root (pagefile.sys, hiberfil.sys,
// swapfile.sys, DumpStack.log.tmp, System Volume Information).
//
// This is standard Node module resolution walking up to the drive root
// looking for a node_modules folder, on every Windows machine, for every
// project — not a bug in this app, and not fixable via next.config.js
// (traced into node_modules/next/dist/compiled/watchpack/watchpack.js:
// the initial directory scan calls lstat on every entry and reports any
// failure via onScanError before webpack's `ignored` patterns are ever
// consulted, so they can't suppress it). Everything else passes through.
const { spawn } = require('child_process')

const NOISE_PATTERN = /^Watchpack Error \(initial scan\): Error: EINVAL: invalid argument, lstat/

function filterAndForward(stream, out) {
  let buffer = ''
  stream.on('data', (chunk) => {
    buffer += chunk.toString()
    const lines = buffer.split('\n')
    buffer = lines.pop()
    for (const line of lines) {
      if (!NOISE_PATTERN.test(line)) out.write(line + '\n')
    }
  })
  stream.on('end', () => {
    if (buffer && !NOISE_PATTERN.test(buffer)) out.write(buffer)
  })
}

// Pass the whole invocation as one string (not `args` + shell:true) to avoid
// Node's DEP0190 warning about that combination.
const child = spawn(['next', 'dev', ...process.argv.slice(2)].join(' '), { shell: true })
filterAndForward(child.stdout, process.stdout)
filterAndForward(child.stderr, process.stderr)
child.on('exit', (code) => process.exit(code ?? 0))
