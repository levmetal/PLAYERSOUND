// Whether to offer "Install app": only while the browser has handed us its
// install prompt and the app isn't already installed.

/** @typedef {{ available: boolean, installed: boolean }} InstallState */

/** @type {InstallState} */
export const initialInstall = { available: false, installed: false }

/**
 * @param {InstallState} state
 * @param {{ type: 'STANDALONE' | 'PROMPT_AVAILABLE' | 'INSTALLED' }
 *   | { type: 'PROMPT_RESULT', payload: { outcome: 'accepted' | 'dismissed' } }} action
 * @returns {InstallState}
 */
export default function installReducer(state, action) {
    switch (action.type) {
        case 'STANDALONE':
        case 'INSTALLED':
            return { available: false, installed: true }
        case 'PROMPT_AVAILABLE':
            return state.installed ? state : { ...state, available: true }
        case 'PROMPT_RESULT':
            // A prompt can be shown once; the browser may hand over a new one later.
            return { available: false, installed: state.installed || action.payload.outcome === 'accepted' }
        default:
            return state
    }
}

/** @param {InstallState} state */
export const canOffer = (state) => state.available && !state.installed
