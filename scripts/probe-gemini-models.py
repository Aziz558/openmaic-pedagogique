#!/usr/bin/env python3
"""
probe-gemini-models.py -- Cartographie les modeles Gemini VRAIMENT utilisables.

Contexte : le free tier Gemini repond beaucoup en 503 "This model is currently
overloaded". Un id present dans GET /models ne garantit donc pas un generateContent
qui marche, et un 404 fait tourner OpenMAIC en rond (lenteur percue par l'utilisateur).
Seule une mesure dit la verite. Ce script :
  1. liste les modeles visibles par GOOGLE_API_KEY,
  2. tente generateContent sur chacun (retenta les 503, qui sont passagers),
  3. classe OK / SATURE / INTROUVABLE / QUOTA / ERREUR et ecrit GEMINI_MODELS.md.

Usage : python scripts/probe-gemini-models.py [--tries N] [--workers N] [--chat-only]
"""

from __future__ import annotations

import argparse
import concurrent.futures as cf
import json
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PROMPT = "C'est quoi la TVA en une phrase ?"
BASE = "https://generativelanguage.googleapis.com/v1beta"


def load_env() -> dict[str, str]:
    env: dict[str, str] = {}
    p = ROOT / ".env.local"
    if not p.exists():
        return env
    for raw in p.read_text(encoding="utf-8", errors="replace").splitlines():
        m = re.match(r"^([A-Za-z0-9_]+)=(.*)$", raw.strip())
        if m and not raw.strip().startswith("#"):
            env[m.group(1)] = m.group(2).strip().strip('"').strip("'")
    return env


def get(url: str, headers: dict, timeout: int = 25):
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return True, json.loads(r.read().decode("utf-8", "replace"))
    except urllib.error.HTTPError as e:
        return False, f"HTTP {e.code} " + e.read().decode("utf-8", "replace")[:300]
    except Exception as e:  # noqa: BLE001
        return False, f"{type(e).__name__}: {e}"


def try_model(key: str, model: str, tries: int) -> dict:
    """generateContent, avec retenta sur 503/429 -> dict de statut classe."""
    url = f"{BASE}/models/{model}:generateContent"
    body = json.dumps(
        {"contents": [{"parts": [{"text": PROMPT}]}],
         "generationConfig": {"maxOutputTokens": 80}}
    ).encode()
    last, total, n = "", 0.0, 0
    for attempt in range(tries):
        n += 1
        t0 = time.time()
        req = urllib.request.Request(
            url, data=body,
            headers={"x-goog-api-key": key, "Content-Type": "application/json"},
        )
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                data = json.loads(r.read().decode("utf-8", "replace"))
            total += time.time() - t0
            try:
                txt = "".join(p.get("text", "") for p in data["candidates"][0]["content"]["parts"])
            except Exception:
                txt = json.dumps(data)[:120]
            return {"model": model, "status": "OK", "s": round(total, 2),
                    "tries": n, "detail": txt.strip()[:100]}
        except urllib.error.HTTPError as e:
            total += time.time() - t0
            try:
                last = e.read().decode("utf-8", "replace")
            except Exception:
                last = str(e)
            if e.code in (429, 503):
                if attempt < tries - 1:
                    time.sleep(1.5 * (attempt + 1))
                continue
            break
        except Exception as e:  # noqa: BLE001
            total += time.time() - t0
            last = f"{type(e).__name__}: {e}"
            break
    msg = re.sub(r"\s+", " ", last)[:170]
    low = last.lower()
    if "503" in last or "overloaded" in low:
        st = "SATURÉ"
    elif "404" in last or "not found" in low:
        st = "INTROUVABLE"
    elif "429" in last or "quota" in low:
        st = "QUOTA"
    else:
        st = "ERREUR"
    return {"model": model, "status": st, "s": round(total, 2), "tries": n, "detail": msg}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--tries", type=int, default=4, help="tentatives par modele sur 503/429")
    ap.add_argument("--workers", type=int, default=4)
    ap.add_argument("--chat-only", action="store_true", help="ignore image/tts/embedding/live")
    args = ap.parse_args()

    key = load_env().get("GOOGLE_API_KEY")
    if not key:
        print("[ERR] GOOGLE_API_KEY absent de .env.local", file=sys.stderr)
        return 2

    ok, res = get(f"{BASE}/models", {"x-goog-api-key": key})
    if not ok:
        print(f"[ERR] liste des modeles refusee : {res}", file=sys.stderr)
        return 1
    models = [m.get("name", "").replace("models/", "") for m in res.get("models", []) if m.get("name")]
    print(f"{len(models)} modeles visibles par cette cle")

    skip = ("image", "tts", "embedding", "live", "computer-use", "aqa",
            "deep-research", "antigravity", "voice")
    targets = [m for m in models if not any(s in m for s in skip)] if args.chat_only else models
    print(f"{len(targets)} modeles sondes (tries={args.tries}, workers={args.workers})\n")

    results: list[dict] = []
    with cf.ThreadPoolExecutor(max_workers=args.workers) as ex:
        futs = {ex.submit(try_model, key, m, args.tries): m for m in targets}
        for f in cf.as_completed(futs):
            r = f.result()
            results.append(r)
            print(f"  [{r['status']:<11}] {r['model']:<44} {r['s']:>6.2f}s x{r['tries']}  {r['detail'][:64]}")

    results.sort(key=lambda r: (r["status"] != "OK", r["s"]))
    good = [r for r in results if r["status"] == "OK"]
    print("\n==================== BILAN ====================")
    print(f"utilisables : {len(good)}/{len(results)}")
    for r in good[:8]:
        print(f"  {r['s']:>6.2f}s  google:{r['model']}")
    if good:
        print(f"\n=> DEFAULT_MODEL=google:{good[0]['model']}   (le plus rapide des OK)")
        tts = [r["model"] for r in results if "tts" in r["model"] and r["status"] == "OK"]
        if tts:
            print(f"=> TTS dispo : {', '.join(tts)}")
    print("===============================================")

    lines = ["# Modèles Gemini réellement testés avec ta clé", "",
             f"Mesure du {time.strftime('%Y-%m-%d %H:%M:%S')} — `scripts/probe-gemini-models.py`.",
             "", "`OK` = le modèle répond vraiment. `SATURÉ` = 503 passager du free tier.",
             "`INTROUVABLE` = 404 : OpenMAIC tourne en rond sur ce cas => lenteur perçue.", "",
             "| Modèle | Statut | Latence cumulée (s) | Tentatives | Détail |",
             "|---|:-:|---:|---:|---|"]
    for r in results:
        d = r["detail"].replace("|", "/").replace("\n", " ")[:95]
        lines.append(f"| `{r['model']}` | {r['status']} | {r['s']} | {r['tries']} | {d} |")
    out = ROOT / "GEMINI_MODELS.md"
    out.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"\nRapport : {out}")
    return 0 if good else 1


if __name__ == "__main__":
    sys.exit(main())

