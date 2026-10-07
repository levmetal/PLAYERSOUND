import { useCallback, useEffect, useReducer, useRef } from 'react'
import installReducer, { initialInstall, canOffer } from '../core/pwa/installState'

// Holds the browser's install prompt (Chrome, Edge, Android) so the menu can
// offer "Install app" only while it can actually be used. Safari has no such
// prompt; About explains Add to Home Screen instead.
export default function useInstallPrompt() {
    const [state, dispatch] = useReducer(installReducer, initialInstall)
    const promptRef = useRef(null)

    useEffect(() => {
        const standalone = window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true
        if (standalone) dispatch({ type: 'STANDALONE' })

        const onPrompt = (event) => {
            // Keeps the prompt for the menu item instead of the browser's own mini bar.
            event.preventDefault()
            promptRef.current = event
            dispatch({ type: 'PROMPT_AVAILABLE' })
        }
        const onInstalled = () => {
            promptRef.current = null
            dispatch({ type: 'INSTALLED' })
        }
        window.addEventListener('beforeinstallprompt', onPrompt)
        window.addEventListener('appinstalled', onInstalled)
        return () => {
            window.removeEventListener('beforeinstallprompt', onPrompt)
            window.removeEventListener('appinstalled', onInstalled)
        }
    }, [])

    const install = useCallback(async () => {
        const prompt = promptRef.current
        if (!prompt) return
        promptRef.current = null
        prompt.prompt()
        const { outcome } = await prompt.userChoice
        dispatch({ type: 'PROMPT_RESULT', payload: { outcome } })
    }, [])

    return { canInstall: canOffer(state), install }
}
