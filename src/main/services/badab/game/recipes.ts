// recipes.ts 巴达布前哨 - 合成与探索远征全量配方表（含资源点燃料规则放行与劳动力槽通配）
import { RecipeDef } from './types'
import { getDef } from './cards'


// ================= 劳动力槽通配（一号裁定口径） =================
// 六类成年单位为劳动力：可顶替配方中未消耗声明的 civilian 工位；婴儿/邪教徒/格罗克斯兽不是劳动力
const LABOR_IDS = ['civilian', 'auxilia', 'battle_sister', 'private_librarian', 'private_assassin', 'astartes']
function reqHasCivilian(inputs: Record<string, number>): boolean {
  return (inputs['civilian'] || 0) > 0
}
function isLaborCard(cardId: string): boolean {
  try {
    return !!getDef(cardId).isLabor
  } catch {
    return false
  }
}

export const RECIPES: RecipeDef[] = [
  // ===================== 一、探索地点远征配方（地点 + 探索者 -> 异步读条结算） =====================
  {
    id: 'explore_alien_forest',
    name: '异形森林远征',
    baseTime: 60, // 默认 60s，阿斯塔特在引擎层单独特化为 40s
    inputs: { alien_forest: 1 },
    anyInputs: [{ options: ['civilian', 'auxilia', 'battle_sister', 'private_librarian', 'private_assassin', 'astartes'], count: 1 }],
    consumes: {},
    outputs: { bitterroot: 2, arken_berry: 1 },
    bonusOutputs: [{ cardId: 'underhive_pipes', chance: 0.2 }, { cardId: 'grox', chance: 0.15 }] // batch19：与 combat.ts 实结对齐
  },
  {
    id: 'explore_battlefield',
    name: '太空古战场远征',
    baseTime: 60,
    inputs: { battlefield_planet: 1 },
    anyInputs: [{ options: ['civilian', 'auxilia', 'battle_sister', 'private_librarian', 'private_assassin', 'astartes'], count: 1 }],
    consumes: {},
    outputs: { rubble_pile: 1, scrap_heap: 1, stone: 1 },
    bonusOutputs: [{ cardId: 'underhive_pipes', chance: 0.2 }] // batch19：与实结对齐（电池/零件为早期草稿残留）
  },
  {
    id: 'explore_mothership',
    name: '海盗母舰远征',
    baseTime: 60,
    inputs: { pirate_mothership: 1 },
    anyInputs: [{ options: ['civilian', 'auxilia', 'battle_sister', 'private_librarian', 'private_assassin', 'astartes'], count: 1 }],
    consumes: {},
    outputs: { coin: 1, refined_metal: 1, circuit: 1 },
    bonusOutputs: [{ cardId: 'gene_seed', chance: 0.1 }, { cardId: 'civilian', chance: 0.05 }] // batch19：与实结对齐
  },
  {
    id: 'explore_pipes',
    name: '地下管道网远征',
    baseTime: 60,
    inputs: { underhive_pipes: 1 },
    anyInputs: [{ options: ['civilian', 'auxilia', 'battle_sister', 'private_librarian', 'private_assassin', 'astartes'], count: 1 }],
    consumes: {},
    outputs: { parts: 1, blackstone: 1 },
    bonusOutputs: [{ cardId: 'warp_rift', chance: 0.25 }] // batch19：与实结对齐
  },

  // ===================== 二、正义线结局召唤仪式（信标 + 电池 + 裂隙口 -> 读条 -> 大魔 Boss） =====================
  {
    id: 'summon_greater_demon_boss',
    name: '锚定召唤',
    baseTime: 60,
    inputs: { rift_beacon: 1, warp_rift: 1, thermonuclear_battery: 5 },
    consumes: { rift_beacon: 1, thermonuclear_battery: 5 }, // 信标与电池消耗，裂隙卡保留（电池门槛由仪式函数实际执行，此处补录用于界面显示与雷达提示）
    outputs: {},
    needsUnlock: true
  },

  // ===================== 三、三大工业建筑无限开采工位 =====================
  {
    id: 'produce_scrap',
    name: '回收站分拣',
    baseTime: 20,
    inputs: { recycling_plant: 1 },
    anyInputs: [{ options: ['civilian', 'auxilia', 'battle_sister', 'private_librarian', 'private_assassin', 'astartes'], count: 1 }],
    consumes: {},
    outputs: { scrap_material: 1 },
    bonusOutputs: [{ cardId: 'parts', chance: 0.1 }],
    isInfiniteWorkstation: true
  },
  {
    id: 'produce_stone',
    name: '石料场凿采',
    baseTime: 20,
    inputs: { excavation_tower: 1 },
    anyInputs: [{ options: ['civilian', 'auxilia', 'battle_sister', 'private_librarian', 'private_assassin', 'astartes'], count: 1 }],
    consumes: {},
    outputs: { stone: 1 },
    bonusOutputs: [{ cardId: 'thermonuclear_battery', chance: 0.1 }],
    isInfiniteWorkstation: true
  },
  {
    id: 'produce_titanium',
    name: '采矿场开采',
    baseTime: 30,
    inputs: { mining_rig: 1 },
    anyInputs: [{ options: ['civilian', 'auxilia', 'battle_sister', 'private_librarian', 'private_assassin', 'astartes'], count: 1 }],
    consumes: {},
    outputs: { titanium_ore: 1 },
    bonusOutputs: [{ cardId: 'stone', chance: 0.1 }],
    isInfiniteWorkstation: true
  },

  // ===================== 四、原生点位采集 =====================
  { id: 'harvest_scrap', name: '拆解机械堆', baseTime: 6, inputs: { civilian: 1, scrap_heap: 1 }, outputs: { scrap_material: 1 }, bonusOutputs: [{ cardId: 'thermonuclear_battery', chance: 0.08 }], consumeSource: true, sourceId: 'scrap_heap' },
  { id: 'harvest_stone', name: '开采瓦砾', baseTime: 6, inputs: { civilian: 1, rubble_pile: 1 }, outputs: { stone: 1 }, consumeSource: true, sourceId: 'rubble_pile' },
  { id: 'harvest_orchard', name: '采集浆果', baseTime: 5, inputs: { civilian: 1, alien_orchard: 1 }, outputs: { arken_berry: 1 }, consumeSource: true, sourceId: 'alien_orchard' },
  { id: 'harvest_farmland', name: '收割谷穗', baseTime: 5, inputs: { civilian: 1, mutant_farmland: 1 }, outputs: { thorn_grain: 1 }, consumeSource: true, sourceId: 'mutant_farmland' },
  { id: 'harvest_titanium', name: '开采钛矿', baseTime: 12, inputs: { civilian: 1, titanium_vein: 1 }, outputs: { titanium_ore: 1 }, consumeSource: true, sourceId: 'titanium_vein' },
  { id: 'slaughter_grox', name: '鲜肉', baseTime: 4, inputs: { civilian: 1, grox: 1 }, consumes: { grox: 1 }, outputs: { grox_meat: 1 } },

  // ===================== 五、农业种植链（栽培基质永久耐用化：仅消耗种子作物，基质保留在场） =====================
  // batch35：种植拆两条声明式配方——农田版在前优先匹配（30秒），基质版在后（60秒）；
  // 产出随种子由引擎结算分支统一处理（两个ID都认）；土壤与农田均永久耐用、不被消耗
  {
    id: 'grow_crop_farmland',
    name: '种植',
    baseTime: 30,
    inputs: { aberrant_farmland: 1 },
    anyInputs: [{ options: ['bitterroot', 'arken_berry', 'thorn_grain'], count: 1 }],
    consumes: {},
    outputs: {},
    allowExtraMembers: true
  },
  {
    id: 'grow_crop',
    name: '种植',
    baseTime: 60,
    inputs: { substrate: 1 },
    anyInputs: [{ options: ['bitterroot', 'arken_berry', 'thorn_grain'], count: 1 }],
    consumes: {},
    outputs: {},
    allowExtraMembers: true
  },

  // batch24：异变农田构筑（基质×3 消耗、人口不消耗）+ 采收点位
  { id: 'build_aberrant_farmland', name: '构筑农田', baseTime: 15, inputs: { substrate: 3 }, anyInputs: [{ options: ['civilian', 'auxilia', 'battle_sister', 'private_librarian', 'private_assassin', 'astartes'], count: 1 }], consumes: { substrate: 3 }, outputs: { aberrant_farmland: 1 }, needsUnlock: true },

  // batch24：草本疗伤贴（医疗类型：棘刺谷穗+史古格真菌）
  { id: 'craft_herb_patch', name: '调制草本疗伤贴', baseTime: 4, inputs: { thorn_grain: 1, squig_meatball: 1 }, consumes: { thorn_grain: 1, squig_meatball: 1 }, outputs: { herb_patch: 1 }, needsUnlock: true },

  // ===================== 六、材料与装备加工 =====================
  { id: 'craft_parts', name: '拆解零件', baseTime: 8, inputs: { civilian: 1, scrap_material: 1 }, consumes: { scrap_material: 1 }, outputs: { parts: 1 } },
  { id: 'craft_plate', name: '制作板材', baseTime: 8, inputs: { civilian: 1, scrap_material: 3 }, consumes: { scrap_material: 3 }, outputs: { plate: 1 }, needsUnlock: true },
  { id: 'craft_prefab', name: '制作石砖', baseTime: 8, inputs: { civilian: 1, stone: 3 }, consumes: { stone: 3 }, outputs: { prefab: 1 }, needsUnlock: true },
  { id: 'smelt_refined_metal', name: '冶炼精炼金属', baseTime: 10, inputs: { furnace: 1, titanium_ore: 3 }, consumes: { titanium_ore: 3 }, outputs: { refined_metal: 1 }, needsUnlock: true },
  { id: 'craft_circuit', name: '组装电子元件', baseTime: 10, inputs: { civilian: 1, refined_metal: 1, parts: 2 }, consumes: { refined_metal: 1, parts: 2 }, outputs: { circuit: 1 }, needsUnlock: true },
  { id: 'smelt_high_alloy', name: '冶炼高阶合金', baseTime: 12, inputs: { furnace: 1, refined_metal: 1, blackstone: 1 }, consumes: { refined_metal: 1, blackstone: 1 }, outputs: { high_alloy: 1 }, needsUnlock: true },
  { id: 'factory_plate', name: '自动化板材', baseTime: 5, inputs: { materials_factory: 1, scrap_material: 2 }, consumes: { scrap_material: 2 }, outputs: { plate: 1 }, needsUnlock: true },
  { id: 'factory_prefab', name: '自动化石砖', baseTime: 5, inputs: { materials_factory: 1, stone: 2 }, consumes: { stone: 2 }, outputs: { prefab: 1 }, needsUnlock: true },

  { id: 'craft_scrap_club', name: '制作废土管棒', baseTime: 6, inputs: { scrap_material: 2, parts: 1 }, consumes: { scrap_material: 2, parts: 1 }, outputs: { scrap_club: 1 } },
  { id: 'craft_void_suit', name: '制作虚空服', baseTime: 8, inputs: { titanium_ore: 3, thermonuclear_battery: 1 }, consumes: { titanium_ore: 3, thermonuclear_battery: 1 }, outputs: { void_suit: 1 }, needsUnlock: true },
  { id: 'craft_laser_rifle', name: '锻造激光步枪', baseTime: 10, inputs: { weapon_workshop: 1, parts: 2, refined_metal: 1 }, consumes: { parts: 2, refined_metal: 1 }, outputs: { laser_rifle: 1 }, needsUnlock: true },
  { id: 'craft_execution_blade', name: '锻造处刑大剑', baseTime: 12, inputs: { weapon_workshop: 1, refined_metal: 2, blackstone: 1 }, consumes: { refined_metal: 2, blackstone: 1 }, outputs: { execution_blade: 1 }, needsUnlock: true },
  { id: 'craft_diagnostor', name: '智脑诊断仪', baseTime: 10, inputs: { circuit: 2, blackstone: 1, thermonuclear_battery: 1 }, consumes: { circuit: 2, blackstone: 1, thermonuclear_battery: 1 }, outputs: { diagnostor: 1 }, needsUnlock: true },
  { id: 'craft_assassin_gear', name: '缝制刺客装具', baseTime: 10, inputs: { refined_metal: 1, circuit: 1, parts: 2 }, consumes: { refined_metal: 1, circuit: 1, parts: 2 }, outputs: { assassin_gear: 1 }, needsUnlock: true },
  { id: 'craft_power_armor', name: '锻造动力甲', baseTime: 15, inputs: { weapon_workshop: 1, high_alloy: 1, blackstone: 1, parts: 2 }, consumes: { high_alloy: 1, blackstone: 1, parts: 2 }, outputs: { power_armor: 1 }, needsUnlock: true }, // batch55：配方放宽（原需电子元件+电池×2，黑石+零件替代）

  // ===================== 七、建筑建造（含裂隙信标） =====================
  { id: 'build_hive_city', name: '巢都', baseTime: 10, inputs: { civilian: 1, scrap_material: 2, stone: 1 }, consumes: { scrap_material: 2, stone: 1 }, outputs: { hive_city: 1 } },
  { id: 'build_shed', name: '简易货棚', baseTime: 8, inputs: { civilian: 1, scrap_material: 1, stone: 1, parts: 1 }, consumes: { scrap_material: 1, stone: 1, parts: 1 }, outputs: { shed: 1 } },
  { id: 'build_warehouse', name: '卡牌货仓', baseTime: 12, inputs: { civilian: 1, prefab: 1, refined_metal: 1 }, consumes: { prefab: 1, refined_metal: 1 }, outputs: { warehouse: 1 }, needsUnlock: true },
  { id: 'build_coin_chest', name: '金币箱', baseTime: 8, inputs: { coin: 1, plate: 2 }, consumes: { coin: 1, plate: 2 }, outputs: { coin_chest: 1 }, needsUnlock: true },
  { id: 'build_black_market', name: '黑市', baseTime: 60, inputs: { civilian: 1, prefab: 1, plate: 1, coin: 3 }, consumes: { prefab: 1, plate: 1, coin: 3 }, outputs: { black_market: 1 }, needsUnlock: true },
  { id: 'build_recycling_plant', name: '回收站', baseTime: 25, inputs: { civilian: 1, scrap_material: 3, stone: 1 }, consumes: { scrap_material: 3, stone: 1 }, outputs: { recycling_plant: 1 }, needsUnlock: true },
  { id: 'build_excavation_tower', name: '石料场', baseTime: 25, inputs: { civilian: 1, stone: 3, scrap_material: 1 }, consumes: { stone: 3, scrap_material: 1 }, outputs: { excavation_tower: 1 }, needsUnlock: true },
  { id: 'build_mining_rig', name: '采矿场', baseTime: 50, inputs: { civilian: 1, thermonuclear_battery: 2, scrap_material: 1, stone: 1 }, consumes: { thermonuclear_battery: 2, scrap_material: 1, stone: 1 }, outputs: { mining_rig: 1 }, needsUnlock: true },
  { id: 'build_furnace', name: '熔炉', baseTime: 12, inputs: { civilian: 1, thermonuclear_battery: 2, prefab: 2, plate: 1 }, consumes: { thermonuclear_battery: 2, prefab: 2, plate: 1 }, outputs: { furnace: 1 }, needsUnlock: true },
  { id: 'build_materials_factory', name: '自动化工厂', baseTime: 20, inputs: { civilian: 1, refined_metal: 3, coin: 5 }, consumes: { refined_metal: 3, coin: 5 }, outputs: { materials_factory: 1 }, needsUnlock: true }, // batch60：整体改为 精金3+金币5
  { id: 'build_weapon_workshop', name: '武器工坊', baseTime: 20, inputs: { civilian: 1, prefab: 1, refined_metal: 2 }, consumes: { prefab: 1, refined_metal: 2 }, outputs: { weapon_workshop: 1 }, needsUnlock: true }, // batch60：石砖2→1
  { id: 'build_food_processor', name: '食品制造站', baseTime: 10, inputs: { civilian: 1, prefab: 1, plate: 1 }, consumes: { prefab: 1, plate: 1 }, outputs: { food_processor: 1 }, needsUnlock: true },
  { id: 'build_food_refinery', name: '食品精制厂', baseTime: 12, inputs: { food_processor: 1, prefab: 2, refined_metal: 1 }, consumes: { food_processor: 1, prefab: 2, refined_metal: 1 }, outputs: { food_refinery: 1 }, needsUnlock: true },
  { id: 'build_mess_hall', name: '星际食堂', baseTime: 10, inputs: { food_processor: 1, plate: 2, refined_metal: 1 }, consumes: { food_processor: 1, plate: 2, refined_metal: 1 }, outputs: { mess_hall: 1 }, needsUnlock: true },
  { id: 'build_breeding_farm', name: '太空养殖场', baseTime: 10, inputs: { civilian: 1, refined_metal: 2, plate: 2 }, consumes: { refined_metal: 2, plate: 2 }, outputs: { breeding_farm: 1 }, needsUnlock: true }, // batch60：精金1→2、取消废料
  { id: 'build_gene_vat', name: '基因培育舱', baseTime: 15, inputs: { civilian: 1, circuit: 2, high_alloy: 1, prefab: 2 }, consumes: { circuit: 2, high_alloy: 1, prefab: 2 }, outputs: { gene_vat: 1 }, needsUnlock: true },
  {
    id: 'build_rift_beacon',
    name: '裂隙信标',
    baseTime: 20,
    inputs: { high_alloy: 2, circuit: 2, blackstone: 3 },
    anyInputs: [{ options: ['civilian', 'auxilia', 'battle_sister', 'private_librarian', 'private_assassin', 'astartes'], count: 3 }],
    consumes: { high_alloy: 2, circuit: 2, blackstone: 3 },
    outputs: { rift_beacon: 1 },
    needsUnlock: true
  },

  // ===================== 八、食品烹饪与人口繁育 =====================
  // 工位菜：食品加工建筑二选一占位（食品制造站 / 食品精制厂，均不消耗）
  // 精制厂加成：带 requiresCard 的额外产出仅在精制厂在场时触发（引擎层判断）
  { id: 'cook_steak', name: '炙烤肉片', baseTime: 6, inputs: { grox_meat: 1 }, anyInputs: [{ options: ['food_processor', 'food_refinery'], count: 1 }], consumes: { grox_meat: 1 }, outputs: { grox_steak: 1 }, bonusOutputs: [{ cardId: 'grox_steak', chance: 0.1, requiresCard: 'food_refinery' }], needsUnlock: true },
  { id: 'cook_porridge', name: '苦根谷糊', baseTime: 6, inputs: { bitterroot: 1, thorn_grain: 1 }, consumes: { bitterroot: 1, thorn_grain: 1 }, outputs: { bitterroot_porridge: 1 }, bonusOutputs: [{ cardId: 'bitterroot_porridge', chance: 0.1, requiresCard: 'food_refinery' }], allowExtraMembers: true, needsUnlock: true }, // batch31：可无建筑合成；精制厂在场→10%双倍（工位作为额外成员留在堆内）
  { id: 'cook_squig_stew', name: '史古格真菌炖罐', baseTime: 7, inputs: { squig_meatball: 2 }, anyInputs: [{ options: ['food_processor', 'food_refinery'], count: 1 }], consumes: { squig_meatball: 2 }, outputs: { squig_stew: 1 }, bonusOutputs: [{ cardId: 'squig_stew', chance: 0.1, requiresCard: 'food_refinery' }], needsUnlock: true },
  { id: 'cook_risotto', name: '阿肯奶浆', baseTime: 7, inputs: { arken_berry: 1, grox_milk: 1 }, consumes: { arken_berry: 1, grox_milk: 1 }, outputs: { grox_risotto: 1 }, bonusOutputs: [{ cardId: 'grox_risotto', chance: 0.1, requiresCard: 'food_refinery' }], allowExtraMembers: true, needsUnlock: true }, // batch31：可无建筑合成；精制厂在场→10%双倍
  { id: 'cook_wilderness_stew', name: '荒野杂烩大锅', baseTime: 8, inputs: { bitterroot: 2, grox_meat: 1, thorn_grain: 1 }, anyInputs: [{ options: ['food_processor', 'food_refinery'], count: 1 }], consumes: { bitterroot: 2, grox_meat: 1, thorn_grain: 1 }, outputs: { wilderness_stew: 1 }, bonusOutputs: [{ cardId: 'wilderness_stew', chance: 0.1, requiresCard: 'food_refinery' }], needsUnlock: true },
  { id: 'cook_corpse_starch', name: '制作尸体淀粉', baseTime: 8, inputs: { corpse: 1 }, anyInputs: [{ options: ['food_processor', 'food_refinery'], count: 1 }], consumes: { corpse: 1 }, outputs: { corpse_starch: 1 }, bonusOutputs: [{ cardId: 'corpse_starch', chance: 0.1, requiresCard: 'food_refinery' }], corruptionDelta: 3, needsUnlock: true }, // batch31：工位制造站/精制厂二选一（均不消耗）；精制厂在场→10%双倍

  { id: 'breed_baby', name: '巢都繁育', baseTime: 15, inputs: { hive_city: 1 }, anyInputs: [{ options: ['civilian', 'auxilia', 'private_assassin'], count: 2 }], consumes: {}, outputs: { baby: 1 }, needsUnlock: true },
  { id: 'grow_baby', name: '婴儿成长', baseTime: 180, inputs: { hive_city: 1, baby: 1 }, consumes: { baby: 1 }, outputs: { civilian: 1 }, allowExtraMembers: true },
  { 
    id: 'promote_auxilia', 
    name: '太空辅助军', 
    baseTime: 6, 
    inputs: { civilian: 1, laser_rifle: 1 }, 
    consumes: { civilian: 1, laser_rifle: 1 }, 
    outputs: { auxilia: 1 }, 
    needsUnlock: true 
  },
  { id: 'promote_sister', name: '晋升战斗修女', baseTime: 8, inputs: { civilian: 1, execution_blade: 1 }, requiredTraits: [{ cardId: 'civilian', trait: 'untouchable', count: 1 }], consumes: { civilian: 1, execution_blade: 1 }, outputs: { battle_sister: 1 }, needsUnlock: true },
  { id: 'promote_librarian', name: '觉醒私人智库', baseTime: 8, inputs: { civilian: 1, diagnostor: 1 }, requiredTraits: [{ cardId: 'civilian', trait: 'psyker', count: 1 }], consumes: { civilian: 1, diagnostor: 1 }, outputs: { private_librarian: 1 }, needsUnlock: true },
  { id: 'promote_assassin', name: '受训私人刺客', baseTime: 8, inputs: { auxilia: 1, assassin_gear: 1 }, consumes: { auxilia: 1, assassin_gear: 1 }, outputs: { private_assassin: 1 }, needsUnlock: true },
  { id: 'transform_astartes', name: '基因转化', baseTime: 18, inputs: { power_armor: 1, gene_seed: 1 }, anyInputs: [{ options: ['civilian', 'auxilia'], count: 1 }], consumes: { power_armor: 1, gene_seed: 1 }, consumeAnyInputs: true, outputs: { astartes: 1 }, successChance: 0.5, failConsumes: ['civilian', 'auxilia'], failOutputs: { corpse: 1 }, needsUnlock: true },

  { id: 'cremate_corpse', name: '荣誉火葬', baseTime: 6, inputs: { furnace: 1, corpse: 1 }, anyInputs: [{ options: ['civilian', 'auxilia', 'battle_sister', 'private_librarian', 'private_assassin', 'astartes'], count: 1 }], consumes: { corpse: 1 }, outputs: {}, corruptionDelta: -1, needsUnlock: true, allowExtraMembers: true },
  { id: 'cremate_astartes', name: '荣耀火葬', baseTime: 8, inputs: { furnace: 1, astartes_corpse: 1 }, anyInputs: [{ options: ['civilian', 'auxilia', 'battle_sister', 'private_librarian', 'private_assassin', 'astartes'], count: 3 }], consumes: { astartes_corpse: 1 }, outputs: {}, corruptionDelta: -10, needsUnlock: true, allowExtraMembers: true },
  { id: 'make_pipes', name: '排通地下管道网', baseTime: 10, inputs: { corpse: 2 }, consumes: { corpse: 2 }, outputs: { underhive_pipes: 1 }, needsUnlock: true },
  { id: 'clone_gene_seed', name: '腐化的想法', baseTime: 15, inputs: { gene_vat: 1, civilian: 1, gene_seed: 1 }, consumes: { civilian: 1, gene_seed: 1 }, outputs: { gene_seed: 2, corpse: 1 }, corruptionDelta: 1, needsUnlock: true },
  { id: 'salvage_astartes', name: '智库回收遗体', baseTime: 10, inputs: { private_librarian: 1, astartes_corpse: 1 }, consumes: { astartes_corpse: 1 }, outputs: { gene_seed: 1, corpse: 1 }, needsUnlock: true, allowExtraMembers: true },

  // batch19：智库活体摘取——阿斯塔特不消耗、仅可献身一次（引擎特殊结算虚弱），腐化 +0
  { id: 'harvest_gene_seed', name: '智库活体摘取', baseTime: 10, inputs: { private_librarian: 1, astartes: 1 }, consumes: {}, outputs: { gene_seed: 1 }, needsUnlock: true },

  // C1 邪教徒净化（纯显示配方：实际执行走 DragDrop 净化匝道，显示/执行分离同远征模式；主意卡纯引导不解锁门）
  {
    id: 'purify_cultist',
    name: '净化邪教徒',
    baseTime: 6,
    inputs: { cultist: 1 },
    anyInputs: [{ options: ['battle_sister', 'private_librarian'], count: 1 }],
    consumes: {},
    outputs: {},
    needsUnlock: true
  }
]

