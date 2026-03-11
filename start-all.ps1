Write-Host "Iniciando Servidor Backend (Sefin e ADN)..."
Start-Process "node" -ArgumentList "src/backend-municipio.js" -NoNewWindow
Start-Sleep -Seconds 2

Write-Host "Iniciando Servidor Frontend..."
.\serve.ps1
