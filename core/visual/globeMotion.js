// How the player's globe moves: it turns only while a track plays, coasts to a
// stop on pause like a tape deck's reels, and pulses with the VU meter. The
// meter is decorative (the YouTube frame exposes no audio), so the pulse
// follows the meter's own rhythm — the vu-bounce keyframes in
// styles/player.module.css — rather than real levels.

/** Radians per frame at 60 fps: the globe's resting speed while playing. */
export const BASE_SPIN = 0.02

// vu-bounce: one 1.1 s cycle, column height (0–1) at each keyframe.
const VU_CYCLE_SECONDS = 1.1
const VU_KEYFRAMES = [[0, 0.15], [0.2, 0.9], [0.35, 0.4], [0.5, 0.7], [0.65, 0.25], [0.8, 0.55], [1, 0.15]]

// A reel spins up fast and coasts down slowly (time constants, in seconds).
const SPIN_UP_TAU = 0.15
const COAST_TAU = 0.4
const STOP_BELOW = BASE_SPIN * 0.001

const PULSE_SPIN = 0.6
const PULSE_GLOW = 0.35

/**
 * The VU meter's curve at a point of its cycle (0–1, wraps), linear between keyframes.
 * @param {number} phase
 * @returns {number} 0–1
 */
export function vuEnvelope(phase) {
    const p = phase - Math.floor(phase)
    for (let i = 1; i < VU_KEYFRAMES.length; i++) {
        const [x1, y1] = VU_KEYFRAMES[i]
        if (p <= x1) {
            const [x0, y0] = VU_KEYFRAMES[i - 1]
            return y0 + ((p - x0) / (x1 - x0)) * (y1 - y0)
        }
    }
    return VU_KEYFRAMES[VU_KEYFRAMES.length - 1][1]
}

/**
 * One step of the spin's inertia: towards BASE_SPIN while playing, towards 0 when not.
 * @param {number} speed current spin (radians per 60 fps frame)
 * @param {boolean} playing
 * @param {number} dt seconds since the last step
 * @returns {number}
 */
export function stepSpin(speed, playing, dt) {
    const target = playing ? BASE_SPIN : 0
    const tau = playing ? SPIN_UP_TAU : COAST_TAU
    const next = speed + (target - speed) * (1 - Math.exp(-dt / tau))
    return !playing && next < STOP_BELOW ? 0 : Math.min(BASE_SPIN, Math.max(0, next))
}

/**
 * The spin and glow for this moment, pulsing with the meter in proportion to how fast the globe turns.
 * @param {number} speed current spin (from stepSpin)
 * @param {number} seconds a clock in seconds
 * @returns {{ spin: number, glow: number }}
 */
export function globePulse(speed, seconds) {
    if (speed <= 0) return { spin: 0, glow: 1 }
    const level = speed / BASE_SPIN
    const env = vuEnvelope(seconds / VU_CYCLE_SECONDS)
    return { spin: speed * (1 + PULSE_SPIN * env * level), glow: 1 + PULSE_GLOW * env * level }
}
