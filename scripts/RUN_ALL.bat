@echo off
set "BASEDIR=%~dp0"

echo ===========================================
echo   ESTATE LINK - INTEGRATED STARTER
echo ===========================================

:: 1. Start Backend in a new window
echo [1/2] Starting Backend...
start cmd /k "cd /d "%BASEDIR%backend" && if exist venv\Scripts\activate (call venv\Scripts\activate) else (python -m venv venv && call venv\Scripts\activate) && pip install -r requirements.txt && python manage.py makemigrations && python manage.py migrate && python manage.py runserver"

:: 2. Start Frontend in same window foreground
echo [2/2] Starting Frontend...
cd /d "%BASEDIR%frontend"
call npm install
:: This will take over the terminal tab
npm run dev
