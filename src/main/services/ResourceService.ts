// 文件名: src/main/services/ResourceService.ts
import { Db } from '../db'

export class ResourceService {
  static getDiscoveryList(tabId: string): any[] {
    try {
      let sql = `SELECT * FROM titan_resources WHERE status = 'active' AND (hide_in_main IS NULL OR hide_in_main = 0)`
      const params: any[] = []

      if (tabId === 'titan_protocol') {
        sql += ` AND type = 'titan_protocol'`
      } else if (tabId !== 'all' && tabId !== 'nexus_gate') {
        sql += ` AND type = ?`
        params.push(tabId)
      }
      
      sql += ` ORDER BY updated_at DESC`
      
      const rows = Db.query(sql, params)

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
        `SELECT meta_json FROM titan_resources WHERE id = ? AND type = 'collection' AND status = 'active'`,
        [collectionId]
      )
      if (!collectionRows || collectionRows.length === 0) return []

      let meta: any = {}
      try {
        meta = JSON.parse(collectionRows[0].meta_json || '{}')
      } catch {
        return []
      }

      const childIds: string[] = meta.collection_ids || []
      if (!Array.isArray(childIds) || childIds.length === 0) return []

      const placeholders = childIds.map(() => '?').join(',')
      const sql = `SELECT * FROM titan_resources WHERE id IN (${placeholders}) AND status = 'active'`
      const rows = Db.query<any>(sql, childIds)

      const rowMap = new Map<string, any>()
      for (const row of rows) {
        rowMap.set(row.id, row)
      }

      const ordered: any[] = []
      for (const id of childIds) {
        const row = rowMap.get(id)
        if (row) ordered.push(row)
      }

      return ordered
    } catch (e) {
      console.error('[ResourceService] getCollectionChildren Error:', e)
      return []
    }
  }
}