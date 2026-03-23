const express = require('express');
const cors = require('cors');
const { Readable } = require('stream');
const { createContext, Script } = require('node:vm');
const { spawn } = require('child_process');
const path = require('path');

// yt-dlp binary (auto-installed by youtube-dl-exec)
const YTDLP_PATH = require('youtube-dl-exec').constants.YOUTUBE_DL_PATH;
// ffmpeg binary (bundled by ffmpeg-static)
const FFMPEG_PATH = require('ffmpeg-static');
const FFMPEG_DIR  = path.dirname(FFMPEG_PATH);

const app = express();
const PORT = 3002;

app.use(cors());

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

function mimeContainer(mimeType) {
  return (mimeType || '').split('/')[1]?.split(';')[0] || 'mp4';
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
      size: f.content_length
        ? `${(parseInt(f.content_length) / 1024 / 1024).toFixed(1)} MB`
        : 'Unknown',
    }));

  // --- Video-only adaptive (mp4 / H.264) ---
  // Filter: mp4 container, minimum 360p, maximum 1080p, no duplicates on height
  const seenHeights = new Set(combined.map(f => parseInt(f.quality)));
  const adaptive = (streamingData.adaptive_formats || [])
    .filter(f => {
      if (!/^video\/mp4/.test(f.mime_type || '')) return false;  // mp4 only
      if (!f.height || f.height < 360 || f.height > 1080) return false;
      return true;
    })
    .sort((a, b) => (parseInt(b.quality_label) || b.height || 0)
                  - (parseInt(a.quality_label) || a.height || 0))
    // Pick best fps variant per height
    .reduce((acc, f) => {
      const key = `${f.height}p${f.fps > 30 ? f.fps : ''}`;
      if (!acc.find(x => `${x.height}p${x.fps > 30 ? x.fps : ''}` === key)) acc.push(f);
      return acc;
    }, [])
    .filter(f => !seenHeights.has(f.height))  // skip heights already in combined
    .map(f => ({
      itag: f.itag,
      quality: f.quality_label || `${f.height}p`,
      container: 'mp4',
      hasAudio: false,
      hasVideo: true,
      type: 'mux', // requires ffmpeg mux with audio stream
      fps: f.fps || null,
      size: f.content_length
        ? `${(parseInt(f.content_length) / 1024 / 1024).toFixed(1)} MB`
        : 'Unknown',
    }));

  return [
    ...combined.sort((a, b) => (parseInt(b.quality) || 0) - (parseInt(a.quality) || 0)),
    ...adaptive,
  ];
}

/**
 * Pick the best AAC audio stream (mp4a codec) for muxing with mp4 video.
 * Prefers highest bitrate.
 */
