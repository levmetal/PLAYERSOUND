import { useEffect, useState } from 'react'
import styles from '../styles/loader.module.css'

const FRAMES = ['◰', '◳', '◲', '◱']
const TELEMETRY_LINES = [
    'MEM_CHECK: 0x80F4A... OK',
    'CALIBRATING SIGNAL...',
    'BUFFER_SYNC: STABLE',
    'PHOSPHOR_TEST: PASS',
    'DECODING STREAM...',
]
const TOTAL_BLOCKS = 8

const Loader = ({ closing = false }) => {
    const [frame, setFrame] = useState(0)
    const [filled, setFilled] = useState(1)
    const [telemetryIndex, setTelemetryIndex] = useState(0)

    useEffect(() => {
        const frameTimer = setInterval(() => setFrame((f) => (f + 1) % FRAMES.length), 200)
        const barTimer = setInterval(() => setFilled((n) => (n >= TOTAL_BLOCKS ? 1 : n + 1)), 300)
        const telemetryTimer = setInterval(
            () => setTelemetryIndex((i) => (i + 1) % TELEMETRY_LINES.length),
            700
        )
        return () => {
            clearInterval(frameTimer)
            clearInterval(barTimer)
            clearInterval(telemetryTimer)
        }
    }, [])

    return (
        <div
            className={closing ? `${styles.overlay} ${styles.overlayClosing}` : styles.overlay}
            role="status"
            aria-live="polite"
        >
            {/* The single, stable announcement for assistive tech. The decorative
                readout below (box) is aria-hidden — its frame/bar/telemetry text
                changes every 200-700ms, which would otherwise spam a live region
                with announcements no one asked for. */}
            <span className="sr-only">Loading</span>
            <div className={styles.box} aria-hidden="true">
                <div className={styles.header}>SYSTEM INITIALIZING...</div>
                <div className={styles.frame}>{FRAMES[frame]}</div>
                <div className={styles.bar}>
                    {Array.from({ length: TOTAL_BLOCKS }).map((_, i) => (
                        <span
                            key={i}
                            className={`${styles.block} ${i < filled ? styles.blockFilled : ''}`}
                        />
                    ))}
                </div>
                <div className={styles.telemetry}>{TELEMETRY_LINES[telemetryIndex]}</div>
            </div>
        </div>
    )
}
export default Loader
