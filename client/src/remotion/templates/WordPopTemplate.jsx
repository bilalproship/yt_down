import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from 'remotion'
import { distributeWordTimings, chunkWords } from '../utils/wordUtils'

// ── Single caption card ────────────────────────────────────────────────────

function CaptionCard({ chunk }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const chunkStartSec = chunk[0].startSec
  const currentSec = frame / fps

  // Entrance: spring up from below
  const mountSpring = spring({
    frame,
    fps,
    config: { damping: 16, stiffness: 200, mass: 0.7 },
    durationInFrames: 18,
  })
  const enterY    = interpolate(mountSpring, [0, 1], [30, 0])
  const opacity   = interpolate(frame, [0, 6], [0, 1], { extrapolateRight: 'clamp' })

  // Whole-card gentle wiggle (one sine for Y, a slower one for tilt)
  const wiggleY      = Math.sin(frame * 0.09) * 3
  const wiggleDeg    = Math.sin(frame * 0.06 + 1.2) * 0.6

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'center',
        alignItems: 'center',
        opacity,
        transform: `translateY(${enterY + wiggleY}px) rotate(${wiggleDeg}deg)`,
      }}
    >
      <div
        style={{
          display: 'inline-flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '0 18px',
        }}
      >
        {chunk.map((w, i) => {
          const isActive = currentSec >= (w.startSec - chunkStartSec)
                        && currentSec <  (w.endSec   - chunkStartSec)

          // Per-word staggered vertical float
          const wordFloat = Math.sin((frame * 0.10) + i * 1.1) * 4

          // Active word breathes in scale
          const activePulse = isActive ? 1 + Math.sin(frame * 0.28) * 0.045 : 1

          // Feathered border: concentric blurred shadows at 0 offset
          const feather = '0 0 3px rgba(0,0,0,1), 0 0 7px rgba(0,0,0,0.9), 0 0 13px rgba(0,0,0,0.75), 0 0 20px rgba(0,0,0,0.5)'

          // Multi-layer stacked shadow = 3D extrusion in -Z (into the screen)
          const extrusion = isActive
            ? '1px 1px 0 #900000, 2px 2px 0 #7a0000, 3px 3px 0 #640000, 4px 4px 0 #500000, 5px 5px 0 #3d0000, 6px 6px 0 #2d0000, 7px 7px 0 #200000, 8px 8px 0 #150000, 9px 9px 0 #0d0000, 10px 10px 0 #080000'
            : '1px 1px 0 #1a1a1a, 2px 2px 0 #161616, 3px 3px 0 #121212, 4px 4px 0 #0e0e0e, 5px 5px 0 #0b0b0b, 6px 6px 0 #090909, 7px 7px 0 #070707, 8px 8px 0 #050505, 9px 9px 0 #030303, 10px 10px 0 #020202'

          return (
            <span
              key={i}
              style={{
                fontFamily: 'Impact, Arial Black, sans-serif',
                fontSize: 96,
                fontWeight: 900,
                textTransform: 'uppercase',
                letterSpacing: -2,
                lineHeight: 1,
                color: isActive ? '#e63030' : '#ffffff',
                textShadow: `${feather}, ${extrusion}`,
                display: 'inline-block',
                whiteSpace: 'nowrap',
                transform: `translateY(${wordFloat}px) scale(${activePulse})`,
                transformOrigin: 'bottom center',
              }}
            >
              {w.word}
            </span>
          )
        })}
      </div>
    </AbsoluteFill>
  )
}

// ── Main template ──────────────────────────────────────────────────────────

export function WordPopTemplate({ segments, totalDurationSec }) {
  const { fps } = useVideoConfig()

  const allWords = segments.flatMap(seg => distributeWordTimings(seg))
  const chunks   = chunkWords(allWords, 4)

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      {chunks.map((chunk, i) => {
        const startFrame       = Math.round(chunk[0].startSec * fps)
        const endFrame         = Math.round(chunk[chunk.length - 1].endSec * fps)
        const durationInFrames = Math.max(1, endFrame - startFrame)

        return (
          <Sequence
            key={i}
            from={startFrame}
            durationInFrames={durationInFrames}
            premountFor={fps}
            layout="none"
          >
            <CaptionCard chunk={chunk} />
          </Sequence>
        )
      })}
    </AbsoluteFill>
  )
}
