const express = require('express');
const cors = require('cors');
const { Readable } = require('stream');
const { createContext, Script } = require('node:vm');
const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');

// yt-dlp binary (auto-installed by youtube-dl-exec)
const YTDLP_PATH = require('youtube-dl-exec').constants.YOUTUBE_DL_PATH;
// ffmpeg binary (bundled by ffmpeg-static)
const FFMPEG_PATH = require('ffmpeg-static');

const app = express();
const PORT = 3002;

app.use(cors());
app.use(express.json());

// Multer: save uploaded audio files to OS temp dir
const upload = multer({
  storage: multer.diskStorage({
    destination: os.tmpdir(),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname) || '.audio';
      cb(null, `local_transcribe_${Date.now()}${ext}`);
    },
  }),
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB
});

// ── Constants ─────────────────────────────────────────────────────────────────

const YT_FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Referer': 'https://www.youtube.com/',
  'Origin': 'https://www.youtube.com',
};

// Same headers formatted for ffmpeg's -headers flag
const YT_FFMPEG_HEADERS = Object.entries(YT_FETCH_HEADERS)
  .map(([k, v]) => `${k}: ${v}`)
  .join('\r\n') + '\r\n';

// ── Innertube init ────────────────────────────────────────────────────────────
let _yt = null;

async function getYT() {
  if (_yt) return _yt;

  const { Innertube, Platform } = await import('youtubei.js');

  // Inject Node.js vm as the JavaScript evaluator so decipher() can run the
  // obfuscated YouTube player script that decodes the n-parameter and cipher.
  const shim = Platform.shim;
  Platform.load({
    ...shim,
    eval: async (data, _env) => {
      const code = `(function() { ${data.output} })()`;
      const ctx = createContext({});
      return new Script(code).runInContext(ctx);
    },
  });

  _yt = await Innertube.create({ generate_session_locally: true });
  return _yt;
}

getYT()
  .then(() => console.log('  Innertube + vm evaluator ready.'))
  .catch(err => { console.warn('  Pre-warm failed:', err.message); _yt = null; });

// ── Remotion bundle cache ─────────────────────────────────────────────────
let _remotionBundlePath = null;

async function getRemotionBundle() {
  if (_remotionBundlePath) return _remotionBundlePath;
  const { bundle } = await import('@remotion/bundler');
  _remotionBundlePath = await bundle({
    entryPoint: path.join(__dirname, '../client/src/remotion/Root.jsx'),
  });
  return _remotionBundlePath;
}

// Pre-warm Remotion browser + bundle in background (5s delay to let server start)
setTimeout(async () => {
  try {
    const { ensureBrowser } = await import('@remotion/renderer');
    await ensureBrowser();
    await getRemotionBundle();
    console.log('  Remotion ready.');
  } catch (e) {
    console.warn('  Remotion pre-warm failed:', e.message);
  }
}, 5000);

// ── Temp file cleanup ─────────────────────────────────────────────────────
function cleanupOldRenders() {
  const tmpDir = os.tmpdir();
  const now = Date.now();
  const TWO_HOURS = 2 * 60 * 60 * 1000;
  try {
    const files = fs.readdirSync(tmpDir).filter(f => f.startsWith('subtitles-') && f.endsWith('.mov'));
    for (const file of files) {
      const filePath = path.join(tmpDir, file);
      try {
        const stat = fs.statSync(filePath);
        if (now - stat.mtimeMs > TWO_HOURS) {
          fs.unlinkSync(filePath);
          console.log(`[cleanup] Removed old render: ${file}`);
        }
      } catch {}
    }
  } catch {}
}

cleanupOldRenders();
setInterval(cleanupOldRenders, 30 * 60 * 1000);

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractVideoId(rawUrl) {
  try {
    const u = new URL(rawUrl);
    if (u.searchParams.has('v')) return u.searchParams.get('v');
    const m = u.pathname.match(/\/(?:shorts|embed|v)\/([a-zA-Z0-9_-]{11})/)
           || u.pathname.match(/^\/([a-zA-Z0-9_-]{11})$/);
    if (m) return m[1];
  } catch {
    if (/^[a-zA-Z0-9_-]{11}$/.test(rawUrl)) return rawUrl;
  }
  return null;
}

