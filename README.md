
# PlayerSound

Search and stream audio from YouTube — no login, no fake genre filters, playlists saved
locally in your browser.

## Two ways to run this

YouTube blocks server-to-server audio requests from datacenter IPs (Vercel, Render, any
cloud host) — it does not block a real browser. So this app ships two playback engines:

- **Local (recommended, and the default)** — run it on your own machine
  (`npm run dev`) and it streams real audio directly, with **no ads** and no YouTube
  player on screen. Your machine's IP is a normal residential one, which is exactly what
  YouTube expects, so nothing gets blocked.
- **Hosted demo** ([playersound.vercel.app](https://playersound.vercel.app)) — runs in
  "iframe" mode instead: your own browser talks to YouTube's official player directly, so
  it works from anywhere without installing anything, but the YouTube player is visible
  and it *can* show ads (not guaranteed — see
  [`docs/AUDIO_BACKEND_BLOCKERS.md`](docs/AUDIO_BACKEND_BLOCKERS.md) for what was actually
  tested).

If you want the full experience — no ads, MediaSession lock-screen controls — clone it
and run it locally.

## Table of Contents

- [Getting Started](#getting-started)
- [Features](#features)
- [Technologies Used](#technologies-used)
- [Contributing](#contributing)
- [License](#license)

## Features

- Search and play stream audio from youtube
- Integration with libraries based on YOUTUBE API
- User-friendly interface

## Technologies Used

- Next.js
- React
- Node.js
- YouTube API

## Contributing

Contributions are welcome! Please fork the repository and submit a pull request.

## License

This project is licensed under the MIT License.

## Getting Started

### Prerequisites

Make sure you have the following installed on your machine:

- Node.js
- npm (Node Package Manager)

### Installation

**First:**

Clone the repository:

```bash
git clone https://github.com/levmetal/PLAYERSOUND
```

**Second:**

Navigate to the project directory:

```bash
cd PLAYERSOUND
```

**Third:**

Install the dependencies:

```bash
npm install
```

**Fourth:**

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.
This uses the native playback engine by default — real audio, no ads — since
`NEXT_PUBLIC_PLAYBACK_MODE` is unset. See `.env.local.example` for the full explanation.
