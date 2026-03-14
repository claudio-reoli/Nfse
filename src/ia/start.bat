@echo off
setlocal EnableDelayedExpansion

:: Refresca PATH do sistema (Machine + User) para garantir que Python seja encontrado
for /f "tokens=*" %%P in ('powershell -NoProfile -Command "[System.Environment]::GetEnvironmentVariable(\"Path\",\"Machine\")"') do set SYS_PATH=%%P
for /f "tokens=*" %%P in ('powershell -NoProfile -Command "[System.Environment]::GetEnvironmentVariable(\"Path\",\"User\")"') do set USR_PATH=%%P
set PATH=%SYS_PATH%;%USR_PATH%;%PATH%

:: Força UTF-8 no processo Python
set PYTHONUTF8=1
set PYTHONIOENCODING=utf-8

:: Localiza Python (por nome ou caminho absoluto conhecido)
set PY=
where python  >nul 2>&1 && set PY=python
if "!PY!"=="" where py      >nul 2>&1 && set PY=py
if "!PY!"=="" where python3 >nul 2>&1 && set PY=python3

:: Fallback: caminhos absolutos comuns no Windows
if "!PY!"=="" if exist "%LOCALAPPDATA%\Programs\Python\Python313\python.exe" set "PY=%LOCALAPPDATA%\Programs\Python\Python313\python.exe"
if "!PY!"=="" if exist "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" set "PY=%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
if "!PY!"=="" if exist "%LOCALAPPDATA%\Programs\Python\Python311\python.exe" set "PY=%LOCALAPPDATA%\Programs\Python\Python311\python.exe"
if "!PY!"=="" if exist "%LOCALAPPDATA%\Programs\Python\Python310\python.exe" set "PY=%LOCALAPPDATA%\Programs\Python\Python310\python.exe"
if "!PY!"=="" if exist "C:\Python313\python.exe" set "PY=C:\Python313\python.exe"
if "!PY!"=="" if exist "C:\Python311\python.exe" set "PY=C:\Python311\python.exe"

if "!PY!"=="" (
    echo [ERRO] Python nao encontrado no PATH ou nos caminhos padrao.
    echo.
    echo  Instale Python 3.9+ em: https://www.python.org/downloads/
    echo  Marque a opcao "Add Python to PATH" durante a instalacao.
    echo.
    pause
    exit /b 1
)

echo [IA Fiscal] Python encontrado: !PY!
echo [IA Fiscal] Instalando/atualizando dependencias...
"!PY!" -m pip install -r "%~dp0requirements.txt" --quiet

echo [IA Fiscal] Iniciando servico na porta 8001...
"!PY!" "%~dp0main.py"
pause
