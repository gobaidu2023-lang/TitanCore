// 文件名: src/components/modals/toolRegistry.ts
// fix50: 工具注册表(渲染层镜像,与主进程 ToolService.TOOLS 同构,新增工具双端各加一行)
export interface ToolDef {
  id: string
  toolDir: string
  zipName: string
  dirName: string
  exeRel: string
  killImage: string
  prefKey?: string // 显隐开关 key，若未定义或为空串则不在实验弹窗和库菜单中显示【显示/隐藏】开关
  serverKey: string
  nameKey: string
  icon: string
}

export const TOOLS: ToolDef[] = [
  {
    id: 'dlc_manager',
    toolDir: 'dlcmanager',
    zipName: 'Titan-DlcTool.zip',
    dirName: 'Titan-DlcTool',
    exeRel: 'Titan-DlcTool.exe',
    killImage: 'Titan-DlcTool.exe',
    prefKey: 'pref_tool_dlc_visible',
    serverKey: 'dlc',
    nameKey: 'settings.exp.tools.dlc',
    icon: '🧩'
  },
  {
    id: 'asf',
    toolDir: 'tcasf',
    zipName: 'TC_ASF.zip',
    dirName: 'TC_ASF', // 压缩包内含 TC_ASF/titan-asf.exe
    exeRel: 'titan-asf.exe',
    killImage: 'titan-asf.exe',
    prefKey: '', // 仅在实验功能启动，不需要显示/隐藏开关
    serverKey: 'asf',
    nameKey: 'settings.exp.tools.asf',
    icon: '⚡'
  }
]
