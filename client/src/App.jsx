import { useState, useRef, useCallback } from 'react'
import './App.css'

// ── Icons ─────────────────────────────────────────────────────────────────────

const IconYT = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="28" height="28">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
  </svg>
)

const IconDownload = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
)

const IconSearch = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
    <circle cx="11" cy="11" r="8"/>
    <path d="m21 21-4.35-4.35"/>
  </svg>
)

const IconCopy = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
    <rect x="9" y="9" width="13" height="13" rx="2"/>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
  </svg>
)

const IconClear = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" width="16" height="16">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
)

const IconInfo = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="15" height="15">
    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
)

const IconPlay = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
    <path d="M8 5v14l11-7z"/>
  </svg>
)

const IconSpinner = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="18" height="18" className="spin">
    <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"/>
  </svg>
)

const IconCheck = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
)

// ── Utility ───────────────────────────────────────────────────────────────────

function formatViews(n) {
  const num = parseInt(n?.replace(/,/g, '') || '0')
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}B views`
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M views`
  if (num >= 1_000) return `${(num / 1_000).toFixed(0)}K views`
  return `${num} views`
}

function qualityBadgeColor(quality) {
  if (!quality) return '#666'
  const h = parseInt(quality)
  if (h >= 1080) return '#a78bfa'
  if (h >= 720)  return '#60a5fa'
  if (h >= 480)  return '#34d399'
  if (h >= 360)  return '#fbbf24'
  return '#9ca3af'
}

// ── Components ────────────────────────────────────────────────────────────────

function FormatRow({ format, selected, onSelect }) {
  const color = qualityBadgeColor(format.quality)
  const isMux = format.type === 'mux'
  return (
    <label className={`format-row ${selected ? 'selected' : ''}`}>
      <input
        type="radio"
        name="format"
        value={format.itag}
        checked={selected}
        onChange={() => onSelect(format.itag)}
      />
      <span className="quality-badge" style={{ color, borderColor: `${color}44`, background: `${color}18` }}>
        {format.quality || '?'}
        {format.fps && format.fps > 30 && <span className="fps-tag">{format.fps}fps</span>}
      </span>
      <span className="format-container">{format.container?.toUpperCase()}</span>
      <span className={`format-type ${isMux ? 'mux' : ''}`}>
        {format.type === 'combined' ? '🔊 Audio+Video' : '🎬 HD — auto-muxed'}
      </span>
      <span className="format-size">{format.size}</span>
    </label>
  )
}

