// The "03" in a track row: its 1-based position, zero-padded to the width of
// the list's size (never narrower than two digits) so numbers line up.

/**
 * @param {number} position  1-based
 * @param {number} [total]   how many rows the list has
 * @returns {string}  '--' when `position` isn't a real track number
 */
export function formatTrackNumber(position, total = 0) {
    if (!Number.isInteger(position) || position < 1) return '--'
    const width = Math.max(2, String(Math.max(total, position)).length)
    return String(position).padStart(width, '0')
}
