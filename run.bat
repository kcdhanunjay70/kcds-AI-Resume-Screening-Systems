@echo off
setlocal
cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
  echo Project environment is missing. Running setup first...
  call setup.bat
  if errorlevel 1 exit /b 1
)

".venv\Scripts\python.exe" -c "import flask, pymongo, pypdf, docx" >nul 2>nul
if errorlevel 1 (
  echo Dependencies changed. Updating environment...
  ".venv\Scripts\python.exe" -m pip install -r requirements.txt
  if errorlevel 1 exit /b 1
)

echo Starting TalentLens AI at http://127.0.0.1:5000
".venv\Scripts\python.exe" app.py
