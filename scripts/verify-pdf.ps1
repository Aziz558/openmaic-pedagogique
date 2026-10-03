param([string]$Provider = 'mineru-cloud', [string]$Base = 'http://localhost:3000')
$ErrorActionPreference = 'Stop'
Set-Location 'C:\Users\LENOVO\openmaic'

# Lecture du code d'acces depuis .env.local (meme approche que verify-live.ps1)
$vars = @{}
Get-Content '.env.local' | ForEach-Object {
    $l = $_.Trim()
    if ($l -and -not $l.StartsWith('#')) {
        $i = $l.IndexOf('=')
        if ($i -gt 0) { $vars[$l.Substring(0, $i).Trim()] = $l.Substring($i + 1).Trim() }
    }
}

Invoke-RestMethod "$Base/api/access-code/verify" -Method Post `
    -ContentType 'application/json' -Body (@{ code = $vars['ACCESS_CODE'] } | ConvertTo-Json -Compress) `
    -SessionVariable sess | Out-Null
Write-Host "cookie d'acces obtenu" -ForegroundColor Green

Write-Host "`n=== Verification de l'extracteur '$Provider' via OpenMAIC ==="
try {
    $r = Invoke-RestMethod "$Base/api/verify-pdf-provider" -Method Post `
        -ContentType 'application/json' -Body (@{ providerId = $Provider } | ConvertTo-Json -Compress) `
        -WebSession $sess -TimeoutSec 120
    $r | ConvertTo-Json -Depth 6
} catch {
    'ECHEC : ' + $_.Exception.Message
    if ($_.Exception.Response) {
        $sr = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        'CORPS : ' + $sr.ReadToEnd()
    }
}
