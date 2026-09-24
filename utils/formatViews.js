const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });

// 438385 -> "438.4K views". null when the search API didn't return a count.
export function formatViews(views) {
    if (typeof views !== 'number' || !Number.isFinite(views) || views < 0) return null;
    return `${compact.format(views)} ${views === 1 ? 'view' : 'views'}`;
}
