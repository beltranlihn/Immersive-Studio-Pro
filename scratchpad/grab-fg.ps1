# Capture the FOREGROUND window, but only if it belongs to the process we expect, at native resolution.
# Rationale: CopyFromScreen grabs whatever is physically on screen at a rectangle. Picking a window by name
# and hoping it is on top silently produced a capture of Blender labelled as our app. So the only window we
# trust is the one Windows says is in front, and we verify its owner before saving.
param([string]$Expect, [string]$Out)

Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;using System.Text;using System.Runtime.InteropServices;
public class FG {
 [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")] public static extern int GetWindowTextLength(IntPtr h);
 [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
 [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
 [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
 public struct RECT { public int L, T, R, B; }
}
"@ -ErrorAction SilentlyContinue

$h = [FG]::GetForegroundWindow()
$pid2 = 0; [void][FG]::GetWindowThreadProcessId($h, [ref]$pid2)
$pr = (Get-Process -Id $pid2 -ErrorAction SilentlyContinue).ProcessName
$len = [FG]::GetWindowTextLength($h); $sb = New-Object System.Text.StringBuilder ($len + 1)
[void][FG]::GetWindowText($h, $sb, $sb.Capacity)
$title = $sb.ToString()

if ($pr -notlike "*$Expect*") {
  Write-Output "REFUSED: foreground app is '$pr' ('$title'), expected something like '$Expect'. Not saving."
  exit 2
}
$r = New-Object FG+RECT; [void][FG]::GetWindowRect($h, [ref]$r)
$w = $r.R - $r.L; $ht = $r.B - $r.T
if ($w -lt 800 -or $ht -lt 500) { Write-Output "REFUSED: foreground window '$title' is ${w}x${ht} - not the main window"; exit 3 }
$bmp = New-Object System.Drawing.Bitmap $w, $ht
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($r.L, $r.T, 0, 0, (New-Object System.Drawing.Size($w, $ht)))
$bmp.Save($Out, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
Write-Output "OK  $pr  '$title'  ${w}x${ht}  -> $Out"
