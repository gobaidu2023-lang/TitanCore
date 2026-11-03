; build/installer.nsh
; TitanCore 官方原生标准向导 (保留 D:\ 预填 + 快捷方式彻底清理 + 0延迟瞬时卸载)

!pragma warning disable 6020
!pragma warning disable 7999
!include MUI2.nsh

ManifestDPIAware true

; ==========================================
; 默认安装目录预填 (UX 预设: 优先沿用非受保护旧安装目录；全新安装有 D 盘预填 D:\TitanCore，单 C 盘预填 C:\TitanCore)
; ==========================================
!macro preInit
    SetRegView 64
    ReadRegStr $0 HKCU "${INSTALL_REGISTRY_KEY}" "InstallLocation"
    ${If} $0 == ""
        ReadRegStr $0 HKLM "${INSTALL_REGISTRY_KEY}" "InstallLocation"
    ${EndIf}
    ${If} $0 == ""
        ${If} ${FileExists} "D:\*.*"
            StrCpy $0 "D:\TitanCore"
        ${Else}
            StrCpy $0 "C:\TitanCore"
        ${EndIf}
    ${EndIf}
    StrCpy $INSTDIR "$0"
    WriteRegExpandStr HKLM "${INSTALL_REGISTRY_KEY}" "InstallLocation" "$0"
    WriteRegExpandStr HKCU "${INSTALL_REGISTRY_KEY}" "InstallLocation" "$0"
    SetRegView 32
    WriteRegExpandStr HKLM "${INSTALL_REGISTRY_KEY}" "InstallLocation" "$0"
    WriteRegExpandStr HKCU "${INSTALL_REGISTRY_KEY}" "InstallLocation" "$0"
!macroend

; ==========================================
; 覆盖安装/原地升级前置排雷 (排空历史陈年缓存，杜绝敏感 DLL 备份报警)
; ==========================================
!macro customInit
    ; 1. 强杀可能残留的后台 TitanCore 进程，排空文件占用
    nsExec::Exec 'taskkill /F /T /IM TitanCore.exe'
    nsExec::Exec 'taskkill /F /T /IM TitanPatcher.exe'
    nsExec::Exec 'taskkill /F /T /IM ArchiSteamFarm.exe'
    nsExec::Exec 'taskkill /F /T /IM Titan-DlcTool.exe'
    Sleep 500

    SetShellVarContext current
    ; 清空历史临时升级避风港
    RMDir /r "$LOCALAPPDATA\TC_UpgradeBackup"

    ; 🛡️【核心用户资产避风港】覆盖升级前全量安全暂存，绝不允许新版抹除用户数据！
    ; 探测实际旧安装目录（优先 $INSTDIR，备选 D:\TitanCore、C:\TitanCore）
    StrCpy $1 "$INSTDIR"
    ${If} $1 == ""
        ${If} ${FileExists} "D:\TitanCore\*.*"
            StrCpy $1 "D:\TitanCore"
        ${ElseIf} ${FileExists} "C:\TitanCore\*.*"
            StrCpy $1 "C:\TitanCore"
        ${EndIf}
    ${EndIf}

    ${If} $1 != ""
        ; (1) 保护 OST 注入核心、全部 config 配置与已激活游戏 lua 脚本
        ${If} ${FileExists} "$1\ost\*.*"
            CreateDirectory "$LOCALAPPDATA\TC_UpgradeBackup\ost"
            CopyFiles /SILENT "$1\ost\*.*" "$LOCALAPPDATA\TC_UpgradeBackup\ost"
        ${EndIf}

        ; (2) 保护用户已下载的游戏资源与存档 (games 目录)
        ${If} ${FileExists} "$1\games\*.*"
            CreateDirectory "$LOCALAPPDATA\TC_UpgradeBackup\games"
            CopyFiles /SILENT "$1\games\*.*" "$LOCALAPPDATA\TC_UpgradeBackup\games"
        ${EndIf}

        ; (3) 保护用户已按需下载就绪的官方外部工具组件 (tools 目录)
        ${If} ${FileExists} "$1\tools\*.*"
            CreateDirectory "$LOCALAPPDATA\TC_UpgradeBackup\tools"
            CopyFiles /SILENT "$1\tools\*.*" "$LOCALAPPDATA\TC_UpgradeBackup\tools"
        ${EndIf}

        ; (4) 保护本地便携模式数据库 (data 目录)
        ${If} ${FileExists} "$1\data\*.*"
            CreateDirectory "$LOCALAPPDATA\TC_UpgradeBackup\data"
            CopyFiles /SILENT "$1\data\*.*" "$LOCALAPPDATA\TC_UpgradeBackup\data"
        ${EndIf}
    ${EndIf}

    ; 智能自愈排雷：清理历史遗留在 AppData 下的远古 tools 垃圾，防止 360 抓取
    ${If} ${FileExists} "$APPDATA\titan-core\tools\*.*"
        RMDir /r "$APPDATA\titan-core\tools"
    ${EndIf}
