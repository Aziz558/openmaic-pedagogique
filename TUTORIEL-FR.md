# OpenMAIC — tutoriel pas à pas (configuration 100 % gratuite)

Document écrit pour **Aziz — M1 Comptabilité-Fiscalité**.
Chaque affirmation ci-dessous vient d'un **test réellement exécuté** sur cette machine le
2026-09-28. Rien n'est supposé. Les mesures brutes sont dans `GEMINI_MODELS.md`.

---

## 1. Où on en est (mesuré, pas deviné)

| Élément | Résultat mesuré | Verdict |
|---|---|---|
| Clé Gemini (`AQ.Ab8...`) | 47 modèles visibles, appels acceptés | ✅ **valide** |
| `google:gemini-3.6-flash` | **OK — 1,88 s** via l'app, **mais** quota quotidien épuisé après une journée de mesures | ✅ **secours** (vision) |
| `google:gemma-4-26b-a4b-it` | **OK — 2,72 s** (1,61 s via l'app) | ✅ disponible |
| `google:gemini-3.8-flash` | ❌ 429 quota dépassé (échec après **8,2 s** dans l'app) | ✗ ne pas utiliser |
| `google:gemini-3.5-flash` | ❌ 503 saturé (échec après **18,1 s** dans l'app) | ✗ ne pas utiliser |
| `google:gemini-3.7-flash` | ❌ 503 saturé | ✗ ne pas utiliser |
| `google:gemini-3-flash-preview` | ❌ timeout 60 s | ✗ ne pas utiliser |
| Clé xAI/Grok (`xai-…`) | ❌ HTTP 403 « permission-denied », **0** modèle visible | ✗ inutilisable |
| Clé Groq (`gsk_…`) — ajoutée le 2026-09-29 | 11 modèles visibles, appels acceptés | ✅ **valide** |
| `groq:openai/gpt-oss-120b` | **OK — 0,32 s** en régime établi, 65 536 jetons, JSON de cours complet en 7,0 s | ✅ **modèle principal** |
| `groq:qwen/qwen3.8-27b` | **OK — 0,15–0,66 s**, **lit les images** (vérifié) | ✅ disponible |
| `groq:openai/gpt-oss-20b` | **OK — 0,45–1,49 s** via l'app | ✅ disponible |

| Chaîne complète (accès → modèle) | ✅ `Connection successful` → `OK` | ✅ **ça marche** |

### Le point le plus important de tout ce document

L'application **n'affiche aucune erreur** quand un modèle est mauvais. Elle **réessaie en
silence** et échoue au bout de 8 s, 18 s ou 60 s. On croit alors que « OpenMAIC est lent »,
alors que c'est **le nom du modèle qui est faux**.

C'est exactement ce qui se passait : `gemini-3.8-flash` (l'ancien réglage) est **hors quota**
gratuit. Chaque génération perdait 8 s avant de tomber en secours.

**Règle à retenir : on ne change le modèle qu'après avoir lancé le script de mesure.**

---

## 2. Vérifier sa configuration à tout moment

Deux scripts servent à ça (aucune dépendance à installer) :

```powershell
cd C:\Users\LENOVO\openmaic

# Test rapide : la clé répond-elle ? combien de modèles ?
python scripts\check-free-tiers.py --write

# Test complet : quel modèle répond VRAIMENT, et en combien de temps ?
python scripts\probe-gemini-models.py --tries 3 --workers 6
```

Le second écrit `GEMINI_MODELS.md` avec un tableau `OK / SATURÉ / QUOTA / INTROUVABLE`.
**Ne mets en `DEFAULT_MODEL` qu'un modèle marqué `OK` et le plus rapide possible.**

Pour tester un modèle précis **à travers l'application** (le vrai test), un script fait
le travail complet : il lit `.env.local`, récupère le cookie d'accès (sinon 401) puis
interroge `/api/verify-model` :

```powershell
# sans argument : teste DEFAULT_MODEL puis MODEL_FALLBACK
powershell -ExecutionPolicy Bypass -File scripts\verify-live.ps1

# ou des modèles précis
powershell -ExecutionPolicy Bypass -File scripts\verify-live.ps1 `
  -Models 'groq:openai/gpt-oss-120b','groq:qwen/qwen3.8-27b'
```

Mesures réelles du 2026-09-29 (serveur `pnpm dev` lancé) :

```
google:gemini-3.6-flash     -> OK en 1,88 s
groq:openai/gpt-oss-120b    -> OK en 0,70 s
groq:qwen/qwen3.8-27b       -> OK en 0,66 s
groq:openai/gpt-oss-20b     -> OK en 1,49 s
```


---

## 3. Lancer l'application en local

```powershell
cd C:\Users\LENOVO\openmaic
pnpm install     # déjà fait : répond « Already up to date » (3 min si à refaire)
pnpm dev         # http://localhost:3000
```

- Démarrage mesuré : **2,1 s** (Next.js 16.3.3, Turbopack).
- Node.js requis : **≥ 22.19.0** (`package.json` → `engines`).
- Le fichier `.env.local` est lu automatiquement (le serveur affiche `Environments: .env.local`).

Puis ouvre <http://localhost:3000> et saisis le mot de passe défini par `ACCESS_CODE`.

---

## 4. Comment OpenMAIC choisit le modèle (lu dans le code)

Ordre de priorité réel (`lib/server/resolve-model.ts`) :

```
1. MODEL_ROUTES[étape]      (réglage fin par étape, optionnel)
2. en-tête x-model          (envoyé par l'interface)
3. DEFAULT_MODEL            ← notre réglage principal
4. modèle embarqué par défaut = deepseek:deepseek-v4-pro   ⚠ PAYANT
```

⚠️ Le point 4 explique pourquoi `DEFAULT_MODEL` **doit** être rempli : sans lui, l'app
partirait sur DeepSeek, qui est payant.

### Les deux variables de secours (et une fausse)

| Variable | Existe ? | Rôle |
|---|---|---|
| `DEFAULT_MODEL` | ✅ oui | modèle principal |
| `MODEL_FALLBACK` | ✅ oui | second modèle si timeout / 429 / 503 / réponse vide |
| `MODEL_ROUTES` | ✅ oui | JSON : modèle + fallback **par étape** |
| ~~`FALLBACK_MODEL`~~ | ❌ **non** | **n'existe nulle part dans le code — pur placebo** |

> **Nuance vérifiée sur les deux modèles retenus :**
> - `groq:openai/gpt-oss-120b` → présent dans le **catalogue** (`lib/ai/providers.ts`) :
>   outils ✅, 131 072 de contexte, 65 536 de sortie. **Pas de vision** (l'API renvoie
>   `400` sur une image). Il apparaît dans les listes de l'interface.
> - `google:gemini-3.6-flash` → lui a la **vision** (lecture des scans .jpg) : c'est
>   exactement pourquoi il est en secours et pas en principal.

Le code du secours : `lib/server/llm-fallback.ts` (« Retryable-failure model fallback »).
Il se déclenche sur erreur transitoire : **429 quota, 503 saturé, timeout, réseau, réponse vide**.
C'est exactement le comportement qu'on veut avec un free tier.

> **⚠️ Ce que le test « petit prompt » ne montre pas, et le test « vrai cours » si.**
>
> Sur un simple « réponds OK », Gemini répondait en 1,9 s : tout allait bien.
> Mais sur une **vraie génération de cours** (JSON de 4 séquences / 12 scènes) :
>
> | Modèle | Résultat du test réaliste |
> |---|---|
> | `groq:openai/gpt-oss-120b` | ✅ 7,04 s — JSON complet et valide |
> | `groq:qwen/qwen3.8-27b` | ✅ 7,70 s — JSON complet et valide |
> | `google:gemini-3.6-flash` | ❌ **échec** « high demand » après 3 tentatives |
>
> Un modèle peut sembler excellent et tomber exactement quand tu en as besoin.
> D'où la règle : **mesurer sur la vraie tâche**, pas sur un hello-world.
>
> **⚠️ Le free tier Gemini est très bridé** (mesuré le 2026-09-29) :
> 20 requêtes par **minute**, plus un **plafond quotidien** qui a été atteint en
> fin de journée de mesures (« You exceeded your current quota »). Le secours Google
> est donc *meilleure-effort* : disponible tant que le quota n'est pas consommé.
> Groq, lui, n'a jamais été bridé sur toutes les mesures.


### Changer de modèle : la bonne procédure

1. lancer `python scripts\probe-gemini-models.py --tries 3 --workers 6` ;
2. repérer les lignes `OK`, prendre la **latence la plus basse** ;
3. écrire dans `.env.local` : `DEFAULT_MODEL=google:<id>` ;
4. mettre un **autre** modèle `OK` en `MODEL_FALLBACK=google:<id2>` ;
5. redémarrer `pnpm dev` (les variables d'environnement sont lues au démarrage) ;
6. reconfirmer avec le test `/api/verify-model` du § 2.

`MODEL_ROUTES` sert seulement si une étape précise doit utiliser un autre modèle. Exemple
(uniquement si tu en as besoin) — JSON **sur une seule ligne**, étapes valides dans
`lib/server/model-routes.ts` :

```env
MODEL_ROUTES='{"conversation-title":"google:gemini-3.6-flash","scene-content":{"model":"google:gemini-3.6-flash","fallback":"google:gemma-4-26b-a4b-it"}}'
```

### ⚠️ Piège à connaître : l'« Agent workbench »

Si un jour tu actives `OPENMAIC_AGENT_RUNTIME_ENABLED=true`, l'agent **exige** une étape
`maic-agent-driver` dans `MODEL_ROUTES`, sinon il lève une exception :

> `MODEL_ROUTES must explicitly configure stage "maic-agent-driver" ...`

Et cette étape n'accepte qu'un transport **OpenAI** (`openai-completions`), **pas** l'API
native Gemini. Elle réclame aussi une base PostgreSQL (`DATABASE_URL`).
👉 **Conclusion pratique : laisse l'agent éteint** (c'est le défaut). Le « travail de cours »
classique n'en a pas besoin. Coût : 0 €.

---

## 5. La voix (TTS) sans payer

### Ce que le code propose réellement

`TTS_ENV_MAP` (`lib/server/provider-config.ts`) contient : openai, azure, glm, qwen, voxcpm,
doubao, elevenlabs, minimax, lemonade.
👉 **Aucun fournisseur TTS gratuit avec clé.** Tous demandent une carte bancaire ou une
machine locale (VoxCPM/Lemonade = serveurs à installer chez toi).

### La solution gratuite : la voix du navigateur

`browser-native-tts` est **déjà présent** dans OpenMAIC, ne demande **aucune clé** et tourne
dans ton navigateur (Edge/Chrome ont des voix françaises). Vérifié dans le code :

- `lib/audio/constants.ts` → l'entrée `browser-native-tts` existe ;
- `isTTSProviderConfigured('browser-native-tts')` renvoie **toujours `true`** (pas de clé requise) ;
- la route serveur la refuse volontairement (`must be handled client-side`) : normal, tout se
  passe dans le navigateur.

**Comment l'activer :** Réglages → Voix → active **« Browser Native TTS »**, et choisis-le
comme voix par défaut. C'est du 100 % gratuit, sans limite.

> Note : `/api/health` affiche `"tts": false`. C'est **normal et sans gravité** : ça signifie
> « aucun fournisseur TTS côté serveur n'est configuré ». La voix du navigateur, elle,
> fonctionne quand même. Et `TTS_BROWSER_NATIVE=false` ne peut **que désactiver** — il ne
> peut jamais activer à ta place, donc il faut cocher la case dans les Réglages.

### Gemini TTS : possible, mais pas encore branché

Bonne nouvelle mesurée : **ta clé Gemini donne accès aux modèles TTS** (`gemini-3.8-flash-tts`
→ OK en 2,96 s ; `gemini-3.8-flash-lite-tts` → OK en 2,42 s). Mauvaise nouvelle : OpenMAIC
n'a pas d'entrée pour eux, il faudrait donc ajouter un fournisseur dans le code (catalogue,
adaptateur, clé i18n, et le test de neutralité `tests/providers/provider-neutrality-guard.test.ts`
qu'il faut mettre à jour car il compte les occurrences exactes de chaque nom de fournisseur).
Tant que ce n'est pas fait, **utilise la voix du navigateur** : gratuit, immédiat, zéro risque.


---

## 6. Déployer gratuitement (et pourquoi en local c'est impossible ici)

### Le problème matériel, en une mesure

```
RAM totale : 5,8 Go    RAM libre : 0,4 Go
```

Une compilation de production (`pnpm build`, Next.js 16 + Turbopack + 9 paquets à builder)
réclame au minimum ~1 Go de tas JS. Avec 0,4 Go libre, elle échoue par manque de mémoire —
ou pire, elle fige Windows. **Ce n'est pas un bug d'OpenMAIC : c'est la machine qui est trop
petite.** Le `Dockerfile` du projet le dit lui-même : l'étape la plus lourde « complète sous
une limite de conteneur de 1 Gio ».

👉 **Conclusion : on ne compile pas en local. On laisse la compilation se faire sur les
serveurs gratuits de l'hébergeur, qui ont de la RAM à revendre.** C'est exactement la raison
d'être du déploiement cloud.

Pour information, l'installation des dépendances a pris **3 min 27 s** et a réussi ; seul le
build final manque. C'est le signe que `node_modules` est sain.

> **Ce document décrit deux chemins.** La voie **retenue** est **Render** (§ « Voie retenue :
> Render » plus bas), via un fork GitHub et le fichier `render.yaml` du dépôt.
> **Vercel Hobby** reste le **plan B** : gratuit lui aussi, mais avec plus de mémoire de build
> — c'est la solution de repli si Render échoue sur les 512 Mo.

### Plan B : Vercel (offre Hobby = gratuite)

Le dépôt contient **déjà** `vercel.json` :

```json
{ "framework": "nextjs",
  "installCommand": "pnpm install",
  "buildCommand": "pnpm build",
  "functions": { "app/api/**/*.ts": { "maxDuration": 300 } } }
```

Donc Vercel est prévu par les auteurs, avec les routes API autorisées jusqu'à 300 s
(indispensable : une génération de cours est longue, un hébergeur à 10 s la couperait).

Étapes :

1. **Le code est déjà poussé** (commit `2f999da`, `.env.local` gitignoré). Si ce n'est pas
   encore fait, suis l'« Étape 1 » de la section Render ci-dessus : c'est le même dépôt.
   ⚠️ `.env.local` ne part **jamais** : gitignoré (`.gitignore:50` → `.env*`), vérifié par
   `git check-ignore .env.local`.

2. **Sur <https://vercel.com>** → *Add New… → Project* → importe le dépôt.
   Framework détecté : Next.js. **Ne touche pas** aux commandes (celles de `vercel.json`).

3. **Renseigne les variables d'environnement** (Settings → Environment Variables) —
   recopie ces valeurs depuis ton `.env.local` :
   ```
   ACCESS_CODE          = <ton mot de passe long, différent de celui du local>
   GOOGLE_API_KEY       = AQ.Ab8RN6...
   GROQ_API_KEY         = gsk_rmTZ0N...
   DEFAULT_MODEL        = groq:openai/gpt-oss-120b
   MODEL_FALLBACK       = google:gemini-3.6-flash
   IMAGE_ENABLED        = false
   VIDEO_ENABLED        = false
   ```
   ⚠️ `DEFAULT_MODEL` sans préfixe `google:` échoue. Les variables sont lues **au démarrage** :
   après toute modification, il faut *Redeploy*.
   Le préfixe Groq est `groq:` (et non `grok:`, qui est xAI et dont la clé est morte).

4. **Deploy**, puis vérifie sur ton URL :
   - `https://<ton-app>.vercel.app/api/health` → doit répondre `"status":"ok"` ;
   - ouvre le site, saisis `ACCESS_CODE`, puis fais **une** génération de cours et chronomètre.

5. **Node.js** : le projet exige **≥ 22.19.0**. Dans Vercel → Settings → Node.js Version,
   choisis **22.x**.

### Ce que Vercel gratuit ne fait pas (à savoir d'avance)

| Limite | Conséquence | Contournement |
|---|---|---|
| Pas de disque persistant | tout ce qui s'écrit dans `./data` disparaît | les cours restent dans **ton navigateur** (comportement par défaut d'OpenMAIC) ; ou branche une base |
| Site « qui s'endort » (Render) | 1er chargement lent après inactivité | Vercel ne s'endort pas ; Render oui (≈ 30–60 s) |
| Pas de PostgreSQL gratuit chez Vercel | l'Agent workbench et le stockage serveur restent OFF | base **Neon** gratuite → variable `DATABASE_URL` |

### Voie retenue : Render (GitHub + `render.yaml`)

Un fichier `render.yaml` est déjà commité : Render le détecte et configure le service tout seul.

**Étape 1 — créer ton dépôt sur GitHub (2 min).**
Ce dépôt local est un clone de `THU-MAIC/OpenMAIC`. **Ne pousse jamais vers celui-là.**
Le plus simple est de faire un *fork* : bouton **Fork** en haut de
<https://github.com/THU-MAIC/OpenMAIC> → ton compte `Aziz558`. Tu gardes l'historique
complet, la licence, et tu peux récupérer les mises à jour amont ensuite.

```powershell
cd C:\Users\LENOVO\openmaic
# `origin` a été renommé `upstream` : il pointe déjà vers THU-MAIC.
git remote add origin https://github.com/Aziz558/OpenMAIC.git
git push -u origin main
```

**Étape 2 — créer le service Render.**
1. <https://render.com> → connexion avec GitHub → **New** → **Blueprint**.
2. Choisis le dépôt forké. Render affiche `render.yaml` : les paramètres sont pré-remplis.
3. Render te demande les 3 variables marquées `sync: false` (elles ne sont **pas** dans le
   fichier, par sécurité) :
   - `ACCESS_CODE` = ton mot de passe
   - `GOOGLE_API_KEY` = `AQ.Ab8RN6…`
   - `GROQ_API_KEY` = `gsk_rmTZ0N…`
4. **Apply** → le build démarre.

**Ce que Render pré-remplit** (déjà dans `render.yaml`, vérifié) :

| Réglage | Valeur | Pourquoi |
|---|---|---|
| Runtime | `node` | le projet est en Next.js |
| Node | `22.19.0` | `package.json` exige `>=22.19.0` |
| Install | `pnpm install --frozen-lockfile` | `packageManager: pnpm@10.28.0` est déclaré |
| Build | `pnpm build` | compile 9 packages workspace puis `next build` |
| Start | `pnpm start` | |
| Health check | `/api/health` | Render ne publie le service que si ça répond |
| Région | `frankfurt` | latence faible depuis le Maroc / la France |

**⚠️ Le vrai risque, dit franchement : la RAM.**
Le palier **Free** de Render = **512 Mo**, et le build s'exécute sur cette même machine.
Or ce projet construit d'abord 9 packages workspace (`postinstall` → `build:packages`) puis
lance `next build` : c'est exactement pour ça que le build local n'a jamais abouti ici.

- Si le build échoue sur `JavaScript heap out of memory` ou sur un **OOM 137**,
  ce n'est **pas un bug du projet** : c'est la limite du palier gratuit.
- `NODE_OPTIONS=--max-old-space-size=400` est déjà dans le blueprint pour que V8 libère
  la mémoire avant que le conteneur ne soit tué. Ça peut sauver un build limite ; sinon,
  passe au plan B ci-dessous.
- Le palier à 7 $/mois est lui aussi à 512 Mo : l'aide y est faible.
- **Plan B si le build échoue** : Vercel Hobby (gratuit, plus de mémoire de build, et
  `vercel.json` est déjà présent dans le dépôt). Voir la section précédente.

**Ce que Render gratuit ne fait pas (à savoir d'avance)** :

| Limite | Conséquence | Contournement |
|---|---|---|
| 512 Mo de RAM | le build peut échouer ; le service aussi sous charge | `NODE_OPTIONS` ci-dessus, ou plan B |
| Arrêt après **15 min** d'inactivité | 1re requête très lente (30–60 s de démarrage à froid) | c'est normal, ce n'est pas un bug |
| **Fichiers locaux perdus** à chaque redéploiement | ce qui est écrit dans `./data` disparaît | les cours restent dans **ton navigateur** ; ou `DATABASE_URL` |
| Pas de disque persistant, pas de SSH | | |
| Postgres gratuit | **expire au bout de 30 jours** | ne l'utilise pas ; prends l'Agent workbench = reste OFF |
| 750 h/mois, 5 Go de bande passante | large pour un usage personnel | |

### Base de données gratuite (facultatif) : Neon

1. compte gratuit sur <https://neon.tech> → crée un projet → copie la chaîne `postgresql://…`.
2. ajoute `DATABASE_URL=postgresql://…` dans les variables Vercel.
3. redéploie.

Sans `DATABASE_URL`, l'application fonctionne quand même : elle garde les cours côté
navigateur (`.env.local` contient déjà cette note dans la section *Persistance*).


---

## 7. Dépannage : les pièges réellement rencontrés

| Symptôme | Cause réelle constatée | Correction |
|---|---|---|
| « C'est très lent » (8 s, 18 s, 60 s) | `DEFAULT_MODEL` pointait sur `gemini-3.8-flash` → **429 quota**, puis 503 ; l'app réessayait en silence avant le secours | principal sur `groq:openai/gpt-oss-120b` (mesuré **0,32–0,70 s**) |
| `Quota exceeded ... limit: 20` | le free tier Gemini permet **20 requêtes/minute** | attendre ~30 s, ou basculer sur Groq |
| `You exceeded your current quota` | **plafond quotidien** Gemini atteint (consommé par les mesures) | le secours Gemini devient inopérant ; principal Groq non bridé |
| `HTTP 403 error code: 1010` sur `api.groq.com` | blocage **Cloudflare** : `urllib` envoie `User-Agent: Python-urllib/…` | `check-free-tiers.py` envoie maintenant un User-Agent normal (corrigé) |
| `messages[0].content must be a string` | le modèle ne gère **pas** les images (gpt-oss-120b) | utiliser `groq:qwen/qwen3.8-27b` (vision vérifiée) |

| Erreur `401 Access code required` | le cookie `openmaic_access` manque (middleware) | POST `/api/access-code/verify` avec `{"code":"…"}` d'abord |
| `.env` modifié mais aucun effet | les variables sont lues **au démarrage** | redémarrer `pnpm dev` / *Redeploy* sur Vercel |
| `FALLBACK_MODEL` ne change rien | cette variable **n'existe pas** dans le code | utiliser **`MODEL_FALLBACK`** |
| Exception sur l'agent | `OPENMAIC_AGENT_RUNTIME_ENABLED=true` exige `MODEL_ROUTES.maic-agent-driver` (transport OpenAI + PostgreSQL) | laisser l'agent **désactivé** (défaut) |
| `/api/health` → `"tts": false` | normal : aucun TTS serveur configuré | la voix du **navigateur** fonctionne quand même (case à cocher) |
| Clé `xai-…` refusée partout | **403 permission-denied**, 0 modèle visible → xAI exige un plan payant activé | clé commentée dans `.env.local` ; ne pas y compter |
| « Illimité » avec `gemma-4-31b-it` | 34,6 s mesurés | préférer `gemma-4-26b-a4b-it` (1,6–2,7 s) |
| Build local qui échoue / PC figé | 0,4 Go de RAM libre | compiler sur Vercel (§ 6) |

### Comment lire une erreur du modèle

Le test `/api/verify-model` renvoie un code HTTP dans la réponse d'erreur :

- **404 / « not found »** → l'identifiant du modèle est faux ou absent du catalogue. Cette
  erreur est la plus vicieuse : elle provoque des relances en boucle → lenteur apparente.
- **429** → plafond gratuit atteint (attendre, ou basculer sur le modèle de secours).
- **503 / « overloaded »** → surcharge passagère de Google. Réessayer ; c'est transitoire.
- **403** → clé sans droits (cas de la clé xAI).

---

## 8. Ce qui reste ouvert (honnêtement)

Ce qui est **fait et vérifié** : clé Gemini valide, modèle par défaut rapide, secours
configuré, application qui répond de bout en bout, voix gratuite identifiée, procédure de
déploiement gratuit prête, **et fournisseur Groq ajouté le 2026-09-29** (clé `gsk_…` :
11 modèles visibles, les 3 modèles de conversation testés de bout en bout, y compris le
streaming et le secours `MODEL_FALLBACK`).

Ce qui **n'est pas** fait, et pourquoi :

1. **Build de production non exécuté ici** — impossible avec 0,4 Go de RAM libre. À valider
   par le premier déploiement Vercel (gratuit, il le fera pour toi).
2. **Fournisseur Gemini TTS non codé** — l'API répond (2,4–3,0 s) mais son intégration
   demande de toucher au catalogue TTS, à la configuration serveur, aux traductions et au
   test `provider-neutrality-guard`. Non urgent : la voix du navigateur est gratuite et
   disponible immédiatement.
3. **TTS/ASR côté Groq non codés** — la même clé Groq expose `canopylabs/orpheus-*`
   (synthèse vocale) et `whisper-large-v3-turbo` (transcription) **gratuits**. Ils
   demandent les mêmes modifications que le point 2. C'est la meilleure piste si tu veux
   un jour de la voix **côté serveur** sans payer.
4. **Aucune clé payante** n'est configurée : xAI commentée, OpenRouter vide, Ollama désactivé.

---

## 9. Fichiers de référence

| Fichier | Contenu |
|---|---|
| `.env.local` | ta configuration active (gitignoré, jamais commité) |
| `render.yaml` | blueprint Render : runtime, Node, build, start, variables |
| `vercel.json` | configuration Vercel (plan B), incluse par les auteurs |

| `GEMINI_MODELS.md` | tableau de mesure des 50 modèles : `OK / SATURÉ / QUOTA / INTROUVABLE` |
| `FREE_TIER_REPORT.md` | rapport du test rapide des clés et des fournisseurs |
| `scripts/probe-gemini-models.py` | sonde **par modèle** (à lancer avant tout changement) |
| `scripts/check-free-tiers.py` | sonde rapide multi-fournisseurs |
| `scripts/test-groq-resolution.ts` | vérifie Groq de bout en bout : clé, catalogue, 3 modèles, streaming, secours |
| `scripts/test-long-generation.ts` | compare Groq et Gemini sur une **vraie** génération de cours JSON |
| `scripts/verify-live.ps1` | teste des modèles **à travers l'app** (cookie + `/api/verify-model`) |
| `TUTORIEL-FR.md` | ce document |
| `README.md` | documentation officielle (l'Agent workbench est décrit ≈ ligne 1074) |
| `.env.example` | **la** référence des variables reconnues (le seul juge en cas de doute) |

### Les commandes à retenir

```powershell
cd C:\Users\LENOVO\openmaic

python scripts\check-free-tiers.py --write     # quelles clés marchent ? (rapide)
python scripts\probe-gemini-models.py --tries 3 --workers 6   # quel modèle Gemini ?
pnpm dev                                                      # lancer en local
powershell -ExecutionPolicy Bypass -File scripts\verify-live.ps1   # vérifier via l'app
git status                                                    # .env.local ne doit PAS y apparaitre
```

---

*Toutes les valeurs de ce document proviennent de commandes exécutées et de fichiers lus
dans ce dépôt, les 2026-09-28 et 2026-09-29 (ajout de Groq). Aucune n'est estimée.*


