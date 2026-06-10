@echo off
setlocal EnableExtensions

if "%~1"=="" (
  echo Usage: setup.bat ^<path-to-repo^>
  exit /b 1
)

rem Resolve paths
pushd "%~1" >nul 2>&1
if errorlevel 1 (
  echo Repo path not found: %~1
  exit /b 1
)
set "repo=%CD%"
popd >nul

pushd "%~dp0.." >nul 2>&1
set "pi_config_dir=%CD%"
popd >nul

set "pi_link=%repo%\.pi"

rem Create .pi symlink. If an existing .pi reparse point is present, replace it.
if exist "%pi_link%" (
  fsutil reparsepoint query "%pi_link%" >nul 2>&1
  if errorlevel 1 (
    echo Refusing to replace existing non-symlink path: %pi_link%
    exit /b 1
  ) else (
    rmdir "%pi_link%" >nul 2>&1
    if errorlevel 1 (
      echo Failed to remove existing link: %pi_link%
      exit /b 1
    )
  )
)

mklink /D "%pi_link%" "%pi_config_dir%" >nul 2>&1
if errorlevel 1 (
  rem Directory symlinks require Developer Mode or Administrator privileges.
  rem Fall back to a junction, which works for local directories without that privilege.
  mklink /J "%pi_link%" "%pi_config_dir%" >nul 2>&1
  if errorlevel 1 (
    echo Failed to create symlink or junction. Enable Windows Developer Mode or run this script as Administrator.
    exit /b 1
  )
  echo Created junction: %pi_link% -^> %pi_config_dir%
) else (
  echo Created symlink: %pi_link% -^> %pi_config_dir%
)

rem Update .gitignore
set "gitignore=%repo%\.gitignore"
type nul >> "%gitignore%"

findstr /x /l /c:"# pi-config" "%gitignore%" >nul 2>&1 || echo # pi-config>> "%gitignore%"
findstr /x /l /c:".pi" "%gitignore%" >nul 2>&1 || echo .pi>> "%gitignore%"
findstr /x /l /c:".pi-config/*" "%gitignore%" >nul 2>&1 || echo .pi-config/*>> "%gitignore%"

echo Updated %gitignore%
