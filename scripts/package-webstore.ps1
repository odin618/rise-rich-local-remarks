$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = Split-Path -Parent $scriptDir
$dist = Join-Path $root 'dist'
$stage = Join-Path $dist 'webstore'
$manifestPath = Join-Path $root 'manifest.json'
$manifest = Get-Content -Raw -LiteralPath $manifestPath | ConvertFrom-Json
$zipPath = Join-Path $dist ("rise-rich-local-remarks-{0}.zip" -f $manifest.version)

$resolvedRoot = (Resolve-Path -LiteralPath $root).Path
New-Item -ItemType Directory -Force -Path $dist | Out-Null

if (Test-Path -LiteralPath $stage) {
  $resolvedStage = (Resolve-Path -LiteralPath $stage).Path
  if (-not $resolvedStage.StartsWith($resolvedRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to remove staging directory outside project root: $resolvedStage"
  }
  Remove-Item -LiteralPath $stage -Recurse -Force
}

New-Item -ItemType Directory -Force -Path $stage | Out-Null
Copy-Item -LiteralPath $manifestPath -Destination $stage
New-Item -ItemType Directory -Force -Path (Join-Path $stage 'src') | Out-Null
foreach ($dir in @('background', 'content', 'core', 'options', 'popup')) {
  Copy-Item -LiteralPath (Join-Path $root "src\$dir") -Destination (Join-Path $stage 'src') -Recurse
}
New-Item -ItemType Directory -Force -Path (Join-Path $stage 'src\assets\icons') | Out-Null
Copy-Item -Path (Join-Path $root 'src\assets\icons\*.png') -Destination (Join-Path $stage 'src\assets\icons')

if (Test-Path -LiteralPath $zipPath) {
  Remove-Item -LiteralPath $zipPath -Force
}

[Reflection.Assembly]::LoadWithPartialName('System.IO.Compression') | Out-Null
[Reflection.Assembly]::LoadWithPartialName('System.IO.Compression.FileSystem') | Out-Null
$archive = [System.IO.Compression.ZipFile]::Open($zipPath, [System.IO.Compression.ZipArchiveMode]::Create)
try {
  foreach ($file in Get-ChildItem -LiteralPath $stage -Recurse -File) {
    $relative = $file.FullName.Substring($stage.Length + 1).Replace('\', '/')
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
      $archive,
      $file.FullName,
      $relative,
      [System.IO.Compression.CompressionLevel]::Optimal
    ) | Out-Null
  }
} finally {
  $archive.Dispose()
}
Write-Host $zipPath
