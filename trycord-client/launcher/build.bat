@echo off
REM Build TrycordClient.exe with the inbox .NET Framework C# compiler.
REM No SDK, NuGet, or downloads required. Produces a single self-contained
REM exe (framework-dependent on .NET Framework 4.x, preinstalled on Windows).
setlocal
set CSC=%WINDIR%\Microsoft.NET\Framework64\v4.0.30319\csc.exe
if not exist "%CSC%" (
  echo ERROR: csc not found at %CSC%
  exit /b 1
)
cd /d "%~dp0.."
if not exist dist mkdir dist
"%CSC%" /nologo /target:exe /optimize ^
  /resource:index.html,TrycordClient.index.html ^
  /resource:app.js,TrycordClient.app.js ^
  /resource:style.css,TrycordClient.style.css ^
  /out:dist\TrycordClient.exe launcher\launcher.cs
if errorlevel 1 exit /b 1
echo Built dist\TrycordClient.exe
certutil -hashfile dist\TrycordClient.exe SHA256
