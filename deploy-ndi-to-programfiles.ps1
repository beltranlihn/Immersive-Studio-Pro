# Copies the current build (with NDI) to the Program Files install (the one the desktop shortcut opens).
# Run it and approve the single UAC prompt. Closes any running instance first.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$srcAsar   = Join-Path $root 'dist\win-unpacked\resources\app.asar'
$srcUnpack = Join-Path $root 'dist\win-unpacked\resources\app.asar.unpacked'
$instB = 'C:\Program Files\Dome Studio Pro\resources'
try { Get-Process 'Dome Studio Pro' -ErrorAction Stop | Stop-Process -Force } catch {}
Start-Sleep -Milliseconds 700
$cmd = "Copy-Item -LiteralPath '$srcAsar' -Destination '$instB\app.asar' -Force; robocopy '$srcUnpack' '$instB\app.asar.unpacked' /MIR /NJH /NJS /NDL /NFL; exit 0"
Start-Process powershell -ArgumentList "-NoProfile -Command `"$cmd`"" -Verb RunAs -Wait
if (Test-Path "$instB\app.asar") {
  $ok = Test-Path "$instB\app.asar.unpacked\node_modules\dsp-ndi-send\build\Release\dsp_ndi.node"
  Write-Host ("Install B updated: {0} bytes, NDI addon present: {1}" -f (Get-Item "$instB\app.asar").Length, $ok)
}