function getBestAudioFormat(streamingData) {
  return (streamingData.adaptive_formats || [])
    .filter(f => /^audio\/mp4/.test(f.mime_type || '') && f.has_audio)
    .sort((a, b) => (parseInt(b.bitrate) || 0) - (parseInt(a.bitrate) || 0))[0] || null;
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
 * GET /api/download?url=<yt_url>&itag=<itag>
 *
 * For combined formats:  deciphers the CDN URL and proxies the stream directly.
 * For adaptive (mux) formats: deciphers both the video-only and best AAC audio
 *   streams, then pipes them into ffmpeg (stream copy) to produce a fragmented
 *   mp4 that can be streamed to the browser in real time.
 */
app.get('/api/download', async (req, res) => {
  const { url, itag } = req.query;
  if (!url) return res.status(400).json({ error: 'url query param is required' });

  const videoId = extractVideoId(url);
  if (!videoId) return res.status(400).json({ error: 'Invalid YouTube URL' });

  try {
    const yt = await getYT();
    const info = await yt.getBasicInfo(videoId, 'WEB');

    if (!info.streaming_data) {
      return res.status(403).json({ error: 'Video is unavailable.' });
    }

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

    const title = sanitizeFilename(info.basic_info.title);
    const filename = `${title}.mp4`;

    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    res.setHeader('Content-Type', 'video/mp4');

    const needsMux = !format.has_audio; // video-only adaptive (SABR) stream

    if (needsMux) {
      // ── HD path ──────────────────────────────────────────────────────────
      // YouTube's adaptive formats (480p–1080p) use Server-side ABR (SABR)
      // which doesn't expose direct stream URLs in the format proto.
      //
      // Strategy:
      //   1. Ask yt-dlp to resolve the actual CDN URLs (--get-url, no download).
      //      yt-dlp implements the SABR protocol and prints two lines:
      //      line 1 = video CDN URL, line 2 = audio CDN URL.
      //   2. Feed both URLs into the local ffmpeg-static binary, which merges
      //      them as a fragmented mp4 (streamable without seeking) and writes
      //      the result directly to the HTTP response.

      // Use the actual pixel height from the format metadata.
      // For portrait/Shorts videos, quality_label "480p" means width=480,
      // but yt-dlp's height selector refers to the taller dimension (e.g. 854).
      // Using format.height gives us the correct pixel height to constrain by.
      const actualHeight = format.height || parseInt(format.quality_label) || 720;

      // Prefer H.264 + AAC (stream-copy, no re-encode). Fall back broadly.
      const fmtSpec = [
        `bestvideo[vcodec^=avc][height<=${actualHeight}]+bestaudio[ext=m4a]`,
        `bestvideo[ext=mp4][height<=${actualHeight}]+bestaudio[ext=m4a]`,
        `bestvideo[height<=${actualHeight}]+bestaudio`,
      ].join('/');

      console.log(`[yt-dlp] resolving URLs — quality: ${format.quality_label || actualHeight + 'p'} (actualHeight=${actualHeight})`);

      // Step 1: get CDN URLs from yt-dlp (no actual download)
      const cdnUrls = await new Promise((resolve, reject) => {
        let out = '', err = '';
        const proc = spawn(YTDLP_PATH, [
          url, '-f', fmtSpec, '--get-url', '--no-playlist',
        ]);
        proc.stdout.on('data', d => { out += d.toString(); });
        proc.stderr.on('data', d => { err += d.toString(); });
        proc.on('error', reject);
        proc.on('close', code => {
          const lines = out.trim().split('\n').filter(Boolean);
          if (lines.length >= 1) resolve(lines);
          else reject(new Error(`yt-dlp --get-url failed (exit ${code}): ${err.slice(0, 300)}`));
        });
      });

      const videoUrl = cdnUrls[0];
      const audioUrl = cdnUrls[1] ?? cdnUrls[0]; // single URL = already muxed

      console.log(`[yt-dlp] resolved ${cdnUrls.length} URL(s), handing to ffmpeg`);

      // Step 2: ffmpeg merges both streams → fragmented mp4 → HTTP response
      const ytHeaders = [
        'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Referer: https://www.youtube.com/',
        'Origin: https://www.youtube.com',
      ].join('\r\n') + '\r\n';

      const ffmpegArgs = [
        '-reconnect', '1', '-reconnect_streamed', '1', '-reconnect_delay_max', '5',
        '-headers', ytHeaders, '-i', videoUrl,
      ];

      if (cdnUrls.length >= 2) {
        ffmpegArgs.push(
          '-reconnect', '1', '-reconnect_streamed', '1', '-reconnect_delay_max', '5',
          '-headers', ytHeaders, '-i', audioUrl,
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
      // ── Direct proxy path: combined stream, no muxing needed ──

      const videoUrl = await format.decipher(yt.session.player);
      if (!videoUrl) return res.status(500).json({ error: 'Could not resolve video URL.' });

      const fetchHeaders = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Referer': 'https://www.youtube.com/',
        'Origin': 'https://www.youtube.com',
      };
      if (req.headers.range) fetchHeaders['Range'] = req.headers.range;

      const upstream = await fetch(videoUrl, { headers: fetchHeaders });

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

app.listen(PORT, () => {
  console.log(`\n  YouTube Downloader API`);
  console.log(`  ──────────────────────────────`);
  console.log(`  http://localhost:${PORT}`);
  console.log(`  GET /api/info?url=<yt_url>`);
  console.log(`  GET /api/download?url=<yt_url>&itag=<itag>\n`);
});
