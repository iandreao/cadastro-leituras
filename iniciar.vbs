Option Explicit

Dim fso, shell, projectDir

Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")

projectDir = fso.GetParentFolderName(WScript.ScriptFullName)
shell.CurrentDirectory = projectDir

' 0 = janela oculta, False = nao espera o processo terminar
shell.Run "cmd /c npm run dev", 0, False

WScript.Sleep 2000
shell.Run "http://localhost:3001", 1, False
