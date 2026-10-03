#!/usr/bin/env python3
"""
check-free-tiers.py -- Verifie reellement les cles API configurees dans .env.local.

Pourquoi ce script : OpenMAIC echoue silencieusement quand DEFAULT_MODEL pointe sur
un id de modele inexistant (l'API repond 404, l'app retente, puis tombe en 503 sur les
alternatives) -> l'utilisateur voit juste "ca est tres long". Ce script repond a la
seule question qui compte : QUELLE cle tourne, QUELS modeles sont accessibles, et en
COMBIEN de temps.

Usage :
    python scripts/check-free-tiers.py            # sonde les providers configures
    python scripts/check-free-tiers.py --write    # + ecrit FREE_TIER_REPORT.md

Ne lit JAMAIS les cles depuis la ligne de commande, seulement depuis .env.local.
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
ENV_PATH = ROOT / ".env.local"

# La console Windows (cp1252) plante avec `UnicodeEncodeError` au beau milieu
# du rapport des qu'une reponse contient un caractere hors table — constate le
# 2026-09-29 avec les reponses Groq. On ecrit en UTF-8 : c'est aussi ce que
# les redirections de fichiers attendent.
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, ValueError):  # flux deja clos ou non reconfigurable
        pass

# Question de calibration : courte, en francais, domaine du tutorat.
PROMPT = "C'est quoi la TVA en une phrase ? Reponds brievement en francais."
TIMEOUT = 45

# urllib annonce « Python-urllib/3.10 » : Cloudflare rejette api.groq.com avec
# HTTP 403 « error code: 1010 » (bannissement base sur la signature du
# navigateur). Constate le 2026-09-29 — la meme cle repond en 200 via
# PowerShell/Node. Sans ce User-Agent, la sonde conclut a tort que Groq est mort.
DEFAULT_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) openmaic-free-tier-probe/1.0"


def load_env(path: Path = ENV_PATH) -> dict[str, str]:
    """Parse .env.local sans dependance externe (pas de python-dotenv requis)."""
    env: dict[str, str] = {}
    if not path.exists():
        return env
    for raw in path.read_text(encoding="utf-8", errors="replace").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        m = re.match(r"^([A-Za-z0-9_]+)=(.*)$", line)
        if m:
            env[m.group(1)] = m.group(2).strip().strip('"').strip("'")
    return env


def post(url: str, body: dict, headers: dict) -> tuple[bool, float, object]:
    """POST JSON -> (ok, secondes, reponse ou message d'erreur). N'eleve jamais."""
    t0 = time.time()
    req = urllib.request.Request(
        url,
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json",
                 "User-Agent": DEFAULT_UA, **headers},
    )
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
            data = json.loads(r.read().decode("utf-8", "replace"))
        return True, time.time() - t0, data
    except urllib.error.HTTPError as e:
        detail = ""
        try:
            detail = e.read().decode("utf-8", "replace")[:220]
        except Exception:
            pass
        return False, time.time() - t0, f"HTTP {e.code} {detail}"
    except Exception as e:  # noqa: BLE001 - on veut un rapport, pas un traceback
        return False, time.time() - t0, f"{type(e).__name__}: {e}"


def list_models(url: str, headers: dict) -> list[str] | None:
    """GET /models -> liste d'ids, ou None si indisponible."""
    req = urllib.request.Request(url, headers={"User-Agent": DEFAULT_UA, **headers})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            data = json.loads(r.read().decode("utf-8", "replace"))
    except Exception:
        return None
    items = data.get("data") or data.get("models") or []
    out = []
    for it in items:
        if isinstance(it, str):
            out.append(it)
        elif isinstance(it, dict):
            v = it.get("id") or it.get("name")
            if v:
                out.append(str(v).replace("models/", ""))
    return sorted(out) or None


def one_openai_compat(name: str, base: str, key: str, model: str) -> dict:
    ok, dt, res = post(
        f"{base.rstrip('/')}/chat/completions",
        {"model": model, "messages": [{"role": "user", "content": PROMPT}], "max_tokens": 120},
        {"Authorization": f"Bearer {key}"},
    )
    if ok:
        try:
            txt = res["choices"][0]["message"]["content"] or ""  # type: ignore[index]
        except Exception:
            txt = json.dumps(res)[:150]
        # HTTP 200 != modele utilisable. llm-fallback.ts classe une reponse vide
        # comme echec transitoire et bascule sur le secours : un modele qui
        # repond vite mais sans texte fait perdre le meme temps qu'un 429.
        # Constate le 2026-09-29 : gpt-oss-safeguard-20b (0,57 s) et
        # gemini-3.6-flash (15,9 s, finishReason MAX_TOKENS) repondaient vide.
        if not txt.strip():
            return {"provider": name, "model": model, "ok": False, "s": round(dt, 2),
                    "ex": "REPONSE VIDE (HTTP 200, aucun texte) — l'app la traiterait en echec"}
        return {"provider": name, "model": model, "ok": True, "s": round(dt, 2), "ex": txt[:110]}
    return {"provider": name, "model": model, "ok": False, "s": round(dt, 2), "ex": str(res)[:170]}


def one_google(name: str, key: str, model: str) -> dict:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    # Le free tier Gemini repond souvent 503 "model is currently overloaded" pendant
    # quelques secondes. 2 tentatives suffisent a separer "sature" de "modele mort".
    last: object = ""
    total = 0.0
    for attempt in range(3):
        ok, dt, res = post(
            url,
            {"contents": [{"parts": [{"text": PROMPT}]}],
             "generationConfig": {"maxOutputTokens": 120}},
            {"x-goog-api-key": key},
        )
        total += dt
        if ok:
            # Un HTTP 200 sans texte n'est pas un modele utilisable : ici
            # gemini-3.6-flash a repondu `content: {}` + finishReason MAX_TOKENS
            # en 15,9 s (le JSON affiche plus bas etait alors pris pour du texte).
            txt = ""
            try:
                parts = res["candidates"][0]["content"].get("parts") or []  # type: ignore[index]
                txt = "".join(p.get("text", "") for p in parts)
            except Exception:
                txt = ""
            if not txt.strip():
                return {"provider": name, "model": model, "ok": False,
                        "s": round(total, 2), "tries": attempt + 1,
                        "ex": "REPONSE VIDE (HTTP 200, aucun texte) " + json.dumps(res)[:110]}
            return {"provider": name, "model": model, "ok": True,
                    "s": round(total, 2), "tries": attempt + 1, "ex": txt[:110]}
        last = res
        if "503" not in str(res) and "429" not in str(res):
            break  # 404 / cles invalides : reinserer ne changera rien
        time.sleep(2.5 * (attempt + 1))
    return {"provider": name, "model": model, "ok": False,
            "s": round(total, 2), "tries": 3, "ex": str(last)[:170]}


def build_jobs(env: dict[str, str]) -> list:
    """Construit la liste des sondes depuis .env.local. Une ferme par provider configure."""
    jobs: list = []

    # --- xAI / Grok : format de cle `xai-` (c'est ce que "groq"/designait ici) ---
    k = env.get("GROK_API_KEY") or env.get("XAI_API_KEY")
    if k:
        base = env.get("GROK_BASE_URL") or "https://api.x.ai/v1"
        models = list_models(f"{base.rstrip('/')}/models", {"Authorization": f"Bearer {k}"})
        print(f"[xAI/Grok] cle {k[:5]}...  modeles visibles : {len(models) if models else 0}")
        if models:
            print("           " + ", ".join(models[:14]))
        wanted = (models or [])[:6] or [
            "grok-4.5", "grok-4", "grok-4-fast-non-reasoning", "grok-3", "grok-3-mini",
        ]
        for m in wanted:
            jobs.append(lambda m=m, b=base, k=k: one_openai_compat("xAI", b, k, m))

    # --- Groq : format de cle `gsk_` -------------------------------------------
    # Les IDs Groq changent souvent : `llama-3.3-70b-versatile` et
    # `meta-llama/llama-4-scout-17b-16e-instruct` ont disparu de l'API
    # (constate le 2026-09-29). On liste donc dynamiquement, comme pour xAI et
    # Gemini, sinon les 404 concluent a tort "aucun modele utilisable".
    k = env.get("GROQ_API_KEY")
    if k:
        base = (env.get("GROQ_BASE_URL") or "https://api.groq.com/openai/v1").rstrip("/")
        models = list_models(f"{base}/models", {"Authorization": f"Bearer {k}"})
        print(f"\n[Groq] cle {k[:4]}...  modeles visibles : {len(models) if models else 0}")
        if models:
            print("           " + ", ".join(models))
        # Whisper = ASR, orpheus = TTS, prompt-guard = filtre de moderation :
        # aucun n'est un modele de conversation.
        non_chat = ("whisper", "prompt-guard", "orpheus")
        chat = [m for m in (models or []) if not any(t in m.lower() for t in non_chat)]
        wanted = chat[:6] or ["openai/gpt-oss-120b", "qwen/qwen3.8-27b"]
        for m in wanted:
            jobs.append(lambda m=m, b=base, k=k: one_openai_compat("Groq", b, k, m))

    # --- Google Gemini : free tier, vision + 1M de contexte ---------------------
    k = env.get("GOOGLE_API_KEY")
    if k:
        base = env.get("GOOGLE_BASE_URL") or "https://generativelanguage.googleapis.com/v1beta"
        models = list_models(f"{base.rstrip('/')}/models", {"x-goog-api-key": k})
        gen = [m for m in (models or []) if not m.startswith("gemini-embedding")]
        print(f"\n[Gemini] cle {k[:8]}...  modeles accessibles a cette cle : {len(gen)}")
        if gen:
            print("           " + ", ".join(gen[:20]))
        # Choix des cibles : la liste "preferee" ne sert QUE si le modele y est
        # reellement accessible. Sinon on interroge dynamiquement les premiers
        # modeles de chat de la cle. Sans ca, un id hors quota dans la liste
        # figee fait conclure a tort "AUCUN modele utilisable" alors que
        # gemini-3.6-flash repond (bug constate le 2026-09-29).
        non_chat = ("image", "tts", "embedding", "live", "computer-use", "aqa", "deep-research",
                    "antigravity", "voice", "veo", "lyria", "robotics", "transcribe", "gemma-4-31b")
        preferred = ("gemini-3.6-flash", "gemma-4-26b-a4b-it", "gemini-3.8-flash",
                     "gemini-3.5-flash", "gemini-2.5-flash")
        targets = [m for m in preferred if m in gen]
        targets += [m for m in gen if m not in targets and not any(s in m for s in non_chat)]
        if not targets:
            targets = gen
        for m in targets[:6]:
            jobs.append(lambda m=m, k=k: one_google("Gemini", k, m))

    # --- OpenRouter : on ne sonde que les modeles `:free` (0 $) -----------------
    k = env.get("OPENROUTER_API_KEY")
    if k:
        base = env.get("OPENROUTER_BASE_URL") or "https://openrouter.ai/api/v1"
        models = list_models(f"{base.rstrip('/')}/models", {"Authorization": f"Bearer {k}"}) or []
        free = [m for m in models if m.endswith(":free")]
        print(f"\n[OpenRouter] {len(models)} modeles vus, {len(free)} gratuits (:free)")
        if free:
            print("           " + ", ".join(free[:10]))
        for m in free[:4]:
            jobs.append(lambda m=m, b=base, k=k: one_openai_compat("OpenRouter", b, k, m))

    # --- Ollama local (0 $, mais 5,8 Go de RAM sur ce PC => laisse commente) -----
    base = env.get("OLLAMA_BASE_URL")
    if base:
        for m in (env.get("OLLAMA_MODELS") or "qwen2.5-coder:7b").split(","):
            m = m.strip()
            if m:
                jobs.append(lambda m=m, b=base: one_openai_compat("Ollama(local)", b, "ollama", m))
    return jobs



def main() -> int:
    ap = argparse.ArgumentParser(description="Sonde les cles API de .env.local")
    ap.add_argument("--write", action="store_true", help="ecrit aussi FREE_TIER_REPORT.md")
    args = ap.parse_args()

    env = load_env()
    if not env:
        print(f"[ERR] {ENV_PATH} introuvable", file=sys.stderr)
        return 2

    presentes = sorted(k for k, v in env.items() if v and "KEY" in k)
    print(f"cles presentes : {presentes or 'aucune'}\n")

    jobs = build_jobs(env)
    if not jobs:
        print("\n[AUCUN] aucune cle exploitable dans .env.local.")
        print("Renseigne GOOGLE_API_KEY (free tier) puis relance : python scripts/check-free-tiers.py")
        return 1

    print(f"\n--- {len(jobs)} appels de test en paralele (max 6) ---")
    results: list[dict] = []
    with cf.ThreadPoolExecutor(max_workers=6) as ex:
        for r in ex.map(lambda f: f(), jobs):
            results.append(r)
            mark = "OK " if r["ok"] else "KO "
            print(f"  [{mark}] {r['provider']:<14} {r['model']:<46} {r['s']:>6.2f}s  {str(r['ex'])[:74]}")

    ok = [r for r in results if r["ok"]]
    print("\n===================== BILAN =====================")
    if ok:
        best = min(ok, key=lambda r: r["s"])
        print(f"modeles utilisables : {len(ok)}/{len(results)}")
        print(f"le plus rapide      : {best['provider']}:{best['model']}  ({best['s']}s)")
        pid = {"xAI": "grok", "Gemini": "google", "Groq": "groq",
               "OpenRouter": "openrouter", "Ollama(local)": "ollama"}[best["provider"]]
        print(f"=> a mettre dans .env.local :  DEFAULT_MODEL={pid}:{best['model']}")
    else:
        print("AUCUN modele utilisable -> verifie les cles, le reseau, ou les plafonds du free tier.")
    print("=================================================")

    if args.write:
        lines = [
            "# Verification des free tiers", "",
            f"Genere le {time.strftime('%Y-%m-%d %H:%M:%S')} par `scripts/check-free-tiers.py`.", "",
            "| Provider | Modele | OK | Latence (s) | Extrait / erreur |",
            "|---|---|:-:|---:|---|",
        ]
        for r in sorted(results, key=lambda x: (not x["ok"], x["s"])):
            ex = str(r["ex"]).replace("|", "/").replace("\n", " ")[:90]
            lines.append(
                f"| {r['provider']} | `{r['model']}` | {'OK' if r['ok'] else 'KO'} | {r['s']} | {ex} |"
            )
        out = ROOT / "FREE_TIER_REPORT.md"
        out.write_text("\n".join(lines) + "\n", encoding="utf-8")
        print(f"\nRapport ecrit : {out}")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())

