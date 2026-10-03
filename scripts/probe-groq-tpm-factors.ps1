$ErrorActionPreference = 'Stop'
Set-Location 'C:\Users\LENOVO\openmaic'

$key = (Select-String -Path '.env.local' -Pattern '^GROQ_API_KEY=').Line.Split('=', 2)[1].Trim()

# L'erreur observee dit : "Limit 8000, Requested 9642" sur gpt-oss-20b, alors que
# la route envoie max_tokens = 65536. Donc "Requested" ne compte PAS max_tokens :
# il compte la TAILLE DU PROMPT. Ce script isole les deux facteurs.

$unit = "Une entreprise assujettie collecte la TVA pour le compte de l'Etat. "
# ~4 caracteres par jeton en francais, donc 3500 repetitions ~ 49000 caracteres ~ 12000 jetons.
$bigPrompt = ($unit * 1200)
$smallPrompt = 'Dis bonjour.'

function Send([string]$Model, [string]$Prompt, [int]$MaxTok, [string]$Label) {
    $body = @{
        model      = $Model
        messages   = @(@{ role = 'user'; content = $Prompt })
        max_tokens = $MaxTok
    } | ConvertTo-Json -Depth 5 -Compress

    $approxTokens = [int]($Prompt.Length / 4)
    try {
        $r = Invoke-WebRequest -Uri 'https://api.groq.com/openai/v1/chat/completions' `
            -Method Post -ContentType 'application/json' `
            -Headers @{ Authorization = "Bearer $key" } -Body $body -TimeoutSec 120
        "  {0,-46} -> 200 OK   (prompt ~{1} jetons, max_tokens={2})" -f $Label, $approxTokens, $MaxTok
    }
    catch {
        $resp = $_.Exception.Response
        $code = if ($resp) { [int]$resp.StatusCode } else { '?' }
        $detail = ''
        if ($resp) {
            try {
                $sr = New-Object System.IO.StreamReader($resp.GetResponseStream())
                $detail = ($sr.ReadToEnd() -replace '\s+', ' ')
            } catch {}
        }
        "  {0,-46} -> HTTP {1} (prompt ~{2} jetons, max_tokens={3})" -f $Label, $code, $approxTokens, $MaxTok
        if ($detail -match 'Request too large|Rate limit reached') {
            $m = [regex]::Match($detail, '(Request too large for model[^\\]{0,180})')
            if ($m.Success) { '      ' + $m.Groups[1].Value }
        } elseif ($detail) { '      ' + $detail.Substring(0, [Math]::Min(220, $detail.Length)) }
    }
    Start-Sleep -Seconds 62   # fenetre glissante d'une minute
}

'=== Facteur A : taille du PROMPT (max_tokens minuscule, 16) ==='
'Si ca echoue ici, c est le prompt qui est trop gros, pas la fenetre de sortie.'
Send 'openai/gpt-oss-20b' $smallPrompt 16 'gpt-oss-20b : petit prompt'
Send 'openai/gpt-oss-20b' $bigPrompt   16 'gpt-oss-20b : gros prompt'
Send 'openai/gpt-oss-120b' $bigPrompt  16 'gpt-oss-120b : gros prompt'

''
'=== Facteur B : max_tokens eleve, prompt minuscule ==='
Send 'openai/gpt-oss-20b' $smallPrompt 8192 'gpt-oss-20b : max_tokens=8192'
Send 'openai/gpt-oss-20b' $smallPrompt 65536 'gpt-oss-20b : max_tokens=65536'
