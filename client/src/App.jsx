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

const IconUpload = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" width="28" height="28">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="17 8 12 3 7 8"/>
    <line x1="12" y1="3" x2="12" y2="15"/>
  </svg>
)

const IconFile = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
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

// ── Template Modal ────────────────────────────────────────────────────────

const TEMPLATES = [
  {
    id: 'WordPop',
    name: 'Word Pop',
    desc: '5 animated styles — bold highlight, pill card, karaoke glow, scale pop, gradient wipe',
  },
]

function TemplateModal({ onSelect, onClose }) {
  return (
    <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-sheet">
        <div className="modal-header">
          <span className="modal-title">Choose a subtitle style</span>
          <button className="icon-btn" onClick={onClose} title="Close"><IconClear /></button>
        </div>
        <p className="modal-note">1920×1080 ProRes 4444 with alpha channel (.mov) — transparent background</p>
        <div className="template-grid">
          {TEMPLATES.map(t => (
            <button key={t.id} className="template-card" onClick={() => onSelect(t.id)}>
              <div className="template-preview">▶</div>
              <div className="template-name">{t.name}</div>
              <div className="template-desc">{t.desc}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Transcript Output (shared between YouTube and Local File tabs) ─────────────

function TranscriptOutput({ segments, status, language, error }) {
  const [copied, setCopied] = useState(false)
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [renderStatus, setRenderStatus] = useState('idle') // idle | rendering | done | error
  const [renderProgress, setRenderProgress] = useState(0)
  const [renderFileId, setRenderFileId] = useState(null)
  const [renderError, setRenderError] = useState(null)

  const startRender = async (templateId) => {
    setShowTemplateModal(false)
    setRenderStatus('rendering')
    setRenderProgress(0)
    setRenderFileId(null)
    setRenderError(null)

    try {
      const response = await fetch('/api/render-subtitles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ segments, templateId }),
      })

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop()
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const event = JSON.parse(line.slice(6))
            if (event.type === 'progress') {
              setRenderProgress(event.progress)
            } else if (event.type === 'done') {
              setRenderFileId(event.fileId)
              setRenderStatus('done')
              setRenderProgress(1)
            } else if (event.type === 'error') {
              setRenderError(event.message)
              setRenderStatus('error')
            }
          } catch {}
        }
      }
    } catch (err) {
      setRenderError(err.message)
      setRenderStatus('error')
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
    <>
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

      {/* Subtitle video generation */}
      {status === 'done' && segments.length > 0 && (
        <div className="subtitle-actions">
          {renderStatus === 'idle' && (
            <button className="btn-generate-subtitles" onClick={() => setShowTemplateModal(true)}>
              🎬 Generate Subtitles Video
            </button>
          )}
          {renderStatus === 'rendering' && (
            <>
              <button className="btn-generate-subtitles" disabled style={{ opacity: 0.6 }}>
                <IconSpinner /> Rendering…
              </button>
              <div className="render-progress-bar">
                <div
                  className="render-progress-fill"
                  style={{ width: `${Math.round(renderProgress * 100)}%` }}
                />
              </div>
              <span className="render-progress-label">{Math.round(renderProgress * 100)}%</span>
            </>
          )}
          {renderStatus === 'done' && renderFileId && (
            <>
              <a
                className="btn-download-rendered"
                href={`/api/download-rendered/${renderFileId}`}
                download="subtitles.mov"
              >
                <IconDownload /> Download .mov (ProRes Alpha)
              </a>
              <button className="btn-generate-subtitles" onClick={() => { setRenderStatus('idle'); setRenderFileId(null) }}
                style={{ background: 'rgba(255,255,255,0.1)', fontSize: 13 }}>
                Render again
              </button>
            </>
          )}
          {renderStatus === 'error' && (
            <>
              <div className="error-box" style={{ marginTop: 0 }}>
                <strong>Render error:</strong> {renderError}
              </div>
              <button className="btn-generate-subtitles" onClick={() => setRenderStatus('idle')}
                style={{ background: 'rgba(255,255,255,0.1)', fontSize: 13 }}>
                Try again
              </button>
            </>
          )}
        </div>
      )}

      {showTemplateModal && (
        <TemplateModal onSelect={startRender} onClose={() => setShowTemplateModal(false)} />
      )}
    </>
  )
}

// ── Transcribe Panel (YouTube) ────────────────────────────────────────────────

function TranscribePanel({ url }) {
  const [model, setModel] = useState('small')
  const [status, setStatus] = useState('idle') // idle | running | done | error
  const [statusMsg, setStatusMsg] = useState('')
  const [language, setLanguage] = useState(null)
  const [segments, setSegments] = useState([])
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

      <TranscriptOutput segments={segments} status={status} language={language} error={error} />
    </div>
  )
}

// ── Local File Transcribe Tab ─────────────────────────────────────────────────

const AUDIO_ACCEPT = '.mp3,.m4a,.wav,.ogg,.flac,.aac,.opus,.weba,.webm,.mp4,.mov,.avi,.mkv'

function LocalTranscribeTab() {
  const [file, setFile] = useState(null)
  const [model, setModel] = useState('small')
  const [status, setStatus] = useState('idle') // idle | running | done | error
  const [statusMsg, setStatusMsg] = useState('')
  const [language, setLanguage] = useState(null)
  const [segments, setSegments] = useState([])
  const [error, setError] = useState(null)
  const abortRef = useRef(null)
  const fileInputRef = useRef(null)

  const startTranscription = async () => {
    if (!file) return
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setStatus('running')
    setStatusMsg('Uploading…')
    setSegments([])
    setLanguage(null)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('audio', file)
      formData.append('model', model)

      const response = await fetch('/api/transcribe-file', {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.error || `Server error ${response.status}`)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      let finished = false

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop()
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const event = JSON.parse(line.slice(6))
            if (event.type === 'status') {
              setStatusMsg(event.message)
            } else if (event.type === 'info') {
              setLanguage(event.language)
              setStatusMsg(`Transcribing (detected: ${event.language})…`)
            } else if (event.type === 'segment') {
              setSegments(prev => [...prev, event])
            } else if (event.type === 'done') {
              setStatus('done')
              finished = true
            } else if (event.type === 'error') {
              setError(event.message)
              setStatus('error')
              finished = true
            }
          } catch {}
        }
      }
      if (!finished) setStatus(s => s === 'running' ? 'done' : s)
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err.message)
        setStatus('error')
      }
    }
  }

  const handleFileChange = (e) => {
    const f = e.target.files[0] || null
    setFile(f)
    // Reset transcript state when a new file is chosen
    setStatus('idle')
    setSegments([])
    setLanguage(null)
    setError(null)
  }

  const formatFileSize = (bytes) => {
    if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
    return `${(bytes / 1024).toFixed(0)} KB`
  }

  return (
    <div className="local-transcribe-tab">
      {/* File picker */}
      <div className="local-upload-section">
        <span className="formats-label">Audio / Video File</span>
        <div
          className={`file-drop-zone ${file ? 'has-file' : ''}`}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => {
            e.preventDefault()
            const f = e.dataTransfer.files[0]
            if (f) {
              setFile(f)
              setStatus('idle')
              setSegments([])
              setLanguage(null)
              setError(null)
            }
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={AUDIO_ACCEPT}
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
          {file ? (
            <div className="file-selected">
              <IconMic />
              <span className="file-name">{file.name}</span>
              <span className="file-size">{formatFileSize(file.size)}</span>
            </div>
          ) : (
            <div className="file-placeholder">
              <IconUpload />
              <span>Click or drag &amp; drop an audio/video file</span>
              <span className="file-hint">MP3 · M4A · WAV · FLAC · OGG · AAC · MP4 · MOV · MKV</span>
            </div>
          )}
        </div>
      </div>

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
        disabled={status === 'running' || !file}
      >
        {status === 'running' ? (
          <><IconSpinner /> {statusMsg || 'Transcribing…'}</>
        ) : status === 'done' ? (
          <><IconMic /> Transcribe Again</>
        ) : (
          <><IconMic /> Start Transcription</>
        )}
      </button>

      <TranscriptOutput segments={segments} status={status} language={language} error={error} />
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

// ── Twitter Icons ─────────────────────────────────────────────────────────────

const IconTwitter = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.26 5.632zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
)

const IconImage = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
    <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
    <polyline points="21 15 16 10 5 21"/>
  </svg>
)

