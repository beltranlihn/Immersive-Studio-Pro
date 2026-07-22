# Copy the freshly built app.asar to the three installs. Run elevated: the Program Files one needs it.
$src = "C:\Users\beltr\Desktop\Alma Digital Studio\Projects\Immersive Studio Pro\dist\win-unpacked\resources\app.asar"
if (-not (Test-Path $src)) { Write-Output "FAIL: no build at $src"; exit 1 }
$targets = @(
  "C:\Users\beltr\AppData\Local\Programs\Immersive Studio Pro\resources\app.asar",
  "C:\Users\beltr\AppData\Local\Programs\dome studio pro\resources\app.asar",
  "C:\Program Files\Dome Studio Pro\resources\app.asar"
)
Get-Process -Name "Immersive Studio Pro","Dome Studio Pro","electron" -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2
foreach ($t in $targets) {
  if (-not (Test-Path (Split-Path $t))) { Write-Output "SKIP (not installed): $t"; continue }
  try { Copy-Item $src $t -Force -ErrorAction Stop
        $s = (Get-Item $t).Length
        Write-Output "OK   $t  ($([math]::Round($s/1MB,2)) MB)" }
  catch { Write-Output "FAIL $t : $($_.Exception.Message)" }
}
Write-Output "source: $([math]::Round((Get-Item $src).Length/1MB,2)) MB  $((Get-Item $src).LastWriteTime)"
