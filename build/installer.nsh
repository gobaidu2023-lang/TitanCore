; build/installer.nsh
; TitanCore 官方原生标准向导 (保留 D:\ 预填 + 快捷方式彻底清理 + 0延迟瞬时卸载)

!pragma warning disable 6020
!pragma warning disable 7999
!include MUI2.nsh
!ifndef nsProcess::KillProcess
    !include "nsProcess.nsh"
!endif

ManifestDPIAware true

Var tcDirAutoCorrected

; 选择默认安全安装目录：优先 D:\TitanCore（仅识别本地固定硬盘，避免空盘漏判或光驱/内存盘误判），其次其余非 C 固定盘，最后才回落 C:\TitanCore（绝不默认 C:\Program Files）
!macro TC_PICK_DEFAULT_DIR OUT_VAR
    Push $R0
    Push $R1
    Push $R2
    StrCpy ${OUT_VAR} ""

    System::Call 'kernel32::GetDriveTypeW(w "D:\")i.R0'
    ${If} $R0 == 3
        StrCpy ${OUT_VAR} "D:\TitanCore"
    ${EndIf}

    ${If} ${OUT_VAR} == ""
        StrCpy $R1 "EFGHIJKLMNOPQRSTUVWXYZ"
        StrCpy $R2 0
        ${Do}
            StrCpy $R0 $R1 1 $R2
            ${If} $R0 == ""
                ${ExitDo}
            ${EndIf}
            System::Call 'kernel32::GetDriveTypeW(w "$R0:\")i.R0'
            ${If} $R0 == 3
                StrCpy $R0 $R1 1 $R2
                StrCpy ${OUT_VAR} "$R0:\TitanCore"
                ${ExitDo}
            ${EndIf}
            IntOp $R2 $R2 + 1
        ${Loop}
    ${EndIf}

    ${If} ${OUT_VAR} == ""
        StrCpy ${OUT_VAR} "C:\TitanCore"
    ${EndIf}

    Pop $R2
    Pop $R1
    Pop $R0
!macroend

; 判断路径是否落入禁止目录（Program Files / Program Files (x86) / AppData\Local\Programs）；IN_VAR/OUT_VAR 不可传入 $R5/$R6
!macro TC_IS_FORBIDDEN_DIR IN_VAR OUT_VAR
    Push $R5
    Push $R6
    StrCpy ${OUT_VAR} "0"
    ${If} "${IN_VAR}" == ""
        StrCpy ${OUT_VAR} "1"
    ${Else}
        StrCpy $R5 0
        ${Do}
            StrCpy $R6 "${IN_VAR}" 13 $R5
            ${If} $R6 == ""
                ${ExitDo}
            ${EndIf}
            ${If} $R6 == "Program Files"
                StrCpy ${OUT_VAR} "1"
                ${ExitDo}
            ${EndIf}
            IntOp $R5 $R5 + 1
        ${Loop}

        ${If} ${OUT_VAR} == "0"
            StrCpy $R5 0
            ${Do}
                StrCpy $R6 "${IN_VAR}" 22 $R5
                ${If} $R6 == ""
                    ${ExitDo}
                ${EndIf}
                ${If} $R6 == "AppData\Local\Programs"
                    StrCpy ${OUT_VAR} "1"
                    ${ExitDo}
                ${EndIf}
                IntOp $R5 $R5 + 1
            ${Loop}
        ${EndIf}
    ${EndIf}
    Pop $R6
    Pop $R5
!macroend

!macro TC_FIND_AND_KILL_ONE PROC_NAME STILL_ALIVE_VAR
    ${nsProcess::FindProcess} "${PROC_NAME}" $R9
    ${If} $R9 == 0
        ${nsProcess::KillProcess} "${PROC_NAME}" $R9
        ${nsProcess::FindProcess} "${PROC_NAME}" $R9
        ${If} $R9 == 0
            StrCpy ${STILL_ALIVE_VAR} "1"
        ${EndIf}
    ${EndIf}
!macroend

