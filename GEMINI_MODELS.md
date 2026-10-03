# Modèles Gemini réellement testés avec ta clé

Mesure du 2026-09-28 15:49:14 — `scripts/probe-gemini-models.py`.

`OK` = le modèle répond vraiment. `SATURÉ` = 503 passager du free tier.
`INTROUVABLE` = 404 : OpenMAIC tourne en rond sur ce cas => lenteur perçue.

| Modèle | Statut | Latence cumulée (s) | Tentatives | Détail |
|---|:-:|---:|---:|---|
| `gemini-3.5-transcribe` | OK | 0.45 | 1 |  |
| `gemini-robotics-er-2-preview` | OK | 1.26 | 1 | La TVA ( |
| `gemini-3.6-flash` | OK | 1.9 | 1 | La **T |
| `gemini-3.8-flash-lite-tts` | OK | 2.42 | 1 |  |
| `gemma-4-26b-a4b-it` | OK | 2.72 | 1 | *   Topic: TVA (Taxe sur la Valeur Ajoutée / Value Added Tax).     *   Constraint: "En une phra |
| `gemini-3.8-flash-tts` | OK | 2.96 | 1 |  |
| `gemma-4-31b-it` | OK | 34.61 | 1 | *   Topic: TVA (Taxe sur la Valeur Ajoutée / Value Added Tax).     *   Constraint: One sentence |
| `gemini-embedding-001` | INTROUVABLE | 0.23 | 1 | { "error": { "code": 404, "message": "models/gemini-embedding-001 is not found for API version  |
| `veo-3.1-generate-preview` | INTROUVABLE | 0.24 | 1 | { "error": { "code": 404, "message": "models/veo-3.1-generate-preview is not found for API vers |
| `gemini-2.5-flash-lite` | INTROUVABLE | 0.26 | 1 | { "error": { "code": 404, "message": "This model models/gemini-2.5-flash-lite is no longer avai |
| `veo-3.1-fast-generate-preview` | INTROUVABLE | 0.26 | 1 | { "error": { "code": 404, "message": "models/veo-3.1-fast-generate-preview is not found for API |
| `gemini-embedding-2-preview` | INTROUVABLE | 0.29 | 1 | { "error": { "code": 404, "message": "models/gemini-embedding-2-preview is not found for API ve |
| `gemini-embedding-2` | INTROUVABLE | 0.29 | 1 | { "error": { "code": 404, "message": "models/gemini-embedding-2 is not found for API version v1 |
| `aqa` | INTROUVABLE | 0.29 | 1 | { "error": { "code": 404, "message": "models/aqa is not found for API version v1beta, or is not |
| `deep-research-max-preview-04-2026` | ERREUR | 0.41 | 1 | { "error": { "code": 400, "message": "This model only supports Interactions API.", "status": "I |
| `antigravity-preview-09-2026` | ERREUR | 0.43 | 1 | { "error": { "code": 400, "message": "This model only supports Interactions API.", "status": "I |
| `antigravity-preview-latest` | ERREUR | 0.44 | 1 | { "error": { "code": 400, "message": "This model only supports Interactions API.", "status": "I |
| `antigravity-preview-05-2026` | ERREUR | 0.49 | 1 | { "error": { "code": 400, "message": "This model only supports Interactions API.", "status": "I |
| `deep-research-preview-04-2026` | ERREUR | 0.5 | 1 | { "error": { "code": 400, "message": "This model only supports Interactions API.", "status": "I |
| `deep-research-pro-preview-12-2025` | ERREUR | 0.5 | 1 | { "error": { "code": 400, "message": "This model only supports Interactions API.", "status": "I |
| `gemini-3.1-flash-tts-preview` | ERREUR | 0.73 | 1 | { "error": { "code": 400, "message": "Request contains an invalid argument.", "status": "INVALI |
| `gemini-2.5-pro` | INTROUVABLE | 0.74 | 1 | { "error": { "code": 404, "message": "This model models/gemini-2.5-pro is no longer available t |
| `gemini-2.5-flash` | INTROUVABLE | 0.77 | 1 | { "error": { "code": 404, "message": "This model models/gemini-2.5-flash is no longer available |
| `gemini-2.5-flash-preview-tts` | ERREUR | 0.9 | 1 | { "error": { "code": 400, "message": "The requested combination of response modalities (TEXT) i |
| `gemini-2.5-computer-use-preview-10-2025` | QUOTA | 0.93 | 3 | { "error": { "code": 429, "message": "You exceeded your current quota, please check your plan a |
| `gemini-omni-1.1-flash` | QUOTA | 1.01 | 3 | { "error": { "code": 429, "message": "You exceeded your current quota, please check your plan a |
| `lyria-3-pro-preview` | QUOTA | 1.08 | 3 | { "error": { "code": 429, "message": "You exceeded your current quota, please check your plan a |
| `gemini-omni-flash-preview` | QUOTA | 1.1 | 3 | { "error": { "code": 429, "message": "You exceeded your current quota, please check your plan a |
| `lyria-3.5` | QUOTA | 1.14 | 3 | { "error": { "code": 429, "message": "You exceeded your current quota, please check your plan a |
| `gemini-pro-latest` | QUOTA | 1.15 | 3 | { "error": { "code": 429, "message": "You exceeded your current quota, please check your plan a |
| `gemini-3.1-pro-preview` | QUOTA | 1.16 | 3 | { "error": { "code": 429, "message": "You exceeded your current quota, please check your plan a |
| `nano-banana-pro-preview` | QUOTA | 1.16 | 3 | { "error": { "code": 429, "message": "You exceeded your current quota, please check your plan a |
| `gemini-3.1-flash-image-preview` | QUOTA | 1.19 | 3 | { "error": { "code": 429, "message": "You exceeded your current quota, please check your plan a |
| `gemini-3.1-pro-preview-customtools` | QUOTA | 1.21 | 3 | { "error": { "code": 429, "message": "You exceeded your current quota, please check your plan a |
| `gemini-3.1-flash-lite-image` | QUOTA | 1.27 | 3 | { "error": { "code": 429, "message": "You exceeded your current quota, please check your plan a |
| `gemini-2.5-flash-image` | QUOTA | 1.28 | 3 | { "error": { "code": 429, "message": "You exceeded your current quota, please check your plan a |
| `gemini-3.1-flash-image` | QUOTA | 1.34 | 3 | { "error": { "code": 429, "message": "You exceeded your current quota, please check your plan a |
| `gemini-3-pro-image-preview` | QUOTA | 1.35 | 3 | { "error": { "code": 429, "message": "You exceeded your current quota, please check your plan a |
| `lyria-3-clip-preview` | QUOTA | 1.37 | 3 | { "error": { "code": 429, "message": "You exceeded your current quota, please check your plan a |
| `gemini-2.5-pro-preview-tts` | QUOTA | 1.4 | 3 | { "error": { "code": 429, "message": "You exceeded your current quota, please check your plan a |
| `gemini-3-pro-image` | QUOTA | 1.53 | 3 | { "error": { "code": 429, "message": "You exceeded your current quota, please check your plan a |
| `gemini-3.5-flash-lite` | SATURÉ | 1.8 | 3 | { "error": { "code": 503, "message": "This model is currently experiencing high demand. Spikes  |
| `gemini-3.8-flash` | QUOTA | 1.89 | 3 | { "error": { "code": 429, "message": "You exceeded your current quota, please check your plan a |
| `gemini-flash-lite-latest` | SATURÉ | 2.02 | 3 | { "error": { "code": 503, "message": "This model is currently experiencing high demand. Spikes  |
| `gemini-3.1-flash-lite-preview` | SATURÉ | 2.47 | 3 | { "error": { "code": 503, "message": "This model is currently experiencing high demand. Spikes  |
| `gemini-3.5-flash` | SATURÉ | 2.47 | 3 | { "error": { "code": 503, "message": "This model is currently experiencing high demand. Spikes  |
| `gemini-3.7-flash` | SATURÉ | 3.36 | 3 | { "error": { "code": 503, "message": "This model is currently experiencing high demand. Spikes  |
| `gemini-3.1-flash-lite` | SATURÉ | 3.44 | 3 | { "error": { "code": 503, "message": "This model is currently experiencing high demand. Spikes  |
| `gemini-flash-latest` | SATURÉ | 3.63 | 3 | { "error": { "code": 503, "message": "This model is currently experiencing high demand. Spikes  |
| `gemini-3-flash-preview` | ERREUR | 60.14 | 1 | TimeoutError: The read operation timed out |
