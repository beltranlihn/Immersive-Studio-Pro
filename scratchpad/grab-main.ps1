# Bring the LARGEST window of a process to the front and capture it at native resolution.
# Two lessons baked in:
#  1. CopyFromScreen grabs whatever is physically on screen -> always VERIFY the target is foreground first.
#     (Skipping this produced a capture of Blender labelled as our app.)
#  2. Apps have many windows; the first match may be a child panel (Premiere owns an 'AsusDial' window).
#     Pick the biggest one.
# SetForegroundWindow is only permitted from a thread attached to the current foreground thread.
param([string]$Match, [string]$Out)

Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;using System.Text;using System.Runtime.InteropServices;
public class GM {
 [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc cb, IntPtr p);
 public delegate bool EnumWindowsProc(IntPtr h, IntPtr p);
 [DllImport("user32.dll")] public static extern int GetWindowTextLength(IntPtr h);
 [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
 [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
 [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
 [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
 [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int c);
 [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
 [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")] public static extern bool BringWindowToTop(IntPtr h);
 [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint a, uint b, bool attach);
 [DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();
 public struct RECT { public int L, T, R, B; }
}
"@ -ErrorAction SilentlyContinue

$script:best = $null
$cb = [GM+EnumWindowsProc]{
  param($hh, $p)
  if (-not [GM]::IsWindowVisible($hh)) { return $true }
  $len = [GM]::GetWindowTextLength($hh); if ($len -le 0) { return $true }
  $sb = New-Object System.Text.StringBuilder ($len + 1); [void][GM]::GetWindowText($hh, $sb, $sb.Capacity)
  $pd = 0; [void][GM]::GetWindowThreadProcessId($hh, [ref]$pd)
  $pr = (Get-Process -Id $pd -ErrorAction SilentlyContinue).ProcessName
  if ($pr -notlike "*$Match*") { return $true }
  $r = New-Object GM+RECT; [void][GM]::GetWindowRect($hh, [ref]$r)
  $area = ($r.R - $r.L) * ($r.B - $r.T)
  if (($null -eq $script:best) -or ($area -gt $script:best.area)) {
    $script:best = @{ h = $hh; area = $area; title = $sb.ToString(); proc = $pr }
  }
  return $true
}
[void][GM]::EnumWindows($cb, [IntPtr]::Zero)
if ($null -eq $script:best) { Write-Output "NOTFOUND: '$Match'"; exit 1 }
$b = $script:best

# attach to the CURRENT FOREGROUND thread (not the target's) - that is what unlocks SetForegroundWindow
$fgw = [GM]::GetForegroundWindow(); $fgpid = 0
$fgTid = [GM]::GetWindowThreadProcessId($fgw, [ref]$fgpid)
$me = [GM]::GetCurrentThreadId()
[void][GM]::AttachThreadInput($me, $fgTid, $true)
[void][GM]::ShowWindow($b.h, 9)
[void][GM]::BringWindowToTop($b.h)
[void][GM]::SetForegroundWindow($b.h)
[void][GM]::AttachThreadInput($me, $fgTid, $false)
Start-Sleep -Milliseconds 1600

if ([GM]::GetForegroundWindow() -ne $b.h) { Write-Output "REFUSED: '$($b.title)' would not come to the front. Not saving."; exit 2 }
$r = New-Object GM+RECT; [void][GM]::GetWindowRect($b.h, [ref]$r)
$w = $r.R - $r.L; $ht = $r.B - $r.T
if ($w -lt 800 -or $ht -lt 500) { Write-Output "REFUSED: ${w}x${ht} too small"; exit 3 }
$bmp = New-Object System.Drawing.Bitmap $w, $ht
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($r.L, $r.T, 0, 0, (New-Object System.Drawing.Size($w, $ht)))
$bmp.Save($Out, [System.Drawing.Imaging.ImageFormat]::Png); $g.Dispose(); $bmp.Dispose()
Write-Output "OK  $($b.proc)  '$($b.title)'  ${w}x${ht}  -> $Out"
