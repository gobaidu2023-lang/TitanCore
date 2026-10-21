// packs.ts 巴达布前哨 - 卡包与卡池系统（六包独立权重、主意低高阶分级、未拥有主意优先、平民保底）
import { RecipeDef } from './types'

export interface PackConfig {
  id: string
  name: string
  subName: string
  price: number
  cardCount: number
  color: number
  borderColor: number
  fixedCards?: string[] // 固定卡池（如新手包）
}

export const PACK_CONFIGS: Record<string, PackConfig> = {
  pack_starter: {
    id: 'pack_starter',
    name: '新手补给包',
    subName: 'STARTER',
    price: 0,
    cardCount: 12,
    color: 0x0f766e,
    borderColor: 0x2dd4bf,
    // [新手引导] 固定卡序：支撑任务链1~8（建材走任务6奖励），+2阿肯果丛保早期采集点，+2苦根保首次年末口粮，不再内嵌拓荒包（防跳过任务6）
    fixedCards: [
      'civilian', 'civilian',
      'scrap_heap',
      'alien_orchard', 'alien_orchard',
      'scrap_material', 'scrap_material',
      'coin', 'coin', 'coin',
      'bitterroot', 'bitterroot'
    ]
  },
  pack_pioneer: {
    id: 'pack_pioneer',
    name: '拓荒补给包',
    subName: 'PIONEER',
    price: 3,
    cardCount: 3,
    color: 0x1e293b,
    borderColor: 0x38bdf8
  },
  pack_blueprints: {
    id: 'pack_blueprints',
    name: '技术图纸包',
    subName: 'BLUEPRINTS',
    price: 4,
    cardCount: 4,
    color: 0x1e1b4b,
    borderColor: 0x818cf8
  },
  pack_supplies: {
    id: 'pack_supplies',
    name: '荒野给养包',
    subName: 'SUPPLIES',
    price: 10,
    cardCount: 4,
    color: 0x14532d,
    borderColor: 0x4ade80
  },
  pack_industry: {
    id: 'pack_industry',
    name: '工业与发展',
    subName: 'INDUSTRY',
    price: 15,
    cardCount: 4,
    color: 0x7c2d12,
    borderColor: 0xfb923c
  },
  pack_ruins: {
    id: 'pack_ruins',
    name: '失落遗迹包',
    subName: 'RUINS',
    price: 20,
    cardCount: 4,
    color: 0x581c87,
    borderColor: 0xc084fc
  },
  pack_armory: {
    id: 'pack_armory',
    name: '军械密档包',
    subName: 'ARMORY',
    price: 20,
    cardCount: 4,
    color: 0x881337,
    borderColor: 0xf43f5e
  }
}

export interface PackGenerationContext {
  breedableCount: number      // 场上存活的可繁衍人口（平民/辅助军/邪教徒）
  ourUnitsCount: number       // 场上我方存活人口总数
  pioneerPityCounter: number  // 拓荒包未出平民计数器
  monthsElapsed: number       // 已流逝星际年（batch14：前3年卡包怪带不生效，第4年起可出）
  unlockedRecipes: Set<string>
  allRecipes: RecipeDef[]
}

// ================= 主意分级表（低阶/高阶） =================
// 基于 recipes.ts 事实 ID 建表；主意卡 ID = idea_<recipeId>
// 注：factory_plate / factory_prefab（自动化板材/构件）文档未明确定级，暂归 B 加工低阶
const LOW_TIER_RECIPES = [
  // B 加工合成类（低阶）
  'craft_parts', 'craft_plate', 'craft_prefab', 'factory_plate', 'factory_prefab', 'craft_herb_patch',
  // C 装备类（低阶）
  'craft_scrap_club', 'craft_laser_rifle', 'craft_void_suit', 'craft_execution_blade', 'craft_diagnostor', 'craft_assassin_gear',
  // D 转职类（均为低阶）
  'promote_auxilia', 'promote_sister', 'promote_librarian', 'promote_assassin', 'transform_astartes',
  // E 人口类（低阶）
  'breed_baby',
  // F 建筑类（低阶）
  'build_hive_city', 'build_shed', 'build_warehouse', 'build_coin_chest', 'build_black_market',
  'build_recycling_plant', 'build_excavation_tower', 'build_mining_rig', 'build_furnace', 'build_aberrant_farmland',
  'build_materials_factory', 'build_weapon_workshop', 'build_food_processor',
  // G 烹饪类（低阶）
  'cook_steak', 'cook_porridge', 'cook_squig_stew', 'cook_corpse_starch',
  // H 特殊/功能类（均为低阶）
  'cremate_corpse', 'cremate_astartes', 'make_pipes', 'clone_gene_seed', 'salvage_astartes',
  'purify_cultist'
]