function formatDuration(seconds) {
  const s = parseInt(seconds || 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function sanitizeFilename(name) {
  return (name || 'video')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 200) || 'video';
}

/**
 * Resolve CDN URL(s) for a video via yt-dlp --get-url.
 * Returns an array of URL strings (usually 1 for video-only/audio-only, 2 for combined).
 */
function resolveYtdlp(videoUrl, fmtSpec) {
  return new Promise((resolve, reject) => {
    let out = '', err = '';
    const proc = spawn(YTDLP_PATH, [videoUrl, '-f', fmtSpec, '--get-url', '--no-playlist']);
    proc.stdout.on('data', d => { out += d.toString(); });
    proc.stderr.on('data', d => { err += d.toString(); });
    proc.on('error', reject);
    proc.on('close', code => {
      const lines = out.trim().split('\n').filter(Boolean);
      if (lines.length >= 1) resolve(lines);
      else reject(new Error(`yt-dlp --get-url failed (exit ${code}): ${err.slice(0, 300)}`));
    });
  });
}

/**
 * Proxy a single CDN URL directly to the HTTP response (no transcoding).
 * Passes through content-length and range headers for resumable downloads.
 */
async function proxyDirectUrl(cdnUrl, req, res) {
  const headers = { ...YT_FETCH_HEADERS };
  if (req.headers.range) headers['Range'] = req.headers.range;

  const upstream = await fetch(cdnUrl, { headers });
  if (!upstream.ok && upstream.status !== 206) {
    throw new Error(`YouTube CDN returned HTTP ${upstream.status}`);
  }

  res.status(upstream.status);
  ['content-length', 'content-range', 'accept-ranges'].forEach(h => {
    const v = upstream.headers.get(h);
    if (v) res.setHeader(h, v);
  });

  Readable.fromWeb(upstream.body).pipe(res);
}

/**
 * Returns all useful download formats:
 * - Combined (video+audio) at lower resolutions (usually ≤ 360p)
 * - Video-only adaptive streams at higher resolutions (480p–1080p)
 *   These are marked type:'mux' and require server-side audio muxing.
 *
 * We include only mp4-container formats (H.264 video + AAC audio) so we
 * don't need codec transcoding — just stream copying.
 */
function buildFormatList(streamingData) {
  if (!streamingData) return [];

  // --- Combined (video+audio) ---
  const combined = (streamingData.formats || [])
    .filter(f => /^video\/mp4/.test(f.mime_type || ''))
    .map(f => ({
      itag: f.itag,
      quality: f.quality_label || f.quality || '?',
      container: 'mp4',
      hasAudio: true,
      hasVideo: true,
      type: 'combined',
      fps: f.fps || null,
      height: f.height || parseInt(f.quality_label) || null,
      size: f.content_length
        ? `${(parseInt(f.content_length) / 1024 / 1024).toFixed(1)} MB`
        : 'Unknown',
    }));

  // --- Video-only adaptive (mp4 / H.264) ---
  const seenHeights = new Set(combined.map(f => parseInt(f.quality)));
  const adaptive = (streamingData.adaptive_formats || [])
    .filter(f => {
      if (!/^video\/mp4/.test(f.mime_type || '')) return false;
      if (!f.height || f.height < 360 || f.height > 1080) return false;
      return true;
    })
    .sort((a, b) => (parseInt(b.quality_label) || b.height || 0)
                  - (parseInt(a.quality_label) || a.height || 0))
    .reduce((acc, f) => {
      const key = `${f.height}p${f.fps > 30 ? f.fps : ''}`;
      if (!acc.find(x => `${x.height}p${x.fps > 30 ? x.fps : ''}` === key)) acc.push(f);
      return acc;
    }, [])
    .filter(f => !seenHeights.has(f.height))
    .map(f => ({
      itag: f.itag,
      quality: f.quality_label || `${f.height}p`,
      container: 'mp4',
      hasAudio: false,
      hasVideo: true,
      type: 'mux',
      fps: f.fps || null,
      height: f.height || parseInt(f.quality_label) || null,
      size: f.content_length
        ? `${(parseInt(f.content_length) / 1024 / 1024).toFixed(1)} MB`
        : 'Unknown',
    }));

  return [
    ...combined.sort((a, b) => (parseInt(b.quality) || 0) - (parseInt(a.quality) || 0)),
    ...adaptive,
  ];
}

// ── Routes ────────────────────────────────────────────────────────────────────

app.get('/api/info', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'url query param is required' });

  const videoId = extractVideoId(url);
  if (!videoId) return res.status(400).json({ error: 'Invalid YouTube URL' });

  try {
    const yt = await getYT();
    const info = await yt.getBasicInfo(videoId, 'WEB');

    if (!info.streaming_data) {
      return res.status(403).json({
        error: 'Video unavailable — may be private, age-restricted, or region-blocked.',
      });
    }

    const d = info.basic_info;
    const thumbnails = d.thumbnail || [];
    const thumbnail = thumbnails[thumbnails.length - 1]?.url ?? null;

    const formats = buildFormatList(info.streaming_data);
    if (formats.length === 0) {
      return res.status(500).json({ error: 'No downloadable formats found for this video.' });
    }

    return res.json({
      title: d.title || 'Unknown Title',
      author: d.author || 'Unknown',
      duration: formatDuration(d.duration),
      viewCount: (d.view_count || 0).toLocaleString(),
      thumbnail,
      isShort: url.includes('/shorts/'),
      formats,
    });
  } catch (err) {
    console.error('[/api/info]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/download?url=<yt_url>&itag=<itag>&mode=<both|video|audio>
 *
 * mode=both  (default) — video + audio merged (existing behaviour)
 * mode=video — video stream only, no audio track (.mp4)
 * mode=audio — best audio stream only (.m4a)
 *
 * For mode=both:
 *   - Combined (SD) formats: decipher CDN URL via youtubei.js and proxy directly.
 *   - Adaptive HD formats: resolve URLs via yt-dlp then mux with ffmpeg.
 * For mode=video and mode=audio: resolve URL via yt-dlp and proxy directly.
 */
app.get('/api/download', async (req, res) => {
  const { url, itag, mode = 'both' } = req.query;
  if (!url) return res.status(400).json({ error: 'url query param is required' });

  const videoId = extractVideoId(url);
  if (!videoId) return res.status(400).json({ error: 'Invalid YouTube URL' });

  try {
    const yt = await getYT();
    const info = await yt.getBasicInfo(videoId, 'WEB');

    if (!info.streaming_data) {
      return res.status(403).json({ error: 'Video is unavailable.' });
    }

    const title = sanitizeFilename(info.basic_info.title);

    // ── Audio-only ───────────────────────────────────────────────────────────
    if (mode === 'audio') {
      console.log(`[audio] resolving best audio via yt-dlp`);
      const cdnUrls = await resolveYtdlp(url, 'bestaudio[ext=m4a]/bestaudio');
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(title + '.m4a')}`);
      res.setHeader('Content-Type', 'audio/mp4');
      await proxyDirectUrl(cdnUrls[0], req, res);
      return;
    }

    // ── Resolve the selected video format ────────────────────────────────────
    const allFormats = [
      ...(info.streaming_data.formats || []),
      ...(info.streaming_data.adaptive_formats || []),
    ];

    let format = itag ? allFormats.find(f => String(f.itag) === String(itag)) : null;
    if (!format) {
      // Fallback: best combined mp4
      format = (info.streaming_data.formats || [])
        .filter(f => /^video\/mp4/.test(f.mime_type || ''))
        .sort((a, b) => (parseInt(b.quality_label) || 0) - (parseInt(a.quality_label) || 0))[0]
        ?? allFormats[0];
    }
    if (!format) return res.status(404).json({ error: 'No suitable format found.' });

    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(title + '.mp4')}`);
    res.setHeader('Content-Type', 'video/mp4');

    // ── Video-only ───────────────────────────────────────────────────────────
    if (mode === 'video') {
      const h = format.height || parseInt(format.quality_label) || 720;
      const fmtSpec = [
        `bestvideo[vcodec^=avc][height<=${h}][ext=mp4]`,
        `bestvideo[height<=${h}]`,
      ].join('/');
      console.log(`[video-only] resolving video stream via yt-dlp — height<=${h}`);
      const cdnUrls = await resolveYtdlp(url, fmtSpec);
      await proxyDirectUrl(cdnUrls[0], req, res);
      return;
    }

    // ── Both: video + audio ──────────────────────────────────────────────────
    const needsMux = !format.has_audio; // video-only adaptive (SABR) stream

    if (needsMux) {
      // HD path: use yt-dlp to get CDN URLs, then ffmpeg to mux into fragmented mp4.
      const actualHeight = format.height || parseInt(format.quality_label) || 720;

      const fmtSpec = [
        `bestvideo[vcodec^=avc][height<=${actualHeight}]+bestaudio[ext=m4a]`,
        `bestvideo[ext=mp4][height<=${actualHeight}]+bestaudio[ext=m4a]`,
        `bestvideo[height<=${actualHeight}]+bestaudio`,
      ].join('/');

      console.log(`[yt-dlp] resolving URLs — quality: ${format.quality_label || actualHeight + 'p'} (actualHeight=${actualHeight})`);

      const cdnUrls = await resolveYtdlp(url, fmtSpec);
      const videoUrl = cdnUrls[0];
      const audioUrl = cdnUrls[1] ?? cdnUrls[0];

      console.log(`[yt-dlp] resolved ${cdnUrls.length} URL(s), handing to ffmpeg`);

      const ffmpegArgs = [
        '-reconnect', '1', '-reconnect_streamed', '1', '-reconnect_delay_max', '5',
        '-headers', YT_FFMPEG_HEADERS, '-i', videoUrl,
      ];

      if (cdnUrls.length >= 2) {
        ffmpegArgs.push(
          '-reconnect', '1', '-reconnect_streamed', '1', '-reconnect_delay_max', '5',
          '-headers', YT_FFMPEG_HEADERS, '-i', audioUrl,
          '-map', '0:v:0', '-map', '1:a:0',
        );
      }

      ffmpegArgs.push(
        '-c:v', 'copy',
        '-c:a', 'aac', '-b:a', '192k',
        '-movflags', 'frag_keyframe+empty_moov+faststart',
        '-f', 'mp4',
        'pipe:1',
      );

      const ffmpeg = spawn(FFMPEG_PATH, ffmpegArgs);

      ffmpeg.stdout.pipe(res);
      ffmpeg.stderr.on('data', d => {
        const line = d.toString().trim();
        if (line) process.stdout.write(`[ffmpeg] ${line}\n`);
      });
      ffmpeg.on('error', err => {
        console.error('[ffmpeg error]', err.message);
        if (!res.headersSent) res.status(500).json({ error: err.message });
        else res.destroy();
      });
      ffmpeg.on('close', code => {
        if (code !== 0) console.warn(`[ffmpeg] exited with code ${code}`);
      });
      req.on('close', () => ffmpeg.kill('SIGKILL'));

    } else {
      // SD combined path: decipher CDN URL via youtubei.js and proxy directly.
      const videoUrl = await format.decipher(yt.session.player);
      if (!videoUrl) return res.status(500).json({ error: 'Could not resolve video URL.' });
      await proxyDirectUrl(videoUrl, req, res);
    }

  } catch (err) {
    console.error('[/api/download]', err.message);
    if (!res.headersSent) res.status(500).json({ error: err.message });
    else res.destroy();
  }
});

app.get('/api/validate', (req, res) => {
  const { url } = req.query;
  res.json({ valid: !!url && extractVideoId(url) !== null });
});

/**
 * GET /api/transcribe?url=<yt_url>&model=<model_size>
 *
 * Downloads audio via yt-dlp, transcribes via faster-whisper, and streams
 * results back as Server-Sent Events (SSE).
 *
 * SSE event types forwarded from the Python worker:
 *   info    — detected language + confidence
 *   segment — timestamped text chunk
 *   done    — transcription complete
 *   error   — something went wrong
 */
app.get('/api/transcribe', async (req, res) => {
  const { url, model = 'small' } = req.query;
  if (!url) return res.status(400).json({ error: 'url query param is required' });

  const videoId = extractVideoId(url);
  if (!videoId) return res.status(400).json({ error: 'Invalid YouTube URL' });

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sendEvent = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  const tmpFile = path.join(os.tmpdir(), `yt_transcribe_${Date.now()}_${videoId}.m4a`);
  let ytdlpProc = null;
  let pythonProc = null;

  const cleanup = () => {
    try { fs.unlinkSync(tmpFile); } catch {}
  };

  req.on('close', () => {
    ytdlpProc?.kill('SIGKILL');
    pythonProc?.kill('SIGKILL');
    cleanup();
  });

  try {
    // Step 1: download best audio to a temp file
    sendEvent({ type: 'status', message: 'Downloading audio…' });

    await new Promise((resolve, reject) => {
      const args = [
        url,
        '-f', 'bestaudio[ext=m4a]/bestaudio',
        '--no-playlist',
        '-o', tmpFile,
      ];
      ytdlpProc = spawn(YTDLP_PATH, args);
      let stderr = '';
      ytdlpProc.stderr.on('data', d => { stderr += d.toString(); });
      ytdlpProc.on('error', reject);
      ytdlpProc.on('close', code => {
        if (code === 0) resolve();
        else reject(new Error(`yt-dlp exited ${code}: ${stderr.slice(0, 300)}`));
      });
    });

    // Step 2: transcribe with faster-whisper via Python script
    sendEvent({ type: 'status', message: `Transcribing with faster-whisper (${model})…` });

    const scriptPath = path.join(__dirname, 'transcribe.py');
    const venvPython = path.join(__dirname, '.venv', 'bin', 'python3');
    const pythonBin = fs.existsSync(venvPython) ? venvPython : 'python3';
    await new Promise((resolve, reject) => {
      pythonProc = spawn(pythonBin, [scriptPath, tmpFile, model]);

      let lineBuf = '';

      pythonProc.stdout.on('data', chunk => {
        lineBuf += chunk.toString();
        const lines = lineBuf.split('\n');
        lineBuf = lines.pop(); // keep incomplete trailing line
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);
            sendEvent(event);
            if (event.type === 'error') reject(new Error(event.message));
          } catch {
            // ignore non-JSON lines (e.g. Python warnings)
          }
        }
      });

      pythonProc.stderr.on('data', d => {
        const msg = d.toString().trim();
        if (msg) process.stdout.write(`[transcribe.py] ${msg}\n`);
      });

      pythonProc.on('error', reject);
      pythonProc.on('close', code => {
        if (code === 0 || code === null) resolve();
        else reject(new Error(`Python worker exited with code ${code}`));
      });
    });

  } catch (err) {
    console.error('[/api/transcribe]', err.message);
    sendEvent({ type: 'error', message: err.message });
  } finally {
    cleanup();
    res.end();
  }
});

