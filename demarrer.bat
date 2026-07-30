@echo off
title Cahier des charges - Serveur
cd /d "%~dp0"
echo Demarrage du serveur...
echo.
echo Une fois demarre, ouvrez votre navigateur sur : http://localhost:3000
echo Pour arreter le serveur, fermez simplement cette fenetre.
echo.
npm start
pause
