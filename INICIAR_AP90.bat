@echo off
chcp 65001 >nul
title AP90 - Inicializador de Comparacao
echo =======================================================
echo          AP90 - INICIALIZADOR DE COMPARACAO
echo =======================================================
echo.
echo Iniciando servidores locais persistentes...
echo.
echo [1/2] Iniciando Versao Nova (Design Cinematografico) na porta 5173...
start "AP90 - Novo Design (Porta 5173)" cmd /k "npx vite --port 5173 --host"

echo [2/2] Iniciando Versao Anterior (Design Original) na porta 5174...
start "AP90 - Versao Anterior (Porta 5174)" cmd /k "cd versao-anterior && npx vite --port 5174 --host"

echo.
echo Aguardando 3 segundos para os servidores subirem...
timeout /t 3 /nobreak >nul

echo Abrindo abas no navegador...
start http://localhost:5173/
start http://localhost:5174/

echo.
echo =======================================================
echo Concluido!
echo.
echo Versao Nova:     http://localhost:5173/
echo Versao Anterior: http://localhost:5174/
echo.
echo Dica: As janelas do terminal ficarao abertas.
echo Para encerrar, basta fechar as janelas do terminal.
echo =======================================================
pause
