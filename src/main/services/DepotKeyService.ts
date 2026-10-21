// 文件名: src/main/services/DepotKeyService.ts
// 边缘业务：工坊 DepotKey 密钥库下发 + 部署后静默注入 lua
// 设计约束：零 UI、零 IPC、零主库 schema 变更、零日志；所有失败静默降级
import fs from 'node:fs'
import { ModeSwitchService } from './ModeSwitchService'
import path from 'node:path'
import crypto from 'node:crypto'
import axios from 'axios'
import Database from 'better-sqlite3'
import { Db } from '../db'
import { titanFetch } from '../TitanNet'
import { ArchiveService } from '../utils/ArchiveService'

const DB_FILE_NAME = 'depot_keys.db'
const VERSION_KEY = 'depot_keys_version'
const IDLE_TIMEOUT_MS = 8000
// 基础防盗共享密钥：必须与 depotkey.php 中的 DEPOT_SECRET 完全一致（改则两边同改）
const DEPOT_SECRET = process.env.TITAN_DEPOT_SECRET || ''

export class DepotKeyService {

    // ================= [ 路径 ] =================

    private static dbFilePath(): string {
        return path.join(Db.getDataRoot(), DB_FILE_NAME)
    }

    private static tempRoot(): string {
        const dir = path.join(Db.getDataRoot(), 'TitanTemp', 'depotkeys')
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
        return dir
    }

    // ================= [ 查询（独立只读连接，用完即关，天然规避替换时句柄占用）] =================

    static getKey(appId: string): string | null {
        if (!/^\d+$/.test(appId)) return null
        const dbPath = this.dbFilePath()
        if (!fs.existsSync(dbPath)) return null

        let db: Database.Database | null = null
        try {
            db = new Database(dbPath, { readonly: true, fileMustExist: true })
            const row = db.prepare('SELECT key FROM depot_keys WHERE id = ?').get(appId) as { key: string } | undefined
            const key = row?.key || ''
            if (!/^[0-9a-fA-F]{64}$/.test(key)) return null
            return key.toLowerCase()
        } catch (e: any) {
            return null
        } finally {
            try { db?.close() } catch {}
        }
    }

    // ================= [ 部署后注入（TitanProtocol.deploy 成功路径转发，同步速返）] =================

    static applyToDeploy(steamPath: string, appId: string, _engine: 'ost' | 'st' = 'ost'): void {
        try {
            const key = this.getKey(appId)
            if (!key) return

            const pluginDirName = 'lua'
            const luaPath = path.join(ModeSwitchService.getActiveRoot(steamPath), 'config', pluginDirName, `${appId}.lua`)
            if (!fs.existsSync(luaPath)) return

            const lines = fs.readFileSync(luaPath, 'utf-8').split(/\r?\n/)
            // 纯行正则容忍行尾注释（如 `addappid(233450) -- Prison Architect`），注释原样保留
            const plainRe = new RegExp(`^(\\s*)addappid\\(\\s*${appId}\\s*\\)(\\s*(?:--.*)?)$`)
            const keyedRe = new RegExp(`^\\s*addappid\\(\\s*${appId}\\s*,`)

            let alreadyKeyed = false
            let patched = false
            const out = lines.map(line => {
                if (line.trim().startsWith('--')) return line                    // 整行注释永不触碰
                if (keyedRe.test(line)) { alreadyKeyed = true; return line }     // 已带密钥，绝不重复写
                const m = line.match(plainRe)
                if (m) { patched = true; return `${m[1]}addappid(${appId}, 1, "${key}")${m[2]}` }
                return line
            })

            if (patched) {
                fs.writeFileSync(luaPath, out.join('\n'), 'utf-8')
            }
        } catch {}
    }

    // ================= [ 启动 +2min 版号比对与静默全量更新 ] =================

    static async syncIfNeeded(): Promise<void> {
        try {
            const serverUrl = Db.get<any>('app_seed_config')?.serverUrl
            if (!serverUrl || !DEPOT_SECRET) return

            const res = await titanFetch(`${serverUrl}/titan/depotkey.php?action=version`, {
                headers: {
                    'User-Agent': 'TitanCore/2.0',
                    'X-Titan-Depot': DEPOT_SECRET
                }
            })
            if (!res.ok) return

            const json = await res.json() as {
                code?: number
                data?: { version?: string; file?: string; size?: number; sha1?: string; token?: string; exp?: number }
            }
            if (json.code !== 200 || !json.data?.version || !json.data?.file || !json.data?.token || !json.data?.exp) return

            const remoteVersion = String(json.data.version)
            if (Db.get<string>(VERSION_KEY) === remoteVersion) return

            // 下载 URL 由服务端版号接口签发的短时令牌构造，非永久直链
            const downloadUrl = `${serverUrl}/titan/depotkey.php?action=download` +
                `&f=${encodeURIComponent(json.data.file)}` +
                `&t=${encodeURIComponent(json.data.token)}` +
                `&e=${json.data.exp}`

            await this.downloadAndReplace(
                downloadUrl,
                json.data.size || 0,
                (json.data.sha1 || '').toLowerCase(),
                remoteVersion
            )
            Db.set(VERSION_KEY, remoteVersion)
        } catch {}
    }