; 静默结束 TitanCore 主程序及配套伴生/运行时子进程并轮询等其彻底退出（最多约 5 秒）
; INTERACTIVE: "1" 时若因权限不足等原因 5 秒后仍无法结束，提示用户手动退出后重试
!macro TC_KILL_AND_WAIT_ALL INTERACTIVE
    Push $R7
    Push $R8
    Push $R9

    ${Do}
        StrCpy $R7 0
        ${Do}
            StrCpy $R8 "0"
            !insertmacro TC_FIND_AND_KILL_ONE "TitanCore.exe" $R8
            !insertmacro TC_FIND_AND_KILL_ONE "TitanUpdater.exe" $R8
            !insertmacro TC_FIND_AND_KILL_ONE "TitanPatcher.exe" $R8
            !insertmacro TC_FIND_AND_KILL_ONE "titan-asf.exe" $R8
            !insertmacro TC_FIND_AND_KILL_ONE "ArchiSteamFarm.exe" $R8
            !insertmacro TC_FIND_AND_KILL_ONE "Titan-DlcTool.exe" $R8
            !insertmacro TC_FIND_AND_KILL_ONE "Steamless.CLI.exe" $R8

            ${If} $R8 == "0"
                ${ExitDo}
            ${EndIf}

            IntOp $R7 $R7 + 1
            ${If} $R7 >= 25
                ${ExitDo}
            ${EndIf}
            Sleep 200
        ${Loop}

        ${If} $R8 == "1"
        ${AndIf} "${INTERACTIVE}" == "1"
        ${AndIfNot} ${Silent}
            ${If} ${Cmd} 'MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "检测到 TitanCore 或相关组件仍在运行且无法自动关闭（可能正以管理员权限运行）。$\r$\n$\r$\n请先手动退出 TitanCore（或重启安装程序选择“为所有用户安装”），然后点击“重试”继续。" /SD IDCANCEL IDRETRY'
                ; 点击重试：继续外层循环再尝试关闭并等待
            ${Else}
                ${nsProcess::Unload}
                Pop $R9
                Pop $R8
                Pop $R7
                Quit
            ${EndIf}
        ${Else}
            ${ExitDo}
        ${EndIf}
    ${Loop}

    ${nsProcess::Unload}
    Pop $R9
    Pop $R8
    Pop $R7
!macroend

; ==========================================
; 默认安装目录预填 (优先沿用非受保护旧安装目录；否则优先 D:\TitanCore，绝不落入 C:\Program Files)
; ==========================================
!macro preInit
    StrCpy $tcDirAutoCorrected "0"
    SetRegView 64
    ReadRegStr $0 HKCU "${INSTALL_REGISTRY_KEY}" "InstallLocation"
    ${If} $0 == ""
        ReadRegStr $0 HKLM "${INSTALL_REGISTRY_KEY}" "InstallLocation"
    ${EndIf}
    ${If} $0 == ""
        SetRegView 32
        ReadRegStr $0 HKCU "${INSTALL_REGISTRY_KEY}" "InstallLocation"
        ${If} $0 == ""
            ReadRegStr $0 HKLM "${INSTALL_REGISTRY_KEY}" "InstallLocation"
        ${EndIf}
        SetRegView 64
    ${EndIf}
    ClearErrors

    !insertmacro TC_IS_FORBIDDEN_DIR "$0" $1
    ${If} $1 == "1"
        !insertmacro TC_PICK_DEFAULT_DIR $0
    ${EndIf}
    StrCpy $INSTDIR "$0"
!macroend

