$ErrorActionPreference = "Stop"
$OutputFile = "info_proyecto_para_ia.txt"
if (Test-Path $OutputFile) { Remove-Item $OutputFile }

$excluir = @('node_modules', '\.git', 'dist', 'build', '\.next', 'coverage', '\.vercel', '\.cache')

function Write-Seccion {
    param([string]$Titulo)
    Add-Content -Path $OutputFile -Value ""
    Add-Content -Path $OutputFile -Value ("=" * 70)
    Add-Content -Path $OutputFile -Value $Titulo
    Add-Content -Path $OutputFile -Value ("=" * 70)
}

# 1. ESTRUCTURA
Write-Seccion "1. ESTRUCTURA DE ARCHIVOS"
Get-ChildItem -Recurse -File | Where-Object {
    $ruta = $_.FullName
    -not ($excluir | Where-Object { $ruta -match $_ })
} | ForEach-Object {
    $rel = $_.FullName.Replace((Get-Location).Path + "\", "")
    Add-Content -Path $OutputFile -Value $rel
}

# 2. PACKAGE.JSON
Write-Seccion "2. CONTENIDO DE package.json"
if (Test-Path "package.json") {
    Get-Content "package.json" | Add-Content -Path $OutputFile
}

# 3. FUNCIONES
Write-Seccion "3. FUNCIONES, CLASES Y EXPORTS"
$extensiones = @('*.ts', '*.tsx', '*.js', '*.jsx', '*.mjs', '*.cjs')
$archivosCodigo = Get-ChildItem -Recurse -Include $extensiones -File | Where-Object {
    $ruta = $_.FullName
    -not ($excluir | Where-Object { $ruta -match $_ })
}

$patrones = @(
    '^\s*(export\s+)?(async\s+)?function\s+\w+',
    '^\s*(export\s+)?const\s+\w+\s*=\s*(async\s+)?\(',
    '^\s*(export\s+)?const\s+\w+\s*=\s*(async\s+)?function',
    '^\s*(export\s+)?class\s+\w+',
    '^\s*(export\s+)?interface\s+\w+',
    '^\s*(export\s+)?type\s+\w+\s*=',
    '^\s*export\s+default\s+'
)

foreach ($archivo in $archivosCodigo) {
    $rel = $archivo.FullName.Replace((Get-Location).Path + "\", "")
    $lineas = Get-Content $archivo.FullName
    $encontrados = @()
    for ($i = 0; $i -lt $lineas.Count; $i++) {
        foreach ($patron in $patrones) {
            if ($lineas[$i] -match $patron) {
                $encontrados += ("  L{0,4}: {1}" -f ($i + 1), $lineas[$i].Trim())
                break
            }
        }
    }
    if ($encontrados.Count -gt 0) {
        Add-Content -Path $OutputFile -Value ""
        Add-Content -Path $OutputFile -Value "--- $rel ---"
        $encontrados | ForEach-Object { Add-Content -Path $OutputFile -Value $_ }
    }
}

# 4. ENDPOINTS
Write-Seccion "4. ENDPOINTS Y LLAMADAS API"
$patronesApi = @(
    'app\.(get|post|put|delete|patch)\s*\(',
    'router\.(get|post|put|delete|patch)\s*\(',
    'fetch\s*\(',
    'axios\.(get|post|put|delete|patch)\s*\(',
    '@app\.(get|post|put|delete|patch)',
    'export\s+(async\s+)?function\s+(GET|POST|PUT|DELETE|PATCH)'
)
foreach ($archivo in $archivosCodigo) {
    $rel = $archivo.FullName.Replace((Get-Location).Path + "\", "")
    $lineas = Get-Content $archivo.FullName
    $encontrados = @()
    for ($i = 0; $i -lt $lineas.Count; $i++) {
        foreach ($patron in $patronesApi) {
            if ($lineas[$i] -match $patron) {
                $encontrados += ("  L{0,4}: {1}" -f ($i + 1), $lineas[$i].Trim())
                break
            }
        }
    }
    if ($encontrados.Count -gt 0) {
        Add-Content -Path $OutputFile -Value ""
        Add-Content -Path $OutputFile -Value "--- $rel ---"
        $encontrados | ForEach-Object { Add-Content -Path $OutputFile -Value $_ }
    }
}

# 5. POWERSHELL SCRIPTS
Write-Seccion "5. FUNCIONES EN SCRIPTS POWERSHELL"
Get-ChildItem -Recurse -Include '*.ps1' -File | Where-Object {
    $ruta = $_.FullName
    -not ($excluir | Where-Object { $ruta -match $_ })
} | ForEach-Object {
    $rel = $_.FullName.Replace((Get-Location).Path + "\", "")
    $lineas = Get-Content $_.FullName
    $funciones = @()
    for ($i = 0; $i -lt $lineas.Count; $i++) {
        if ($lineas[$i] -match '^\s*function\s+\w+') {
            $funciones += ("  L{0,4}: {1}" -f ($i + 1), $lineas[$i].Trim())
        }
    }
    if ($funciones.Count -gt 0) {
        Add-Content -Path $OutputFile -Value ""
        Add-Content -Path $OutputFile -Value "--- $rel ---"
        $funciones | ForEach-Object { Add-Content -Path $OutputFile -Value $_ }
    }
}

Write-Host ""
Write-Host "===================================================" -ForegroundColor Green
Write-Host " Listo. Archivo generado: $OutputFile" -ForegroundColor Green
Write-Host "===================================================" -ForegroundColor Green
Write-Host ("Tamano: {0:N0} KB" -f ((Get-Item $OutputFile).Length / 1KB))
Write-Host ""
