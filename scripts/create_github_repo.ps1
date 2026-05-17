$ErrorActionPreference = 'Stop'

$keyPath = 'D:\CODE\JSZNINFP16DAWNMARKS\JSZNINFP16DAWNMARKS\KEYS.txt'
$content = Get-Content -Raw $keyPath
$token = $null

if ($content -match 'GITHUBPTOKEN[:=]\s*([A-Za-z0-9_]+)') {
  $token = $Matches[1]
}
elseif ($content.Trim().Length -gt 0) {
  $token = $content.Trim()
}

if (-not $token) {
  throw 'No GitHub token found'
}

$headers = @{
  Authorization = "Bearer $token"
  Accept = 'application/vnd.github+json'
  'X-GitHub-Api-Version' = '2022-11-28'
}

$body = @{
  name = 'BookRoute'
  description = 'Legal book discovery and acquisition route assistant'
  private = $false
} | ConvertTo-Json

try {
  $repo = Invoke-RestMethod -Uri 'https://api.github.com/user/repos' -Method Post -Headers $headers -Body $body -ContentType 'application/json'
  $repo.clone_url
}
catch {
  if ($_.Exception.Response.StatusCode.value__ -eq 422) {
    $user = Invoke-RestMethod -Uri 'https://api.github.com/user' -Headers $headers
    "https://github.com/$($user.login)/BookRoute.git"
  }
  else {
    throw
  }
}