/**
 * POST /api/transcribe-file
 * Body: multipart/form-data — audio (file) + model (string)
 *
 * Accepts an uploaded audio/video file, transcribes via faster-whisper,
 * and streams results back as Server-Sent Events (SSE).
 */
app.post('/api/transcribe-file', upload.single('audio'), async (req, res) => {
  const { model = 'small' } = req.body || {};
  if (!req.file) return res.status(400).json({ error: 'No audio file uploaded' });

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sendEvent = (data) => {
    if (!res.writableEnded) res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  const tmpFile = req.file.path;
  let pythonProc = null;

  const cleanup = () => {
    try { fs.unlinkSync(tmpFile); } catch {}
  };

  req.on('close', () => {
    pythonProc?.kill('SIGKILL');
    cleanup();
  });

  try {
    sendEvent({ type: 'status', message: `Transcribing with faster-whisper (${model})…` });

    const scriptPath = path.join(__dirname, 'transcribe.py');
    const venvPython = path.join(__dirname, '.venv', 'bin', 'python3');
    const pythonBin = fs.existsSync(venvPython) ? venvPython : 'python3';

    await new Promise((resolve, reject) => {
      pythonProc = spawn(pythonBin, [scriptPath, tmpFile, model]);

      let lineBuf = '';

      pythonProc.stdout.on('data', chunk => {
        lineBuf += chunk.toString();
        const lines = lineBuf.split('\n');
        lineBuf = lines.pop();
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);
            sendEvent(event);
            if (event.type === 'error') reject(new Error(event.message));
          } catch {}
        }
      });

      pythonProc.stderr.on('data', d => {
        const msg = d.toString().trim();
        if (msg) process.stdout.write(`[transcribe.py] ${msg}\n`);
      });

      pythonProc.on('error', reject);
      pythonProc.on('close', code => {
        if (code === 0 || code === null) resolve();
        else reject(new Error(`Python worker exited with code ${code}`));
      });
    });

  } catch (err) {
    console.error('[/api/transcribe-file]', err.message);
    sendEvent({ type: 'error', message: err.message });
  } finally {
    cleanup();
    res.end();
  }
});

