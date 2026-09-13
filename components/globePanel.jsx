import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import styles from '../styles/globePanel.module.css'

// Same PIXEL_SIZE-style approach as pixelCassettePanel: render at a small
// native resolution, upscale via CSS image-rendering:pixelated, so the
// blockiness comes from real low resolution rather than a filter.
const RENDER_SIZE = 72

// 60/30/10, straight from the geometry/materials rather than a post-process:
// most of the wireframe is the dim structural green (--phosphor-secondary),
// one equatorial ring is the cyan accent (--rgb-cyan) — a plain white
// unlit-line source has no in-between tones for a luminance-based dither to
// work with (confirmed empirically: antialias is off, so every lit pixel is
// already at full brightness), so real color variety has to come from
// distinct meshes instead of a per-pixel remap.
const COLOR_WIREFRAME = 0x008f39
const COLOR_ACCENT = 0x00ffff

function prefersReducedMotion() {
    return (
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
    )
}

export default function GlobePanel() {
    const containerRef = useRef(null)

    useEffect(() => {
        const container = containerRef.current
        if (!container) return undefined

        let width = Math.max(1, container.clientWidth)
        let height = Math.max(1, container.clientHeight)

        const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 100)
        camera.position.z = 3

        const scene = new THREE.Scene()
        scene.background = new THREE.Color(0x050b05)

        const group = new THREE.Group()
        scene.add(group)

        // Radius 0.72, not 1 — at fov 35 / z 3 the camera's vertical frustum
        // is only ~1.9 units tall at the origin, so a full-radius (diameter 2)
        // sphere would poke past the top/bottom of its own render buffer with
        // no margin. 0.72 (diameter 1.44) leaves a comfortable border, matching
        // how the thumbnail sits inside its own box.
        const radius = 0.72
        const sphereGeometry = new THREE.SphereGeometry(radius, 16, 12)
        const wireframeGeometry = new THREE.WireframeGeometry(sphereGeometry)
        const lineMaterial = new THREE.LineBasicMaterial({ color: COLOR_WIREFRAME })
        const globe = new THREE.LineSegments(wireframeGeometry, lineMaterial)
        group.add(globe)

        // The one accent element: a single equatorial ring in cyan, standing
        // out against the dominant green lat/long grid.
        const ringGeometry = new THREE.TorusGeometry(radius, 0.014, 6, 48)
        const ringMaterial = new THREE.MeshBasicMaterial({ color: COLOR_ACCENT })
        const ring = new THREE.Mesh(ringGeometry, ringMaterial)
        ring.rotation.x = Math.PI / 2
        group.add(ring)

        const renderer = new THREE.WebGLRenderer({ antialias: false })
        renderer.domElement.style.imageRendering = 'pixelated'
        renderer.domElement.style.width = '100%'
        renderer.domElement.style.height = '100%'
        renderer.domElement.style.display = 'block'
        container.appendChild(renderer.domElement)

        let frameId = null
        let inView = true
        const motionEnabled = !prefersReducedMotion()
        const startTime = performance.now()

        const resize = () => {
            width = Math.max(1, container.clientWidth)
            height = Math.max(1, container.clientHeight)
            camera.aspect = width / height
            camera.updateProjectionMatrix()
            renderer.setSize(RENDER_SIZE, RENDER_SIZE, false)
        }

        const render = () => {
            const t = (performance.now() - startTime) * 0.001
            group.rotation.y = t * 0.5
            group.rotation.x = Math.sin(t * 0.3) * 0.15
            renderer.render(scene, camera)
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
        intersectionObserver.observe(container)

        return () => {
            if (frameId) cancelAnimationFrame(frameId)
            resizeObserver.disconnect()
            intersectionObserver.disconnect()
            sphereGeometry.dispose()
            wireframeGeometry.dispose()
            lineMaterial.dispose()
            ringGeometry.dispose()
            ringMaterial.dispose()
            renderer.dispose()
            if (renderer.domElement.parentNode === container) {
                container.removeChild(renderer.domElement)
            }
        }
    }, [])

    return <div ref={containerRef} className={styles.container} aria-hidden="true" />
}
