@echo off
title BharatShield AI — Push to GitHub and Build APK
color 0A

echo ============================================================
echo   BharatShield AI Mobile App — Push to GitHub
echo   Repo: https://github.com/Kuldipgodase07/BharatSheild_AI_MobileApp
echo ============================================================
echo.

:: ─── Ensure local git user is configured ─────────────────────
git config user.name >nul 2>nul
if %errorlevel% neq 0 git config user.name "Kuldipgodase07"

git config user.email >nul 2>nul
if %errorlevel% neq 0 git config user.email "kuldipgodase07@gmail.com"

:: ─── Set Remote ──────────────────────────────────────────────
git remote remove origin >nul 2>nul
git remote add origin https://github.com/Kuldipgodase07/BharatSheild_AI_MobileApp.git
git branch -M main

:: ─── Stage and Commit any remaining changes ───────────────────
echo [1/3] Staging all files...
git add .

echo [2/3] Checking commits...
git diff --cached --quiet
if %errorlevel% neq 0 (
    git commit -m "feat: BharatShield AI Mobile App - Capacitor Android setup and APK build workflow"
    echo Commit created.
) else (
    echo Working tree is ready.
)
echo.

:: ─── Push to GitHub ───────────────────────────────────────────
echo [3/3] Pushing to GitHub...
echo.
echo NOTE: If a GitHub login window or prompt appears, log in
echo       using your GitHub account or Personal Access Token (PAT).
echo.

git push -u origin main
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
