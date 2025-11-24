@echo off
echo ========================================
echo   INICIANDO MEDICHAT - WhatsApp Bot
echo ========================================
echo.

cd /d "%~dp0"

echo Verificando dependencias...
if not exist "node_modules" (
    echo Instalando dependencias...
    call npm install
    echo.
)

echo Verificando archivo .env...
if not exist ".env" (
    echo ADVERTENCIA: Archivo .env no encontrado
    echo El servidor puede no funcionar correctamente sin configuracion
    echo.
)

echo Iniciando servidor medichat...
echo Puerto: 3001
echo.
echo IMPORTANTE:
echo - Si es la primera vez, escanea el codigo QR que aparecera
echo - El QR tambien se guardara en: qr\qr.png
echo - Espera a ver: "WhatsApp conectado exitosamente"
echo.

node src/app.js

pause

