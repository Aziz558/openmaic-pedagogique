param([string]$Script = 'test-tpm-sweep.ts', [string]$Log = 'tpm-sweep.log')
Set-Location 'C:\Users\LENOVO\openmaic'

# tsx ne charge pas .env.local (c'est Next.js qui le fait d'habitude) :
# on injecte manuellement les variables non vides dans l'environnement du process.
Get-Content '.env.local' | ForEach-Object {
    $line = $_.Trim()
    if ($line -and -not $line.StartsWith('#')) {
        $i = $line.IndexOf('=')
        if ($i -gt 0) {
            $k = $line.Substring(0, $i).Trim()
            $v = $line.Substring($i + 1).Trim()
            Set-Item -Path ("Env:" + $k) -Value $v
        }
    }
}

& .\node_modules\.bin\tsx.cmd "scripts\$Script" 2>&1 | Tee-Object -FilePath $Log

Get-Content '.env.local' | ForEach-Object {
    $line = $_.Trim()
    if ($line -and -not $line.StartsWith('#')) {
        $i = $line.IndexOf('=')
        if ($i -gt 0) {
            $k = $line.Substring(0, $i).Trim()
            $v = $line.Substring($i + 1).Trim()
            Set-Item -Path ("Env:" + $k) -Value $v
        }
    }
}

& .\node_modules\.bin\tsx.cmd scripts\test-long-generation.ts 2>&1 |
    Tee-Object -FilePath long-gen.log
