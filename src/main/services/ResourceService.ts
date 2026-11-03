// 文件名: src/main/services/ResourceService.ts
import { Db } from '../db'

export class ResourceService {
  static getDiscoveryList(tabId: string): any[] {
    try {
      let sql = `SELECT * FROM titan_resources WHERE status = 'active' AND (hide_in_main IS NULL OR hide_in_main = 0)`
      const params: any[] = []

      if (tabId === 'titan_protocol') {
        sql += ` AND (type = 'titan_protocol' OR type = 'notice')`
      } else if (tabId !== 'all' && tabId !== 'nexus_gate') {
        sql += ` AND (type = ? OR type = 'notice')`
        params.push(tabId)
      }
      
      sql += ` ORDER BY updated_at DESC`
      
      const rows = Db.query<any>(sql, params)

      // 【核心升级】：合集封面 100% 自动继承首条子项封面图，绝不出现空白底图
      for (const row of rows) {
        if (row.type === 'collection' && (!row.cover || row.cover.trim() === '')) {
          let childIds: string[] = []
          try {
            if (row.collection_ids) {
              childIds = JSON.parse(row.collection_ids)
            }
          } catch {}
          if ((!childIds || childIds.length === 0) && row.meta_json) {
            try {
              const meta = JSON.parse(row.meta_json)
              childIds = meta.collection_ids || []
            } catch {}
          }

          if (Array.isArray(childIds) && childIds.length > 0) {
            const firstId = String(childIds[0])
            const numMatch = firstId.match(/\d+/)
            if (numMatch) {
              row.cover = `${process.env.TITAN_NODE_2 || ''}/titan/cover_gateway.php?id=${numMatch[0]}`
            } else {
              const childRow = Db.query<any>(`SELECT cover, target_id FROM titan_resources WHERE id = ? LIMIT 1`, [firstId])[0]
              if (childRow?.cover) {
                row.cover = childRow.cover
              } else if (childRow?.target_id) {
                row.cover = `${process.env.TITAN_NODE_2 || ''}/titan/cover_gateway.php?id=${childRow.target_id}`
              }
            }
          }
        }
      }

      return rows
    } catch (e) {
      console.error('[ResourceService] getDiscoveryList Error:', e)
      return []
    }
  }

  static getCollectionChildren(collectionId: string): any[] {
    try {
      if (!collectionId) return []

      const collectionRows = Db.query<any>(
        `SELECT meta_json, collection_ids FROM titan_resources WHERE id = ? AND type = 'collection' AND status = 'active'`,
        [collectionId]
      )
      if (!collectionRows || collectionRows.length === 0) return []

      let childIds: string[] = []
      try {
        if (collectionRows[0].collection_ids) {
          childIds = JSON.parse(collectionRows[0].collection_ids)
        }
      } catch {}

      if ((!childIds || childIds.length === 0) && collectionRows[0].meta_json) {
        try {
          const meta = JSON.parse(collectionRows[0].meta_json || '{}')
          childIds = meta.collection_ids || []
        } catch {}
      }

      if (!Array.isArray(childIds) || childIds.length === 0) return []

      // 构建全量候选键（兼容纯数字 AppID 与 steam_gate_ 前缀）
      const candidateKeys: string[] = []
      for (const id of childIds) {
        const strId = String(id).trim()
        if (!strId) continue
        candidateKeys.push(strId)
        if (strId.startsWith('steam_gate_')) {
          candidateKeys.push(strId.replace(/^steam_gate_/, ''))
        } else if (/^\d+$/.test(strId)) {
          candidateKeys.push(`steam_gate_${strId}`)
        }
      }
      const uniqueKeys = Array.from(new Set(candidateKeys))
      if (uniqueKeys.length === 0) return []

      const placeholders = uniqueKeys.map(() => '?').join(',')
      const sql = `SELECT * FROM titan_resources WHERE (id IN (${placeholders}) OR target_id IN (${placeholders})) AND status = 'active'`
      const rows = Db.query<any>(sql, [...uniqueKeys, ...uniqueKeys])

      const rowMap = new Map<string, any>()
      for (const row of rows) {
        if (row.id) {
          rowMap.set(row.id, row)
          if (row.id.startsWith('steam_gate_')) {
            rowMap.set(row.id.replace(/^steam_gate_/, ''), row)
          }
        }
        if (row.target_id) {
          rowMap.set(String(row.target_id), row)
          rowMap.set(`steam_gate_${row.target_id}`, row)
        }
      }

      const ordered: any[] = []
      for (const id of childIds) {
        const strId = String(id)
        const numMatch = strId.match(/\d+/)
        const rawAppId = numMatch ? numMatch[0] : ''

        const row = rowMap.get(strId) || 
                    (rawAppId ? rowMap.get(`steam_gate_${rawAppId}`) : null) || 
                    (rawAppId ? rowMap.get(rawAppId) : null)

        if (row) {
          // 若子项 cover 为空，智能穿透补齐为网关 WebP 地址
          if (!row.cover || row.cover.trim() === '') {
            const appId = row.target_id || rawAppId
            if (appId) {
              row.cover = `${process.env.TITAN_NODE_2 || ''}/titan/cover_gateway.php?id=${appId}`
            }
          }
          ordered.push(row)
        } else {
          // 【核心升级】：未单独发布的 AppID 虚拟就绪机制，合集绝不吞掉未发布游戏
          if (rawAppId) {
            ordered.push({
              id: `steam_gate_${rawAppId}`,
              type: 'titan_protocol',
              title: `Steam App (${rawAppId})`,
              cover: `${process.env.TITAN_NODE_2 || ''}/titan/cover_gateway.php?id=${rawAppId}`,
              target_id: rawAppId,
              status: 'active',
              tags: 'STEAM,AUTO',
              rating: 9.8,
              desc: `Steam AppID: ${rawAppId} (合集收录未发布资源)`
            })
          }
        }
      }

      return ordered
    } catch (e) {
      console.error('[ResourceService] getCollectionChildren Error:', e)
      return []
    }
  }
}
