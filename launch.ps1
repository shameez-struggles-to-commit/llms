# Requires: Windows PowerShell 5.1+
# Single-file launcher for llms.py

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# Resolve repo root
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Push-Location $ScriptDir

# Load .env if present
$envPath = Join-Path $ScriptDir ".env"
if (Test-Path $envPath) {
    Write-Host "Loading .env from $envPath"
    Get-Content $envPath | ForEach-Object {
        if ($_ -match '^[ \t]*#') { return }
        if ($_ -match '^[ \t]*$') { return }
        # Match key=value or key="value" and capture without quotes
        if ($_ -match '^(?<k>[A-Za-z_][A-Za-z0-9_]*)\s*=\s*(?:"(?<v>[^"]*)"|(?<v>[^#\r\n]*))') {
            $k = $Matches['k']
            $v = $Matches['v'].Trim()
            Set-Item -Path ("Env:" + $k) -Value $v
            Write-Host "  Set $k"
        }
    }
}

# Ensure HOME for llms default config path
if (-not $env:HOME) { $env:HOME = $env:USERPROFILE }

# Use python on PATH
$py = 'python'

# Install runtime deps and the package (editable)
Write-Host "Installing dependencies..."
& $py -m pip install --upgrade pip | Write-Output
& $py -m pip install -r requirements.txt | Write-Output
& $py -m pip install -e . | Write-Output

# Initialize default configs if missing
$llmsConfig = Join-Path $env:HOME ".llms\llms.json"
if (-not (Test-Path $llmsConfig)) {
    Write-Host "Initializing llms default config in $($env:HOME)\.llms"
    llms --init | Write-Output
}

# Launch server (use repo config so AI Refinery is enabled out-of-the-box)
$port = 8000
$configArg = "--config llms.json"
Write-Host "Starting llms server on http://localhost:$port using repo config ..."
Start-Process -FilePath "powershell.exe" -ArgumentList @('-NoLogo','-NoProfile','-Command',"llms $configArg --serve $port --verbose") -WindowStyle Minimized
Start-Sleep -Seconds 3

# Open browser
try { Start-Process "http://localhost:$port" } catch {}

Write-Host "llms is launching in the background on port $port."
Pop-Location
