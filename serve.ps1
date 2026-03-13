# Simple PowerShell HTTP Server for NFS-e Freire
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:8080/")
$listener.Start()
Write-Host "NFS-e Freire Server running at http://localhost:8080/"
Write-Host "Press Ctrl+C to stop."

$mimeTypes = @{
  ".html" = "text/html; charset=utf-8"
  ".css"  = "text/css; charset=utf-8"
  ".js"   = "application/javascript; charset=utf-8"
  ".json" = "application/json; charset=utf-8"
  ".svg"  = "image/svg+xml"
  ".png"  = "image/png"
  ".jpg"  = "image/jpeg"
  ".ico"  = "image/x-icon"
  ".woff2" = "font/woff2"
  ".woff" = "font/woff"
  ".ttf"  = "font/ttf"
  ".xsd"  = "application/xml"
  ".xml"  = "application/xml"
  ".xlsx" = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  ".pdf"  = "application/pdf"
}

$basePath = $PSScriptRoot

while ($listener.IsListening) {
  $context = $listener.GetContext()
  $request = $context.Request
  $response = $context.Response

  $urlPath = $request.Url.LocalPath
  if ($urlPath -eq "/") { $urlPath = "/index.html" }

  $filePath = Join-Path $basePath ($urlPath -replace "/", "\")

  if (Test-Path $filePath -PathType Leaf) {
    $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
    $contentType = if ($mimeTypes.ContainsKey($ext)) { $mimeTypes[$ext] } else { "application/octet-stream" }

    $response.ContentType = $contentType
    $response.StatusCode = 200
    $response.Headers.Add("Access-Control-Allow-Origin", "*")
    $response.Headers.Add("Cache-Control", "no-cache")
    $bytes = [System.IO.File]::ReadAllBytes($filePath)
    $response.OutputStream.Write($bytes, 0, $bytes.Length)
    Write-Host "$($request.HttpMethod) $urlPath -> 200 ($contentType)"
  } else {
    $response.StatusCode = 404
    $msg = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found: $urlPath")
    $response.OutputStream.Write($msg, 0, $msg.Length)
    Write-Host "$($request.HttpMethod) $urlPath -> 404"
  }

  $response.OutputStream.Close()
}
