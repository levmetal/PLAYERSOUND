import { useEffect, useRef } from 'react'
import styles from '../styles/globePanel.module.css'

// A 2D-canvas Bayer-dithered rotating globe: procedural continents + a
// lat/long grid + Lambertian shading, ordered-dithered into flat color bands
// instead of a smooth gradient, colored with this app's own phosphor/cyan
// tokens. Render size is kept small on purpose: this
// is a CPU-bound nested pixel loop (unlike the wireframe-sphere version this
// replaces, which was GPU-rasterized geometry and cheap at any resolution),
// so render size has a real per-frame cost. Kept modest and let CSS
// upscaling (image-rendering: pixelated) do the rest — same trick the old
// version used, just at a lower base resolution since visible pixel blocks
// are the point of a dither look, not a limitation to hide.
const RENDER_SIZE = 96

// Mirrors --phosphor-secondary / --phosphor-primary / --rgb-cyan in
// styles/tokens.css — hardcoded here (not read via getComputedStyle) since
// this paints raw canvas pixels every frame; same precedent this file's
// previous THREE.js material colors set. No "off" color constant: unlit
// pixels get alpha 0 (see render() below) so the panel's own
// --crt-black-tint background (styles/globePanel.module.css) shows through
// instead of a second, separately-maintained near-black value.
const C_DIM = [0, 143, 57]      // --phosphor-secondary #008F39
const C_BRIGHT = [0, 255, 102]  // --phosphor-primary #00FF66
const C_PEAK = [0, 255, 255]    // --rgb-cyan — the one accent, same role the old equatorial ring played

// 4x4 ordered (Bayer) dither matrix, normalized 0..1 — turns smooth
// lighting into the same "screen door" halftone a real low-res CRT/plasma
// readout would show, rather than a soft gradient that would read as a flat
// web graphic instead of hardware.
const BAYER_4X4 = [
    [0 / 16, 8 / 16, 2 / 16, 10 / 16],
    [12 / 16, 4 / 16, 14 / 16, 6 / 16],
    [3 / 16, 11 / 16, 1 / 16, 9 / 16],
    [15 / 16, 7 / 16, 13 / 16, 5 / 16],
]

function prefersReducedMotion() {
    return (
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
    )
}

