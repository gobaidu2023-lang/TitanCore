// 文件路径: src/main/utils/ArchiveService.ts
// 职责: 全局统一 7Z 解压 / 打包压缩 / 归档完整性探测服务，替代全仓散落的 spawn(resolve7zExePath(), ...)
import { spawn } from 'node:child_process'
import path from 'node:path'
import fs from 'node:fs'
import { resolve7zExePath } from './resolve7z'

export class ArchiveService {
  /**
   * 解压归档文件至目标目录
   */
  static extract(srcArchive: string, destDir: string, options: { overwrite?: boolean } = {}): Promise<void> {
    if (!fs.existsSync(srcArchive)) return Promise.reject(new Error(`ARCHIVE_NOT_FOUND: ${srcArchive}`))
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true })

    const exe = resolve7zExePath()
    const args = ['x', srcArchive, `-o${destDir}`, '-y', '-bsp0', '-bso0']
    if (options.overwrite) args.push('-aoa')

    return new Promise((resolve, reject) => {
      const proc = spawn(exe, args, { windowsHide: true })
      proc.on('close', code => {
        if (code === 0) resolve()
        else reject(new Error(`7Z_EXTRACT_FAILED_CODE_${code}`))
      })
      proc.on('error', err => reject(err))
    })
  }

  /**
   * 将指定目录内容压缩为 ZIP
   */
  static compressDir(srcDir: string, destZip: string): Promise<void> {
    if (!fs.existsSync(srcDir)) return Promise.reject(new Error(`SRC_DIR_NOT_FOUND: ${srcDir}`))
    const destFolder = path.dirname(destZip)
    if (!fs.existsSync(destFolder)) fs.mkdirSync(destFolder, { recursive: true })

    const exe = resolve7zExePath()
    const args = ['a', '-tzip', '-y', destZip, '*']

    return new Promise((resolve, reject) => {
      const proc = spawn(exe, args, { cwd: srcDir, windowsHide: true })
      proc.on('close', code => {
        if (code === 0) resolve()
        else reject(new Error(`7Z_COMPRESS_FAILED_CODE_${code}`))
      })
      proc.on('error', err => reject(err))
    })
  }

  /**
   * 测试归档包完整性（用于下载后损坏探测）
   */
  static test(archivePath: string): Promise<boolean> {
    if (!fs.existsSync(archivePath)) return Promise.resolve(false)
    const exe = resolve7zExePath()
    return new Promise(resolve => {
      const proc = spawn(exe, ['t', archivePath, '-y', '-bsp0', '-bso0'], { windowsHide: true })
      proc.on('close', code => resolve(code === 0))
      proc.on('error', () => resolve(false))
    })
  }
}
