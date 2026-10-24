#!/usr/bin/env pwsh
# =============================================================================
# SCRIPT DE DESPLIEGUE A GITHUB - CUESTAGE
# =============================================================================
# Este script automatiza todo el proceso de subir CueStage a GitHub.
# Requiere: Git instalado y una cuenta de GitHub.
#
# USO:
%   1. Crea un repositorio vacío en GitHub (https://github.com/new)
%   2. Ejecuta este script: .\deploy-github.ps1
# =============================================================================

# --- CONFIGURACIÓN ---
$repoName = "cuestage"
$repoDescription = "CueStage - Control de música y efectos de sonido para presentaciones en vivo"
$repoHomepage = "https://cuestage.github.io"

# Colores para output
function Write-Header {
    Write-Host "`n========================================" -ForegroundColor Cyan
    Write-Host "  CUESTAGE - DESPLIEGUE A GITHUB" -ForegroundColor Cyan
    Write-Host "========================================`n" -ForegroundColor Cyan
}

function Write-Success($msg) {
    Write-Host "✅ $msg" -ForegroundColor Green
}

function Write-Error($msg) {
    Write-Host "❌ $msg" -ForegroundColor Red
}

function Write-Info($msg) {
    Write-Host "ℹ️  $msg" -ForegroundColor Yellow
}

# --- PASO 1: Verificar git ---
Write-Host "`n[1/5] Verificando Git..." -ForegroundColor Cyan
try {
    & git --version | Select-Object -First 1
    Write-Success "Git está instalado"
} catch {
    Write-Error "Git no está instalado. Instálalo desde https://git-scm.com/"
    exit 1
}

# --- PASO 2: Verificar que estamos en el directorio correcto ---
Write-Host "`n[2/5] Verificando directorio del proyecto..." -ForegroundColor Cyan
if (-not (Test-Path ".git")) {
    Write-Error "No se encontró el repositorio Git. Ejecuta este script desde la carpeta de CueStage."
    exit 1
}
Write-Safe "Directorio del proyecto encontrado"

# --- PASO 3: Agregar cambios ---
Write-Host "`n[3/5] Agregando cambios..." -ForegroundColor Cyan
git add -A
Write-Success "Archivos agregados al área de staging"

# --- PASO 4: Commit ---
Write-Host "`n[4/5] Creando commit..." -ForegroundColor Cyan
$commitMessage = "feat: versión lista para producción - $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
git commit -m "$commitMessage"
if ($LASTEXITCODE -ne 0) {
    Write-Info "No hay cambios nuevos para commitear (puede que ya esté todo commitado)"
} else {
    Write-Success "Commit creado: $commitMessage"
}

# --- PASO 5: Configurar remote y subir ---
Write-Host "`n[5/5] Configurando repositorio remoto..." -ForegroundColor Cyan
$remoteUrl = Read-Host "Ingresa la URL de tu repositorio GitHub (ej: https://github.com/tuusuario/cuestage.git)"

if (-not $remoteUrl) {
    Write-Error "No se proporcionó URL del repositorio"
    exit 1
}

# Agregar remote si no existe
try {
    git remote add origin $remoteUrl 2>$null
} catch {
    # Ya existe, actualizarlo
    git remote set-url origin $remoteUrl
}

# Subir cambios
git push -u origin main 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Success "¡Proyecto subido a GitHub exitosamente!"
    Write-Host "`n🎉 ¡LISTO! Tu proyecto está en GitHub." -ForegroundColor Green
    Write-Host "   Repositorio: $remoteUrl" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Ahora configura GitHub Pages:" -ForegroundColor Cyan
    Write-Host "  1. Ve a tu repositorio en GitHub"
    Write-Host "  2. Ve a Settings → Pages"
    3.  "    Selecciona la rama 'main' y carpeta '/root'"
    Write-Host "  4. Haz clic en Save"
    Write-Host ""
    Write-Host "Tu sitio web estará disponible en: https://tuusuario.github.io/cuestage/"
} else {
    Write-Error "Error al subir a GitHub. Verifica que el repositorio exista y tengas permisos."
    exit 1
}