const HIGH_TIER_RECIPES = [
  // B 加工合成类（高阶）
  'smelt_refined_metal', 'smelt_high_alloy', 'craft_circuit',
  // C 装备类（高阶）
  'craft_power_armor',
  // C2 活体摘取（batch19：军械密档/遗迹包主意位可开出，中间档位不卡进程）
  'harvest_gene_seed',
  // F 建筑类（高阶）
  'build_food_refinery', 'build_mess_hall', 'build_breeding_farm', 'build_gene_vat', 'build_rift_beacon',
  // G 烹饪类（高阶）
  'cook_risotto', 'cook_wilderness_stew',
  // U 结局仪式（高阶）
  'summon_greater_demon_boss'
]

/** 等权随机抽取 */
function pickUniform(pool: string[]): string {
  return pool[Math.floor(Math.random() * pool.length)]
}

/** batch62：保底专用——从全部低阶+高阶未拥有主意中均匀抽取（全解锁则 null） */
export function rollAnyUnownedIdea(unlocked: Set<string>): string | null {
  const pool = [...LOW_TIER_RECIPES, ...HIGH_TIER_RECIPES].filter(id => !unlocked.has(id))
  if (pool.length === 0) return null
  return `idea_${pool[Math.floor(Math.random() * pool.length)]}`
}

/** 从未拥有的主意中抽取一张（优先未拥有）；池空返回 null */
function rollUnownedIdea(unlocked: Set<string>, pool: string[]): string | null {
  const unowned = pool.filter(id => !unlocked.has(id))
  if (unowned.length === 0) return null
  return `idea_${unowned[Math.floor(Math.random() * unowned.length)]}`
}

