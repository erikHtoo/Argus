param([long]$WindowHandle = 0, [string]$ExclusionsBase64 = '')
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
[Windows.Storage.Streams.InMemoryRandomAccessStream, Windows.Storage.Streams, ContentType=WindowsRuntime] | Out-Null
[Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics.Imaging, ContentType=WindowsRuntime] | Out-Null
[Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType=WindowsRuntime] | Out-Null
$script:asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.IsGenericMethod })[0]
function Await-WinRT($Operation, $ResultType) {
  $task = $script:asTask.MakeGenericMethod($ResultType).Invoke($null, @($Operation))
  $task.Wait()
  return $task.Result
}
if ($WindowHandle -ne 0) {
  Add-Type -AssemblyName System.Drawing
  Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class ArgusFrame {
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left,Top,Right,Bottom; }
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd,out RECT rect);
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr hWnd,IntPtr hdc,uint flags);
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll",CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr handle,StringBuilder text,int length);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr handle,out uint processId);
}
'@
  [ArgusFrame]::SetProcessDPIAware() | Out-Null
  $handle = [IntPtr]$WindowHandle
  if ([ArgusFrame]::GetForegroundWindow() -ne $handle) { throw 'Foreground window changed before capture.' }
  if ($ExclusionsBase64) {
    $exclusions = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($ExclusionsBase64)) | ConvertFrom-Json
    $title = New-Object Text.StringBuilder(1024)
    [ArgusFrame]::GetWindowText($handle,$title,1024) | Out-Null
    [uint32]$appProcessId = 0
    [ArgusFrame]::GetWindowThreadProcessId($handle,[ref]$appProcessId) | Out-Null
    $appName = (Get-Process -Id $appProcessId -ErrorAction Stop).ProcessName
    $context = ($appName + ' ' + $title.ToString()).ToLowerInvariant()
    foreach ($excluded in $exclusions) { if ($excluded -and $context.Contains($excluded.ToLowerInvariant())) { throw 'Foreground window is excluded.' } }
  }
  $rect = New-Object ArgusFrame+RECT
  if (-not [ArgusFrame]::GetWindowRect($handle, [ref]$rect)) { throw 'Window is unavailable.' }
  $width = $rect.Right - $rect.Left
  $height = $rect.Bottom - $rect.Top
  if ($width -le 0 -or $height -le 0 -or $width -gt 8000 -or $height -gt 8000) { throw 'Window dimensions unsupported.' }
  $frame = New-Object System.Drawing.Bitmap($width,$height)
  try {
    $graphics = [System.Drawing.Graphics]::FromImage($frame)
    try { $dc = $graphics.GetHdc(); try { $ok = [ArgusFrame]::PrintWindow($handle,$dc,2) } finally { $graphics.ReleaseHdc($dc) } } finally { $graphics.Dispose() }
    if (-not $ok) { throw 'Window does not support capture.' }
    $scale = [Math]::Min(1, 1600 / [double][Math]::Max($width,$height))
    $small = New-Object System.Drawing.Bitmap($frame, [int]($width*$scale), [int]($height*$scale))
    try {
      $buffer = New-Object System.IO.MemoryStream
      try { $small.Save($buffer,[System.Drawing.Imaging.ImageFormat]::Png); $bytes=$buffer.ToArray() } finally { $buffer.Dispose() }
    } finally { $small.Dispose() }
  } finally { $frame.Dispose() }
} else { $bytes = [Convert]::FromBase64String([Console]::In.ReadToEnd()) }
$stream = New-Object Windows.Storage.Streams.InMemoryRandomAccessStream
$writer = New-Object Windows.Storage.Streams.DataWriter($stream)
$writer.WriteBytes($bytes)
Await-WinRT ($writer.StoreAsync()) ([UInt32]) | Out-Null
$writer.DetachStream() | Out-Null
$writer.Dispose()
$stream.Seek(0)
try {
  $decoder = Await-WinRT ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
  $bitmap = Await-WinRT ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
  try {
    $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
    if ($null -eq $engine) { throw 'Install a Windows OCR language pack to enable screen text.' }
    $result = Await-WinRT ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])
    [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding
    @{text=$result.Text} | ConvertTo-Json -Compress | Write-Output
  } finally { $bitmap.Dispose() }
} finally { $stream.Dispose() }