/**
 * POST /api/render-subtitles
 * Body: { segments: [...], templateId: 'WordPop' }
 * Streams SSE progress events, then sends { type: 'done', fileId } on completion.
 */
app.post('/api/render-subtitles', async (req, res) => {
  const { segments, templateId = 'WordPop' } = req.body || {};
  if (!segments || !Array.isArray(segments)) {
    return res.status(400).json({ error: 'segments array is required' });
  }

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sendEvent = (data) => {
    if (!res.writableEnded) res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  const fileId = uuidv4();
  const outputLocation = path.join(os.tmpdir(), `subtitles-${fileId}.mov`);
  const totalDurationSec = segments.length > 0
    ? segments[segments.length - 1].end
    : 60;

  try {
    sendEvent({ type: 'progress', progress: 0 });

    const bundlePath = await getRemotionBundle();
    sendEvent({ type: 'progress', progress: 0.05 });

    const { selectComposition, renderMedia } = await import('@remotion/renderer');

    const composition = await selectComposition({
      serveUrl: bundlePath,
      id: templateId,
      inputProps: { segments, totalDurationSec },
    });

    const durationInFrames = Math.max(1, Math.round(totalDurationSec * composition.fps));

    await renderMedia({
      composition: { ...composition, durationInFrames },
      serveUrl: bundlePath,
      codec: 'prores',
      proResProfile: '4444',
      pixelFormat: 'yuva444p10le',
      imageFormat: 'png',
      outputLocation,
      inputProps: { segments, totalDurationSec },
      onProgress: ({ progress }) => {
        sendEvent({ type: 'progress', progress: 0.05 + progress * 0.95 });
      },
    });

    sendEvent({ type: 'done', fileId });
  } catch (err) {
    console.error('[/api/render-subtitles]', err.message);
    sendEvent({ type: 'error', message: err.message });
  } finally {
    res.end();
  }
});

/**
 * GET /api/download-rendered/:fileId
 * Streams the rendered .mov file and deletes it after download.
 */
app.get('/api/download-rendered/:fileId', (req, res) => {
  const { fileId } = req.params;
  if (!/^[0-9a-f-]{36}$/.test(fileId)) {
    return res.status(400).json({ error: 'Invalid file ID' });
  }

  const filePath = path.join(os.tmpdir(), `subtitles-${fileId}.mov`);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found or already downloaded' });
  }

  res.setHeader('Content-Type', 'video/quicktime');
  res.setHeader('Content-Disposition', 'attachment; filename="subtitles.mov"');

  const stream = fs.createReadStream(filePath);
  stream.pipe(res);
  stream.on('error', (err) => {
    console.error('[download-rendered]', err.message);
    if (!res.headersSent) res.status(500).json({ error: err.message });
  });
  res.on('close', () => {
    try { fs.unlinkSync(filePath); } catch {}
  });
});

