$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.Text;
using System.Runtime.InteropServices;
public static class ArgusWindows {
  [StructLayout(LayoutKind.Sequential)] public struct LASTINPUTINFO { public uint cbSize; public uint dwTime; }
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
  [DllImport("user32.dll")] public static extern bool GetLastInputInfo(ref LASTINPUTINFO info);
  [DllImport("user32.dll", SetLastError=true)] public static extern IntPtr OpenInputDesktop(uint flags, bool inherit, uint access);
  [DllImport("user32.dll")] public static extern bool CloseDesktop(IntPtr desktop);
  public static object[] Sample() {
    var desktop=OpenInputDesktop(0,false,0x0100);
    if(desktop==IntPtr.Zero) return new object[]{"","",0,true,0};
    CloseDesktop(desktop);
    var handle=GetForegroundWindow(); uint pid; GetWindowThreadProcessId(handle,out pid);
    var title=new StringBuilder(1024); GetWindowText(handle,title,title.Capacity);
    string app=""; try { app=System.Diagnostics.Process.GetProcessById((int)pid).ProcessName; } catch {}
    var info=new LASTINPUTINFO(); info.cbSize=(uint)Marshal.SizeOf(info); GetLastInputInfo(ref info);
    uint idle=unchecked((uint)Environment.TickCount-info.dwTime)/1000;
    return new object[]{app,title.ToString(),idle,false,handle.ToInt64()};
  }
}
'@
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding
while ($true) {
  try {
    $sample = [ArgusWindows]::Sample()
    @{ app=$sample[0]; title=$sample[1]; idleSeconds=$sample[2]; locked=$sample[3]; handle=$sample[4] } | ConvertTo-Json -Compress | Write-Output
  } catch { Write-Output '{"error":"Activity sample unavailable"}' }
  Start-Sleep -Seconds 3
}
