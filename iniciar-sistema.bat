@echo off
chcp 65001 >nul
title NFSe Freire — Inicialização do Sistema

echo.
echo ============================================================
echo   SISTEMA NFSe FREIRE — Inicializacao Completa
echo ============================================================
echo.

:: ──────────────────────────────────────────────────────────────
:: PASSO 1 — Inicia Docker Desktop (se ainda nao estiver rodando)
:: ──────────────────────────────────────────────────────────────
echo [1/4] Verificando Docker Desktop...

docker info >nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
  echo       Docker nao esta rodando. Iniciando Docker Desktop...
  start "" "%ProgramFiles%\Docker\Docker\Docker Desktop.exe"
  echo       Aguardando Docker inicializar (ate 90 segundos)...
  :WAIT_DOCKER
    timeout /t 10 /nobreak >nul
    docker info >nul 2>&1
    IF %ERRORLEVEL% EQU 0 goto DOCKER_OK
    set /a DOCKER_TRIES+=1
    IF %DOCKER_TRIES% LSS 9 goto WAIT_DOCKER
    echo.
    echo [ERRO] Docker nao respondeu apos 90 segundos.
    echo        Abra o Docker Desktop manualmente e execute este script novamente.
    pause
    exit /b 1
) ELSE (
  echo       Docker Desktop ja esta ativo. OK.
)
:DOCKER_OK

echo.

:: ──────────────────────────────────────────────────────────────
:: PASSO 2 — Sobe o container PostgreSQL (docker-compose)
:: ──────────────────────────────────────────────────────────────
echo [2/4] Iniciando banco de dados PostgreSQL (porta 5433)...

cd /d "%~dp0"
docker-compose up -d >nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
  echo [ERRO] Falha ao subir o container PostgreSQL.
  echo        Verifique o arquivo docker-compose.yml e tente novamente.
  pause
  exit /b 1
)

echo       Aguardando PostgreSQL aceitar conexoes...
timeout /t 6 /nobreak >nul

:: Confirma que o container está running
docker-compose ps | findstr "Up" >nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
  echo [AVISO] Container pode estar iniciando ainda. Continuando...
  timeout /t 5 /nobreak >nul
)
echo       PostgreSQL OK.
echo.

:: ──────────────────────────────────────────────────────────────
:: PASSO 3 — Encerra instancia anterior do backend (se houver)
:: ──────────────────────────────────────────────────────────────
echo [3/4] Verificando instancia anterior do backend...

for /f "tokens=1" %%P in ('netstat -ano ^| findstr ":3099 " ^| findstr "LISTENING"') do (
  for /f "tokens=5" %%Q in ('netstat -ano ^| findstr ":3099 " ^| findstr "LISTENING"') do (
    echo       Encerrando processo anterior na porta 3099 (PID %%Q)...
    taskkill /PID %%Q /F >nul 2>&1
  )
)
timeout /t 2 /nobreak >nul
echo       Porta 3099 liberada.
echo.

:: ──────────────────────────────────────────────────────────────
:: PASSO 4 — Inicia o backend Node.js (inclui servico de IA)
:: ──────────────────────────────────────────────────────────────
echo [4/4] Iniciando backend Node.js na porta 3099...
echo       (O servico de Inteligencia Fiscal sera iniciado automaticamente)
echo.

:: Atualiza PATH com variáveis do sistema (Machine + User)
for /f "tokens=*" %%P in ('powershell -NoProfile -Command "[System.Environment]::GetEnvironmentVariable(\"Path\",\"Machine\")"') do set SYS_PATH=%%P
for /f "tokens=*" %%P in ('powershell -NoProfile -Command "[System.Environment]::GetEnvironmentVariable(\"Path\",\"User\")"') do set USR_PATH=%%P
set PATH=%SYS_PATH%;%USR_PATH%

:: Abre o servidor em nova janela que permanece aberta
start "NFSe Backend - porta 3099" /D "%~dp0" cmd /k "node src/backend-municipio.js"

:: Aguarda o servidor subir
echo       Aguardando servidor inicializar...
timeout /t 10 /nobreak >nul

:: Verifica se a porta 3099 está respondendo
netstat -ano | findstr ":3099 " | findstr "LISTENING" >nul 2>&1
IF %ERRORLEVEL% EQU 0 (
  echo.
  echo ============================================================
  echo   SISTEMA INICIADO COM SUCESSO!
  echo ============================================================
  echo.
  echo   Backend    : http://localhost:3099
  echo   Municipio  : http://localhost:3099/dashboard-municipio.html
  echo   Contribuinte: http://localhost:3099/
  echo   IA Service : http://localhost:8001
  echo   Banco      : localhost:5433 (nfse / nfse_dev)
  echo.
  echo   Para acessar, abra um navegador e acesse os links acima.
  echo.
  start "" "http://localhost:3099/dashboard-municipio.html"
) ELSE (
  echo.
  echo [AVISO] Servidor pode ainda estar inicializando.
  echo         Verifique a janela "NFSe Backend" para detalhes.
  echo         Acesse: http://localhost:3099/dashboard-municipio.html
  echo.
)

pause