; ==========================================
; 覆盖安装/原地升级前置排雷 (排空历史陈年缓存，清除受保护目录旧安装定位防止 initMultiUser/UAC 误继承)
; ==========================================
!macro customInit
    StrCpy $tcDirAutoCorrected "0"

    ; 1. 清理历史遗留在 Program Files / AppData\Local\Programs 的 InstallLocation，避免 UAC 提权内进程或静默升级读回 C:\Program Files
    SetRegView 64
    ReadRegStr $1 HKCU "${INSTALL_REGISTRY_KEY}" "InstallLocation"
    !insertmacro TC_IS_FORBIDDEN_DIR "$1" $2
    ${If} $1 != ""
    ${AndIf} $2 == "1"
        DeleteRegValue HKCU "${INSTALL_REGISTRY_KEY}" "InstallLocation"
    ${EndIf}
    ReadRegStr $1 HKLM "${INSTALL_REGISTRY_KEY}" "InstallLocation"
    !insertmacro TC_IS_FORBIDDEN_DIR "$1" $2
    ${If} $1 != ""
    ${AndIf} $2 == "1"
        DeleteRegValue HKLM "${INSTALL_REGISTRY_KEY}" "InstallLocation"
    ${EndIf}
    SetRegView 32
    ReadRegStr $1 HKCU "${INSTALL_REGISTRY_KEY}" "InstallLocation"
    !insertmacro TC_IS_FORBIDDEN_DIR "$1" $2
    ${If} $1 != ""
    ${AndIf} $2 == "1"
        DeleteRegValue HKCU "${INSTALL_REGISTRY_KEY}" "InstallLocation"
    ${EndIf}
    ReadRegStr $1 HKLM "${INSTALL_REGISTRY_KEY}" "InstallLocation"
    !insertmacro TC_IS_FORBIDDEN_DIR "$1" $2
    ${If} $1 != ""
    ${AndIf} $2 == "1"
        DeleteRegValue HKLM "${INSTALL_REGISTRY_KEY}" "InstallLocation"
    ${EndIf}
    SetRegView 64
    ClearErrors

    ; 2. 静默升级(/S)若检测到全机安装且已提权：接管 all 模式并屏蔽后续 setInstallModePerAllUsers 覆盖回 C:\Program Files
    StrCpy $2 "0"
    !ifndef INSTALL_MODE_PER_ALL_USERS
    !ifndef ONE_CLICK
    ${If} ${Silent}
    ${AndIf} $hasPerMachineInstallation == "1"
        ${If} ${UAC_IsAdmin}
            StrCpy $installMode all
            SetShellVarContext all
            StrCpy $hasPerMachineInstallation "0"
        ${Else}
            ; 尚未 UAC 提权：待 Section 弹 UAC 进入内进程后再清理进程与安装目录，避免用户点“否”误杀客户端
            StrCpy $2 "1"
        ${EndIf}
    ${EndIf}
    !endif
    !endif

    ; 3. 按当前安装模式（SHELL_CONTEXT）读取非受保护旧安装路径；若无或受保护则回落 D:\TitanCore 默认目录
    !insertmacro GetDParameter $R0
    ${If} $R0 == ""
        Push $2
        SetRegView 64
        ReadRegStr $1 SHELL_CONTEXT "${INSTALL_REGISTRY_KEY}" "InstallLocation"
        ${If} $1 == ""
            SetRegView 32
            ReadRegStr $1 SHELL_CONTEXT "${INSTALL_REGISTRY_KEY}" "InstallLocation"
            SetRegView 64
        ${EndIf}
        ClearErrors

        !insertmacro TC_IS_FORBIDDEN_DIR "$1" $2
        ${If} $2 == "0"
            StrCpy $INSTDIR "$1"
        ${Else}
            !insertmacro TC_PICK_DEFAULT_DIR $INSTDIR
        ${EndIf}
        Pop $2
    ${EndIf}

    ; 4. 静默安装(/S)已具备执行条件时，直接结束运行中的程序并按目录匹配清理旧版 UninstallString
    ${If} ${Silent}
    ${AndIf} $2 != "1"
        Call tcKillRunningProcesses
        Call tcClearUninstallString
    ${EndIf}
!macroend

; ==========================================
; 页面回调与安装目录实时校验: 彻底拦截 Program Files / LocalAppData\Programs，确保默认落到 D:\TitanCore
; ==========================================
!ifndef BUILD_UNINSTALLER
!ifdef INSTALL_MODE_PER_ALL_USERS
!define MUI_PAGE_CUSTOMFUNCTION_SHOW tcEnsureSafeInstDir
!else
!define MUI_PAGE_CUSTOMFUNCTION_PRE tcPreInstallMode
!define MUI_PAGE_CUSTOMFUNCTION_LEAVE tcAfterInstallModeLeave
!endif

!macro customPageAfterChangeDir
    Page custom tcPrepareOverwriteInstall
!macroend

; 替换框架默认弹窗查杀：改为无声强杀完整进程清单并等待彻底退出（避免当前用户路径弹出英文/确认窗）
!macro customCheckAppRunning
    Call tcKillRunningProcesses
!macroend

