$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

# Genere une image de "fiche de cours" francaise : accents, chiffres, tableau.
# C'est exactement le cas que unpdf ne sait pas lire (aucun OCR) et qui exige
# que le pack de langue couvre le francais.
$w = 1100; $h = 900
$bmp = New-Object System.Drawing.Bitmap($w, $h)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.Clear([System.Drawing.Color]::White)
$g.SmoothingMode = 'AntiAlias'
$g.TextRenderingHint = 'AntiAliasGridFit'

$title = New-Object System.Drawing.Font('Arial', 26, [System.Drawing.FontStyle]::Bold)
$body  = New-Object System.Drawing.Font('Arial', 17)
$mono  = New-Object System.Drawing.Font('Consolas', 16)
$black = [System.Drawing.Brushes]::Black

$g.DrawString('Comptabilité — La TVA expliquée', $title, $black, 50, 40)
$g.DrawString('Chapitre 3 : régimes, déclarations, écritures', $body, $black, 50, 90)

$lines = @(
    "Une entreprise assujettie collecte la TVA pour le compte de l'État.",
    "Le taux normal est de 20 %. Les taux réduits sont 10 %, 5,5 % et 2,1 %.",
    "Écriture : débit du compte 44566 « TVA déductible », crédit du 401.",
    "Attention : l'exercice comptable débute le 1er janvier et s'achève au 31 décembre.",
    "Mentions obligatoires : numéro SIRET, date, montant hors taxes, TVA, TTC."
)
$y = 150
foreach ($l in $lines) { $g.DrawString($l, $body, $black, 50, $y); $y += 40 }

$y += 30
$g.DrawString('Tableau de contrôle', $title, $black, 50, $y)
$y += 55

$rows = @(
    @('Opération', 'Base HT', 'Taux', 'TVA', 'TTC'),
    @('Vente de marchandises', '1 500,00 €', '20 %', '300,00 €', '1 800,00 €'),
    @('Prestation de service', '800,00 €', '10 %', '80,00 €', '880,00 €'),
    @('Achat fournisseur', '2 000,00 €', '20 %', '400,00 €', '2 400,00 €')
)
foreach ($r in $rows) {
    $x = 50
    foreach ($c in $r) { $g.DrawString($c, $mono, $black, $x, $y); $x += 205 }
    $y += 34
}

$out = 'C:\Users\LENOVO\openmaic\tmp-fr-test.png'
$bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
"image ecrite : $out (" + (Get-Item $out).Length + " octets)"

