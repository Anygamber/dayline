' Prayer Habits Schedule — скрытый запуск на порту 8001.
' Не использовать: 8000 (Optimusbot), 8010 (сайт), 8080 (другой локальный сервис).
'
' Использование: дважды кликните start_hidden.vbs

Option Explicit

Dim fso, shell, scriptDir, pythonw, cmd

Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")

scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
pythonw = scriptDir & "\.venv\Scripts\pythonw.exe"

If Not fso.FileExists(pythonw) Then
    MsgBox "Не найден pythonw в .venv:" & vbCrLf & pythonw & vbCrLf & vbCrLf & _
           "Сначала: python -m venv .venv && .venv\Scripts\pip install -r requirements.txt", _
           vbCritical, "Prayer Habits"
    WScript.Quit 1
End If

shell.CurrentDirectory = scriptDir

' Явно 8001 — не 8000 / 8010 / 8080.
cmd = """" & pythonw & """ -m uvicorn main:app --host 127.0.0.1 --port 8001 --reload --reload-dir ."
shell.Run cmd, 0, False