// ── Twitter / X helpers ───────────────────────────────────────────────────────

function isTwitterUrl(raw) {
  try {
    const h = new URL(raw).hostname.replace(/^www\./, '');
    return h === 'twitter.com' || h === 'x.com';
  } catch { return false; }
}

/**
 * Run yt-dlp -J (single JSON dump) on a URL and return the parsed object.
 */
function ytdlpJson(url) {
  return new Promise((resolve, reject) => {
    let out = '', err = '';
    const proc = spawn(YTDLP_PATH, [url, '-J', '--no-warnings']);
    proc.stdout.on('data', d => { out += d; });
    proc.stderr.on('data', d => { err += d; });
    proc.on('error', reject);
    proc.on('close', code => {
      if (code !== 0) return reject(new Error(`yt-dlp failed (exit ${code}): ${err.slice(0, 400)}`));
      try { resolve(JSON.parse(out)); }
      catch (e) { reject(new Error('Failed to parse yt-dlp JSON output')); }
    });
  });
}

/**
 * Build a deduplicated, sorted list of Twitter video formats.
 *
 * Twitter has two kinds of formats:
 *   - http-NNN  (protocol: https)  — direct mp4 URLs, combined video+audio,
 *                                    vcodec/acodec listed as undefined/"unknown"
 *   - hls-NNN   (protocol: m3u8_native) — HLS streams, video-only
 *
 * We prefer the direct http mp4s; they're always combined and work without muxing.
 */
