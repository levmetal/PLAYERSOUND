import { useEffect, useRef } from 'react'
import styles from '../styles/dataPixelArc.module.css'

// Halftone dome of glowing phosphor pixels, ported and re-tuned from a Canvas 2D
// reference (arc/intensity math) to run behind the hero cassette using this
// project's own CRT phosphor palette (styles/tokens.css) instead of the source's colors.
const OPTIONS = {
    pixelSize: 6,
    arcCenter: 0.58,
    arcDrop: 0.95,
    thickness: 0.32,
    speed: 0.85,
    brightness: 1,
    // The dome's own horizontal peak defaults to dead center (0.5), but the
    // hero's cassetteHero.png isn't centered on its own hand/wrist — sampling
    // the source PNG's opaque pixels puts the wrist at roughly 63% across
    // the image, which (given how much of the frame's width the
    // object-fit:contain image actually fills) lands around here as a
    // fraction of this canvas's own width. Nudged slightly past that
    // measured value (not exactly on top of it) so the wrist reads as
    // sitting a touch left of the halo's own peak, not dead-centered on it.
    centerXFrac: 0.60,
}

function prefersReducedMotion() {
    return (
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
    )
}

export default function DataPixelArc({ className }) {
    const canvasRef = useRef(null)

    useEffect(() => {
        const canvas = canvasRef.current
        const container = canvas.parentElement
        const context = canvas.getContext('2d', { alpha: true })
        if (!context || !container) return undefined

        let width = 1
        let height = 1
        let time = 0
        let frameId = null
        let inView = true
        const motionEnabled = !prefersReducedMotion()

        const resize = () => {
            const rect = container.getBoundingClientRect()
            width = Math.max(1, rect.width)
            height = Math.max(1, rect.height)
            const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
            canvas.width = Math.round(width * pixelRatio)
            canvas.height = Math.round(height * pixelRatio)
            context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
        }

        const render = () => {
            context.clearRect(0, 0, width, height)

            const { pixelSize, arcCenter, arcDrop, thickness, brightness, centerXFrac } = OPTIONS
            const cols = Math.ceil(width / pixelSize)
            const rows = Math.ceil(height / pixelSize)
            const arcCenterY = height * arcCenter
            const arcDropPx = height * arcDrop
            const thicknessPx = height * thickness

            for (let x = 0; x < cols; x += 1) {
                const px = x * pixelSize
                const nx = (px / width - centerXFrac) * 2
                const curveY = arcCenterY + Math.pow(Math.abs(nx), 1.8) * arcDropPx
                const edgeFade = Math.max(0, 1 - Math.pow(Math.abs(nx), 2.5))
                if (edgeFade <= 0.01) continue

                for (let y = 0; y < rows; y += 1) {
                    const py = y * pixelSize
                    let intensity = Math.max(0, 1 - Math.abs(py - curveY) / thicknessPx)
                    if (intensity <= 0.01) continue

                    const wave1 = Math.sin(nx * 4 - time * 1.5) * 0.1
                    const wave2 = Math.cos(py * 0.01 + time) * 0.1
                    intensity = Math.max(0, Math.min(1, intensity + wave1 + wave2))
                    intensity *= edgeFade
                    if (intensity <= 0.02) continue

                    const coreStrength = Math.pow(intensity, 3)
                    const midStrength = Math.pow(intensity, 1.5)
                    // Phosphor green core (--phosphor-primary #00FF66) with a warmer
                    // near-white hot-core, same weighting shape as the source math.
                    const r = Math.floor((10 * intensity + 140 * coreStrength) * brightness)
                    const g = Math.floor((200 * midStrength + 55 * coreStrength) * brightness)
                    const b = Math.floor((70 * intensity + 90 * coreStrength) * brightness)

                    context.fillStyle = `rgb(${r}, ${g}, ${b})`
                    context.globalAlpha = intensity
                    context.fillRect(px, py, pixelSize - 1, pixelSize - 1)
                }
            }

            context.globalAlpha = 1
            time += 0.02 * OPTIONS.speed
        }

        const loop = () => {
            if (inView) render()
            frameId = requestAnimationFrame(loop)
        }

        resize()
        render()
        if (motionEnabled) {
            frameId = requestAnimationFrame(loop)
        }

        const resizeObserver = new ResizeObserver(() => {
            resize()
            render()
        })
        resizeObserver.observe(container)

        const intersectionObserver = new IntersectionObserver(([entry]) => {
            inView = entry.isIntersecting
        })
        intersectionObserver.observe(canvas)

        return () => {
            if (frameId) cancelAnimationFrame(frameId)
            resizeObserver.disconnect()
            intersectionObserver.disconnect()
        }
    }, [])

    return (
        <canvas
            ref={canvasRef}
            className={`${styles.canvas} ${className || ''}`}
            aria-hidden="true"
        />
    )
}
