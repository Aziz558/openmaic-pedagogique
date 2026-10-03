$ErrorActionPreference = 'Stop'

# Validation du jeton MinerU Cloud : creation d'une tache sur le PDF de demonstration
# officiel, puis attente du resultat. Si la tache aboutit, le jeton est bon et la
# chaine complete (creation -> upload -> analyse -> markdown) fonctionne.

$token = $env:MINERU_TOKEN
if (-not $token) { $token = (Select-String -Path 'C:\Users\LENOVO\openmaic\.env.local' -Pattern '^PDF_MINERU_CLOUD_API_KEY=').Line.Split('=', 2)[1].Trim() }
if (-not $token) { throw 'Jeton MinerU introuvable.' }

$base = 'https://mineru.net/api/v4'
$h = @{ Authorization = "Bearer $token"; 'Content-Type' = 'application/json'; Accept = '*/*' }

'=== 1. Creation de la tache ==='
$body = @{
    url           = 'https://cdn-mineru.openxlab.org.cn/demo/example.pdf'
    model_version = 'vlm'
    language      = 'latin'
    is_ocr        = $true
    enable_table  = $true
    enable_formula = $true
} | ConvertTo-Json -Compress

try {
    $r = Invoke-RestMethod -Uri "$base/extract/task" -Method Post -Headers $h -Body $body -TimeoutSec 60
    $r | ConvertTo-Json -Depth 5 -Compress
} catch {
    'ECHEC HTTP : ' + $_.Exception.Message
    if ($_.Exception.Response) {
        $sr = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        'CORPS : ' + $sr.ReadToEnd()
    }
    exit 1
}

if ($r.code -ne 0) { 'Code non nul : ' + $r.msg; exit 1 }
$taskId = $r.data.task_id
"task_id = $taskId"

''
'=== 2. Attente du resultat ==='
$deadline = (Get-Date).AddMinutes(4)
$started = Get-Date
$state = 'pending'
while ((Get-Date) -lt $deadline) {
    Start-Sleep -Seconds 4
    $p = Invoke-RestMethod -Uri "$base/extract/task/$taskId" -Headers $h -Method Get -TimeoutSec 60
    $state = $p.data.state
    "[{0,3:N0} s] {1}" -f ((Get-Date) - $started).TotalSeconds, $state
    if ($state -eq 'done' -or $state -eq 'failed') { break }
}

if ($state -eq 'failed') {
    'ECHEC analyse : ' + ($p.data | ConvertTo-Json -Depth 5 -Compress)
    exit 1
}
if ($state -ne 'done') { 'Delai depasse, etat : ' + $state; exit 1 }

''
'=== 3. Qualite du markdown produit ==='
$mdUrl = $p.data.full_zip_url
"zip = $mdUrl"
"pages = " + $p.data.extract_progress.extracted_pages + ' / ' + $p.data.extract_progress.total_pages

$md = Invoke-RestMethod -Uri $p.data.markdown_url -TimeoutSec 120
''
'--- 800 premiers caracteres du markdown ---'
$md.Substring(0, [Math]::Min(800, $md.Length))