function buildTwitterFormatList(formats) {
  if (!formats || !formats.length) return [];

  // Prefer direct HTTP mp4 formats (combined audio+video).
  // These have protocol 'https' and vcodec undefined (shown as "unknown" in yt-dlp -F).
  const directHttp = formats.filter(f =>
    f.height && f.ext === 'mp4' && f.protocol === 'https'
  );

  // Fall back to HLS video streams if no direct URLs exist.
  const source = directHttp.length > 0 ? directHttp : formats.filter(f =>
    f.height && f.vcodec && f.vcodec !== 'none' && f.ext === 'mp4'
  );

  const seen = new Set();
  return source
    .sort((a, b) => (b.height || 0) - (a.height || 0))
    .filter(f => {
      if (seen.has(f.height)) return false;
      seen.add(f.height);
      return true;
    })
    .map(f => ({
      formatId: f.format_id,
      quality: `${f.height}p`,
      height: f.height,
      // Direct http mp4s are always combined; HLS ones are video-only
      hasAudio: f.protocol === 'https' || !!(f.acodec && f.acodec !== 'none'),
      ext: f.ext || 'mp4',
      size: f.filesize
        ? `${(f.filesize / 1024 / 1024).toFixed(1)} MB`
        : (f.filesize_approx ? `~${(f.filesize_approx / 1024 / 1024).toFixed(1)} MB` : null),
    }));
}

/**
 * Parse a single yt-dlp entry into our normalised media object.
 * index is 1-based and used as the yt-dlp --playlist-items value.
 */
function parseTweetEntry(entry, index) {
  if (!entry) return null;
  const ext = (entry.ext || '').toLowerCase();

  // Image: direct URL stub with an image extension and no formats array
  const isImage = ['jpg', 'jpeg', 'png', 'webp'].includes(ext) && !(entry.formats && entry.formats.length);
  if (isImage) {
    const imgUrl = entry.url || '';
    // Upgrade pbs.twimg.com URLs to the largest available size
    const hiRes = imgUrl.replace(/[?&]name=\w+/, '').replace(/\?$/, '') +
      (imgUrl.includes('pbs.twimg.com') ? (imgUrl.includes('?') ? '&name=large' : '?name=large') : '');
    return {
      index,
      type: 'image',
      url: hiRes || imgUrl,
      thumbnail: imgUrl,
      width: entry.width || null,
      height: entry.height || null,
    };
  }

  const formats = buildTwitterFormatList(entry.formats || []);

  // A video has at least one combined (has audio) direct mp4 format.
  // If all formats are video-only HLS, treat as GIF/muted video.
  const hasAudio = formats.some(f => f.hasAudio);

  return {
    index,
    type: hasAudio ? 'video' : 'gif',
    thumbnail: entry.thumbnail || null,
    duration: entry.duration ? formatDuration(entry.duration) : null,
    formats,
    width: entry.width || null,
    height: entry.height || null,
  };
}