!macro TC_CLEAR_UNINSTALL_IF_MATCH HIVE TARGET_DIR_VAR
    ReadRegStr $R0 ${HIVE} "${UNINSTALL_REGISTRY_KEY}" "UninstallString"
    ${If} $R0 != ""
        ReadRegStr $R1 ${HIVE} "${INSTALL_REGISTRY_KEY}" "InstallLocation"
        ${If} $R1 == ""
            Push $R0
            Call tcExtractDirFromCmd
            Pop $R1
        ${EndIf}
        ${If} $R1 != ""
            StrCpy $R3 $R1 1 -1
            ${If} $R3 == "\"
                StrCpy $R1 $R1 -1
            ${EndIf}
        ${EndIf}
        ${If} $R1 == "${TARGET_DIR_VAR}"
            DeleteRegValue ${HIVE} "${UNINSTALL_REGISTRY_KEY}" "UninstallString"
        ${EndIf}
    ${EndIf}
!macroend

!macro customHeader
Function tcKillRunningProcesses
    !insertmacro TC_KILL_AND_WAIT_ALL 1
FunctionEnd

; 从 UninstallString 命令行提取所在目录（去除首尾引号与可执行文件名）
Function tcExtractDirFromCmd
    Exch $R0
    Push $R1
    Push $R2
    Push $R3

    StrCpy $R1 $R0 1
    ${If} $R1 == '"'
        StrCpy $R0 $R0 "" 1
        StrCpy $R2 0
        ${Do}
            StrCpy $R3 $R0 1 $R2
            ${If} $R3 == ""
                ${ExitDo}
            ${EndIf}
            ${If} $R3 == '"'
                StrCpy $R0 $R0 $R2
                ${ExitDo}
            ${EndIf}
            IntOp $R2 $R2 + 1
        ${Loop}
    ${EndIf}

    StrLen $R2 $R0
    ${DoWhile} $R2 > 0
        IntOp $R2 $R2 - 1
        StrCpy $R3 $R0 1 $R2
        ${If} $R3 == "\"
            StrCpy $R0 $R0 $R2
            ${ExitDo}
        ${EndIf}
    ${Loop}

    Pop $R3
    Pop $R2
    Pop $R1
    Exch $R0
FunctionEnd

; 仅清除与当前目标目录 $INSTDIR 一致的旧版 UninstallString，使同目录覆盖安装跳过旧卸载器；
; 保留指向其它旧路径（如 C:\Program Files 或跨安装模式残留）的卸载入口，交由框架自动卸载清理旧目录。
Function tcClearUninstallString
    Push $R0
    Push $R1
    Push $R2
    Push $R3

    StrCpy $R2 "$INSTDIR"
    ${If} $R2 != ""
        StrCpy $R3 $R2 1 -1
        ${If} $R3 == "\"
            StrCpy $R2 $R2 -1
        ${EndIf}
    ${EndIf}

    SetRegView 64
    !insertmacro TC_CLEAR_UNINSTALL_IF_MATCH HKCU $R2
    !insertmacro TC_CLEAR_UNINSTALL_IF_MATCH HKLM $R2
    SetRegView 32
    !insertmacro TC_CLEAR_UNINSTALL_IF_MATCH HKCU $R2
    !insertmacro TC_CLEAR_UNINSTALL_IF_MATCH HKLM $R2
    SetRegView 64
    ClearErrors

    Pop $R3
    Pop $R2
    Pop $R1
    Pop $R0
FunctionEnd

!ifdef INSTALL_MODE_PER_ALL_USERS
; 目录页显示时兜底（当 perMachine 跳过模式页时直接生效）
Function tcEnsureSafeInstDir
    !insertmacro GetDParameter $R0
    ${If} $R0 == ""
        !insertmacro TC_IS_FORBIDDEN_DIR "$INSTDIR" $0
        ${If} $0 == "1"
            !insertmacro TC_PICK_DEFAULT_DIR $INSTDIR
            FindWindow $R1 "#32770" "" $HWNDPARENT
            ${If} $R1 != 0
                GetDlgItem $R2 $R1 1019
                ${If} $R2 != 0
                    SendMessage $R2 0x000C 0 "STR:$INSTDIR"
                ${EndIf}
            ${EndIf}
        ${EndIf}
    ${EndIf}
