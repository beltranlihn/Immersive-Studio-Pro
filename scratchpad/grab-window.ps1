# Capture ONLY the main window of a named process, at native resolution, to a PNG.
# Deliberately not a full-screen grab: only the apps the user asked to be measured should land in a file.
#
# CopyFromScreen copies whatever is PHYSICALLY on screen at that rectangle. If the window is not actually
# in front, you silently capture the app on top of it - which happened once here and produced a "measurement"
# of Blender labelled as our app. So: force foreground via AttachThreadInput, then VERIFY the foreground
# window is the one we asked for, and refuse to save if it isn't.
param([string]$Match, [string]$Out)

Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;using System.Text;using System.Runtime.InteropServices;
public class WG2 {
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

$script:found = $null
$cb = [WG2+EnumWindowsProc]{
  param($h, $p)
  $len = [WG2]::GetWindowTextLength($h); if ($len -le 0) { return $true }
  $sb = New-Object System.Text.StringBuilder ($len + 1); [void][WG2]::GetWindowText($h, $sb, $sb.Capacity)
  $pid2 = 0; [void][WG2]::GetWindowThreadProcessId($h, [ref]$pid2)
  $pr = (Get-Process -Id $pid2 -ErrorAction SilentlyContinue).ProcessName
  if ($pr -like "*$Match*") { if ($null -eq $script:found) { $script:found = @{ h = $h; title = $sb.ToString(); proc = $pr; tid = [WG2]::GetWindowThreadProcessId($h, [ref]$pid2) } } }
  return $true
}
[void][WG2]::EnumWindows($cb, [IntPtr]::Zero)
if ($null -eq $script:found) { Write-Output "NOTFOUND: no window for process like '$Match'"; exit 1 }
$f = $script:found

# force foreground: attach our input queue to the target's so SetForegroundWindow is permitted
$me = [WG2]::GetCurrentThreadId()
[void][WG2]::AttachThreadInput($me, $f.tid, $true)
[void][WG2]::ShowWindow($f.h, 9)          # SW_RESTORE
[void][WG2]::BringWindowToTop($f.h)
[void][WG2]::SetForegroundWindow($f.h)
[void][WG2]::AttachThreadInput($me, $f.tid, $false)
Start-Sleep -Milliseconds 1400            # let it repaint on top

$fg = [WG2]::GetForegroundWindow()
if ($fg -ne $f.h) {
  Write-Output "REFUSED: '$($f.title)' did not come to the front (foreground=$fg, wanted=$($f.h)). Not saving: the capture would be of whatever is on top."
  exit 2
}
$r = New-Object WG2+RECT; [void][WG2]::GetWindowRect($f.h, [ref]$r)
$w = $r.R - $r.L; $h = $r.B - $r.T
if ($w -lt 600 -or $h -lt 400) { Write-Output "REFUSED: window is ${w}x${h} (minimised or tiny)"; exit 3 }
$bmp = New-Object System.Drawing.Bitmap $w, $h
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($r.L, $r.T, 0, 0, (New-Object System.Drawing.Size($w, $h)))
$bmp.Save($Out, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
Write-Output "OK  proc=$($f.proc)  '$($f.title)'  ${w}x${h}  (foreground verified)  -> $Out"
