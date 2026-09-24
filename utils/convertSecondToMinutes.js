const pad = (n) => (n < 10 ? `0${n}` : `${n}`);

// mm:ss, or h:mm:ss once a track reaches an hour (otherwise a 10h stream
// would read "600:00").
export const ConvertSecToMin = (durationSec) => {
    const total = Math.max(0, Math.floor(durationSec || 0));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
};