FunctionEnd
!else
Function tcPreInstallMode
    StrCpy $tcDirAutoCorrected "0"
FunctionEnd

; 离开安装模式选择页时，若当前所选上下文无安全旧路径且未传 /D=，强制保持 D:\TitanCore 默认预填路径
Function tcAfterInstallModeLeave
    StrCpy $tcDirAutoCorrected "0"
    !insertmacro GetDParameter $R0
    ${If} $R0 == ""
        SetRegView 64
        ReadRegStr $0 SHELL_CONTEXT "${INSTALL_REGISTRY_KEY}" "InstallLocation"
        ${If} $0 == ""
            SetRegView 32
            ReadRegStr $0 SHELL_CONTEXT "${INSTALL_REGISTRY_KEY}" "InstallLocation"
            SetRegView 64
        ${EndIf}
        ClearErrors
        !insertmacro TC_IS_FORBIDDEN_DIR "$0" $1
        ${If} $1 == "1"
            !insertmacro TC_PICK_DEFAULT_DIR $INSTDIR
        ${Else}
            StrCpy $INSTDIR "$0"
        ${EndIf}
    ${EndIf}
FunctionEnd
!endif

; 进入文件释放前一瞬间：二次兜底拦截受保护路径、静默清场所有运行中的进程，并清理 UninstallString
Function tcPrepareOverwriteInstall
    !insertmacro GetDParameter $R0
    ${If} $R0 == ""
        !insertmacro TC_IS_FORBIDDEN_DIR "$INSTDIR" $0
        ${If} $0 == "1"
            !insertmacro TC_PICK_DEFAULT_DIR $INSTDIR
        ${EndIf}
    ${EndIf}
    Call tcKillRunningProcesses
    Call tcClearUninstallString
    Abort
FunctionEnd

Function .onVerifyInstDir
    Push $0
    Push $R0
    Push $R1
    Push $R2

    !insertmacro TC_IS_FORBIDDEN_DIR "$INSTDIR" $0
    ${If} $0 == "1"
        ; 关键修复：UAC 提权内进程会 Abort 跳过模式页并被框架强制改写为 C:\Program Files\TitanCore；
        ; 目录页初始化触发 .onVerifyInstDir 时立即原地纠偏回 D:\TitanCore 并刷新文本框，后续人工选入则严格拦截
        !insertmacro GetDParameter $R0
        ${If} $R0 == ""
        ${AndIf} $tcDirAutoCorrected != "1"
            FindWindow $R1 "#32770" "" $HWNDPARENT
            ${If} $R1 != 0
                GetDlgItem $R2 $R1 1019
                ${If} $R2 != 0
                    StrCpy $tcDirAutoCorrected "1"
                    !insertmacro TC_PICK_DEFAULT_DIR $INSTDIR
                    SendMessage $R2 0x000C 0 "STR:$INSTDIR"
                    Pop $R2
                    Pop $R1
                    Pop $R0
                    Pop $0
                    Return
                ${EndIf}
            ${EndIf}
        ${EndIf}
        Pop $R2
        Pop $R1
        Pop $R0
        Pop $0
        Abort
    ${Else}
        StrCpy $tcDirAutoCorrected "1"
    ${EndIf}

    Pop $R2
    Pop $R1
    Pop $R0
    Pop $0
FunctionEnd
!macroend
!endif

; ==========================================
; 安装完成后清理历史临时升级备份残留 (注册表由框架 registryAddInstallInfo 按 SHELL_CONTEXT 标准写入)
; ==========================================
!macro customInstall
    SetShellVarContext current
    RMDir /r "$LOCALAPPDATA\TC_UpgradeBackup"
    ${If} $installMode == "all"
        SetShellVarContext all
    ${EndIf}
!macroend

; ==========================================
; 保护覆盖安装：仅在真正卸载(非 ${isUpdated})时删除安装目录
; ==========================================
!macro customRemoveFiles
    ${IfNot} ${isUpdated}
        SetOutPath $TEMP
        RMDir /r $INSTDIR
    ${EndIf}
!macroend

