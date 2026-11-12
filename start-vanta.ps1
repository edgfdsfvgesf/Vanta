$ErrorActionPreference = 'Stop'
$secureKey = Read-Host 'Enter a NEW Groq API key (input is hidden); press Enter to run without AI' -AsSecureString
$credential = [System.Net.NetworkCredential]::new('', $secureKey)
$env:GROQ_API_KEY = $credential.Password
try {
    node (Join-Path $PSScriptRoot 'server.mjs')
} finally {
    Remove-Item Env:GROQ_API_KEY -ErrorAction SilentlyContinue
    $credential = $null
    $secureKey = $null
}
