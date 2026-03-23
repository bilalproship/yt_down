# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Setup
```bash
npm run setup        # install root + client dependencies
```

### Development (both servers)
```bash
npm run dev          # starts Express (port 3002) + Vite (port 5173) concurrently
```

### Run individually
```bash
npm run server       # Express backend only
npm run client       # Vite dev server only
```

### Production
```bash
cd client && npm run build   # build React app to client/dist/
npm start                    # run Express server only
```

## Architecture

This is a full-stack YouTube downloader with no file storage — videos are proxied in real time.

### Backend (`server/index.js`) — Express on port 3002

Three API routes:
- `GET /api/validate?url=` — checks if a URL is a valid YouTube URL
- `GET /api/info?url=` — returns video metadata + available format list
- `GET /api/download?url=&itag=` — streams the video to the browser

**Two download paths** depending on the format type:

1. **Combined (SD, `type: 'combined'`)** — video+audio in a single stream. Uses `youtubei.js` to decipher the CDN URL, then proxies it directly to the response via `fetch` + `Readable.fromWeb`.

2. **Adaptive HD (`type: 'mux'`)** — video-only stream (480p–1080p) that requires audio to be merged. The server:
   - Calls `yt-dlp --get-url` to resolve CDN URLs for the video and audio tracks (bypasses YouTube's SABR streaming protocol that `youtubei.js` can't resolve for adaptive formats)
   - Pipes both URLs into `ffmpeg-static` which merges them as a fragmented mp4 (`frag_keyframe+empty_moov`) streamed to the response in real time

**Innertube singleton (`getYT()`)** — `youtubei.js` session is initialized once at startup. It uses Node's `vm` module as the JS evaluator to run YouTube's obfuscated player script for cipher/n-parameter decoding.

**Format selection (`buildFormatList`)** — returns combined mp4 formats (SD) plus deduped adaptive mp4 formats (HD, max 1080p), sorted by quality descending.

### Frontend (`client/`) — React + Vite on port 5173

Single-page app with no routing and no state management library. All state lives in `App.jsx` using `useState`/`useCallback`.

- Vite proxies `/api/*` → `http://localhost:3002` (configured in `vite.config.js`)
- Download is triggered by programmatically clicking a hidden `<a>` tag pointing to `/api/download`
- Components: `App` (main state), `VideoCard` (result display + format picker), `FormatRow` (individual quality option)
- Inline SVG icons — no icon library

### Key dependencies
- `youtubei.js` — Innertube API client (video info + URL deciphering for combined streams)
- `youtube-dl-exec` — provides the `yt-dlp` binary path; used only for `--get-url` on HD formats
- `ffmpeg-static` — bundled ffmpeg binary; used only for muxing HD streams
- `concurrently` — dev-only, runs both servers from root