; ==========================================
; 卸载时强力排空: 仅在真正卸载(非覆盖升级 ${isUpdated})时清零数据与快捷方式
; ==========================================
!macro customUnInstall
    ; 1. 原生安全结束 TitanCore 及其全部伴生/子进程并等待退出，排空句柄占用（交互卸载遇权限阻塞可重试，静默更新跳过弹窗）
    !insertmacro TC_KILL_AND_WAIT_ALL 1

    ${IfNot} ${isUpdated}
        ; 2. 注册表与环境变量清理 (仅真正卸载时执行)
        SetRegView 64
        DeleteRegValue HKLM "${INSTALL_REGISTRY_KEY}" "InstallLocation"
        DeleteRegValue HKCU "${INSTALL_REGISTRY_KEY}" "InstallLocation"
        SetRegView 32
        DeleteRegValue HKLM "${INSTALL_REGISTRY_KEY}" "InstallLocation"
        DeleteRegValue HKCU "${INSTALL_REGISTRY_KEY}" "InstallLocation"

        SetRegView 64
        DeleteRegKey HKCU "Software\TitanCore"

        DeleteRegValue HKCU "Environment" "CR_STATE_DIR"

        ; 清理开机自启注册表项及 Windows 启动审批缓存（仅真正卸载时执行，升级保留用户自启设置）
        DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "TitanCore"
        DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "com.TitanCore.app"
        DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "electron.app.TitanCore"
        DeleteRegValue HKLM "Software\Microsoft\Windows\CurrentVersion\Run" "TitanCore"
        DeleteRegValue HKLM "Software\Microsoft\Windows\CurrentVersion\Run" "com.TitanCore.app"
        DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run" "TitanCore"
        DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run" "com.TitanCore.app"
        DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run" "electron.app.TitanCore"
        SetRegView 32
        DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "TitanCore"
        DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "com.TitanCore.app"
        DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "electron.app.TitanCore"
        DeleteRegValue HKLM "Software\Microsoft\Windows\CurrentVersion\Run" "TitanCore"
        DeleteRegValue HKLM "Software\Microsoft\Windows\CurrentVersion\Run" "com.TitanCore.app"
        SetRegView 64

        ; 3. 本地数据与缓存清零 (仅真正卸载时执行，覆盖升级时严禁清空用户数据)
        SetShellVarContext current
        RMDir /r "$APPDATA\titan-core"
        RMDir /r "$APPDATA\TitanCore"
        RMDir /r "$LOCALAPPDATA\titan-core"
        RMDir /r "$LOCALAPPDATA\TitanCore"

        SetShellVarContext all
        RMDir /r "$APPDATA\titan-core"
        RMDir /r "$APPDATA\TitanCore"

        RMDir /r "$INSTDIR\data"
        RMDir /r "$INSTDIR\cache"
        RMDir /r "$INSTDIR\userData"
        RMDir /r "$INSTDIR\titan-core"
        RMDir /r "$INSTDIR\TitanCore"
        RMDir /r "$INSTDIR\games"
        RMDir /r "$INSTDIR\ost"
        RMDir /r "$INSTDIR\tools"
        Delete "$INSTDIR\*.log"
        Delete "$INSTDIR\*.session"
        Delete "$INSTDIR\*.tmp"

        ; 系统与用户临时目录
        RMDir /r "$TEMP\titan-core"
        RMDir /r "$TEMP\TitanCore"
        RMDir /r "$TEMP\com.TitanCore.app"
        RMDir /r "$WINDIR\Temp\titan-core"
        RMDir /r "$WINDIR\Temp\TitanCore"

        ; 4. 彻底拔除桌面与开始菜单快捷方式死链接
        SetShellVarContext current
        Delete "$DESKTOP\TitanCore.lnk"
        Delete "$DESKTOP\Titan Core.lnk"
        Delete "$SMPROGRAMS\TitanCore.lnk"
        Delete "$SMPROGRAMS\Titan Core.lnk"
        RMDir /r "$SMPROGRAMS\TitanCore"

        SetShellVarContext all
        Delete "$DESKTOP\TitanCore.lnk"
        Delete "$DESKTOP\Titan Core.lnk"
        Delete "$SMPROGRAMS\TitanCore.lnk"
        Delete "$SMPROGRAMS\Titan Core.lnk"
        RMDir /r "$SMPROGRAMS\TitanCore"
        ${If} $installMode != "all"
            SetShellVarContext current
        ${EndIf}
    ${EndIf}
!macroend