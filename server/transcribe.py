#!/usr/bin/env python3
"""
faster-whisper transcription worker.

Usage:
    python3 transcribe.py <audio_file_path> [model_size]

Streams newline-delimited JSON events to stdout:
    {"type": "info",    "language": "en", "probability": 0.99}
    {"type": "segment", "start": 0.0, "end": 2.5, "text": "Hello world"}
    {"type": "done"}
    {"type": "error",   "message": "..."}
"""

import sys
import json
import os

def emit(obj):
    sys.stdout.write(json.dumps(obj) + "\n")
    sys.stdout.flush()

def main():
    if len(sys.argv) < 2:
        emit({"type": "error", "message": "No audio file path provided"})
        sys.exit(1)

    audio_path = sys.argv[1]
    model_size = sys.argv[2] if len(sys.argv) > 2 else "small"

    if not os.path.exists(audio_path):
        emit({"type": "error", "message": f"Audio file not found: {audio_path}"})
        sys.exit(1)

    try:
        from faster_whisper import WhisperModel
    except ImportError:
        emit({"type": "error", "message": "faster-whisper is not installed. Run: pip install faster-whisper"})
        sys.exit(1)

    try:
        emit({"type": "status", "message": f"Loading {model_size} model…"})
        model = WhisperModel(model_size, device="cpu", compute_type="int8")
        emit({"type": "status", "message": "Analysing audio…"})

        segments, info = model.transcribe(
            audio_path,
            beam_size=5,
            vad_filter=True,
            vad_parameters={"min_silence_duration_ms": 500},
        )

        emit({
            "type": "info",
            "language": info.language,
            "probability": round(info.language_probability, 3),
        })

        for segment in segments:
            emit({
                "type": "segment",
                "start": round(segment.start, 2),
                "end": round(segment.end, 2),
                "text": segment.text.strip(),
            })

        emit({"type": "done"})

    except Exception as e:
        emit({"type": "error", "message": str(e)})
        sys.exit(1)

if __name__ == "__main__":
    main()
