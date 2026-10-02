@echo off
title BharatShield AI — Push to GitHub
color 0A

echo ============================================================
echo   BharatShield AI Mobile App — GitHub Push Script
echo   Repo: https://github.com/Kuldipgodase07/BharatSheild_AI_MobileApp
echo ============================================================
echo.

:: ─── Security check: warn if .env was accidentally staged ─────
git diff --cached --name-only 2>nul | findstr /i "\.env" >nul
if %errorlevel% equ 0 (
    echo [!] WARNING: A .env file is staged for commit.
    echo     This may contain secrets. Unstaging it now...
    git reset HEAD "*.env" >nul 2>nul
    git reset HEAD "**/.env" >nul 2>nul
)

:: ─── Ensure local git user is configured ─────────────────────
git config user.name >nul 2>nul
if %errorlevel% neq 0 git config user.name "Kuldipgodase07"
git config user.email >nul 2>nul
if %errorlevel% neq 0 git config user.email "kuldipgodase07@gmail.com"

:: ─── Set Remote ───────────────────────────────────────────────
git remote remove origin >nul 2>nul
git remote add origin https://github.com/Kuldipgodase07/BharatSheild_AI_MobileApp.git
git branch -M main

:: ─── Stage and Commit any changes ─────────────────────────────
echo [1/3] Staging all files...
git add .

echo [2/3] Checking for changes to commit...
git diff --cached --quiet
if %errorlevel% neq 0 (
    git commit -m "feat: BharatShield AI update"
    echo Commit created.
) else (
    echo No new changes to commit. Pushing existing commits...
)
echo.

:: ─── Push to GitHub ───────────────────────────────────────────
echo [3/3] Pushing to GitHub...
echo.
echo NOTE: If a login prompt appears, use your Personal Access Token (PAT).
echo       Get one at: https://github.com/settings/tokens
echo.

:: First try normal push; if rejected (due to rewritten history), use force-with-lease
git push -u origin main
if %errorlevel% neq 0 (
    echo.
    echo Remote history differs (this is expected after secret removal).
    echo Pushing with --force-with-lease to update remote history...
    git push --force-with-lease -u origin main
)
if %errorlevel% neq 0 (
    echo.
    echo Remote has existing commits. Merging with rebase...
    git pull origin main --rebase --allow-unrelated-histories
    git push -u origin main
)

echo.
echo ============================================================
if %errorlevel% equ 0 (
    echo   PUSH COMPLETE! Your repository has received the code.
    echo.
    echo   GitHub Actions will now build your Android APK file.
    echo   Monitor the build at:
    echo   https://github.com/Kuldipgodase07/BharatSheild_AI_MobileApp/actions
) else (
    echo   Push encountered an error. Check credentials or connection above.
)
echo ============================================================
echo.
echo Press any key to close this window...
pause >nul
