# Verification des free tiers

Genere le 2026-09-28 18:00:35 par `scripts/check-free-tiers.py`.

| Provider | Modele | OK | Latence (s) | Extrait / erreur |
|---|---|:-:|---:|---|
| Groq | `qwen/qwen3.8-27b` | OK | 0.39 | La TVA est un impôt sur la valeur ajoutée qui s’applique à la plupart des biens et service |
| Groq | `openai/gpt-oss-safeguard-20b` | OK | 0.57 | La TVA (taxe sur la valeur ajoutée) est une taxe indirect |
| Groq | `allam-2-7b` | OK | 0.58 | Taux de valeur ajoutée (TVA) est un système de redevance et de taxation applicable sur les |
| Groq | `openai/gpt-oss-120b` | OK | 0.71 | La TVA (taxe sur la valeur ajoutée) est un impôt indirect prélevé sur la consommation à ch |
| Groq | `openai/gpt-oss-20b` | OK | 0.77 | La TVA est une taxe indirecte ajoutée à la valeur ajoutée d’un produit ou d’un service à c |
| Gemini | `gemini-3.6-flash` | OK | 2.38 | La TVA (Tax |
| Gemini | `gemma-4-26b-a4b-it` | OK | 3.23 |  *   Topic: TVA (Taxe sur la Valeur Ajoutée / Value Added Tax). *   Constraint 1: One sent |
| Gemini | `gemini-2.5-flash` | KO | 0.24 | HTTP 404 {   "error": {     "code": 404,     "message": "This model models/gemini-2.5-flas |
| Gemini | `gemini-2.5-flash-lite` | KO | 0.3 | HTTP 404 {   "error": {     "code": 404,     "message": "This model models/gemini-2.5-flas |
| Gemini | `gemini-3.5-flash` | KO | 1.34 | HTTP 429 {   "error": {     "code": 429,     "message": "You exceeded your current quota,  |
| Gemini | `gemini-3.8-flash` | KO | 1.63 | HTTP 429 {   "error": {     "code": 429,     "message": "You exceeded your current quota,  |
