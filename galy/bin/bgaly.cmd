@echo off
rem bgaly — the kit's CLI, on PATH, for cmd.exe and PowerShell.
rem
rem PowerShell finds this through PATHEXT, so `bgaly search x` works there with no extra
rem file. Its companion `bgaly` (no extension) serves every POSIX shell; see the header of
rem that file for why the command is not called `bg`.
rem
rem `exit /b` carries node's status out, which is the whole point: a caller that tests the
rem exit code must be told the truth.
node "%~dp0bg.mjs" %*
exit /b %ERRORLEVEL%
