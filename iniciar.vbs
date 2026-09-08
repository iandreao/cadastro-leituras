Option Explicit

Dim fso, shell, projectDir, tentativas

Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")

projectDir = fso.GetParentFolderName(WScript.ScriptFullName)
shell.CurrentDirectory = projectDir

If Not ServidorPronto() Then
  ' 0 = janela oculta; False = nao espera (sobrevive ao fechar o Cursor)
  shell.Run "cmd /c npm run dev", 0, False
End If

tentativas = 0
Do While tentativas < 30
  If ServidorPronto() Then Exit Do
  WScript.Sleep 1000
  tentativas = tentativas + 1
Loop

shell.Run "http://localhost:3001", 1, False

Function ServidorPronto()
  On Error Resume Next
  Dim http
  Set http = CreateObject("MSXML2.ServerXMLHTTP.6.0")
  http.setTimeouts 800, 800, 800, 800
  http.Open "GET", "http://127.0.0.1:3001", False
  http.Send
  ServidorPronto = (Err.Number = 0)
  On Error GoTo 0
End Function