export default function GlobePanel() {
    const containerRef = useRef(null)
    const canvasRef = useRef(null)

    useEffect(() => {
        const container = containerRef.current
        const canvas = canvasRef.current
        if (!container || !canvas) return undefined

        canvas.width = RENDER_SIZE
        canvas.height = RENDER_SIZE
        const ctx = canvas.getContext('2d')
        const imageData = ctx.createImageData(RENDER_SIZE, RENDER_SIZE)
        const data = imageData.data

        const cx = RENDER_SIZE / 2
        const cy = RENDER_SIZE / 2
        // Leaves room for the dotted orbital ring outside the sphere itself,
        // same proportions as the reference (radius 44 in a 112px canvas).
        const radius = RENDER_SIZE * 0.39
        const ringRadius = radius * 1.16
        const tilt = 0.28 // ~16 degrees axial tilt, matches the reference

        // Fixed directional light (upper-right-front), matches the reference.
        const lx = 0.55
        const ly = -0.45
        const lz = 0.70

        let angle = 0
        let frameId = null
        let inView = true
        const motionEnabled = !prefersReducedMotion()

        const render = () => {
            if (motionEnabled) angle += 0.02

            for (let y = 0; y < RENDER_SIZE; y++) {
                for (let x = 0; x < RENDER_SIZE; x++) {
                    const idx = (y * RENDER_SIZE + x) * 4
                    const dx = x - cx
                    const dy = y - cy
                    const distSq = dx * dx + dy * dy

                    if (distSq > radius * radius) {
                        // Dotted orbital ring — the one "radar" accent outside the
                        // sphere proper, same dim tone as the grid's resting state.
                        const ringDist = Math.abs(Math.sqrt(distSq) - ringRadius)
                        if (ringDist < 1 && (x + y) % 4 === 0) {
                            data[idx] = C_DIM[0]
                            data[idx + 1] = C_DIM[1]
                            data[idx + 2] = C_DIM[2]
                            data[idx + 3] = 255
                        } else {
                            data[idx + 3] = 0
                        }
                        continue
                    }

                    // Surface normal of the sphere at this pixel.
                    const nx = dx / radius
                    const ny = dy / radius
                    const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny))

                    // Axial tilt, then the planet's own spin.
                    const ry1 = ny * Math.cos(tilt) - nz * Math.sin(tilt)
                    const rz1 = ny * Math.sin(tilt) + nz * Math.cos(tilt)
                    const lon = Math.atan2(nx, rz1) + angle
                    const lat = Math.asin(Math.max(-1, Math.min(1, ry1)))

                    // Procedural "continents" — layered sine/cosine noise, no
                    // real map data, same as the reference.
                    const landNoise =
                        Math.sin(lon * 3) * Math.cos(lat * 2.5) +
                        Math.sin(lon * 6 + 1.2) * 0.45 +
                        Math.cos(lat * 4) * 0.3
                    const isLand = landNoise > 0.12

                    // Lat/long grid.
                    const meridian = Math.abs(Math.sin(lon * 6)) < 0.08
                    const parallel = Math.abs(Math.sin(lat * 5)) < 0.08
                    const isGrid = (meridian || parallel) && nz > 0.15

                    // Lambertian diffuse lighting — land reflects more than ocean.
                    const diffuse = Math.max(0, nx * lx + ny * ly + nz * lz)
                    let illumination = diffuse * (isLand ? 0.95 : 0.45)
                    if (isGrid) illumination += 0.25

                    // Ordered dither against the Bayer threshold at this pixel.
                    const bayerThreshold = BAYER_4X4[y % 4][x % 4]

                    if (isGrid && illumination > 0.3) {
                        data[idx] = C_PEAK[0]
                        data[idx + 1] = C_PEAK[1]
                        data[idx + 2] = C_PEAK[2]
                        data[idx + 3] = 255
                    } else if (illumination > bayerThreshold * 1.1) {
                        data[idx] = C_BRIGHT[0]
                        data[idx + 1] = C_BRIGHT[1]
                        data[idx + 2] = C_BRIGHT[2]
                        data[idx + 3] = 255
                    } else if (illumination > bayerThreshold * 0.5) {
                        data[idx] = C_DIM[0]
                        data[idx + 1] = C_DIM[1]
                        data[idx + 2] = C_DIM[2]
                        data[idx + 3] = 255
                    } else {
                        // Dark side / open ocean — falls through to the panel
                        // background instead of a painted "off" black.
                        data[idx + 3] = 0
                    }
                }
            }

            ctx.putImageData(imageData, 0, 0)
        }

        const loop = () => {
            if (inView) render()
            frameId = requestAnimationFrame(loop)
        }

        // Square canvas centered in a not-necessarily-square container — a
        // stretched (non-uniform-scaled) canvas would render the sphere as an
        // ellipse, since (unlike the THREE.js camera it replaces) this 2D
        // pixel grid has no aspect-ratio-aware projection of its own.
        const resize = () => {
            const size = Math.min(container.clientWidth, container.clientHeight)
            canvas.style.width = `${size}px`
            canvas.style.height = `${size}px`
        }

        resize()
        render()
        if (motionEnabled) frameId = requestAnimationFrame(loop)

        const resizeObserver = new ResizeObserver(resize)
        resizeObserver.observe(container)

        const intersectionObserver = new IntersectionObserver(([entry]) => {
            inView = entry.isIntersecting
        })
        intersectionObserver.observe(container)

        return () => {
            if (frameId) cancelAnimationFrame(frameId)
            resizeObserver.disconnect()
            intersectionObserver.disconnect()
        }
    }, [])

    return (
        <div ref={containerRef} className={styles.container} aria-hidden="true">
            <canvas ref={canvasRef} className={styles.canvas} />
        </div>
    )
}
