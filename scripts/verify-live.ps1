<#
.SYNOPSIS
  Vérifie des modèles À TRAVERS l'application (le seul test qui compte).

.DESCRIPTION
  1. lit ACCESS_CODE / DEFAULT_MODEL / MODEL_FALLBACK depuis .env.local ;
  2. obtient le cookie d'accès sur /api/access-code/verify (sinon 401) ;
  3. interroge /api/verify-model pour chaque modèle et affiche la latence.

  Le serveur doit tourner : `pnpm dev` puis, dans un autre terminal :
    powershell -ExecutionPolicy Bypass -File scripts\verify-live.ps1
  Sans argument, il teste DEFAULT_MODEL puis MODEL_FALLBACK.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\verify-live.ps1 `
    -Models 'groq:openai/gpt-oss-120b','groq:qwen/qwen3.8-27b'
#>
param(
  [string[]]$Models
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$base = 'http://localhost:3000'

# --- lecture de .env.local (meme parsing que scripts/check-free-tiers.py) ----
$vars = @{}
Get-Content (Join-Path $root '.env.local') | ForEach-Object {
  $line = $_.Trim()
  if ($line -and -not $line.StartsWith('#') -and $line.Contains('=')) {
    $p = $line.Split('=', 2)
    $vars[$p[0].Trim()] = $p[1].Trim().Trim('"').Trim("'")
  }
}

if (-not $Models -or $Models.Count -eq 0) {
  $Models = @($vars['DEFAULT_MODEL'], $vars['MODEL_FALLBACK']) |
    Where-Object { $_ } | Select-Object -Unique
}

# --- 1) cookie d'accès ------------------------------------------------------
$acc = $vars['ACCESS_CODE']
Invoke-RestMethod "$base/api/access-code/verify" -Method Post `
  -ContentType 'application/json' -Body (@{ code = $acc } | ConvertTo-Json -Compress) `
  -SessionVariable sess | Out-Null
Write-Host "cookie d'accès obtenu`n" -ForegroundColor Green

# --- 2) vérification de chaque modèle ---------------------------------------
foreach ($m in $Models) {
  $t = Get-Date
  try {
    $r = Invoke-RestMethod "$base/api/verify-model" -Method Post `
      -ContentType 'application/json' -Body (@{ model = $m } | ConvertTo-Json -Compress) `
      -WebSession $sess -TimeoutSec 120
    $s = [Math]::Round(((Get-Date) - $t).TotalSeconds, 2)
    $resp = if ($r.response) { $r.response } else { $r | ConvertTo-Json -Compress }
    Write-Host ("{0,-34} -> {1} en {2} s" -f $m, $resp, $s)
  } catch {
    $s = [Math]::Round(((Get-Date) - $t).TotalSeconds, 2)
    Write-Host ("{0,-34} -> ECHEC en {1} s : {2}" -f $m, $s, $_.Exception.Message) `
      -ForegroundColor Red
  }
}