// ── Twitter routes ─────────────────────────────────────────────────────────────

/**
 * GET /api/twitter/info?url=<tweet_url>
 * Returns tweet metadata + a list of media items (images, videos, GIFs).
 */
app.get('/api/twitter/info', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'url param is required' });
  if (!isTwitterUrl(url)) return res.status(400).json({ error: 'Not a Twitter/X URL' });

  try {
    const info = await ytdlpJson(url);

    let entries;
    if (info._type === 'playlist') {
      entries = (info.entries || []);
    } else {
      entries = [info];
    }

    const media = entries
      .map((e, i) => parseTweetEntry(e, i + 1))
      .filter(Boolean);

    if (media.length === 0) {
      return res.status(404).json({ error: 'No downloadable media found in this tweet.' });
    }

    // Prefer root-level metadata; fall back to first entry
    const root = info._type === 'playlist' ? info : info;
    const firstEntry = entries[0] || {};

    return res.json({
      tweetText: root.title || firstEntry.title || '',
      author: root.uploader || firstEntry.uploader || 'Unknown',
      username: (root.uploader_id || firstEntry.uploader_id || '').replace(/^@/, ''),
      timestamp: root.timestamp || firstEntry.timestamp || null,
      tweetUrl: root.webpage_url || url,
      media,
    });
  } catch (err) {
    console.error('[/api/twitter/info]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/twitter/download?url=&index=&formatId=
 * Streams a Twitter video (or image) to the browser.
 * index is 1-based (matches --playlist-items).
 * formatId is optional; omitting it uses best available quality.
 */
app.get('/api/twitter/download', async (req, res) => {
  const { url, index = '1', formatId } = req.query;
  if (!url) return res.status(400).json({ error: 'url param is required' });
  if (!isTwitterUrl(url)) return res.status(400).json({ error: 'Not a Twitter/X URL' });

  try {
    const cdnLines = await new Promise((resolve, reject) => {
      let out = '', err = '';
      // Twitter's direct http mp4s (combined audio+video) are listed with unknown vcodec.
      // 'best' alone picks them correctly; specifying ext or vcodec filters them out.
      const args = [url, '-f', formatId || 'best', '--get-url', '--no-warnings', '--playlist-items', index];
      const proc = spawn(YTDLP_PATH, args);
      proc.stdout.on('data', d => { out += d; });
      proc.stderr.on('data', d => { err += d; });
      proc.on('error', reject);
      proc.on('close', code => {
        const lines = out.trim().split('\n').filter(Boolean);
        if (lines.length >= 1) resolve(lines);
        else reject(new Error(`yt-dlp --get-url failed (exit ${code}): ${err.slice(0, 300)}`));
      });
    });

    const filename = sanitizeFilename(`tweet_${index}`) + '.mp4';
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    res.setHeader('Content-Type', 'video/mp4');

    if (cdnLines.length >= 2) {
      // Separate video+audio streams — mux with ffmpeg
      const ffmpegArgs = [
        '-i', cdnLines[0], '-i', cdnLines[1],
        '-map', '0:v:0', '-map', '1:a:0',
        '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
        '-movflags', 'frag_keyframe+empty_moov+faststart',
        '-f', 'mp4', 'pipe:1',
      ];
      const ff = spawn(FFMPEG_PATH, ffmpegArgs);
      ff.stdout.pipe(res);
      ff.stderr.on('data', d => process.stdout.write(`[ffmpeg-tw] ${d}`));
      ff.on('error', e => { if (!res.headersSent) res.status(500).json({ error: e.message }); else res.destroy(); });
      req.on('close', () => ff.kill('SIGKILL'));
    } else {
      // Twitter CDN — proxy without YouTube-specific headers
      const upstream = await fetch(cdnLines[0], {
        headers: { 'User-Agent': 'Mozilla/5.0', ...(req.headers.range ? { Range: req.headers.range } : {}) },
      });
      if (!upstream.ok && upstream.status !== 206) throw new Error(`CDN HTTP ${upstream.status}`);
      res.status(upstream.status);
      ['content-length', 'content-range', 'accept-ranges'].forEach(h => {
        const v = upstream.headers.get(h); if (v) res.setHeader(h, v);
      });
      Readable.fromWeb(upstream.body).pipe(res);
    }
  } catch (err) {
    console.error('[/api/twitter/download]', err.message);
    if (!res.headersSent) res.status(500).json({ error: err.message });
    else res.destroy();
  }
});

/**
 * GET /api/twitter/proxy-image?url=&filename=
 * Proxies a Twitter image download (avoids CORS + forces Content-Disposition).
 * Only accepts pbs.twimg.com URLs.
 */
app.get('/api/twitter/proxy-image', async (req, res) => {
  const { url: imageUrl, filename = 'tweet_image.jpg' } = req.query;
  if (!imageUrl) return res.status(400).json({ error: 'url param required' });

  try {
    const parsed = new URL(imageUrl);
    if (!parsed.hostname.endsWith('twimg.com')) {
      return res.status(403).json({ error: 'Only pbs.twimg.com URLs are allowed' });
    }
  } catch {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  try {
    const upstream = await fetch(imageUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://x.com/' },
    });
    if (!upstream.ok) throw new Error(`Upstream HTTP ${upstream.status}`);

    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'image/jpeg');
    const cl = upstream.headers.get('content-length');
    if (cl) res.setHeader('Content-Length', cl);

    Readable.fromWeb(upstream.body).pipe(res);
  } catch (err) {
    console.error('[/api/twitter/proxy-image]', err.message);
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/twitter/transcribe?url=&index=&model=
 * Downloads audio for a tweet media item via yt-dlp and transcribes via faster-whisper.
 * Streams results as SSE events (same format as /api/transcribe).
 */
app.get('/api/twitter/transcribe', async (req, res) => {
  const { url, index = '1', model = 'small' } = req.query;
  if (!url) return res.status(400).json({ error: 'url param required' });
  if (!isTwitterUrl(url)) return res.status(400).json({ error: 'Not a Twitter/X URL' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sendEvent = (data) => { if (!res.writableEnded) res.write(`data: ${JSON.stringify(data)}\n\n`); };
  const tmpFile = path.join(os.tmpdir(), `tw_transcribe_${Date.now()}_${index}.m4a`);
  let ytdlpProc = null, pythonProc = null;
  const cleanup = () => { try { fs.unlinkSync(tmpFile); } catch {} };

  req.on('close', () => { ytdlpProc?.kill('SIGKILL'); pythonProc?.kill('SIGKILL'); cleanup(); });

  try {
    sendEvent({ type: 'status', message: 'Downloading audio…' });

    await new Promise((resolve, reject) => {
      const args = [url, '-f', 'bestaudio[ext=m4a]/bestaudio', '--no-warnings', '--playlist-items', index, '-o', tmpFile];
      ytdlpProc = spawn(YTDLP_PATH, args);
      let stderr = '';
      ytdlpProc.stderr.on('data', d => { stderr += d; });
      ytdlpProc.on('error', reject);
      ytdlpProc.on('close', code => {
        if (code === 0) resolve();
        else reject(new Error(`yt-dlp exited ${code}: ${stderr.slice(0, 300)}`));
      });
    });

    sendEvent({ type: 'status', message: `Transcribing with faster-whisper (${model})…` });

    const scriptPath = path.join(__dirname, 'transcribe.py');
    const venvPython = path.join(__dirname, '.venv', 'bin', 'python3');
    const pythonBin = fs.existsSync(venvPython) ? venvPython : 'python3';

    await new Promise((resolve, reject) => {
      pythonProc = spawn(pythonBin, [scriptPath, tmpFile, model]);
      let lineBuf = '';
      pythonProc.stdout.on('data', chunk => {
        lineBuf += chunk.toString();
        const lines = lineBuf.split('\n');
        lineBuf = lines.pop();
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);
            sendEvent(event);
            if (event.type === 'error') reject(new Error(event.message));
          } catch {}
        }
      });
      pythonProc.stderr.on('data', d => process.stdout.write(`[tw-transcribe] ${d}`));
      pythonProc.on('error', reject);
      pythonProc.on('close', code => {
        if (code === 0 || code === null) resolve();
        else reject(new Error(`Python worker exited with code ${code}`));
      });
    });
  } catch (err) {
    console.error('[/api/twitter/transcribe]', err.message);
    sendEvent({ type: 'error', message: err.message });
  } finally {
    cleanup();
    res.end();
  }
});

app.listen(PORT, () => {
  console.log(`\n  YouTube + Twitter Downloader API`);
  console.log(`  ──────────────────────────────`);
  console.log(`  http://localhost:${PORT}`);
  console.log(`  GET /api/info?url=<yt_url>`);
  console.log(`  GET /api/twitter/info?url=<tweet_url>`);
  console.log(`  GET /api/twitter/download?url=&index=&formatId=`);
  console.log(`  GET /api/twitter/transcribe?url=&index=&model=\n`);
});
