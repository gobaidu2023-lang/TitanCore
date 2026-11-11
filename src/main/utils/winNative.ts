// 文件路径: src/main/utils/winNative.ts
// 职责: 全局统一 Win32 原生桥接封装 (加载 tc_native.node，替代 taskkill/tasklist/reg.exe 外部命令行)
import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'

export type RegRoot = 'HKCU' | 'HKLM' | 'HKCR'

export interface TcNativeAddon {
  launchSuspended: (
    steamExe: string,
    dllPath: string,
    baseDir: string,
    eventName: string,
    timeoutMs: number,
    callback: (err: any, res: any) => void
  ) => void
  broadcastSettingChange: () => boolean
  isProcessRunning: (imageName: string) => boolean
  killProcesses: (imageNames: string[], includeTree?: boolean) => number
  killProcessByPid: (pid: number, expectedImage?: string, includeTree?: boolean) => boolean
  regReadString: (root: RegRoot, subKey: string, valueName: string) => string | null
  regQuerySubkeyStrings: (root: RegRoot, subKey: string, valueName: string) => string[]
  regWriteString: (root: RegRoot, subKey: string, valueName: string, value: string) => boolean
  regWriteBinary: (root: RegRoot, subKey: string, valueName: string, data: Buffer) => boolean
  regDeleteValue: (root: RegRoot, subKey: string, valueName: string) => boolean
}

let cachedNative: TcNativeAddon | null = null
let loadAttempted = false

export function getNativeModule(): TcNativeAddon | null {
  if (process.platform !== 'win32') return null
  if (loadAttempted) return cachedNative
  loadAttempted = true

  const candidates: string[] = [
    path.join(process.resourcesPath || '', 'bin', 'tc_native.node'),
    path.join(path.dirname(process.execPath), 'resources', 'bin', 'tc_native.node'),
    path.join(path.dirname(process.execPath), '..', '..', '..', 'native', 'build', 'Release', 'tc_native.node')
  ]
  try { candidates.push(path.join(app.getAppPath(), 'native', 'build', 'Release', 'tc_native.node')) } catch {}
  try { candidates.push(path.join(app.getAppPath(), 'build', 'native', 'Release', 'tc_native.node')) } catch {}
  try { candidates.push(path.join(app.getAppPath(), 'build', 'Release', 'tc_native.node')) } catch {}
  try { candidates.push(path.join(app.getAppPath(), 'resources', 'bin', 'tc_native.node')) } catch {}
  try { candidates.push(path.join(process.cwd(), 'resources', 'bin', 'tc_native.node')) } catch {}
  try { candidates.push(path.join(process.cwd(), 'native', 'build', 'Release', 'tc_native.node')) } catch {}

  for (const p of candidates) {
    try {
      if (p && fs.existsSync(p)) {
        cachedNative = require(p) as TcNativeAddon
        return cachedNative
      }
    } catch (e: any) {
      console.error('[WinNative] 原生插件加载失败:', p, e?.message)
    }
  }
  console.error('[WinNative] 未找到 tc_native.node 原生插件')
  return null
}

export class WinNative {
  static getNativeModule(): TcNativeAddon | null {
    return getNativeModule()
  }

  static broadcastSettingChange(): boolean {
    return getNativeModule()?.broadcastSettingChange() ?? false
  }

  static isProcessRunning(imageName: string): boolean {
    if (!imageName) return false
    return getNativeModule()?.isProcessRunning(imageName) ?? false
  }

  static killProcesses(imageNames: string[], includeTree = true): number {
    const valid = imageNames.filter(Boolean)
    if (valid.length === 0) return 0
    return getNativeModule()?.killProcesses(valid, includeTree) ?? 0
  }

  static killProcessByPid(pid: number, expectedImage = '', includeTree = true): boolean {
    if (!pid || pid <= 0) return false
    return getNativeModule()?.killProcessByPid(pid, expectedImage, includeTree) ?? false
  }

  static regReadString(root: RegRoot, subKey: string, valueName = ''): string | null {
    return getNativeModule()?.regReadString(root, subKey, valueName) ?? null
  }

  static regQuerySubkeyStrings(root: RegRoot, subKey: string, valueName = ''): string[] {
    return getNativeModule()?.regQuerySubkeyStrings(root, subKey, valueName) ?? []
  }

  static regWriteString(root: RegRoot, subKey: string, valueName: string, value: string): boolean {
    return getNativeModule()?.regWriteString(root, subKey, valueName, value) ?? false
  }

  static regWriteBinary(root: RegRoot, subKey: string, valueName: string, data: Buffer): boolean {
    return getNativeModule()?.regWriteBinary(root, subKey, valueName, data) ?? false
  }

  static regDeleteValue(root: RegRoot, subKey: string, valueName: string): boolean {
    return getNativeModule()?.regDeleteValue(root, subKey, valueName) ?? false
  }
}