/** 生成一个卡包内将要逐张弹出的卡牌数组 */
export function generatePackCards(
  packId: string,
  ctx: PackGenerationContext
): { cards: string[]; nextPity: number } {
  const cfg = PACK_CONFIGS[packId]
  if (!cfg) return { cards: ['scrap_material'], nextPity: ctx.pioneerPityCounter }

  // 1. 新手包：固定卡序
  if (cfg.fixedCards) {
    return { cards: [...cfg.fixedCards], nextPity: ctx.pioneerPityCounter }
  }

  const result: string[] = []
  let nextPity = ctx.pioneerPityCounter
  const unlocked = ctx.unlockedRecipes

  // 2. 拓荒补给包（3 抽，每抽独立 roll）：点位60 / 物资30 / 敌对海盗8 / 低阶主意2
  if (packId === 'pack_pioneer') {
    // 平民三档保底（基线铁律，额外插卡不占抽数）：防死档、护开荒
    let mustCivilian = false

    if (ctx.ourUnitsCount > 0 && ctx.breedableCount === 0) {
      // 档位1：存活但可繁衍=0，每包必出平民
      mustCivilian = true
    } else if (ctx.breedableCount === 1) {
      // 档位2：可繁衍=1，高概率且 7 包硬保底
      nextPity++
      if (nextPity >= 7 || Math.random() < 0.4) {
        mustCivilian = true
        nextPity = 0
      }
    } else if (ctx.breedableCount >= 4) {
      // 档位3a：可繁衍>=4（人口过剩），平民概率压至 2%——玩家应自行繁育（batch14 裁定）
      if (Math.random() < 0.02) mustCivilian = true
    } else if (ctx.breedableCount >= 2) {
      // 档位3b：可繁衍2~3，基础概率无保底
      if (Math.random() < 0.15) mustCivilian = true
    }

    if (mustCivilian) {
      result.push('civilian')
    }

    const nodePool = ['scrap_heap', 'rubble_pile']
    const matPool = ['substrate', 'scrap_material', 'stone', 'bitterroot']

    for (let i = 0; i < cfg.cardCount; i++) {
      const r = Math.random()
      if (r < 0.60) {
        result.push(pickUniform(nodePool))
      } else if (r < 0.90) {
        result.push(pickUniform(matPool))
      } else if (r < 0.98) {
        // batch19：拓荒包（新手补给包）海盗纳入前 3 年保护期闸门（batch14 闸门漏挂此包）
        result.push(ctx.monthsElapsed >= 4 ? 'space_pirate' : pickUniform(matPool))
      } else {
        result.push(rollUnownedIdea(unlocked, LOW_TIER_RECIPES) ?? pickUniform(matPool))
      }
    }

    return { cards: result, nextPity }
  }

  // 3. 技术图纸包（4 抽 + 独立平民 roll）：点位45 / 物资35 / 低阶主意15
  if (packId === 'pack_blueprints') {
    const nodePool = ['scrap_heap', 'rubble_pile']
    const matPool = ['thermonuclear_battery', 'scrap_material', 'stone', 'bitterroot', 'parts', 'titanium_ore']

    for (let i = 0; i < cfg.cardCount; i++) {
      const r = Math.random()
      if (r < 0.35) {
        result.push(pickUniform(nodePool))
      } else if (r < 0.70) {
        result.push(pickUniform(matPool))
      } else if (r < 0.75) {
        result.push(ctx.monthsElapsed >= 4 ? 'cultist' : pickUniform(matPool))
      } else if (r < 0.80) {
        result.push(ctx.monthsElapsed >= 4 ? 'space_pirate' : pickUniform(matPool))
      } else {
        result.push(rollUnownedIdea(unlocked, LOW_TIER_RECIPES) ?? pickUniform(matPool))
      }
    }

    // 独立平民 roll（不占抽数、每包限 1）：可繁衍人口 <2 时 80% 保开荒，否则 5% 防泛滥
    const civChance = ctx.breedableCount < 2 ? 0.8 : (ctx.breedableCount >= 4 ? 0.01 : 0.05)
    if (Math.random() < civChance) {
      result.push('civilian')
    }

    return { cards: result, nextPity }
  }

  // 4. 荒野给养包（4 抽）：节点50%（真菌/苦根/果丛/穗丛各12.5%）/ 食材25%（生肉/奶/浆果/谷穗/基质各5%）/ 格罗克斯兽10% / 低阶烹饪主意5% / 高阶烹饪主意5% / 成品菜肴5%
  if (packId === 'pack_supplies') {
    const nodePool = ['squig_meatball', 'bitterroot', 'alien_orchard', 'mutant_farmland']
    const matPool = ['grox_meat', 'grox_milk', 'arken_berry', 'thorn_grain', 'substrate']
    const dishPool = ['grox_steak', 'bitterroot_porridge', 'squig_stew', 'grox_risotto', 'wilderness_stew', 'corpse_starch']
    const lowCookIdeas = ['cook_steak', 'cook_porridge', 'cook_squig_stew', 'cook_corpse_starch']
    const highCookIdeas = ['cook_risotto', 'cook_wilderness_stew']

    for (let i = 0; i < cfg.cardCount; i++) {
      const r = Math.random()
      if (r < 0.40) {
        result.push(pickUniform(nodePool))
      } else if (r < 0.65) {
        result.push(pickUniform(matPool))
      } else if (r < 0.75) {
        result.push(ctx.monthsElapsed >= 4 ? 'snotling' : pickUniform(matPool))
      } else if (r < 0.85) {
        result.push('grox')
      } else if (r < 0.90) {
        result.push(rollUnownedIdea(unlocked, lowCookIdeas) ?? pickUniform(dishPool))
      } else if (r < 0.95) {
        result.push(rollUnownedIdea(unlocked, highCookIdeas) ?? pickUniform(dishPool))
      } else {
        result.push(pickUniform(dishPool))
      }
    }

    return { cards: result, nextPity }
  }

  // 5. 工业与发展包（4 抽）：点位30 / 合成材料20 / B+F 低阶主意20 / B+F 高阶主意20 / 黑石+高阶合金10
  if (packId === 'pack_industry') {
    const nodePool = ['titanium_vein', 'scrap_heap', 'rubble_pile']
    const matPool = ['scrap_material', 'stone', 'parts', 'thermonuclear_battery', 'titanium_ore', 'plate', 'prefab', 'refined_metal', 'circuit']
    const lowIdeaPool = LOW_TIER_RECIPES.filter(id => id.startsWith('craft_') || id.startsWith('factory_') || id.startsWith('build_'))
    const highIdeaPool = HIGH_TIER_RECIPES.filter(id => id.startsWith('smelt_') || id === 'craft_circuit' || id.startsWith('build_'))
    const rarePool = ['blackstone', 'high_alloy']

    for (let i = 0; i < cfg.cardCount; i++) {
      const r = Math.random()
      if (r < 0.25) {
        result.push(pickUniform(nodePool))
      } else if (r < 0.45) {
        result.push(pickUniform(matPool))
      } else if (r < 0.65) {
        result.push(rollUnownedIdea(unlocked, lowIdeaPool) ?? pickUniform(matPool))
      } else if (r < 0.80) {
        result.push(rollUnownedIdea(unlocked, highIdeaPool) ?? pickUniform(rarePool))
      } else if (r < 0.85) {
        result.push(ctx.monthsElapsed >= 4 ? 'cultist' : pickUniform(matPool))
      } else if (r < 0.90) {
        result.push(ctx.monthsElapsed >= 4 ? 'expedition_trooper' : pickUniform(matPool))
      } else {
        result.push(pickUniform(rarePool))
      }
    }

    return { cards: result, nextPity }
  }

  // 6. 失落遗迹包（按包结构化：必出 1 地图 + 1 怪物 + 2 资源，资源池含想法位）
  if (packId === 'pack_ruins') {
    const mapPool = ['alien_forest', 'battlefield_planet', 'pirate_mothership', 'warp_rift']
    // 注：设计文档怪物池含"敌对辅助军"，但 cards.ts 无此卡牌，未编造，暂用现有 4 种
    const monsterPool = ['corpse_mutant', 'space_pirate', 'ork_boy', 'warp_imp']
    const resPool = ['scrap_heap', 'rubble_pile', 'substrate', 'thermonuclear_battery', 'scrap_material', 'stone', 'parts', 'refined_metal', 'plate', 'circuit', 'prefab', 'grox_milk', 'arken_berry', 'thorn_grain', 'bitterroot', 'squig_meatball', 'blackstone', 'titanium_ore', 'idea_slot']
    const resNoIdea = resPool.filter(id => id !== 'idea_slot')

    result.push(pickUniform(mapPool))
    result.push(pickUniform(monsterPool))

    for (let i = 0; i < 2; i++) {
      const c = pickUniform(resPool)
      if (c === 'idea_slot') {
        // 想法位：低阶 70% / 高阶 30%；全拥有则退回普通资源
        const idea = Math.random() < 0.7
          ? rollUnownedIdea(unlocked, LOW_TIER_RECIPES)
          : rollUnownedIdea(unlocked, HIGH_TIER_RECIPES)
        result.push(idea ?? pickUniform(resNoIdea))
      } else {
        result.push(c)
      }
    }

    // 打乱四张出场顺序
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      const tmp = result[i]
      result[i] = result[j]
      result[j] = tmp
    }

    return { cards: result, nextPity }
  }

  // 7. 军械密档包（4 抽）：C低+D低+H低主意20 / C高+U结局高主意30 / 低阶装备20 / 高阶装备20 / 动力甲5 / 黑石+基因种子5
  if (packId === 'pack_armory') {
    const lowIdeaPool = LOW_TIER_RECIPES.filter(id =>
      id.startsWith('craft_') || id.startsWith('promote_') || id.startsWith('transform_') ||
      id.startsWith('breed_') || id.startsWith('cremate_') || id.startsWith('make_') ||
      id.startsWith('clone_') || id.startsWith('salvage_'))
    const highIdeaPool = HIGH_TIER_RECIPES.filter(id => id === 'craft_power_armor' || id === 'summon_greater_demon_boss')
    const lowGearPool = ['scrap_club', 'laser_rifle', 'void_suit']
    const highGearPool = ['execution_blade', 'diagnostor', 'assassin_gear']
    const rarePool = ['blackstone', 'gene_seed']

    // A1：怪物15%带内权重六档（军阀2/小子3/敌辅3/敌阿2/小恶魔2/海盗3，权重合计15=带内份额）
    const monsterBand = [
      { id: 'warboss', w: 2 }, { id: 'ork_boy', w: 3 }, { id: 'expedition_trooper', w: 3 },
      { id: 'enemy_astartes', w: 2 }, { id: 'warp_imp', w: 2 }, { id: 'space_pirate', w: 3 }
    ]
    const monsterTotalW = monsterBand.reduce((s, m) => s + m.w, 0)

    for (let i = 0; i < cfg.cardCount; i++) {
      const r = Math.random()
      if (r < 0.15) {
        result.push(rollUnownedIdea(unlocked, lowIdeaPool) ?? pickUniform(lowGearPool))
      } else if (r < 0.40) {
        result.push(rollUnownedIdea(unlocked, highIdeaPool) ?? pickUniform(highGearPool))
      } else if (r < 0.60) {
        result.push(pickUniform(lowGearPool))
      } else if (r < 0.75) {
        result.push(pickUniform(highGearPool))
      } else if (r < 0.80) {
        result.push('power_armor')
      } else if (r < 0.85) {
        result.push(pickUniform(rarePool))
      } else {
        if (ctx.monthsElapsed < 4) {
          result.push(pickUniform(rarePool))
        } else {
        let roll = Math.floor(Math.random() * monsterTotalW)
        let pickM = monsterBand[0].id
        for (const m of monsterBand) {
          if (roll < m.w) { pickM = m.id; break }
          roll -= m.w
        }
        result.push(pickM)
        }
      }
    }

    return { cards: result, nextPity }
  }

  return { cards: ['scrap_material'], nextPity }
}