!macroend

; ==========================================
; 安装目录实时校验: 严禁用户手动选入 Program Files (含 x86) 系统受保护目录
; ==========================================
!ifndef BUILD_UNINSTALLER
Function .onVerifyInstDir
    Push $0
    Push $1
    StrCpy $0 0
    _chk_pf_loop:
        StrCpy $1 $INSTDIR 13 $0
        StrCmp $1 "" _chk_pf_ok
        StrCmp $1 "Program Files" _chk_pf_hit
        IntOp $0 $0 + 1
        Goto _chk_pf_loop
    _chk_pf_hit:
        Pop $1
        Pop $0
        Abort
    _chk_pf_ok:
        Pop $1
        Pop $0
FunctionEnd
!endif

; ==========================================
; 安装完成后真实安装路径回写 + 升级临时区彻底排空
; ==========================================
!macro customInstall
    SetRegView 64
    WriteRegExpandStr HKLM "${INSTALL_REGISTRY_KEY}" "InstallLocation" "$INSTDIR"
    WriteRegExpandStr HKCU "${INSTALL_REGISTRY_KEY}" "InstallLocation" "$INSTDIR"
    SetRegView 32
    WriteRegExpandStr HKLM "${INSTALL_REGISTRY_KEY}" "InstallLocation" "$INSTDIR"
    WriteRegExpandStr HKCU "${INSTALL_REGISTRY_KEY}" "InstallLocation" "$INSTDIR"

    SetShellVarContext current
    ; 🛡️【核心用户资产无损还原】将避风港中的用户数据全量无损写回新版本安装目录
    ${If} ${FileExists} "$LOCALAPPDATA\TC_UpgradeBackup\ost\*.*"
        CreateDirectory "$INSTDIR\ost"
        CopyFiles /SILENT "$LOCALAPPDATA\TC_UpgradeBackup\ost\*.*" "$INSTDIR\ost"
    ${EndIf}

    ${If} ${FileExists} "$LOCALAPPDATA\TC_UpgradeBackup\games\*.*"
        CreateDirectory "$INSTDIR\games"
        CopyFiles /SILENT "$LOCALAPPDATA\TC_UpgradeBackup\games\*.*" "$INSTDIR\games"
    ${EndIf}

    ${If} ${FileExists} "$LOCALAPPDATA\TC_UpgradeBackup\tools\*.*"
        CreateDirectory "$INSTDIR\tools"
        CopyFiles /SILENT "$LOCALAPPDATA\TC_UpgradeBackup\tools\*.*" "$INSTDIR\tools"
    ${EndIf}

    ${If} ${FileExists} "$LOCALAPPDATA\TC_UpgradeBackup\data\*.*"
        CreateDirectory "$INSTDIR\data"
        CopyFiles /SILENT "$LOCALAPPDATA\TC_UpgradeBackup\data\*.*" "$INSTDIR\data"
    ${EndIf}

    ; 还原完毕，彻底清理临时升级避风港
    RMDir /r "$LOCALAPPDATA\TC_UpgradeBackup"
!macroend

; ==========================================
; 卸载时强力排空: 仅在真正卸载(非覆盖升级 ${isUpdated})时清零数据与快捷方式
; ==========================================
!macro customUnInstall
    ; 1. 强杀 TitanCore 及其全部子进程树(/T)，排空句柄占用
    nsExec::Exec 'taskkill /F /T /IM TitanCore.exe'
    nsExec::Exec 'taskkill /F /T /IM TitanPatcher.exe'
    nsExec::Exec 'taskkill /F /T /IM ArchiSteamFarm.exe'
    nsExec::Exec 'taskkill /F /T /IM Titan-DlcTool.exe'
    Sleep 500

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
    ${EndIf}
!macroend