const IconVideo = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
    <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/>
  </svg>
)

const IconExternalLink = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
    <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
  </svg>
)

const IconChevron = ({ open }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="14" height="14"
    style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
    <polyline points="6 9 12 15 18 9"/>
  </svg>
)

// ── Twitter Transcribe Panel ───────────────────────────────────────────────────

function TwitterTranscribePanel({ tweetUrl, index }) {
  const [model, setModel] = useState('small')
  const [status, setStatus] = useState('idle')
  const [statusMsg, setStatusMsg] = useState('')
  const [language, setLanguage] = useState(null)
  const [segments, setSegments] = useState([])
  const [error, setError] = useState(null)
  const esRef = useRef(null)

  const startTranscription = () => {
    if (esRef.current) esRef.current.close()
    setStatus('running')
    setStatusMsg('Connecting…')
    setSegments([])
    setLanguage(null)
    setError(null)

    const qs = new URLSearchParams({ url: tweetUrl, index: String(index), model })
    const es = new EventSource(`/api/twitter/transcribe?${qs}`)
    esRef.current = es

    es.onmessage = (e) => {
      const event = JSON.parse(e.data)
      if (event.type === 'status') setStatusMsg(event.message)
      else if (event.type === 'info') { setLanguage(event.language); setStatusMsg(`Transcribing (${event.language})…`) }
      else if (event.type === 'segment') setSegments(prev => [...prev, event])
      else if (event.type === 'done') { setStatus('done'); es.close() }
      else if (event.type === 'error') { setError(event.message); setStatus('error'); es.close() }
    }
    es.onerror = () => { setError('Connection lost.'); setStatus('error'); es.close() }
  }

  return (
    <div className="tw-transcribe-panel">
      <div className="tw-transcribe-controls">
        <select
          className="model-select tw-model-select"
          value={model}
          onChange={e => setModel(e.target.value)}
          disabled={status === 'running'}
        >
          {WHISPER_MODELS.map(m => (
            <option key={m.value} value={m.value}>{m.label} — {m.note}</option>
          ))}
        </select>
        <button
          className={`btn-transcribe tw-btn-transcribe ${status === 'running' ? 'loading' : ''}`}
          onClick={startTranscription}
          disabled={status === 'running'}
        >
          {status === 'running' ? <><IconSpinner /> {statusMsg}</> :
           status === 'done'    ? <><IconMic /> Transcribe Again</> :
                                  <><IconMic /> Start Transcription</>}
        </button>
      </div>
      <TranscriptOutput segments={segments} status={status} language={language} error={error} />
    </div>
  )
}