    private static async downloadAndReplace(url: string, expectedSize: number, expectedSha1: string, version: string): Promise<void> {
        const tmpDir = this.tempRoot()
        const zipPath = path.join(tmpDir, 'depot_keys.zip')
        const extractDir = path.join(tmpDir, 'extract')

        if (fs.existsSync(zipPath)) try { fs.unlinkSync(zipPath) } catch {}
        if (fs.existsSync(extractDir)) try { fs.rmSync(extractDir, { recursive: true, force: true }) } catch {}

        try {
            // ① 下载（带版号 cache-buster）
            await this.downloadFile(url, zipPath, version)

            // ② 校验 ZIP 本体的体积与 SHA1（与服务端 PHP 的计算对象一致：zip 文件）
            const zipStat = fs.statSync(zipPath)
            if (expectedSize > 0 && zipStat.size !== expectedSize) {
                throw new Error(`zip 体积校验失败: ${zipStat.size} != ${expectedSize}`)
            }
            if (expectedSha1) {
                const zipSha1 = crypto.createHash('sha1').update(fs.readFileSync(zipPath)).digest('hex')
                if (zipSha1 !== expectedSha1) throw new Error('zip SHA1 校验失败')
            }

            // ③ 解压并定位 db
            await ArchiveService.extract(zipPath, extractDir)
            const found = this.findDbFile(extractDir)
            if (!found) throw new Error('压缩包内未找到 depot_keys.db')

            // ④ 校验 db 的 SQLite 魔数（防 zip 内被塞入非 db 文件）
            const fd = fs.openSync(found, 'r')
            const magic = Buffer.alloc(16)
            fs.readSync(fd, magic, 0, 16, 0)
            fs.closeSync(fd)
            if (magic.toString('latin1') !== 'SQLite format 3\0') {
                throw new Error('解压产物非有效 SQLite 数据库')
            }

            // ⑤ 原子替换：查询均为短连接，此刻无句柄占用；rename 覆盖已有文件
            fs.renameSync(found, this.dbFilePath())
        } finally {
            if (fs.existsSync(zipPath)) try { fs.unlinkSync(zipPath) } catch {}
            if (fs.existsSync(extractDir)) try { fs.rmSync(extractDir, { recursive: true, force: true }) } catch {}
        }
    }

    // 下载模式照抄 TitanProtocol.downloadStream：流式 + 静默超时 + PK 头校验
    private static async downloadFile(url: string, dest: string, version: string): Promise<void> {
        const sep = url.includes('?') ? '&' : '?'
        const response = await axios({
            url: `${url}${sep}v=${encodeURIComponent(version)}`,
            method: 'GET',
            responseType: 'stream',
            timeout: 30000,
            maxRedirects: 5,
            // R53: download 请求必须带 X-Titan-Depot —— depotkey.php 第一层密钥校验对全部 action 生效, 缺失即 403
            headers: { 'User-Agent': 'TitanCore/2.0', 'X-Titan-Depot': DEPOT_SECRET },
            validateStatus: () => true
        })
        if (response.status !== 200) throw new Error(`HTTP ${response.status}`)

        const writer = fs.createWriteStream(dest)
        await new Promise<void>((resolve, reject) => {
            let settled = false
            const cleanup = () => {
                clearTimeout(idleTimer)
                try { response.data.destroy() } catch {}
                try { writer.destroy() } catch {}
            }
            const fail = (err: any) => {
                if (settled) return; settled = true; cleanup(); reject(err)
            }
            const idleTimer = setTimeout(() => fail(new Error('下载流静默超时')), IDLE_TIMEOUT_MS)

            response.data.on('data', () => {
                clearTimeout(idleTimer)
                idleTimer.refresh()
            })
            response.data.on('error', fail)
            writer.on('error', fail)
            response.data.pipe(writer)
            writer.on('close', () => {
                if (settled) return; settled = true; clearTimeout(idleTimer); resolve()
            })
        })

        const fd = fs.openSync(dest, 'r')
        const head = Buffer.alloc(2)
        fs.readSync(fd, head, 0, 2, 0)
        fs.closeSync(fd)
        if (!(head[0] === 0x50 && head[1] === 0x4B)) throw new Error('下载内容非有效 zip')
    }

    // zip 内无论是否套了一层目录，递归定位 db 文件
    private static findDbFile(dir: string): string | null {
        if (!fs.existsSync(dir)) return null
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name)
            if (entry.isDirectory()) {
                const found = this.findDbFile(full)
                if (found) return found
            } else if (entry.name === DB_FILE_NAME) {
                return full
            }
        }
        return null
    }
}