function VideoCard({ info, url, onReset }) {
  const [selectedItag, setSelectedItag] = useState(info.formats[0]?.itag)
  const [downloading, setDownloading] = useState(false)
  const [dlDone, setDlDone] = useState(false)
  const [imgLoaded, setImgLoaded] = useState(false)

  const handleDownload = useCallback(() => {
    if (!selectedItag) return
    setDownloading(true)
    setDlDone(false)

    const qs = new URLSearchParams({ url, itag: selectedItag })
    const a = document.createElement('a')
    a.href = `/api/download?${qs}`
    a.download = ''
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)

    // Give visual feedback briefly, then mark done
    setTimeout(() => {
      setDownloading(false)
      setDlDone(true)
      setTimeout(() => setDlDone(false), 3000)
    }, 1500)
  }, [selectedItag, url])

  const selectedFormat = info.formats.find(f => String(f.itag) === String(selectedItag))

  return (
    <div className="video-card">
      {/* Thumbnail */}
      <div className="thumbnail-wrap">
        {info.thumbnail && (
          <>
            <div className={`thumb-skeleton ${imgLoaded ? 'hidden' : ''}`} />
            <img
              src={info.thumbnail}
              alt={info.title}
              className={`thumbnail ${imgLoaded ? 'loaded' : ''}`}
              onLoad={() => setImgLoaded(true)}
            />
          </>
        )}
        <div className="thumb-overlay">
          <span className="play-icon"><IconPlay /></span>
        </div>
        {info.isShort && <span className="shorts-badge">#Shorts</span>}
        <span className="duration-badge">{info.duration}</span>
      </div>

      {/* Info */}
      <div className="video-meta">
        <h2 className="video-title">{info.title}</h2>
        <div className="video-sub">
          <span className="author">{info.author}</span>
          <span className="dot">·</span>
          <span className="views">{formatViews(info.viewCount)}</span>
        </div>

        {/* Format selector */}
        <div className="formats-section">
          <p className="formats-label">Select quality</p>
          <div className="formats-list">
            {info.formats.map(f => (
              <FormatRow
                key={f.itag}
                format={f}
                selected={String(selectedItag) === String(f.itag)}
                onSelect={setSelectedItag}
              />
            ))}
          </div>
          {selectedFormat?.type === 'mux' && (
            <p className="mux-note">
              <IconInfo /> HD download: the server will merge the video and audio streams in real time. May take a few seconds to start.
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="card-actions">
          <button
            className={`btn-download ${downloading ? 'loading' : ''} ${dlDone ? 'done' : ''}`}
            onClick={handleDownload}
            disabled={downloading || !selectedItag}
          >
            {downloading ? (
              <><IconSpinner /> Preparing…</>
            ) : dlDone ? (
              <><IconCheck /> Download started!</>
            ) : (
              <><IconDownload /> Download Video</>
            )}
          </button>
          <button className="btn-reset" onClick={onReset} title="Search another video">
            <IconClear /> New search
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main App ──────────────────────────────────────────────────────────────────

export default function App() {
  const [url, setUrl] = useState('')
  const [status, setStatus] = useState('idle') // idle | loading | success | error
  const [videoInfo, setVideoInfo] = useState(null)
  const [error, setError] = useState(null)
  const inputRef = useRef(null)

  const isValidUrl = url.trim().length > 0

  const fetchInfo = useCallback(async () => {
    const trimmed = url.trim()
    if (!trimmed) return

    setStatus('loading')
    setError(null)
    setVideoInfo(null)

    try {
      const res = await fetch(`/api/info?url=${encodeURIComponent(trimmed)}`)
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || `Server error ${res.status}`)
      }

      if (!data.formats || data.formats.length === 0) {
        throw new Error('No downloadable formats found for this video.')
      }

      setVideoInfo(data)
      setStatus('success')
    } catch (err) {
      setError(err.message)
      setStatus('error')
    }
  }, [url])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') fetchInfo()
  }

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text && (text.includes('youtube.com') || text.includes('youtu.be'))) {
        setUrl(text.trim())
      }
    } catch {
      // clipboard permission denied — ignore
    }
  }

  const handleReset = () => {
    setStatus('idle')
    setVideoInfo(null)
    setError(null)
    setUrl('')
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="logo">
          <span className="logo-icon"><IconYT /></span>
          <div className="logo-text">
            <span className="logo-title">YT Downloader</span>
            <span className="logo-sub">Shorts &amp; Videos</span>
          </div>
        </div>
        <p className="header-tagline">Paste a YouTube Shorts or video URL to download it.</p>
      </header>

      {/* Main */}
      <main className="main">
        {/* Search box — always visible */}
        <section className="search-section">
          <div className={`search-box ${status === 'loading' ? 'searching' : ''}`}>
            <span className="search-icon"><IconSearch /></span>
            <input
              ref={inputRef}
              type="url"
              className="url-input"
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="https://youtube.com/shorts/..."
              spellCheck={false}
              autoComplete="off"
              disabled={status === 'loading'}
            />
            {url && (
              <button className="icon-btn" onClick={() => setUrl('')} title="Clear">
                <IconClear />
              </button>
            )}
            {!url && (
              <button className="icon-btn paste-btn" onClick={handlePaste} title="Paste from clipboard">
                <IconCopy />
              </button>
            )}
          </div>
          <button
            className="btn-fetch"
            onClick={fetchInfo}
            disabled={!isValidUrl || status === 'loading'}
          >
            {status === 'loading' ? <><IconSpinner /> Fetching info…</> : 'Get Video Info'}
          </button>
        </section>

        {/* Error */}
        {status === 'error' && (
          <div className="error-box">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Video result */}
        {status === 'success' && videoInfo && (
          <VideoCard info={videoInfo} url={url} onReset={handleReset} />
        )}

        {/* Idle hint */}
        {status === 'idle' && (
          <div className="hints">
            <p className="hint-title">Supported URLs</p>
            <ul className="hint-list">
              <li><code>https://youtube.com/shorts/VIDEO_ID</code></li>
              <li><code>https://www.youtube.com/watch?v=VIDEO_ID</code></li>
              <li><code>https://youtu.be/VIDEO_ID</code></li>
            </ul>
            <p className="hint-note">
              <IconInfo /> Downloads are served directly from YouTube's CDN through this app's backend.
              No files are stored on the server.
            </p>
          </div>
        )}
      </main>

      <footer className="footer">
        <p>For personal use only &bull; Respect content creators' rights</p>
      </footer>
    </div>
  )
}
