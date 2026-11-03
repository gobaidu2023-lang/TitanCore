import { app, shell } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'
import { ArchiveService } from '../utils/ArchiveService'
import { SteamDetector } from './SteamDetector'
import { ModeSwitchService } from './ModeSwitchService'
import { Db } from '../db'

export class DiagnosticExportService {
  /**
   * 一键收集 TC 主程序日志、OST 底座模块日志、Steam 连接日志及系统摘要，并打包压缩至桌面
   */
  static async export(): Promise<{ success: boolean; path?: string; error?: string }> {
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const timeStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
    
    const desktopDir = app.getPath('desktop')
    const zipFileName = `TitanCore_诊断日志_${timeStr}.zip`
    const targetZip = path.join(desktopDir, zipFileName)
    const tempWorkDir = path.join(app.getPath('temp'), `tc_diag_${Date.now()}`)

    try {
      if (fs.existsSync(tempWorkDir)) {
        fs.rmSync(tempWorkDir, { recursive: true, force: true })
      }
      fs.mkdirSync(tempWorkDir, { recursive: true })

      // 1. 搜集轨道一：TC 主程序运行日志
      const tcLogPath = path.join(app.getPath('appData'), 'titan-core', 'logs', 'titan-debug.log')
      if (fs.existsSync(tcLogPath)) {
        try {
          fs.copyFileSync(tcLogPath, path.join(tempWorkDir, 'titan-debug.log'))
        } catch (e: any) {
          console.error('[DiagnosticExport] 复制 TC 主程序日志失败:', e?.message || e)
        }
      }

      // 2. 搜集轨道二：OST 底座全量模块日志与配置
      const ostLogCandidates: string[] = [
        path.join(ModeSwitchService.ostDir, 'opensteamtool')
      ]
      const steamPath = SteamDetector.lastDetectedPath
      if (steamPath) {
        ostLogCandidates.push(path.join(steamPath, 'opensteamtool'))
      }

      const ostTargetDir = path.join(tempWorkDir, 'ost')
      for (const ostDir of ostLogCandidates) {
        if (fs.existsSync(ostDir)) {
          fs.mkdirSync(ostTargetDir, { recursive: true })
          try {
            const files = fs.readdirSync(ostDir)
            for (const f of files) {
              if (f.endsWith('.log') || f === 'opensteamtool.toml') {
                const srcF = path.join(ostDir, f)
                const dstF = path.join(ostTargetDir, f)
                if (!fs.existsSync(dstF)) {
                  fs.copyFileSync(srcF, dstF)
                }
              }
            }
          } catch (e: any) {
            console.error('[DiagnosticExport] 遍历 OST 目录失败:', ostDir, e?.message || e)
          }
        }
      }

      // 顺带检查并搜集 ost 根目录下的 opensteamtool.toml（纯净模式默认位置）
      const rootToml = path.join(ModeSwitchService.ostDir, 'opensteamtool.toml')
      if (fs.existsSync(rootToml) && !fs.existsSync(path.join(ostTargetDir, 'opensteamtool.toml'))) {
        try {
          fs.mkdirSync(ostTargetDir, { recursive: true })
          fs.copyFileSync(rootToml, path.join(ostTargetDir, 'opensteamtool.toml'))
        } catch {}
      }

      // 3. 搜集轨道三：Steam 官方客户端连接与更新日志
      if (steamPath) {
        const steamLogsDir = path.join(steamPath, 'logs')
        if (fs.existsSync(steamLogsDir)) {
          const steamTargetDir = path.join(tempWorkDir, 'steam_logs')
          fs.mkdirSync(steamTargetDir, { recursive: true })
          const targetLogs = ['connection_log.txt', 'bootstrap_log.txt', 'content_log.txt']
          for (const logName of targetLogs) {
            const p = path.join(steamLogsDir, logName)
            if (fs.existsSync(p)) {
              try {
                fs.copyFileSync(p, path.join(steamTargetDir, logName))
              } catch {}
            }
          }
        }
      }

      // 4. 搜集轨道四：自动生成系统与环境摘要
      const summaryLines = [
        '================================================================================',
        '                  TitanCore 系统诊断与日志汇总报告',
        '================================================================================',
        `导出时间: ${now.toLocaleString()} (ISO: ${now.toISOString()})`,
        `软件版本: TitanCore v${app.getVersion() || '2.0.2'}`,
        `Electron: ${process.versions.electron || 'Unknown'}`,
        `Chrome: ${process.versions.chrome || 'Unknown'}`,
        `Node.js: ${process.versions.node || 'Unknown'}`,
        `操作系统: ${os.type()} ${os.release()} (${os.arch()})`,
        `CPU 型号: ${os.cpus()[0]?.model || 'Unknown'} (${os.cpus().length} 核心)`,
        `内存状态: 空闲 ${(os.freemem() / 1024 / 1024).toFixed(0)}MB / 总量 ${(os.totalmem() / 1024 / 1024).toFixed(0)}MB`,
        `进程路径: ${app.getPath('exe')}`,
        `用户数据: ${app.getPath('userData')}`,
        '--------------------------------------------------------------------------------',
        `OST 当前模式: ${ModeSwitchService.getMode()}`,
        `OST 部署根目录: ${ModeSwitchService.ostDir}`,
        `Steam 探测路径: ${SteamDetector.lastDetectedPath || '未检测到'} (来源: ${SteamDetector.lastDetectSource})`,
        `当前选择节点: ${Db.get<any>('active_node') || '默认'}`,
        '================================================================================',
        '包含的文件清单:',
        '- titan-debug.log: TitanCore 主程序运行及假死看门狗日志',
        '- ost/: OpenSteamTool 底座 IAT Hook、IPC 通信、清单下载、解密钥匙日志与配置文件',
        '- steam_logs/: Steam 官方客户端原生网络连接与更新日志',
        '================================================================================'
      ]
      fs.writeFileSync(path.join(tempWorkDir, 'system_summary.txt'), summaryLines.join('\r\n'), 'utf-8')

      // 5. 调用统一 7Z 服务压缩成标准 ZIP 包
      try {
        await ArchiveService.compressDir(tempWorkDir, targetZip)
        try { fs.rmSync(tempWorkDir, { recursive: true, force: true }) } catch {}
        
        // 自动弹窗并在桌面高亮选中该 ZIP 文件
        shell.showItemInFolder(targetZip)
        return { success: true, path: targetZip }
      } catch (zipErr: any) {
        console.error('[DiagnosticExport] 7Z 压缩失败，尝试备用普通文件夹导出:', zipErr?.message || zipErr)
        // 灾备回退：若 7z 遇到损坏或权限异常，将整个收集目录直接重命名移动至桌面
        const fallbackFolder = path.join(desktopDir, `TitanCore_诊断日志_${timeStr}`)
        fs.renameSync(tempWorkDir, fallbackFolder)
        shell.showItemInFolder(fallbackFolder)
        return { success: true, path: fallbackFolder }
      }
    } catch (e: any) {
      console.error('[DiagnosticExport] 导出诊断日志发生致命异常:', e)
      try { fs.rmSync(tempWorkDir, { recursive: true, force: true }) } catch {}
      return { success: false, error: e?.message || 'EXPORT_FAILED' }
    }
  }
}
