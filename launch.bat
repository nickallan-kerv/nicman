@echo off
setlocal

cd /d "%~dp0"

where py >nul 2>nul
if %errorlevel%==0 goto start_with_py

where python >nul 2>nul
if %errorlevel%==0 goto start_with_python

echo Python was not found. Opening index.html directly...
start "" "%~dp0index.html"
goto :eof

:start_with_py
echo Starting local server on http://localhost:8080 using py...
start "Nicman Server" cmd /k "cd /d "%~dp0" && py -m http.server 8080"
timeout /t 1 >nul
start "" "http://localhost:8080"
goto :eof

:start_with_python
echo Starting local server on http://localhost:8080 using python...
start "Nicman Server" cmd /k "cd /d "%~dp0" && python -m http.server 8080"
timeout /t 1 >nul
start "" "http://localhost:8080"
