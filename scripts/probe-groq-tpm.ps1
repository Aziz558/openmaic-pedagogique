$ErrorActionPreference = 'Stop'
Set-Location 'C:\Users\LENOVO\openmaic'

$key = (Select-String -Path '.env.local' -Pattern '^GROQ_API_KEY=').Line.Split('=', 2)[1].Trim()

function Probe([string]$Model, [int]$MaxTok) {
    $body = @{
        model       = $Model
        messages    = @(@{ role = 'user'; content = 'Dis bonjour en une phrase.' })
        max_tokens  = $MaxTok
    } | ConvertTo-Json -Depth 5 -Compress

    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    try {
        $r = Invoke-WebRequest -Uri 'https://api.groq.com/openai/v1/chat/completions' `
            -Method Post -ContentType 'application/json' `
            -Headers @{ Authorization = "Bearer $key" } -Body $body -TimeoutSec 120
        $sw.Stop()
        $tpm = $r.Headers['x-ratelimit-remaining-tokens']
        "  max_tokens={0,-6} -> 200 OK en {1,5:N1} s | tokens/min restants : {2}" -f `
            $MaxTok, $sw.Elapsed.TotalSeconds, $tpm
    }
    catch {
        $sw.Stop()
        $resp = $_.Exception.Response
        $code = if ($resp) { [int]$resp.StatusCode } else { '?' }
        $detail = ''
        if ($resp) {
            try {
                $sr = New-Object System.IO.StreamReader($resp.GetResponseStream())
                $detail = $sr.ReadToEnd()
            } catch {}
        }
        "  max_tokens={0,-6} -> HTTP {1} en {2,5:N1} s" -f $MaxTok, $code, $sw.Elapsed.TotalSeconds
        if ($detail) { "      " + ($detail -replace '\s+', ' ').Substring(0, [Math]::Min(300, $detail.Length)) }
    }
}

"=== Ce que OpenMAIC demande reellement a Groq (max_tokens = fenetre de sortie) ==="
"La page des limites Groq annonce 8 000 tokens/minute sur le palier gratuit."
""
"openai/gpt-oss-120b"
Probe 'openai/gpt-oss-120b' 65536
Start-Sleep -Seconds 65
Probe 'openai/gpt-oss-120b' 32768
Start-Sleep -Seconds 65
Probe 'openai/gpt-oss-120b' 8192
