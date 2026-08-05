# [R253] Despliegue CON VERIFICACION. Nace de un fallo real: la copia a Program Files se lanza con
# `Start-Process -Verb RunAs -Wait`, cuyo exito NO dice nada sobre si la copia ocurrio. Durante dias esa
# instalacion se quedo con un asar viejo mientras el despliegue se daba por bueno. Sin comprobacion, un
# despliegue no esta hecho: esta supuesto.
#
# Copia la carpeta `resources` ENTERA (regla [R242]: los addons nativos viven en app.asar.unpacked y copiar
# solo el asar los deja desincronizados), limpia el anidamiento `app.asar.unpacked\app.asar.unpacked` que
# dejaron copiados manuales antiguos, y al final COMPARA el sha1 de los tres app.asar contra el recien
# compilado. Si alguno no coincide, sale con codigo 1 y lo dice.
#
# Uso:  powershell -NoProfile -ExecutionPolicy Bypass -File scripts\deploy-verificado.ps1
# La tercera instalacion (Program Files) necesita elevacion: se pide sola.

$ErrorActionPreference = 'Stop'
$raiz = Split-Path -Parent $PSScriptRoot
$src  = Join-Path $raiz 'dist\win-unpacked\resources'
if (-not (Test-Path (Join-Path $src 'app.asar'))) { Write-Error "No hay build en $src -- corre antes 'npm run dist'"; exit 1 }

$destinos = @(
  @{ n='canonica'; p='C:\Users\beltr\AppData\Local\Programs\Immersive Studio Pro'; elev=$false },
  @{ n='legacy1';  p='C:\Users\beltr\AppData\Local\Programs\dome studio pro';      elev=$false },
  @{ n='legacy2';  p='C:\Program Files\Dome Studio Pro';                            elev=$true  }
)

$refe = (Get-FileHash (Join-Path $src 'app.asar') -Algorithm SHA1).Hash
Write-Host "build:  $refe"

foreach ($d in $destinos) {
  if (-not (Test-Path $d.p)) { Write-Host ("  {0,-9} NO INSTALADA, se salta" -f $d.n); continue }
  $dst = Join-Path $d.p 'resources'
  if ($d.elev) {
    # el bloque va a un fichero temporal: pasar comillas anidadas por -ArgumentList es de donde salio el fallo
    $tmp = Join-Path $env:TEMP ('isp-deploy-' + [guid]::NewGuid().ToString('N') + '.ps1')
    @"
`$ErrorActionPreference='Stop'
Remove-Item -Recurse -Force '$dst\app.asar.unpacked\app.asar.unpacked' -ErrorAction SilentlyContinue
Copy-Item -Recurse -Force '$src\*' '$dst\'
"@ | Set-Content -Path $tmp -Encoding utf8
    Start-Process powershell -Verb RunAs -Wait -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File',$tmp
    Remove-Item $tmp -ErrorAction SilentlyContinue
  } else {
    Remove-Item -Recurse -Force (Join-Path $dst 'app.asar.unpacked\app.asar.unpacked') -ErrorAction SilentlyContinue
    Copy-Item -Recurse -Force (Join-Path $src '*') "$dst\"
  }
}

# --- la parte que faltaba: COMPROBAR ---
$fallos = 0
foreach ($d in $destinos) {
  if (-not (Test-Path $d.p)) { continue }
  $a = Join-Path $d.p 'resources\app.asar'
  if (-not (Test-Path $a)) { Write-Host ("  {0,-9} SIN app.asar" -f $d.n); $fallos++; continue }
  $h = (Get-FileHash $a -Algorithm SHA1).Hash
  $unp = Join-Path $d.p 'resources\app.asar.unpacked'
  $anid = Test-Path (Join-Path $unp 'app.asar.unpacked')
  $ok = ($h -eq $refe) -and (-not $anid)
  if (-not $ok) { $fallos++ }
  Write-Host ("  {0,-9} {1}  {2}{3}" -f $d.n, $h, $(if ($h -eq $refe) { 'OK' } else { '*** DISTINTO ***' }), $(if ($anid) { ' *** anidado ***' } else { '' }))
}
if ($fallos -gt 0) { Write-Error "$fallos instalacion(es) NO quedaron al dia"; exit 1 }
Write-Host 'Las tres instalaciones al dia.'
