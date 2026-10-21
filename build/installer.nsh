; build/installer.nsh
; TitanCore 官方原生标准向导 (保留 D:\ 预填 + 快捷方式彻底清理 + 0延迟瞬时卸载)

!pragma warning disable 6020
!pragma warning disable 7999
!include MUI2.nsh

ManifestDPIAware true

; ==========================================
; 默认安装目录预填 (UX 预设: 优先预填 D:\TitanCore)
; ==========================================
!macro preInit
    SetRegView 64
    WriteRegExpandStr HKLM "${INSTALL_REGISTRY_KEY}" "InstallLocation" "D:\TitanCore"
    WriteRegExpandStr HKCU "${INSTALL_REGISTRY_KEY}" "InstallLocation" "D:\TitanCore"
    SetRegView 32
    WriteRegExpandStr HKLM "${INSTALL_REGISTRY_KEY}" "InstallLocation" "D:\TitanCore"
    WriteRegExpandStr HKCU "${INSTALL_REGISTRY_KEY}" "InstallLocation" "D:\TitanCore"
!macroend

; ==========================================
; 安装完成后真实安装路径回写
; ==========================================
!macro customInstall
    SetRegView 64
    WriteRegExpandStr HKLM "${INSTALL_REGISTRY_KEY}" "InstallLocation" "$INSTDIR"
    WriteRegExpandStr HKCU "${INSTALL_REGISTRY_KEY}" "InstallLocation" "$INSTDIR"
    SetRegView 32
    WriteRegExpandStr HKLM "${INSTALL_REGISTRY_KEY}" "InstallLocation" "$INSTDIR"
    WriteRegExpandStr HKCU "${INSTALL_REGISTRY_KEY}" "InstallLocation" "$INSTDIR"
!macroend

; ==========================================
; 卸载时强力排空: 进程树斩首 + 注册表与缓存全量清零 + 快捷方式彻底拔除
; (性能优化: 去除全局 SendMessageBroadcast 阻塞与无谓硬休眠，文件解包完毕 0 秒立即点亮完成)
; ==========================================
!macro customUnInstall
    ; 1. 强杀 TitanCore 及其全部子进程树(/T)，排空句柄占用
    nsExec::Exec 'taskkill /F /T /IM TitanCore.exe'

    ; 2. 注册表与环境变量清理 (瞬时完成，不进行耗时 1~2 秒的系统级顶层窗口全局广播)
    SetRegView 64
    DeleteRegValue HKLM "${INSTALL_REGISTRY_KEY}" "InstallLocation"
    DeleteRegValue HKCU "${INSTALL_REGISTRY_KEY}" "InstallLocation"
    SetRegView 32
    DeleteRegValue HKLM "${INSTALL_REGISTRY_KEY}" "InstallLocation"
    DeleteRegValue HKCU "${INSTALL_REGISTRY_KEY}" "InstallLocation"

    SetRegView 64
    DeleteRegKey HKCU "Software\TitanCore"

    DeleteRegValue HKCU "Environment" "CR_STATE_DIR"

    ; 3. 本地数据与缓存清零 (覆盖 AppData / LocalAppData / 安装目录缓存 / Temp 兜底)
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

    ; 4. 彻底拔除桌面与开始菜单快捷方式死链接 (current 与 all 上下文双重清零)
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
!macroend