// ── Tweet Media Item ──────────────────────────────────────────────────────────

function TweetMediaItem({ item, tweetUrl, index: globalIndex }) {
  const [selectedFmt, setSelectedFmt] = useState(item.formats?.[0]?.formatId || null)
  const [transcribeOpen, setTranscribeOpen] = useState(false)
  const [dlDone, setDlDone] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [imgLoaded, setImgLoaded] = useState(false)

  const isVideo = item.type === 'video'
  const isGif   = item.type === 'gif'
  const isImage  = item.type === 'image'
  const canTranscribe = isVideo // only true video has audio

  const thumbnail = item.thumbnail || item.url

  const handleDownload = () => {
    setDownloading(true)
    setDlDone(false)

    let href
    if (isImage) {
      const fname = `tweet_image_${item.index}.jpg`
      href = `/api/twitter/proxy-image?url=${encodeURIComponent(item.url)}&filename=${encodeURIComponent(fname)}`
    } else {
      const qs = new URLSearchParams({ url: tweetUrl, index: String(item.index), ...(selectedFmt ? { formatId: selectedFmt } : {}) })
      href = `/api/twitter/download?${qs}`
    }

    const a = document.createElement('a')
    a.href = href
    a.download = ''
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)

    setTimeout(() => {
      setDownloading(false)
      setDlDone(true)
      setTimeout(() => setDlDone(false), 3000)
    }, 1200)
  }

  const typeBadge = isImage ? '🖼 Image' : isGif ? '🎞 GIF' : '🎬 Video'
  const typeColor = isImage ? '#34d399' : isGif ? '#fbbf24' : '#60a5fa'

  return (
    <div className="tw-media-item">
      {/* Thumbnail */}
      <div className={`tw-thumb-wrap ${isImage ? 'tw-thumb-image' : ''}`}>
        {thumbnail && (
          <>
            <div className={`thumb-skeleton ${imgLoaded ? 'hidden' : ''}`} />
            <img
              src={thumbnail}
              alt={typeBadge}
              className={`tw-thumb ${imgLoaded ? 'loaded' : ''}`}
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgLoaded(true)}
            />
          </>
        )}
        {!isImage && (
          <div className="tw-thumb-overlay">
            {isGif ? 'GIF' : <IconPlay />}
          </div>
        )}
        {item.duration && (
          <span className="tw-duration-badge">{item.duration}</span>
        )}
        <span className="tw-type-badge" style={{ color: typeColor, borderColor: `${typeColor}44`, background: `${typeColor}14` }}>
          {typeBadge}
        </span>
      </div>

      {/* Actions row */}
      <div className="tw-media-actions">
        {/* Quality selector for videos */}
        {(isVideo || isGif) && item.formats && item.formats.length > 1 && (
          <div className="tw-quality-row">
            <span className="formats-label">Quality</span>
            <div className="tw-quality-pills">
              {item.formats.map(f => (
                <button
                  key={f.formatId}
                  className={`tw-quality-pill ${selectedFmt === f.formatId ? 'active' : ''}`}
                  onClick={() => setSelectedFmt(f.formatId)}
                >
                  {f.quality}
                  {f.size && <span className="tw-pill-size">{f.size}</span>}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Download + Transcribe buttons */}
        <div className="tw-action-buttons">
          <button
            className={`tw-btn-download ${downloading ? 'loading' : ''} ${dlDone ? 'done' : ''}`}
            onClick={handleDownload}
            disabled={downloading}
          >
            {downloading ? <><IconSpinner /> Preparing…</> :
             dlDone      ? <><IconCheck /> Started!</> :
             isImage     ? <><IconDownload /> Download Image</> :
             isGif       ? <><IconDownload /> Download GIF</> :
                           <><IconDownload /> Download Video</>}
          </button>

          {canTranscribe && (
            <button
              className={`tw-btn-transcribe-toggle ${transcribeOpen ? 'open' : ''}`}
              onClick={() => setTranscribeOpen(v => !v)}
            >
              <IconMic /> Transcribe <IconChevron open={transcribeOpen} />
            </button>
          )}
        </div>

        {/* Inline transcribe panel */}
        {canTranscribe && transcribeOpen && (
          <TwitterTranscribePanel tweetUrl={tweetUrl} index={item.index} />
        )}
      </div>
    </div>
  )
}

// ── Tweet Card ────────────────────────────────────────────────────────────────

function formatRelativeTime(timestamp) {
  if (!timestamp) return null
  const diff = Date.now() - timestamp * 1000
  const m = Math.floor(diff / 60000)
  const h = Math.floor(diff / 3600000)
  const d = Math.floor(diff / 86400000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 30) return `${d}d ago`
  return new Date(timestamp * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function TweetCard({ info, tweetUrl, onReset }) {
  const initials = (info.author || '?').charAt(0).toUpperCase()
  const relTime = formatRelativeTime(info.timestamp)

  return (
    <div className="tweet-card">
      {/* Tweet header */}
      <div className="tweet-header">
        <div className="tweet-avatar" aria-label={info.author}>
          {initials}
        </div>
        <div className="tweet-author-block">
          <span className="tweet-author-name">{info.author}</span>
          <span className="tweet-author-handle">@{info.username}</span>
        </div>
        <div className="tweet-header-right">
          {relTime && <span className="tweet-timestamp">{relTime}</span>}
          <a
            href={info.tweetUrl || tweetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="tweet-open-link"
            title="Open tweet"
          >
            <IconExternalLink />
          </a>
          <span className="tweet-x-logo"><IconTwitter /></span>
        </div>
      </div>

      {/* Tweet text */}
      {info.tweetText && (
        <p className="tweet-text">{info.tweetText}</p>
      )}

      {/* Divider */}
      <div className="tweet-divider" />

      {/* Media items */}
      <div className="tw-media-list">
        {info.media.map((item) => (
          <TweetMediaItem
            key={item.index}
            item={item}
            tweetUrl={tweetUrl}
          />
        ))}
      </div>

      {/* Footer */}
      <div className="tweet-card-footer">
        <span className="tweet-media-count">
          {info.media.length} media item{info.media.length !== 1 ? 's' : ''}
        </span>
        <button className="btn-reset" onClick={onReset}>
          <IconClear /> New search
        </button>
      </div>
    </div>
  )
}

// ── Twitter Tab ───────────────────────────────────────────────────────────────

function TwitterTab() {
  const [url, setUrl] = useState('')
  const [status, setStatus] = useState('idle')
  const [tweetInfo, setTweetInfo] = useState(null)
  const [error, setError] = useState(null)
  const inputRef = useRef(null)

  const fetchTweetInfo = useCallback(async () => {
    const trimmed = url.trim()
    if (!trimmed) return
    setStatus('loading')
    setError(null)
    setTweetInfo(null)
    try {
      const res = await fetch(`/api/twitter/info?url=${encodeURIComponent(trimmed)}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `Server error ${res.status}`)
      setTweetInfo(data)
      setStatus('success')
    } catch (err) {
      setError(err.message)
      setStatus('error')
    }
  }, [url])

  const handleKeyDown = (e) => { if (e.key === 'Enter') fetchTweetInfo() }

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text && (text.includes('twitter.com') || text.includes('x.com'))) {
        setUrl(text.trim())
      }
    } catch {}
  }

  const handleReset = () => {
    setStatus('idle')
    setTweetInfo(null)
    setError(null)
    setUrl('')
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  return (
    <>
      {/* Search box */}
      <section className="search-section">
        <div className={`search-box tw-search-box ${status === 'loading' ? 'searching' : ''}`}>
          <span className="search-icon" style={{ color: '#1d9bf0' }}><IconTwitter /></span>
          <input
            ref={inputRef}
            type="url"
            className="url-input"
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="https://x.com/user/status/..."
            spellCheck={false}
            autoComplete="off"
            disabled={status === 'loading'}
          />
          {url ? (
            <button className="icon-btn" onClick={() => setUrl('')} title="Clear"><IconClear /></button>
          ) : (
            <button className="icon-btn paste-btn" onClick={handlePaste} title="Paste from clipboard"><IconCopy /></button>
          )}
        </div>
        <button
          className="btn-fetch tw-btn-fetch"
          onClick={fetchTweetInfo}
          disabled={!url.trim() || status === 'loading'}
        >
          {status === 'loading' ? <><IconSpinner /> Fetching tweet…</> : 'Get Tweet Info'}
        </button>
      </section>

      {/* Error */}
      {status === 'error' && (
        <div className="error-box"><strong>Error:</strong> {error}</div>
      )}

      {/* Result */}
      {status === 'success' && tweetInfo && (
        <TweetCard info={tweetInfo} tweetUrl={url} onReset={handleReset} />
      )}

      {/* Idle hint */}
      {status === 'idle' && (
        <div className="hints tw-hints">
          <p className="hint-title">Supported URLs</p>
          <ul className="hint-list">
            <li><code>https://x.com/username/status/TWEET_ID</code></li>
            <li><code>https://twitter.com/username/status/TWEET_ID</code></li>
          </ul>
          <p className="hint-note" style={{ color: '#60a5fa', borderColor: 'rgba(96,165,250,0.15)' }}>
            <IconInfo /> Supports videos, GIFs, and images. Videos can be transcribed using Whisper AI.
          </p>
        </div>
      )}
    </>
  )
}

// ── Main App ──────────────────────────────────────────────────────────────────

export default function App() {
  const [mainTab, setMainTab] = useState('youtube') // 'youtube' | 'twitter' | 'local'
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

        {/* Main tab switcher */}
        <div className="main-tabs">
          <button
            className={`main-tab-btn ${mainTab === 'youtube' ? 'active' : ''}`}
            onClick={() => setMainTab('youtube')}
          >
            <IconYT />
            YouTube
          </button>
          <button
            className={`main-tab-btn tw-tab-btn ${mainTab === 'twitter' ? 'active' : ''}`}
            onClick={() => setMainTab('twitter')}
          >
            <IconTwitter />
            Twitter / X
          </button>
          <button
            className={`main-tab-btn ${mainTab === 'local' ? 'active' : ''}`}
            onClick={() => setMainTab('local')}
          >
            <IconFile />
            Local File
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="main">
        {mainTab === 'twitter' ? (
          <TwitterTab />
        ) : mainTab === 'youtube' ? (
          <>
            {/* Search box */}
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
          </>
        ) : (
          <LocalTranscribeTab />
        )}

      </main>

      <footer className="footer">
        <p>For personal use only &bull; Respect content creators' rights</p>
      </footer>
    </div>
  )
}
