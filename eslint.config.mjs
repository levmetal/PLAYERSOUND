import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'

export default defineConfig([
  ...nextVitals,
  {
    // Same rules as before the Next 16 upgrade. These three came with the newer
    // react-hooks plugin (React Compiler readiness) and flag 34 deliberate
    // patterns, most of them ref reads in the player and its engine; adopting
    // them is a separate decision, not part of the upgrade.
    rules: {
      'react-hooks/refs': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/set-state-in-effect': 'off',
    },
  },
  globalIgnores(['.next/**', '.vercel/**', 'out/**', 'build/**', 'public/sw.js', 'docs/**']),
])
