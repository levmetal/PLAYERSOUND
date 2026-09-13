import { useLayoutEffect, useRef, useState } from 'react'
import styles from '../styles/marqueeText.module.css'

function prefersReducedMotion() {
    return (
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
    )
}

export default function MarqueeText({ text, className = '', speedPxPerSec = 40 }) {
    const containerRef = useRef(null)
    const measureRef = useRef(null)
    const [overflowing, setOverflowing] = useState(false)
    const [distance, setDistance] = useState(0)

    useLayoutEffect(() => {
        const container = containerRef.current
        const measure = measureRef.current
        if (!container || !measure) return undefined

        const check = () => {
            const containerWidth = container.clientWidth
            const textWidth = measure.scrollWidth
            setOverflowing(textWidth > containerWidth)
            setDistance(textWidth)
        }

        check()
        const resizeObserver = new ResizeObserver(check)
        resizeObserver.observe(container)
        return () => resizeObserver.disconnect()
    }, [text])

    const reduced = prefersReducedMotion()
    const animate = overflowing && !reduced
    const duration = distance > 0 ? distance / speedPxPerSec : 0

    return (
        <div ref={containerRef} className={`${styles.marquee} ${className}`}>
            <span ref={measureRef} className={styles.measure} aria-hidden="true">{text}</span>

            {animate ? (
                <div
                    className={styles.track}
                    style={{ '--marquee-distance': `${distance}px`, '--marquee-duration': `${duration}s` }}
                >
                    <span className={styles.copy}>{text}</span>
                    <span className={styles.copy} aria-hidden="true">{text}</span>
                </div>
            ) : (
                <span className={styles.static}>{text}</span>
            )}
        </div>
    )
}
