#!/usr/bin/env python3
"""
Pre-download faster-whisper models to local HuggingFace cache so
transcription starts instantly without waiting for network downloads.

Usage:
    python3 download_models.py              # downloads tiny + small (default)
    python3 download_models.py all          # downloads all 4 models
    python3 download_models.py medium large-v3   # specific models
"""

import sys

MODELS = {
    "tiny":     "Systran/faster-whisper-tiny",
    "small":    "Systran/faster-whisper-small",
    "medium":   "Systran/faster-whisper-medium",
    "large-v3": "Systran/faster-whisper-large-v3",
}

SIZES = {
    "tiny":     "~75 MB",
    "small":    "~245 MB",
    "medium":   "~1.5 GB",
    "large-v3": "~3.1 GB",
}

def download(model_size):
    from huggingface_hub import snapshot_download
    repo = MODELS[model_size]
    print(f"  Downloading {model_size} ({SIZES[model_size]}) from {repo}…")
    path = snapshot_download(repo_id=repo)
    print(f"  ✓ {model_size} cached at: {path}")

def main():
    try:
        from huggingface_hub import snapshot_download
    except ImportError:
        print("faster-whisper is not installed. Run: pip install faster-whisper")
        sys.exit(1)

    args = sys.argv[1:]

    if not args:
        targets = ["tiny", "small"]
    elif args == ["all"]:
        targets = list(MODELS.keys())
    else:
        targets = []
        for a in args:
            if a not in MODELS:
                print(f"Unknown model '{a}'. Valid: {', '.join(MODELS)}")
                sys.exit(1)
            targets.append(a)

    print(f"\nDownloading {len(targets)} model(s): {', '.join(targets)}\n")
    for t in targets:
        download(t)
    print("\nAll done. Models are cached and ready to use.\n")

if __name__ == "__main__":
    main()
