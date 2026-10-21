// cards.ts 巴达布前哨 - 卡牌数据表（含探索地点、终局道具与帝国征税军舰）
import { CardDef } from './types'

export const CARD_W = 160
export const CARD_H = 224

// batch24：草本疗伤贴参数（挂 tuner，后续收束进 badab_tuner.py）
export const HERB_PATCH_HEAL = 10
export const MED_PATCH_TIME = 3
// batch30：农田种植参数（挂 tuner）——农田上种植读条 60s→30s、10% 双倍收获
export const FARMLAND_GROW_TIME = 30
export const FARMLAND_DOUBLE_CHANCE = 0.1

export const CARD_DEFS: Record<string, CardDef> = {
  civilian: {
    id: 'civilian',
    name: '平民',
    category: 'unit',
    price: 0,
    unsellable: true,
    foodPerMonth: 2,
    isVillager: true,
    isOurUnit: true,
    isLabor: true,
    canBreed: true,
    hp: 15,
    attack: 1,
    attackInterval: 2.0,
    damageType: 'physical',
    desc: '前哨站基础劳动力。每年消耗 2 点饱食度，可执行采集、建造、繁育，或授装晋升为作战部队。'
  },
  baby: {
    id: 'baby',
    name: '婴儿',
    category: 'unit',
    price: 0,
    unsellable: true,
    foodPerMonth: 1,
    isOurUnit: true,
    hp: 8,
    attack: 0,
    desc: '繁育诞生的前哨新生命。无法参与劳动或战斗，每年消耗 1 点口粮，180 秒后成长为成年平民。'
  },
  auxilia: {
    id: 'auxilia',
    name: '太空辅助军',
    category: 'unit',
    price: 0,
    unsellable: true,
    foodPerMonth: 2,
    isVillager: true,
    isOurUnit: true,
    isLabor: true,
    canBreed: true,
    hp: 18,
    attack: 2,
    attackInterval: 1.5,
    damageType: 'physical',
    desc: '列装标准激光步枪的常备民兵。兼备基础劳作与前线防卫能力，出刀速度快于普通平民。'
  },
  battle_sister: {
    id: 'battle_sister',
    name: '战斗修女',
    category: 'unit',
    price: 0,
    unsellable: true,
    foodPerMonth: 2,
    isOurUnit: true,
    isLabor: true,
    hp: 35,
    attack: 3,
    attackInterval: 2.0,
    damageType: 'true',
    isMagicImmune: true,
    desc: '狂热纯洁的国教战士。拥有无魂者特质，攻击附带真实伤害，完全免疫一切亚空间法术与精神伤害。'
  },
  private_librarian: {
    id: 'private_librarian',
    name: '私人智库',
    category: 'unit',
    price: 0,
    unsellable: true,
    foodPerMonth: 2,
    isOurUnit: true,
    isLabor: true,
    hp: 12,
    attack: 3,
    attackInterval: 1.0,
    damageType: 'magic',
    desc: '觉醒灵能力量的学者。造成无视护甲的灵能法术伤害，并能安全回收阿斯塔特遗骸中的种子与动力甲。光环：每 3 秒治疗周围 250px 内友军 1 点生命（含自己，满血跳过）。'
  },
  private_assassin: {
    id: 'private_assassin',
    name: '私人刺客',
    category: 'unit',
    price: 0,
    unsellable: true,
    foodPerMonth: 2,
    isOurUnit: true,
    isLabor: true,
    // batch15（二号裁定）：刺客计入可繁衍人口（卡包保底计数口径）
    canBreed: true,
    hp: 14,
    attack: 7,
    attackInterval: 1.0,
    damageType: 'physical',
    desc: '身着暗杀装具的精锐影子。具备极高物理爆发斩杀能力，是猎杀敌方首领与怪物的王牌。光环：周围 250px 内友军攻击有 15% 概率暴击（双倍伤害，含自己）。'
  },
  astartes: {
    id: 'astartes',
    name: '阿斯塔特',
    category: 'unit',
    price: 0,
    unsellable: true,
    foodPerMonth: 3,
    isOurUnit: true,
    isLabor: true,
    hp: 30,
    attack: 6,
    attackInterval: 2.0,
    damageType: 'true',
    desc: '帝皇的死亡天使。拥有超凡体魄与真伤打击，远征用时缩减至 40 秒，是驻地防御的绝对中流砥柱。'
  },
  grox: {
    id: 'grox',
    name: '格罗克斯兽',
    category: 'unit',
    price: 3,
    foodPerMonth: 0,
    hp: 15,
    attack: 0,
    desc: '温顺的异星养殖牲畜。无需消耗口粮，每隔 120 秒产出 1 桶生奶，亦可宰杀获取 1 份生肉。'
  },

  space_pirate: {
    id: 'space_pirate',
    name: '宇宙海盗',
    category: 'enemy',
    price: 0,
    hp: 12,
    attack: 3,
    attackInterval: 2.0,
    damageType: 'physical',
    desc: '在废土与星环间游荡的亡命徒。装备简陋，主要造成物理近战威胁。'
  },
  corpse_mutant: {
    id: 'corpse_mutant',
    name: '尸变体',
    category: 'enemy',
    price: 0,
    hp: 12,
    attack: 2,
    attackInterval: 3.0,
    damageType: 'physical',
    desc: '长期曝露于辐射未及时火化的尸体变异而成。行动迟缓但生命顽强。'
  },
  cultist: {
    id: 'cultist',
    name: '邪教徒',
    category: 'enemy',
    price: 0,
    unsellable: true,
    foodPerMonth: 2,
    isOurUnit: true,
    canBreed: true,
    isUndraggable: true,
    hp: 8,
    attack: 0,
    desc: '潜伏在人群中的异端狂热者。不可拖动，持续蚕食驻地口粮并暗中散播腐化。'
  },
  snotling: {
    id: 'snotling',
    name: '鼻涕怪',
    category: 'enemy',
    price: 0,
    hp: 6,
    attack: 1,
    attackInterval: 3.0,
    damageType: 'true',
    desc: '脆弱矮小的兽人伴生生物。虽然单体威胁极低，但攻击附带恶毒的真伤。'
  },
  ork_boy: {
    id: 'ork_boy',
    name: '绿皮小子',
    category: 'enemy',
    price: 0,
    hp: 10,
    attack: 2,
    attackInterval: 2.0,
    damageType: 'true',
    desc: '好战的绿皮先锋步兵。凭借蛮横体能造成真伤，对防御工事具有较强破坏力。'
  },
  warboss: {
    id: 'warboss',
    name: '绿皮军阀',
    category: 'enemy',
    price: 0,
    hp: 30,
    attack: 4,
    attackInterval: 2.0,
    damageType: 'true',
    desc: '体型庞大的绿皮头目。挥舞重型武器造成毁灭性真伤，需集结精锐战力协同围剿。'
  },
  warp_imp: {
    id: 'warp_imp',
    name: '亚空间小恶魔',
    category: 'enemy',
    price: 0,
    hp: 18,
    attack: 4,
    attackInterval: 2.0,
    damageType: 'magic',
    isPhysicalImmune: true,
    desc: '来自以太之洋的扭曲魔物。物理攻击完全免疫，唯有修女的圣光与智库的灵能方可消灭。'
  },
  greater_demon: {
    id: 'greater_demon',
    name: '亚空间大魔',
    category: 'enemy',
    price: 0,
    hp: 1000,
    attack: 10,
    attackInterval: 3.0,
    damageType: 'true',
    desc: '灭世级混沌化身。拥有万点生命与极速高额真伤，唯有正义联军殊死一战方能驱逐。'
  },
  imperial_flagship: {
    id: 'imperial_flagship',
    name: '帝国远征军旗舰',
    category: 'enemy',
    price: 0,
    hp: 1200,
    attack: 0,
    damageType: 'physical',
    desc: '审判官亲率的镇压巨舰。作为腐化线终局决战目标，千点装甲源源不断投放远征步兵与敌对天使。'
  },
  expedition_trooper: {
    id: 'expedition_trooper',
    name: '远征军步兵',
    category: 'enemy',
    price: 0,
    hp: 18,
    attack: 3,
    attackInterval: 2.0,
    damageType: 'physical',
    desc: '训练有素的帝国正规军步兵。持精准激光武器结阵突击。'
  },
  enemy_astartes: {
    id: 'enemy_astartes',
    name: '敌对阿斯塔特',
    category: 'enemy',
    price: 0,
    hp: 30,
    attack: 6,
    attackInterval: 2.0,
    damageType: 'true',
    desc: '平叛军精锐星际战士。全副重武装甲，拥有可怕的正面压制力。'
  },
  // batch16：腐化线叛变产物——原战斗修女（数值机制完全一致，仅阵营转为敌对）
  enemy_battle_sister: {
    id: 'enemy_battle_sister',
    name: '敌对修女',
    category: 'enemy',
    price: 0,
    hp: 35,
    attack: 3,
    attackInterval: 2.0,
    damageType: 'true',
    isMagicImmune: true,
    desc: '信仰崩溃、堕落叛变的原战斗修女。仍持真实伤害与法术免疫，无情调转枪口清剿前哨。'
  },

  scrap_material: {
    id: 'scrap_material',
    name: '废料',
    category: 'material',
    price: 1,
    desc: '残破的机械残渣与金属碎屑。工业建造与零件拆解的基础原材料。'
  },
  stone: {
    id: 'stone',
    name: '石料',
    category: 'material',
    price: 1,
    desc: '经开采的坚硬异星矿石。常用于构筑掩体、建造重型工业建筑或石砖。'
  },
  parts: {
    id: 'parts',
    name: '零件',
    category: 'material',
    price: 2,
    desc: '精密机械标准构件。组装电路元件、打造激光步枪与维系工业母机必不可少。'
  },
  thermonuclear_battery: {
    id: 'thermonuclear_battery',
    name: '热核电池',
    category: 'material',
    price: 2,
    desc: '高密聚变能量单元。用于驱动熔炉、建造深井采矿场、组装诊断仪与锻造动力甲。'
  },
  titanium_ore: {
    id: 'titanium_ore',
    name: '钛金矿',
    category: 'material',
    price: 1,
    desc: '高纯度耐高温金属原矿。通过熔炉高温精炼可提取出结构坚韧的精炼金属。'
  },
  blackstone: {
    id: 'blackstone',
    name: '亚空间黑石',
    category: 'material',
    price: 6,
    desc: '能共鸣或抑制以太维度的奇特古老物质。锻造高阶合金、处刑大剑与裂隙信标的神秘主材。'
  },
  substrate: {
    id: 'substrate',
    name: '栽培基质',
    category: 'material',
    price: 1,
    desc: '高效无土栽培土壤槽。永久耐用，投入作物种子可实现源源不断的定点农业培育。'
  },

  plate: {
    id: 'plate',
    name: '板材',
    category: 'material',
    price: 3,
    desc: '经冲压成型的防腐合金板材。主要用于构筑简易货棚、黑市摊位及轻量护具。'
  },
  prefab: {
    id: 'prefab',
    name: '石砖',
    category: 'material',
    price: 3,
    desc: '标准化高强度工程构件。大型基建、自动化工厂与武器工坊的核心梁架。'
  },
  refined_metal: {
    id: 'refined_metal',
    name: '精炼金属',
    category: 'material',
    price: 4,
    desc: '高纯度钛合金铸块。用于精工制造电子元件、军备武器及高阶合成。'
  },
  circuit: {
    id: 'circuit',
    name: '电子元件',
    category: 'material',
    price: 4,
    desc: '高度集成的微电逻辑回路。制造智能诊断仪、刺客装具与高科建筑的神经中枢。合成方式：1 名平民手搓（精炼金属×1 + 零件×2），无需建筑。'
  },
  high_alloy: {
    id: 'high_alloy',
    name: '高阶合金',
    category: 'material',
    price: 5,
    desc: '结合黑石共鸣熔炼的高维装甲钢。用于锻造终极动力甲与修筑裂隙信标。'
  },
  coin: {
    id: 'coin',
    name: '金币',
    category: 'material',
    price: 1,
    unsellable: true,
    desc: '星区流通的硬通货。用于购买战备卡包、黑市交易与向帝国交付什一黄金税额。'
  },

  scrap_club: {
    id: 'scrap_club',
    name: '废土管棒',
    category: 'equipment',
    price: 1,
    attack: 1,
    desc: '简易废料拼接的打击武器。可由平民直接穿戴装备，攻击力 +1。'
  },
  laser_rifle: {
    id: 'laser_rifle',
    name: '激光步枪',
    category: 'equipment',
    price: 2,
    attack: 1,
    desc: '帝国辅助军标准制式步枪。授装给平民可直接将其晋升为常备太空辅助军。'
  },
  void_suit: {
    id: 'void_suit',
    name: '虚空服',
    category: 'equipment',
    price: 2,
    hp: 6, // batch18：与 EQUIP_CONFIGS hpBonus=3、文案"+3"对齐（原 2 导致角标显示错误）
    desc: '加厚增压防护服。可由单位穿戴，生命上限与当前生命立即提升 +6 点。'
  },
  execution_blade: {
    id: 'execution_blade',
    name: '处刑大剑',
    category: 'equipment',
    price: 5,
    attack: 3,
    desc: '附带纯洁符印的重斩刃。赐予具备无魂者特质的平民，可使其觉醒晋升为战斗修女。'
  },
  diagnostor: {
    id: 'diagnostor',
    name: '智脑诊断仪',
    category: 'equipment',
    price: 5,
    attack: 2,
    desc: '便携神经共鸣仪。交予拥有灵能天赋的平民，可引导其成为执掌神秘知识的私人智库。'
  },
  assassin_gear: {
    id: 'assassin_gear',
    name: '刺客装具',
    category: 'equipment',
    price: 5,
    attack: 4,
    desc: '贴身隐匿作战套装。武装受过战术训练的太空辅助军，可将其转职为致命私人刺客。'
  },
  power_armor: {
    id: 'power_armor',
    name: '动力甲',
    category: 'equipment',
    price: 10,
    hp: 10,
    desc: '神圣阿斯塔特动力甲。极其沉重，无法由凡人直接单兵穿戴，仅作基因转化仪式的核心催化载体。锻造方式：必须有武器工坊在场（高阶合金×1 + 亚空间黑石×1 + 零件×2）。'
  },
  gene_seed: {
    id: 'gene_seed',
    name: '基因种子',
    category: 'equipment',
    price: 20,
    unsellable: true,
    desc: '帝皇阿斯塔特原体基因原核。可用于人体基因飞升改造，亦是帝国征税特使最垂涎的贡品。'
  },

  hive_city: {
    id: 'hive_city',
    name: '巢都',
    category: 'building',
    price: 5,
    desc: '前哨站核心人口集聚地。指派 2 名成年人口入驻可繁育出新婴儿，亦可作为火化异端的焚尸炉。'
  },
  shed: {
    id: 'shed',
    name: '简易货棚',
    category: 'building',
    price: 3,
    capacityBonus: 6,
    desc: '轻型前哨储物棚架。在场时为基地提供 +6 张卡牌容量上限（货棚+货仓全场合计上限 5 座）。'
  },
  warehouse: {
    id: 'warehouse',
    name: '卡牌货仓',
    category: 'building',
    price: 6,
    capacityBonus: 20,
    desc: '标准化重型地下仓储库。在场时大幅提升 +20 张卡牌容量上限（货棚+货仓全场合计上限 5 座）。'
  },
  coin_chest: {
    id: 'coin_chest',
    name: '金币箱',
    category: 'building',
    price: 3,
    maxStorage: 120,
    desc: '安全金币保险箱。最多无损收纳 120 枚金币（免占卡槽），点击可批量取出 5 枚金币。'
  },
  black_market: {
    id: 'black_market',
    name: '黑市',
    category: 'building',
    price: 5,
    desc: '见不得光的地下交易所。将多余物资投入其中，可按双倍基础售价快速变卖为金币。'
  },
  recycling_plant: {
    id: 'recycling_plant',
    name: '回收站',
    category: 'building',
    price: 3,
    desc: '废料分拣工位。平民入驻可无限产出废料，并有 10% 几率额外分拣出机械零件。'
  },
  excavation_tower: {
    id: 'excavation_tower',
    name: '石料场',
    category: 'building',
    price: 3,
    desc: '地表碎石破碎工位。平民入驻可无限凿采石料，并有 10% 几率意外获取热核电池。'
  },
  mining_rig: {
    id: 'mining_rig',
    name: '采矿场',
    category: 'building',
    price: 5,
    desc: '深层矿脉钻井工位。平民入驻可源源不断开采珍贵钛金矿，兼带 10% 石料副产物。'
  },
  furnace: {
    id: 'furnace',
    name: '熔炉',
    category: 'building',
    price: 5,
    desc: '高温冶炼炉。用于将钛金矿石冶炼为精炼金属，或融合黑石打造高阶合金。'
  },
  materials_factory: {
    id: 'materials_factory',
    name: '自动化工厂',
    category: 'building',
    price: 5,
    desc: '全自动建材加工中心。免人工将废料压制为板材、石料铸造成石砖（由原加工厂与建材厂合并而来）。'
  },
  weapon_workshop: {
    id: 'weapon_workshop',
    name: '武器工坊',
    category: 'building',
    price: 5,
    desc: '先进军械锻造中心。负责铸造激光步枪、处刑大剑与神圣阿斯塔特动力甲。'
  },
  food_processor: {
    id: 'food_processor',
    name: '食品制造站',
    category: 'building',
    price: 3,
    desc: '基础炊事处理站。可将生肉、乳汁与苦根烹饪为高饱腹度的熟食炖品。'
  },
  food_refinery: {
    id: 'food_refinery',
    name: '食品精制工厂',
    category: 'building',
    price: 5,
    desc: '大型自动化口粮合成厂。高效制备各类高阶复合膳食与应急补给。'
  },
  mess_hall: {
    id: 'mess_hall',
    name: '星际食堂',
    category: 'building',
    price: 6,
    maxStorage: 10,
    desc: '前哨站后勤食堂。可免占卡槽储藏最多 10 份食物，月末结算时优先从此扣除口粮。'
  },
  breeding_farm: {
    id: 'breeding_farm',
    name: '太空养殖场',
    category: 'building',
    price: 3,
    maxStorage: 6,
    desc: '封闭式生态围栏。可将最多 5 头格罗克斯兽圈养在内，防止其四处乱窜并稳定产奶。'
  },
  gene_vat: {
    id: 'gene_vat',
    name: '基因培育舱',
    category: 'building',
    price: 6,
    corruptionDelta: 1,
    desc: '违禁生物克隆舱。可投入人体与基因种子进行禁忌复制（附带腐化风险）。'
  },
  rift_beacon: {
    id: 'rift_beacon',
    name: '裂隙信标',
    category: 'building',
    price: 15,
    desc: '正义线决战装置。布置于亚空间裂隙口，充能完毕后将强制锚定并召唤大魔降临。'
  },

  // batch24：阿斯塔特尸体独立成卡（基因种子封于其中：智库回收→普通尸体+种子，或荣耀火葬 -10 腐化；70 秒不处理同样尸变）
  astartes_corpse: {
    id: 'astartes_corpse',
    name: '阿斯塔特尸体',
    category: 'corpse',
    price: 0,
    unsellable: true,
    isOurCorpse: true,
    // batch31（裁定B）：圣骸不尸变——修描述对齐实现；回收/火葬无时限压力
    desc: '陨落阿斯塔特的圣骸，基因种子封于其中。私人智库可回收种子（遗体还原为普通尸体），或以荣耀火葬安魂（腐化 -10）。'
  },

  // 帝国征税实体大卡（建筑类，不可拖拽、不可出售、不占卡槽）
  tax_ship: {
    id: 'tax_ship',
    name: '帝国什一税军舰',
    category: 'building',
    price: 0,
    unsellable: true,
    isUndraggable: true,
    isTaxShip: true,
    desc: '泰拉神圣什一税舰队征税军舰。每 5 年抵达，必须在年末前足额拖入指定物资完成纳贡。'
  },

  bitterroot: {
    id: 'bitterroot',
    name: '异星苦根块',
    category: 'food',
    price: 2,
    satiety: 2,
    desc: '苦涩多汁的地下块茎。提供 2 点饱腹度、可售 2 金币，是早期充饥与熬制谷糊的基础食材。种入栽培基质，一茬可再产出 2 块。'
  },
  arken_berry: {
    id: 'arken_berry',
    name: '阿肯浆果',
    category: 'food',
    price: 1,
    satiety: 1,
    desc: '酸甜的灌木浆果。提供 1 点饱腹度、可售 1 金币，与格罗克斯生奶调和即成阿肯奶浆。种入栽培基质可长成阿肯果丛。'
  },
  thorn_grain: {
    id: 'thorn_grain',
    name: '棘刺谷穗',
    category: 'food',
    price: 2,
    satiety: 2,
    desc: '坚硬的带刺谷物。提供 2 点饱腹度、可售 2 金币，是熬糊与杂烩的主料。种入栽培基质可长成棘穗丛。'
  },
  squig_meatball: {
    id: 'squig_meatball',
    name: '史古格真菌',
    category: 'food',
    price: 1,
    satiety: 1,
    desc: '兽人孢子与碎肉纠缠成的恶心团块，不可生食。击败鼻涕怪大概率掉落，荒野给养包亦有产出。可售 1 金币，2 份送入食品加工建筑可炖成史古格真菌炖罐。'
  },
  grox_milk: {
    id: 'grox_milk',
    name: '格罗克斯生奶',
    category: 'food',
    price: 1,
    satiety: 1,
    desc: '格罗克斯兽产出的浓郁乳汁。提供 1 点饱腹度、可售 1 金币，直接饮用或与阿肯浆果调和成阿肯奶浆。'
  },
  grox_meat: {
    id: 'grox_meat',
    name: '生肉',
    category: 'food',
    price: 3,
    satiety: 0,
    desc: '血淋淋的兽肉，不可生食，可售 3 金币。宰杀格罗克斯兽获取 1 份，送入食品加工建筑烤制成炙烤肉片。'
  },
  grox_steak: {
    id: 'grox_steak',
    name: '炙烤肉片',
    category: 'food',
    price: 3,
    satiety: 3,
    desc: '碳烤外焦里嫩的熟肉厚片。直接提供 2 点饱腹度，可售 3 金币。由 1 份生肉在食品加工建筑烤制而成。'
  },
  bitterroot_porridge: {
    id: 'bitterroot_porridge',
    name: '苦根谷糊',
    category: 'food',
    price: 4,
    satiety: 4,
    desc: '苦根与谷穗慢火熬制的稠糊，无需炊具、野外直接合成。提供 3 点饱腹度，可售 5 金币。'
  },
  squig_stew: {
    id: 'squig_stew',
    name: '史古格真菌炖罐',
    category: 'food',
    price: 5,
    satiety: 5,
    desc: '异星风味真菌煲，营养丰富。提供 3 点饱腹度，可售 5 金币。需 2 份史古格真菌在食品加工建筑炖制。'
  },
  grox_risotto: {
    id: 'grox_risotto',
    name: '阿肯奶浆',
    category: 'food',
    price: 5,
    satiety: 3,
    desc: '鲜奶与浆果调和而成的浓稠奶糊，无需炊具、直接合成。提供 2 点饱腹度，可售 5 金币，便于携带囤放。'
  },
  wilderness_stew: {
    id: 'wilderness_stew',
    name: '荒野杂烩大锅',
    category: 'food',
    price: 10,
    satiety: 8,
    desc: '汇聚苦根、生肉与谷穗的极品盛宴大锅。一次性补足 5 点高额饱腹度，可售 10 金币。需在食品加工建筑架锅烹制。'
  },
  corpse_starch: {
    id: 'corpse_starch',
    name: '尸体淀粉',
    category: 'food',
    price: 3,
    satiety: 4,
    corruptionDelta: 3,
    desc: '以死者遗体再造的应急军粮。提供 3 点饱腹，但吞咽时将增加 +3 驻地腐化值。'
  },

  // batch24：草本疗伤贴——单独医疗类型（非食物、不占食堂），拖到受伤我方单位上自动读条回血
  herb_patch: {
    id: 'herb_patch',
    name: '草本疗伤贴',
    category: 'medical',
    price: 1,
    desc: '棘刺谷穗与史古格真菌调制的野战敷贴。堆叠到受伤的我方单位上自动读条，完成后恢复 10 点生命（不超过上限）。'
  },

  alien_orchard: {
    id: 'alien_orchard',
    name: '阿肯果丛',
    category: 'resource_point',
    price: 0,
    uses: 4,
    desc: '挂满野果的矮树丛。指派平民可采摘 3 次，产出阿肯浆果。可由阿肯浆果在栽培基质上培育而成。'
  },
  mutant_farmland: {
    id: 'mutant_farmland',
    name: '棘穗丛',
    category: 'resource_point',
    price: 0,
    uses: 3,
    desc: '野生带刺谷穗丛。指派平民可收割 2 次，产出棘刺谷穗。可由棘刺谷穗在栽培基质上培育而成。'
  },

  // batch30：农田——栽培基质的升级版建筑卡：作物种入农田读条 30 秒（基质为 60 秒）、10% 概率双倍收获；永久耐用、可反复栽种
  aberrant_farmland: {
    id: 'aberrant_farmland',
    name: '农田',
    category: 'building',
    price: 2,
    desc: '高肥力农田，栽培基质的升级形态。将作物种子种入农田：种植读条缩短一半，且有 10% 概率双倍收获。永久耐用，可反复栽种。'
  },
  scrap_heap: {
    id: 'scrap_heap',
    name: '废料堆',
    category: 'resource_point',
    price: 0,
    uses: 2,
    desc: '战争遗留的装甲残骸堆。指派平民可拆解 5 次获得废料，并有 8% 概率搜寻到热核电池。'
  },
  rubble_pile: {
    id: 'rubble_pile',
    name: '瓦砾堆',
    category: 'resource_point',
    price: 0,
    uses: 2,
    desc: '坍塌的防御工事残垣。指派平民可开采 5 次，产出石料。'
  },
  titanium_vein: {
    id: 'titanium_vein',
    name: '露天矿脉',
    category: 'resource_point',
    price: 0,
    uses: 2,
    desc: '富集在地表的原生态钛矿点。指派平民可开掘 3 次，产出钛金矿。'
  },

  alien_forest: {
    id: 'alien_forest',
    name: '异形森林星球',
    category: 'location',
    price: 0,
    desc: '未知生态的险恶密林地貌。派遣单位入驻展开远征探索，搜寻果实种子与稀有草木。'
  },
  battlefield_planet: {
    id: 'battlefield_planet',
    name: '太空古战场星球',
    category: 'location',
    price: 0,
    desc: '覆满战舰残骸的废墟世界。派遣单位入驻展开远征，打捞热核电池、机械零件与重石。'
  },
  pirate_mothership: {
    id: 'pirate_mothership',
    name: '海盗母舰',
    category: 'location',
    price: 0,
    desc: '坠毁的劫掠母舰机库。派遣单位入驻登舰肃清，掠夺黄金、精炼金属与电子元件。'
  },
  underhive_pipes: {
    id: 'underhive_pipes',
    name: '地下管道网',
    category: 'location',
    price: 0,
    desc: '盘根错节的幽深管网设施。派遣单位入驻探索，找寻失落的零件与亚空间黑石。'
  },
  warp_rift: {
    id: 'warp_rift',
    name: '亚空间裂隙口',
    category: 'location',
    price: 0,
    desc: '撕裂现实维度的混沌伤痕。在此立起裂隙信标可召唤大魔展开决战。'
  },

  corpse: {
    id: 'corpse',
    name: '尸体',
    category: 'corpse',
    price: 0,
    unsellable: true,
    isOurCorpse: true,
    desc: '逝去前哨军民的遗骸（严禁出售）。需在 70 秒内送入熔炉火化，否则将受辐射污染畸变为尸变体。'
  },
  pack_starter: { id: 'pack_starter', name: '新手补给包', category: 'pack', price: 0, unsellable: true, isPack: true, desc: '初始空投物资包。点击拆包获取基础平民与核心生存资源。' },
  pack_pioneer: { id: 'pack_pioneer', name: '拓荒补给包', category: 'pack', price: 0, unsellable: true, isPack: true, desc: '拓荒补给物资包。点击拆包获取基础农耕工具与劳动力。' },
  pack_blueprints: { id: 'pack_blueprints', name: '技术图纸包', category: 'pack', price: 0, unsellable: true, isPack: true, desc: '帝国工业蓝图。点击拆包可随机掌握 3 项未知科技配方。' },
  pack_supplies: { id: 'pack_supplies', name: '荒野给养包', category: 'pack', price: 0, unsellable: true, isPack: true, desc: '战地给养物资包。点击拆解可获得大量口粮与养殖牲畜。' },
  pack_ruins: { id: 'pack_ruins', name: '失落遗迹包', category: 'pack', price: 0, unsellable: true, isPack: true, desc: '失落遗迹发掘箱。包含远征地标与古老机械残片。' },
  pack_industry: { id: 'pack_industry', name: '重工业包', category: 'pack', price: 0, unsellable: true, isPack: true, desc: '重工业拓展包。补充钛金、高阶合金构件与聚变能源。' },
  pack_armory: { id: 'pack_armory', name: '军械密档包', category: 'pack', price: 0, unsellable: true, isPack: true, desc: '高阶军械库藏。包含武器图纸、暗杀装具与神圣动力装备。' }
}

export function getDef(cardId: string): CardDef {
  const def = CARD_DEFS[cardId]
  if (def) return def

  if (cardId.startsWith('idea_')) {
    const recipeId = cardId.replace('idea_', '')
    return {
      id: cardId,
      name: `科技蓝图`,
      category: 'idea',
      price: 1,
      unlocksRecipe: recipeId,
      desc: '记录着前哨工业核心生产工艺的技术蓝图。持有即可永久掌握该项合成配方。'
    }
  }

  throw new Error(`[badab] 未知卡牌: ${cardId}`)
}

// batch28：撤回 batch24——卡包图不进卡面系统（实体卡包保持原版竖卡绘制），商店格美术由引擎独立加载
export const DEMO_ASSET_IDS: string[] = Object.keys(CARD_DEFS).filter(
  id => id !== 'tax_ship' && !id.startsWith('pack_')
)