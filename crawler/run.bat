@echo off
REM Start the crawler (daily scheduler mode)
cd /d "%~dp0\.."
python -m crawler.main --schedule
pause
