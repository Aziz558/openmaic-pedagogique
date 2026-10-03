"""Probe Groq's free audio models: canopylabs/orpheus (TTS) and whisper (ASR).

Measures what actually works with the configured GROQ_API_KEY before any
provider is wired into the app, so no code is written against a capability the
free tier does not actually grant.
"""

import os
import re
import struct
import sys
import time
import wave
from pathlib import Path

import requests

ENV_PATH = Path(__file__).resolve().parents[1] / ".env.local"
BASE = "https://api.groq.com/openai/v1"


def load_key() -> str:
    for line in ENV_PATH.read_text(encoding="utf-8", errors="replace").splitlines():
        match = re.match(r"^\s*GROQ_API_KEY\s*=\s*(.+?)\s*$", line)
        if match:
            return match.group(1).strip().strip("\"'")
    print("GROQ_API_KEY introuvable dans .env.local")
    sys.exit(1)


def make_wav(seconds: float = 1.0, rate: int = 8000) -> bytes:
    buffer = bytearray()
    with wave.open("silence.wav", "wb") as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(rate)
        handle.writeframes(b"\x00\x00" * int(rate * seconds))
    with open("silence.wav", "rb") as handle:
        buffer = handle.read()
    return bytes(buffer)


def main() -> int:
    key = load_key()
    headers = {"Authorization": f"Bearer {key}"}

    print("=== Modeles audio exposes par Groq ===")
    response = requests.get(f"{BASE}/models", headers=headers, timeout=30)
    response.raise_for_status()
    audio_models = [
        m["id"]
        for m in response.json()["data"]
        if re.search(r"orpheus|whisper|tts|audio", m["id"], re.I)
    ]
    for model in audio_models:
        print(f"  - {model}")

    print()
    print("=== TTS canopylabs/orpheus-v1-english ===")
    payload = {
        "model": "canopylabs/orpheus-v1-english",
        "input": "La TVA est un impot sur la valeur ajoutee.",
        "voice": "alloy",
        "response_format": "wav",
    }
    start = time.time()
    try:
        r = requests.post(
            f"{BASE}/audio/speech",
            headers={**headers, "Content-Type": "application/json"},
            json=payload,
            timeout=40,
        )
        elapsed = time.time() - start
        if r.ok:
            print(f"  OK  {elapsed:.2f}s  {len(r.content)} octets  {r.headers.get('content-type')}")
            tts_ok = True
        else:
            detail = r.json().get("error", {}).get("message", r.text)
            print(f"  KO  {r.status_code}  {elapsed:.2f}s")
            print(f"      {detail[:220]}")
            tts_ok = False
    except Exception as exc:  # noqa: BLE001 - probe reports, never raises
        print(f"  KO  {exc}")
        tts_ok = False

    print()
    print("=== ASR whisper-large-v3-turbo ===")
    Path("silence.wav").write_bytes(make_wav())
    start = time.time()
    try:
        with open("silence.wav", "rb") as handle:
            r = requests.post(
                f"{BASE}/audio/transcriptions",
                headers=headers,
                files={"file": ("silence.wav", handle, "audio/wav")},
                data={"model": "whisper-large-v3-turbo", "response_format": "json"},
                timeout=40,
            )
        elapsed = time.time() - start
        if r.ok:
            text = r.json().get("text", "").strip()
            print(f"  OK  {elapsed:.2f}s  texte={text!r}")
            asr_ok = True
        else:
            detail = r.json().get("error", {}).get("message", r.text)
            print(f"  KO  {r.status_code}  {elapsed:.2f}s")
            print(f"      {detail[:220]}")
            asr_ok = False
    except Exception as exc:  # noqa: BLE001 - probe reports, never raises
        print(f"  KO  {exc}")
        asr_ok = False

    print()
    print(f"Verdict : TTS={'disponible' if tts_ok else 'inutilisable'} / "
          f"ASR={'disponible' if asr_ok else 'inutilisable'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())