export type RecipeCandidate = string | { cardId: string; trait?: string; origin?: string }

export function matchRecipe(candidates: RecipeCandidate[]): RecipeDef | null {
  const normCandidates = candidates.map(c =>
    typeof c === 'string'
      ? { cardId: c, trait: 'none', origin: undefined }
      : // batch18修复：归一化必须保留 origin——此前丢失导致 requiredOrigin 校验恒失败，
        // 智库回收遗体/荣耀火葬两个配方永远无法匹配（死配方）
        { cardId: c.cardId, trait: c.trait || 'none', origin: c.origin }
  )

  for (const r of RECIPES) {
    const needInputs = { ...r.inputs }
    const pool = [...normCandidates]

    let inputsOk = true
    // 冲突A规则：仅当配方不消耗平民时，civilian 工位接受任意劳动力顶替
    const civilianIsLaborSlot = reqHasCivilian(needInputs) && !(r.consumes && r.consumes['civilian'])
    for (const reqId in needInputs) {
      let count = needInputs[reqId]
      for (let i = pool.length - 1; i >= 0 && count > 0; i--) {
        const c = pool[i]
        // requiredOrigin：corpse 输入必须来源指定单位（如阿斯塔特尸体）
        const originOk = !r.requiredOrigin || c.cardId !== 'corpse' || c.origin === r.requiredOrigin
        const laborOk = c.cardId === reqId || (reqId === 'civilian' && civilianIsLaborSlot && isLaborCard(c.cardId))
        if (originOk && laborOk) {
          pool.splice(i, 1)
          count--
        }
      }
      if (count > 0) { inputsOk = false; break }
    }
    if (!inputsOk) continue

    let anyOk = true
    if (r.anyInputs) {
      for (const group of r.anyInputs) {
        let count = group.count
        for (let i = pool.length - 1; i >= 0 && count > 0; i--) {
          const c = pool[i]
          const originOk = !r.requiredOrigin || c.cardId !== 'corpse' || c.origin === r.requiredOrigin
          if (originOk && group.options.includes(c.cardId)) {
            pool.splice(i, 1)
            count--
          }
        }
        if (count > 0) { anyOk = false; break }
      }
    }
    if (!anyOk) continue

    let traitsOk = true
    if (r.requiredTraits) {
      for (const req of r.requiredTraits) {
        const needCount = req.count ?? 1
        const matched = normCandidates.filter(c => c.cardId === req.cardId && c.trait === req.trait).length
        if (matched < needCount) { traitsOk = false; break }
      }
    }
    if (!traitsOk) continue

    // 严谨校验：若池内无多余卡牌，精确匹配成功
    if (pool.length === 0) return r

    // ==================== 资源点燃料规则放行机制 ====================
    if (r.consumeSource && r.sourceId) {
      const isFuelOrWorker = pool.every(
        item => item.cardId === r.sourceId || item.cardId === 'civilian' || item.cardId === 'auxilia'
      )
      if (isFuelOrWorker) {
        return r
      }
    }

    // 劳动力线性加速放行机制
    const consumesWorker = (r.consumes && (r.consumes['civilian'] || r.consumes['auxilia'])) ||
      r.consumeAnyInputs ||
      r.id === 'breed_baby' ||
      r.id === 'build_rift_beacon'

    const usesWorker = ('civilian' in r.inputs) ||
      ('auxilia' in r.inputs) ||
      (r.anyInputs && r.anyInputs.some(g => g.options.includes('civilian') || g.options.includes('auxilia')))

    if (!consumesWorker && usesWorker) {
      const allRemainingAreWorkers = pool.every(item => item.cardId === 'civilian' || item.cardId === 'auxilia')
      if (allRemainingAreWorkers) {
        return r
      }
    }

    // 宽容放行：巢都系/熔炉系配方允许堆内存在配方外额外成员（巢都+熔炉+婴儿等混合堆）
    if (r.allowExtraMembers) {
      return r
    }

    continue
  }
  return null
}