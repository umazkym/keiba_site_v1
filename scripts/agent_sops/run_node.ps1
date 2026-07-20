param(
  [Parameter(Mandatory = $true, Position = 0)]
  [string]$ScriptPath,

  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$ScriptArgs
)

$ErrorActionPreference = "Stop"
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$resolvedScript = Resolve-Path (Join-Path $repoRoot $ScriptPath)

$candidates = @()
$homeNode = Join-Path $HOME ".cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if (Test-Path -LiteralPath $homeNode) {
  $candidates += $homeNode
}

$programFilesNode = Join-Path $env:ProgramFiles "nodejs\node.exe"
if (Test-Path -LiteralPath $programFilesNode) {
  $candidates += $programFilesNode
}

$pathNode = Get-Command node -ErrorAction SilentlyContinue
if ($pathNode) {
  $candidates += $pathNode.Source
}

$candidates = $candidates | Select-Object -Unique
if (-not $candidates -or $candidates.Count -eq 0) {
  Write-Error "Node.js executable was not found."
  exit 1
}

$lastExitCode = 1
$lastOutput = @()
foreach ($nodePath in $candidates) {
  $output = & $nodePath $resolvedScript @ScriptArgs 2>&1
  $lastExitCode = $LASTEXITCODE
  if ($lastExitCode -eq 0) {
    $output | ForEach-Object { Write-Output $_ }
    exit 0
  }
  $lastOutput = $output
}

$lastOutput | ForEach-Object { Write-Error $_ }
exit $lastExitCode
