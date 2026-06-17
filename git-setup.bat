@echo off
cd /d "%~dp0"

set /p TOKEN=Paste your GitHub token and press Enter:

rmdir /s /q .git 2>nul

git init
git branch -M main
git config user.email "rwwelton1@gmail.com"
git config user.name "Ryan Welton"
git config credential.helper ""
git remote add origin "https://rwwelton1:%TOKEN%@github.com/rwwelton1/weltons.git"
git add -A
git commit -m "Full scroll redesign: layout, typography, spacing, section flow"
git push -u origin main --force

echo.
echo Done!
pause
