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

const IconMic = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
    <line x1="12" y1="19" x2="12" y2="23"/>
    <line x1="8" y1="23" x2="16" y2="23"/>
  </svg>
)

const IconWaveform = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="16" height="16">
    <path d="M2 12h2M6 8v8M10 5v14M14 9v6M18 7v10M22 12h-2"/>
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

const MODES = [
  { value: 'both',       label: '🔊 Audio + Video' },
  { value: 'video',      label: '🎬 Video Only' },
  { value: 'audio',      label: '🎵 Audio Only' },
  { value: 'transcribe', label: '📝 Transcribe' },
]

const WHISPER_MODELS = [
  { value: 'tiny',   label: 'Tiny',   note: 'Fastest, lower accuracy' },
  { value: 'small',  label: 'Small',  note: 'Balanced (recommended)' },
  { value: 'medium', label: 'Medium', note: 'Slower, better accuracy' },
  { value: 'large-v3', label: 'Large v3', note: 'Best accuracy, slowest' },
]

function formatTimestamp(seconds) {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function TranscribePanel({ url }) {
  const [model, setModel] = useState('small')
  const [status, setStatus] = useState('idle') // idle | running | done | error
  const [statusMsg, setStatusMsg] = useState('')
  const [language, setLanguage] = useState(null)
  const [segments, setSegments] = useState([])
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState(null)
  const esRef = useRef(null)

  const startTranscription = () => {
    if (esRef.current) esRef.current.close()
    setStatus('running')
    setStatusMsg('Connecting…')
    setSegments([])
    setLanguage(null)
    setError(null)

    const qs = new URLSearchParams({ url, model })
    const es = new EventSource(`/api/transcribe?${qs}`)
    esRef.current = es

    es.onmessage = (e) => {
      const event = JSON.parse(e.data)

      if (event.type === 'status') {
        setStatusMsg(event.message)
      } else if (event.type === 'info') {
        setLanguage(event.language)
        setStatusMsg(`Transcribing (detected: ${event.language})…`)
      } else if (event.type === 'segment') {
        setSegments(prev => [...prev, event])
      } else if (event.type === 'done') {
        setStatus('done')
        es.close()
      } else if (event.type === 'error') {
        setError(event.message)
        setStatus('error')
        es.close()
      }
    }

    es.onerror = () => {
      setError('Connection to server lost.')
      setStatus('error')
      es.close()
    }
  }

  const handleCopy = () => {
    const text = segments.map(s => s.text).join(' ')
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const fullText = segments.map(s => s.text).join(' ')

  return (
    <div className="transcribe-panel">
      {/* Model picker */}
      <div className="transcribe-model-row">
        <span className="formats-label">Whisper model</span>
        <div className="model-select-wrap">
          <select
            className="model-select"
            value={model}
            onChange={e => setModel(e.target.value)}
            disabled={status === 'running'}
          >
            {WHISPER_MODELS.map(m => (
              <option key={m.value} value={m.value}>{m.label} — {m.note}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Start button */}
      <button
        className={`btn-transcribe ${status === 'running' ? 'loading' : ''}`}
        onClick={startTranscription}
        disabled={status === 'running'}
      >
        {status === 'running' ? (
          <><IconSpinner /> {statusMsg || 'Transcribing…'}</>
        ) : status === 'done' ? (
          <><IconMic /> Transcribe Again</>
        ) : (
          <><IconMic /> Start Transcription</>
        )}
      </button>

      {/* Error */}
      {status === 'error' && error && (
        <div className="error-box" style={{ marginTop: 0 }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Transcript output */}
      {(segments.length > 0 || status === 'done') && (
        <div className="transcript-box">
          <div className="transcript-header">
            <span className="transcript-label">
              <IconWaveform />
              Transcript
              {language && <span className="lang-badge">{language.toUpperCase()}</span>}
            </span>
            <button
              className={`btn-copy-transcript ${copied ? 'copied' : ''}`}
              onClick={handleCopy}
              disabled={segments.length === 0}
            >
              {copied ? <><IconCheck /> Copied!</> : <><IconCopy /> Copy all</>}
            </button>
          </div>
          <div className="transcript-segments">
            {segments.map((seg, i) => (
              <div key={i} className="transcript-segment">
                <span className="seg-time">{formatTimestamp(seg.start)}</span>
                <span className="seg-text">{seg.text}</span>
              </div>
            ))}
            {status === 'running' && segments.length === 0 && (
              <div className="transcript-placeholder">Processing audio…</div>
            )}
          </div>
          {status === 'done' && (
            <div className="transcript-full">
              <p className="formats-label" style={{ marginBottom: 6 }}>Plain text</p>
              <p className="transcript-plain">{fullText}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function VideoCard({ info, url, onReset }) {
  const [selectedItag, setSelectedItag] = useState(info.formats[0]?.itag)
  const [mode, setMode] = useState('both')
  const [downloading, setDownloading] = useState(false)
  const [dlDone, setDlDone] = useState(false)
  const [imgLoaded, setImgLoaded] = useState(false)

  const handleDownload = useCallback(() => {
    if (mode !== 'audio' && !selectedItag) return
    setDownloading(true)
    setDlDone(false)

    const qs = new URLSearchParams({ url, itag: selectedItag, mode })
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
  }, [selectedItag, mode, url])

  const selectedFormat = info.formats.find(f => String(f.itag) === String(selectedItag))
  const audioOnly = mode === 'audio'
  const transcribeMode = mode === 'transcribe'

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

        {/* Mode selector */}
        <div className="mode-section">
          <p className="formats-label">Download type</p>
          <div className="mode-toggle">
            {MODES.map(m => (
              <button
                key={m.value}
                className={`mode-btn ${mode === m.value ? 'active' : ''}`}
                onClick={() => setMode(m.value)}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Format selector — hidden in transcribe mode */}
        {!transcribeMode && (
          <div className={`formats-section ${audioOnly ? 'dimmed' : ''}`}>
            <p className="formats-label">
              {audioOnly ? 'Quality (not applicable for audio)' : 'Select quality'}
            </p>
            {audioOnly ? (
              <p className="audio-only-note">
                <IconInfo /> Best available audio quality will be downloaded automatically as a <strong>.m4a</strong> file.
              </p>
            ) : (
              <>
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
                {mode === 'both' && selectedFormat?.type === 'mux' && (
                  <p className="mux-note">
                    <IconInfo /> HD download: the server will merge the video and audio streams in real time. May take a few seconds to start.
                  </p>
                )}
                {mode === 'video' && (
                  <p className="mux-note" style={{ color: '#a78bfa', borderColor: 'rgba(167,139,250,0.2)', background: 'rgba(167,139,250,0.08)' }}>
                    <IconInfo /> Video-only: no audio track will be included in the downloaded file.
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {/* Transcribe panel */}
        {transcribeMode && <TranscribePanel url={url} />}

        {/* Actions — hidden in transcribe mode (TranscribePanel has its own button) */}
        {!transcribeMode && (
          <div className="card-actions">
            <button
              className={`btn-download ${downloading ? 'loading' : ''} ${dlDone ? 'done' : ''}`}
              onClick={handleDownload}
              disabled={downloading || (mode !== 'audio' && !selectedItag)}
            >
              {downloading ? (
                <><IconSpinner /> Preparing…</>
              ) : dlDone ? (
                <><IconCheck /> Download started!</>
              ) : mode === 'audio' ? (
                <><IconDownload /> Download Audio</>
              ) : mode === 'video' ? (
                <><IconDownload /> Download Video Only</>
              ) : (
                <><IconDownload /> Download Video</>
              )}
            </button>
            <button className="btn-reset" onClick={onReset} title="Search another video">
              <IconClear /> New search
            </button>
          </div>
        )}
        {transcribeMode && (
          <div className="card-actions" style={{ marginTop: 0 }}>
            <button className="btn-reset" onClick={onReset} title="Search another video">
              <IconClear /> New search
            </button>
          </div>
        )}
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
