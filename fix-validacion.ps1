$ErrorActionPreference = "Stop"
$tabRegistro = "src\components\TabRegistro.tsx"
if (-not (Test-Path $tabRegistro)) { Write-Host "❌ No se encontró $tabRegistro" -ForegroundColor Red; exit 1 }
$backup = "$tabRegistro.bak_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
Copy-Item $tabRegistro $backup
Write-Host "💾 Backup: $backup" -ForegroundColor Yellow
$c = Get-Content $tabRegistro -Raw

# Cambio 1: Label Email
$oldLabel = @"
                  ) : (
                    <span className="text-[10px] text-amber-800 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                      Obligatorio
                    </span>
                  )}
                </div>
                <div className="relative">
                  <input
                    type="email"
"@
$newLabel = @"
                  ) : (
                    <span className="text-[10px] text-stone-500 bg-stone-50 px-1.5 py-0.5 rounded border border-stone-200">
                      Opcional
                    </span>
                  )}
                </div>
                <div className="relative">
                  <input
                    type="email"
"@
if ($c.Contains($oldLabel)) {
    $c = $c.Replace($oldLabel, $newLabel)
    Write-Host "✓ Label Email: Obligatorio -> Opcional" -ForegroundColor Green
} else {
    Write-Host "⚠️  Label Email no encontrado o ya aplicado" -ForegroundColor DarkYellow
}

# Cambio 2: handleSave valida Hojas 1-4
$oldSaveCheck = @"
  const handleSave = async (e?: React.FormEvent): Promise<boolean> => {
    if (e) e.preventDefault();

    if (!fullValidation.isValid) {
"@
$newSaveCheck = @"
  const handleSave = async (e?: React.FormEvent): Promise<boolean> => {
    if (e) e.preventDefault();

    const todosLosFaltantes: MissingField[] = [];
    for (let paso = 1; paso <= 4; paso++) {
      const faltantes = validateStepComplete(paso as StepId);
      todosLosFaltantes.push(...faltantes);
    }
    if (todosLosFaltantes.length > 0) {
      setMissingFields(todosLosFaltantes);
      setShowMissingFieldsModal(true);
      setValidationActionAttempted('save');
      setValidationWarning('Asiento no autorizado: El expediente contiene ' + todosLosFaltantes.length + ' campos obligatorios faltantes en Hojas 1-4.');
      return false;
    }

    if (!fullValidation.isValid) {
"@
if ($c.Contains($oldSaveCheck)) {
    $c = $c.Replace($oldSaveCheck, $newSaveCheck)
    Write-Host "✓ handleSave: validacion completa Hojas 1-4" -ForegroundColor Green
} else {
    Write-Host "⚠️  handleSave no encontrado o ya aplicado" -ForegroundColor DarkYellow
}

# Cambio 3: isCotejoApproved false
$oldCotejo = "const [isCotejoApproved, setIsCotejoApproved] = useState<boolean>(true);"
$newCotejo = "const [isCotejoApproved, setIsCotejoApproved] = useState<boolean>(false);"
if ($c.Contains($oldCotejo)) {
    $c = $c.Replace($oldCotejo, $newCotejo)
    Write-Host "✓ isCotejoApproved: true -> false" -ForegroundColor Green
} else {
    Write-Host "⚠️  isCotejoApproved no encontrado o ya aplicado" -ForegroundColor DarkYellow
}

# Cambio 4: Hoja 4 validacion completa
$oldHoja4 = @"
    } else if (step === 4) {
      if (!isCotejoApproved && !isMonogramLinked) {
        faltantes.push({ field: 'cotejo', label: 'Cotejo Notarial Aprobado o Monograma Vinculado' });
      }
    }
"@
$newHoja4 = @"
    } else if (step === 4) {
      if (!isCotejoApproved) {
        faltantes.push({ field: 'cotejo', label: 'Cotejo Notarial Aprobado' });
      }
      if (!isMonogramLinked) {
        faltantes.push({ field: 'monograma', label: 'Fierro Quemador Disenado y Vinculado' });
      }
      if (!cotejoDocs.ine) {
        faltantes.push({ field: 'cotejo_ine', label: 'Cotejo de INE verificado' });
      }
      if (!cotejoDocs.predio) {
        faltantes.push({ field: 'cotejo_predio', label: 'Cotejo de Titulo/Certificado verificado' });
      }
      if (!cotejoDocs.upp) {
        faltantes.push({ field: 'cotejo_upp', label: 'Cotejo de Clave UPP verificado' });
      }
    }
"@
if ($c.Contains($oldHoja4)) {
    $c = $c.Replace($oldHoja4, $newHoja4)
    Write-Host "✓ Hoja 4: validacion completa" -ForegroundColor Green
} else {
    Write-Host "⚠️  Hoja 4 no encontrado o ya aplicado" -ForegroundColor DarkYellow
}

# Cambio 5: Hoja 2 validacion completa
$oldHoja2 = @"
      const catV = validateCattleCount(Number(producerData.cattleCount) || 0);
      if (!catV.isValid) faltantes.push({ field: 'cattleCount', label: 'Cantidad de Ganado (minimo 1 cabeza)' });
    } else if (step === 3) {
"@
$newHoja2 = @"
      const catV = validateCattleCount(Number(producerData.cattleCount) || 0);
      if (!catV.isValid) faltantes.push({ field: 'cattleCount', label: 'Cantidad de Ganado (minimo 1 cabeza)' });
      if (!producerData.tenureType) faltantes.push({ field: 'tenureType', label: 'Tipo de Tenencia (Ejidal o Propiedad)' });
      if (!producerData.species) faltantes.push({ field: 'species', label: 'Especie Animal' });
      if (!producerData.zootechnicalPurpose) faltantes.push({ field: 'zootechnicalPurpose', label: 'Fin Zootecnico' });
      if (!producerData.associatedRancher) faltantes.push({ field: 'associatedRancher', label: 'Ganadero Asociado (SI/NO)' });
    } else if (step === 3) {
"@
if ($c.Contains($oldHoja2)) {
    $c = $c.Replace($oldHoja2, $newHoja2)
    Write-Host "✓ Hoja 2: validacion completa" -ForegroundColor Green
} else {
    Write-Host "⚠️  Hoja 2 no encontrado o ya aplicado" -ForegroundColor DarkYellow
}

Set-Content $tabRegistro -Value $c -NoNewline
Write-Host "✅ FASE 1 aplicada." -ForegroundColor Cyan