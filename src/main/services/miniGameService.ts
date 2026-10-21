/**
 * MiniGameService - 小游戏本地持久化与积分服务层
 * 
 * 职责:
 *   1. localStorage 统一前缀存档管理 (tc_minigame_)
 *   2. Session 积分管理（内存）+ 今日累计积分持久化
 *   3. claim 结算：10000 积分 = 1 CORE
 */

const PREFIX = 'tc_minigame_'
const SCORE_KEY = PREFIX + 'score'

interface ScoreRecord {
  totalScore: number
  lastDate: string
}

// ============ 内部工具 ============

function getToday(): string {
  return new Date().toISOString().slice(0, 10)
}

function readScoreRecord(): ScoreRecord {
  try {
    const raw = localStorage.getItem(SCORE_KEY)
    if (raw) return JSON.parse(raw) as ScoreRecord
  } catch (e) {
    console.error('[MiniGameService] 读分失败:', e)
  }
  return { totalScore: 0, lastDate: getToday() }
}

function writeScoreRecord(rec: ScoreRecord): void {
  try {
    localStorage.setItem(SCORE_KEY, JSON.stringify(rec))
  } catch (e) {
    console.error('[MiniGameService] 写分失败:', e)
  }
}

// ============ Session 积分（内存，当前游戏局） ============

let sessionScore = 0

export function addSessionScore(delta: number): void {
  if (delta <= 0) return
  sessionScore += delta
}

export function getSessionScore(): number {
  return sessionScore
}

export function resetSessionScore(): void {
  sessionScore = 0
}

// ============ 今日累计积分（localStorage，每日清空） ============

/**
 * 检查并执行每日清空
 * @returns 当前有效的 ScoreRecord
 */
export function checkDailyReset(): ScoreRecord {
  const rec = readScoreRecord()
  const today = getToday()
  if (rec.lastDate !== today) {
    rec.totalScore = 0
    rec.lastDate = today
    writeScoreRecord(rec)
  }
  return rec
}

/** 获取今日累计积分（自动检查日期） */
export function getTotalScore(): number {
  return checkDailyReset().totalScore
}

/** 获取最后记录日期 */
export function getLastDate(): string {
  return checkDailyReset().lastDate
}

// ============ 结算 ============

/**
 * 结算当前 session 积分：
 *   - 按 10000:1 换算 CORE
 *   - 累加到今日 totalScore 并持久化
 *   - 清空 sessionScore
 * 
 * @returns 兑换出的 cores 数量，以及消耗的原始积分
 */
export function claim(): { cores: number; scoreConsumed: number } {
  const score = sessionScore
  if (score <= 0) {
    return { cores: 0, scoreConsumed: 0 }
  }

  const cores = Math.floor(score / 10000)

  // 累加到今日 totalScore
  const rec = checkDailyReset()
  rec.totalScore += score
  writeScoreRecord(rec)

  sessionScore = 0
  return { cores, scoreConsumed: score }
}

// ============ 存档管理（统一前缀 tc_minigame_） ============

export function save(gameId: string, data: any): void {
  try {
    localStorage.setItem(PREFIX + gameId, JSON.stringify(data))
  } catch (e) {
    console.error(`[MiniGameService] 存档失败 [${gameId}]:`, e)
  }
}

export function load(gameId: string): any {
  try {
    const raw = localStorage.getItem(PREFIX + gameId)
    if (raw) return JSON.parse(raw)
  } catch (e) {
    console.error(`[MiniGameService] 读档失败 [${gameId}]:`, e)
  }
  return null
}

export function deleteSave(gameId: string): void {
  localStorage.removeItem(PREFIX + gameId)
}

export function clearAll(): void {
  const keysToDelete: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && key.startsWith(PREFIX)) {
      keysToDelete.push(key)
    }
  }
  keysToDelete.forEach(k => localStorage.removeItem(k))
}

// ============ 兼容迁移 ============

/**
 * 将旧版存档迁移到统一前缀体系
 * @param oldKey 旧 localStorage key
 * @param gameId 新 gameId（如 'stack'）
 * @returns 是否成功迁移
 */
export function migrateLegacySave(oldKey: string, gameId: string): boolean {
  const raw = localStorage.getItem(oldKey)
  if (raw) {
    try {
      save(gameId, JSON.parse(raw))
      localStorage.removeItem(oldKey)
      console.log(`[MiniGameService] 存档已迁移: ${oldKey} → ${PREFIX}${gameId}`)
      return true
    } catch (e) {
      console.error(`[MiniGameService] 迁移失败 [${oldKey}]:`, e)
    }
  }
  return false
}
