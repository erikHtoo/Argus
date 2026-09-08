$ErrorActionPreference = 'Stop'
$argusRoot = Split-Path -Parent $PSScriptRoot
$powerShellExe = Join-Path $env:SystemRoot 'System32/WindowsPowerShell/v1.0/powershell.exe'
function Start-ArgusHelper([string]$Helper) {
  $info = New-Object System.Diagnostics.ProcessStartInfo
  $info.FileName = $powerShellExe
  $helperPath = Join-Path $argusRoot "native/$Helper"
  $info.Arguments = '-NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' + $helperPath + '"'
  $info.UseShellExecute = $false
  $info.CreateNoWindow = $true
  $info.RedirectStandardInput = $true
  $info.RedirectStandardOutput = $true
  $info.RedirectStandardError = $true
  return [System.Diagnostics.Process]::Start($info)
}
# Read one foreground sample into memory; never print or persist window contents.
$activity = Start-ArgusHelper 'activity.ps1'
try {
  $lineTask = $activity.StandardOutput.ReadLineAsync()
  if (-not $lineTask.Wait(15000)) { throw 'Activity collector did not respond in time.' }
  $sample = $lineTask.Result | ConvertFrom-Json
  if ($null -eq $sample.idleSeconds -or $null -eq $sample.locked) { throw 'Invalid activity sample.' }
  Write-Output 'PASS: native foreground and inactivity sample received (content not logged).'
} finally { if (-not $activity.HasExited) { $activity.Kill() }; $activity.Dispose() }
# Render synthetic text to memory, then exercise the real Windows OCR adapter.
Add-Type -AssemblyName System.Drawing
$bitmap = New-Object System.Drawing.Bitmap(900,180)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$font = New-Object System.Drawing.Font('Arial',32)
$buffer = New-Object System.IO.MemoryStream
try {
  $graphics.Clear([System.Drawing.Color]::White)
  $graphics.DrawString('ARGUS TEST Review chapter four', $font, [System.Drawing.Brushes]::Black, 20, 55)
  $bitmap.Save($buffer, [System.Drawing.Imaging.ImageFormat]::Png)
  $ocr = Start-ArgusHelper 'ocr.ps1'
  try {
    $ocr.StandardInput.Write([Convert]::ToBase64String($buffer.ToArray()))
    $ocr.StandardInput.Close()
    $resultTask = $ocr.StandardOutput.ReadToEndAsync()
    $errorTask = $ocr.StandardError.ReadToEndAsync()
    if (-not $ocr.WaitForExit(30000)) { $ocr.Kill(); throw 'OCR timed out.' }
    if ($ocr.ExitCode -ne 0) { throw $errorTask.Result }
    $result = $resultTask.Result | ConvertFrom-Json
    if ($result.text -notmatch 'Review chapter four') { throw ('OCR text did not match synthetic fixture: ' + $result.text) }
    Write-Output 'PASS: native Windows OCR recognized the synthetic test sentence.'
  } finally { if (-not $ocr.HasExited) { $ocr.Kill() }; $ocr.Dispose() }
} finally { $buffer.Dispose(); $font.Dispose(); $graphics.Dispose(); $bitmap.Dispose() }
