// quests.ts 巴达布前哨 - 新手引导：第一年任务链（10任务）
// 节奏（一号裁定）：任务上半台词(操作前引导) → 玩家操作 → 任务后半台词(操作后点评) → 奖励飞入场 → 缓冲 → 下一任务上半
// 年末五幕：settlementFood → corpse(发2主意卡) → stockOver/stockSafe(条件) → corruption → farewell → commanderFinal → 进二年发种子
export type NpcSpeaker = 'tax_officer' | 'commander' | 'battle_sister' | 'greater_demon'
export type NpcEmotion = 'normal' | 'angry' | 'greedy'

export interface DialogLine {
  speaker: NpcSpeaker
  name: string
  emotion?: NpcEmotion
  text: string
}

export interface QuestReward {
  /** 金币以金币卡形式发放（引擎金币=金币卡+金币箱之和） */
  gold?: number
  /** 实体卡奖励（主意卡 idea_* 落地即自动解锁对应配方） */
  cards?: Array<{ cardId: string; count: number }>
}

export interface QuestDef {
  id: string
  title: string
  npc: NpcSpeaker
  /** 任务面板指令（短句） */
  instruction: string
  /** 上半台词：任务开启时对玩家说的操作引导（空数组=无需开场，如任务1由开场白兼任） */
  before: DialogLine[]
  /** 后半台词：玩家完成操作后的点评（讲完后发奖励） */
  after?: DialogLine[]
  match: { event: string; data?: string }
  reward: QuestReward
}

// ================= 上半部分·新星域十任务 =================
export const UPPER_QUESTS: QuestDef[] = [
  {
    id: 'q_open_pack',
    title: '开启补给',
    npc: 'tax_officer',
    instruction: '点击桌面上的【新手补给包】，逐张拆开物资。',
    // 上半由开场白第三句「这是帝国给您的第一份补给。拆开它吧。」兼任，这里留空
    before: [],
    after: [
      { speaker: 'tax_officer', name: '税务官', emotion: 'normal', text: '这是您的第一份补给' },
      { speaker: 'tax_officer', name: '税务官', emotion: 'normal', text: '当然不能让您空手上路' }
    ],
    match: { event: 'pack_opened' },
    reward: { gold: 1 }
  },
  {
    id: 'q_harvest',
    title: '初次采集',
    npc: 'tax_officer',
    instruction: '把 1 名平民拖到资源点（废料堆）上，等待读条完成。',
    before: [
      { speaker: 'tax_officer', name: '税务官', emotion: 'normal', text: '看见那个“废料堆”了吗？' },
      { speaker: 'tax_officer', name: '税务官', emotion: 'normal', text: '把您麾下的平民，拖到废料堆上  他们干活，东西归您' },
      { speaker: 'tax_officer', name: '税务官', emotion: 'normal', text: '这是总督必修课' }
    ],
    after: [
      { speaker: 'tax_officer', name: '税务官', emotion: 'normal', text: '人口，是您重要的资产——别让他们闲着。' }
    ],
    match: { event: 'harvest_done' },
    reward: { gold: 1 }
  },
  {
    id: 'q_craft_parts',
    title: '拆解零件',
    npc: 'tax_officer',
    instruction: '把 1 名平民 + 1 张废料堆叠，拆解出零件。',
    before: [
      { speaker: 'tax_officer', name: '税务官', emotion: 'normal', text: '“废料”，这是最基础的物资。' },
      { speaker: 'tax_officer', name: '税务官', emotion: 'greedy', text: '把平民拖到单个的“废料”上，他们会把它拆成能用的零件。这叫……再利用。' }
    ],
    after: [
      { speaker: 'tax_officer', name: '税务官', emotion: 'normal', text: '别小看这些小零件，您星域的资产可能就要靠它们累积起来。' }
    ],
    match: { event: 'recipe_done', data: 'craft_parts' },
    reward: { gold: 1, cards: [{ cardId: 'idea_craft_plate', count: 1 }] }
  },
  {
    id: 'q_craft_plate',
    title: '制作板材',
    npc: 'tax_officer',
    instruction: '把 1 名平民 + 3 张废料堆叠，压制成板材。',
    before: [
      { speaker: 'tax_officer', name: '税务官', emotion: 'normal', text: '试试把 3 块废铁堆在一起，放上 1 个平民' },
      { speaker: 'tax_officer', name: '税务官', emotion: 'normal', text: '您看，简单的废料，不同的配方，得到的结果完全不同' }
    ],
    after: [
      { speaker: 'tax_officer', name: '税务官', emotion: 'normal', text: '配方可不止这两种，多尝试也许会有新的发现' }
    ],
    match: { event: 'recipe_done', data: 'craft_plate' },
    reward: { gold: 1 }
  },
  {
    id: 'q_sell',
    title: '第一桶金',
    npc: 'tax_officer',
    instruction: '把您手中的卡牌拖到顶部【出售槽】换取金币。',
    before: [
      { speaker: 'tax_officer', name: '税务官', emotion: 'normal', text: '说到金币——您手上总有几样用不上的东西吧？' },
      { speaker: 'tax_officer', name: '税务官', emotion: 'normal', text: '把它拖到顶部的『出售』栏，童叟无欺' },
      { speaker: 'tax_officer', name: '税务官', emotion: 'normal', text: '记住这个动作，基本没有什么是不能卖的' }
    ],
    after: [
      { speaker: 'tax_officer', name: '税务官', emotion: 'greedy', text: '交易愉快。金币落袋的声音，比什么都动听。' }
    ],
    match: { event: 'card_sold' },
    reward: { gold: 1 }
  },
  {
    id: 'q_buy_pack',
    title: '战备采购',
    npc: 'tax_officer',
    instruction: '拖动金币到顶部卡包槽投币，攒满价格卡包即送达。',
    before: [
      { speaker: 'tax_officer', name: '税务官', emotion: 'normal', text: '现在，尝试把您手中的4枚金币拖到卡包“技术图纸包”上。' },
      { speaker: 'tax_officer', name: '税务官', emotion: 'normal', text: '一个卡包，一份新的可能。这里您也许可以买到更多的配方或者基础资源。' },
      { speaker: 'tax_officer', name: '税务官', emotion: 'normal', text: '不同的卡包内包含的东西也大不相同，想摸清门道，就每种都试试' }
    ],
    after: [
      { speaker: 'tax_officer', name: '税务官', emotion: 'normal', text: '不过小心，偶尔也会开出不同的危险，购买之前要掂量掂量您的星域能否承受。' },
      { speaker: 'tax_officer', name: '税务官', emotion: 'normal', text: '对了，向您介绍一下，这是“巢都”的配方与材料。' }
    ],
    match: { event: 'pack_bought' },
    reward: { gold: 1, cards: [{ cardId: 'scrap_material', count: 2 }, { cardId: 'stone', count: 1 }] }
  },
  {
    id: 'q_build_hive',
    title: '筑巢',
    npc: 'tax_officer',
    instruction: '把 1 名平民 + 2 张废料 + 1 张石料堆叠，建造巢都。',
    before: [
      { speaker: 'tax_officer', name: '税务官', emotion: 'normal', text: '材料齐了，就该立起您在这片星域的第一座城了。' },
      { speaker: 'tax_officer', name: '税务官', emotion: 'normal', text: '把主意卡上的配方堆叠材料。巢都立起来，您的子民才算有了根。' },
      { speaker: 'tax_officer', name: '税务官', emotion: 'normal', text: '有了根，人口才会繁衍。' }
    ],
    after: [
      { speaker: 'tax_officer', name: '税务官', emotion: 'normal', text: '人口繁衍，您的星域才能更加强大' }
    ],
    match: { event: 'recipe_done', data: 'build_hive_city' },
    reward: { cards: [{ cardId: 'idea_breed_baby', count: 1 }] }
  },
  {
    id: 'q_baby',
    title: '新希望',
    npc: 'tax_officer',
    instruction: '把巢都与 2 名成年人口堆叠繁育——婴儿诞生即完成，大人会被请出巢都。',
    before: [
      { speaker: 'tax_officer', name: '税务官', emotion: 'normal', text: '把两个人口放进巢都。给他们一点时间——新生命，自会到来。' }
    ],
    after: [
      { speaker: 'tax_officer', name: '税务官', emotion: 'normal', text: '新生命可干不了活。把“婴儿”放回巢都，让他慢慢长。' },
      { speaker: 'tax_officer', name: '税务官', emotion: 'greedy', text: '等成年了，就会成为您珍贵的财产。当然，有可能出生有天赋的人口，如何善用他们的天赋需要您慢慢探索。' }
    ],
    match: { event: 'recipe_done', data: 'breed_baby' },
    reward: { gold: 1 }
  },
  {
    id: 'q_pause',
    title: '喘口气',
    npc: 'tax_officer',
    instruction: '按 P 键暂停一次游戏（再按 P 恢复）。',
    before: [
      { speaker: 'tax_officer', name: '税务官', emotion: 'normal', text: '日子会越来越乱。怪物、饥荒，还有税收' },
      { speaker: 'tax_officer', name: '税务官', emotion: 'normal', text: '试着按 P，可以暂停时间。' },
      { speaker: 'tax_officer', name: '税务官', emotion: 'normal', text: '喘口气，想清楚下一步再走' }
    ],
    after: [
      { speaker: 'tax_officer', name: '税务官', emotion: 'normal', text: '很好，时间为您停下了' }
    ],
    match: { event: 'pause_toggled' },
    reward: { gold: 1 }
  },
  {
    id: 'q_stockpile',
    title: '囤粮过冬',
    npc: 'tax_officer',
    instruction: '听完税务官关于囤粮的提醒（对话结束即完成）。',
    before: [
      { speaker: 'tax_officer', name: '税务官', emotion: 'normal', text: '最后一条，也是最重要的一条：粮食。' },
      { speaker: 'tax_officer', name: '税务官', emotion: 'normal', text: '看到右上方的饱食度了吗？星际年一到，您的人口就会索要他们生存下去的粮食。试着将人口放在“阿肯果丛”上进行采集。' },
      { speaker: 'tax_officer', name: '税务官', emotion: 'normal', text: '粮仓是满的，大家皆大欢喜；粮仓是空的，他们可就活不过下一个星际年了' },
      { speaker: 'tax_officer', name: '税务官', emotion: 'normal', text: '粮食可以被采集，种植，或者制作更高级的料理。把粮食囤够。这是最仁慈的一个决定。' }
    ],
    match: { event: 'dialog' },
    reward: { gold: 1 }
  }
]

// ================= batch54：前言 / 大魔低语 / 税务官收税提醒(4档) / 修女警觉 / 大魔馈赠 文案 =================
// 前言页（开局背景故事，第四面墙旁白；背景复用 beijing.mp4）
export const LORE_TEXT: string[] = [
  '巴达布星区，帝国的边疆。一纸委任状，一包补给，你就是这座前哨的总督——仅此而已。',
  '帝皇的什一税每五年降临一次。缴清它，前哨存续；缴不清，腐化的账本会替你记下每一笔。',
  '但真正的威胁不在税单。亚空间的裂隙正在附近蠕动——找到它，筑起信标，召出那头大魔，杀了它。这是前哨存在的意义。',
  '记住两件事：你的修女忠诚于帝皇，不属于你。而腐化满盈之日，帝皇的舰队也会来找你——到那时，你仍有另一条路。'
]

// 大魔低语（每周期=新星际年开始时按当前腐化档随机一条：>20 低档 / >40 中档 / >60 高档；低档怒吼、高档赞赏）
export const DEMON_WHISPERS: Record<number, string[]> = {
  1: ['你闻起来还像个人类……真难闻。', '抗拒是徒劳的，小总督。', '每一次妥协，都是向我走一步。'],
  2: ['你的账本越来越像颂唱我的祷文了。', '帝国的税官需要你的税款，我只要你堕落。', '有意思。继续。'],
  3: ['很好。你正在成为我。', '士兵们已经在夜里为你祈祷了……向我。', '很快，我们就不必分彼此。']
}

// 税务官收税提醒（每个税年新年开始必弹；档=此前抗税次数 0正常/1警告/2严正/≥3最后通牒，每档随机一条）
export const TAX_REMINDS: DialogLine[][] = [
  [
    { speaker: 'tax_officer', name: '税务官', emotion: 'normal', text: '总督大人，新一届什一税开征。特使军舰已入泊，年末前缴清即可。' },
    { speaker: 'tax_officer', name: '税务官', emotion: 'normal', text: '又到五年一度的日子了。金币、人口，或种子——特使在等。' },
    { speaker: 'tax_officer', name: '税务官', emotion: 'normal', text: '账期到了，总督。今年的数目与往年相当，别让它逾期。' }
  ],
  [
    { speaker: 'tax_officer', name: '税务官', emotion: 'normal', text: '总督大人，上一届的税……我记得很清楚。这一届，别让我再记一次。' },
    { speaker: 'tax_officer', name: '税务官', emotion: 'normal', text: '逾期一次，帝国有账。希望这是唯一一笔。' },
    { speaker: 'tax_officer', name: '税务官', emotion: 'normal', text: '我可以原谅一次。但帝国不原谅第二次。' }
  ],
  [
    { speaker: 'tax_officer', name: '税务官', emotion: 'angry', text: '两届了，总督。我的账本上，你的名字越来越显眼。' },
    { speaker: 'tax_officer', name: '税务官', emotion: 'angry', text: '帝国的耐心是有限额的——你的额度快用完了。' },
    { speaker: 'tax_officer', name: '税务官', emotion: 'angry', text: '上一次我替你压下了风声。这一次，难说。' }
  ],
  [
    { speaker: 'tax_officer', name: '税务官', emotion: 'angry', text: '三次抗税。总督，您是要造反吗？' },
    { speaker: 'tax_officer', name: '税务官', emotion: 'angry', text: '你的账本已经烧到帝都了。好自为之。' },
    { speaker: 'tax_officer', name: '税务官', emotion: 'angry', text: '我数到三了。帝国，也数到三了。' }
  ]
]

// 修女警觉（腐化>60，新周期开始时一次性；先于大魔低语）
export const SISTER_WARN: DialogLine[] = [
  { speaker: 'battle_sister', name: '战斗修女', emotion: 'normal', text: '（低声）姐妹们最近夜里都在祈祷……为总督大人祈祷。' },
  { speaker: 'battle_sister', name: '战斗修女', emotion: 'normal', text: '愿帝皇宽恕我们心中的疑虑。' }
]

// 大魔馈赠（腐化100触顶瞬间，插在税务官预警与修女誓言之间）
export const DEMON_GIFT: DialogLine[] = [
  { speaker: 'greater_demon', name: '亚空间大魔', emotion: 'normal', text: '看啊，总督。你终于替我撕开了帝国的面纱。' },
  { speaker: 'greater_demon', name: '亚空间大魔', emotion: 'normal', text: '带上我的馈赠——它们曾是人，现在仍是你的工具。' }
]

// ================= NPC 剧情台词 =================
export const DIALOGS: Record<string, DialogLine[]> = {
  // 开场·迎接（第三句兼任任务1上半；说完发放新手补给包）
  welcome: [
    { speaker: 'tax_officer', name: '税务官', emotion: 'normal', text: '总督大人。欢迎来到您的星域。' },
    { speaker: 'tax_officer', name: '税务官', emotion: 'normal', text: '您要在这片『新星域』里做三件事：活下去，按时缴税，碾碎所有敌人。' },
    { speaker: 'tax_officer', name: '税务官', emotion: 'normal', text: '这是您的第一份补给。拆开它吧。' }
  ],
  // 年末·结算日开场（说完自动开饭演示）
  settlementFood: [
    { speaker: 'tax_officer', name: '税务官', emotion: 'normal', text: '结算日到了，总督大人。按历法，一年的账，今天一起算。' },
    { speaker: 'tax_officer', name: '税务官', emotion: 'normal', text: '您看——刚才让您囤的粮，起效果了吧。没有粮，人口就会直接饿死。账，是您自己的。' }
  ],
  // 年末·尸体讲解（开始时发放 荣誉火葬+尸体淀粉 主意卡）
  corpse: [
    { speaker: 'commander', name: '指挥官', emotion: 'normal', text: '如果饿死了呢？' },
    { speaker: 'tax_officer', name: '税务官', emotion: 'normal', text: '饿死？那就只剩尸体了。按规矩，尸体得用荣誉火葬处理——烧干净，这是标准的做法，一场火焰的葬礼也足以抚慰人心。（获得荣誉火葬配方）' },
    { speaker: 'commander', name: '指挥官', emotion: 'normal', text: '也许……还有其他做法。（获得尸体淀粉配方）' },
    { speaker: 'tax_officer', name: '税务官', emotion: 'normal', text: '……二位可真是让我长见识。' }
  ],
  // 年末·库存讲解（超容时用）
  stockOver: [
    { speaker: 'tax_officer', name: '税务官', emotion: 'normal', text: '哦，还有一件事——您的仓库，超容了。' },
    { speaker: 'tax_officer', name: '税务官', emotion: 'normal', text: '帝国的清点只认上限。多出来的卡，只能拖去卖了换金币，多余的东西总得清理掉。' }
  ],
  // 年末·库存讲解（未超容时的变体）
  stockSafe: [
    { speaker: 'tax_officer', name: '税务官', emotion: 'normal', text: '哦，还有件事——您的仓库眼下还宽裕，但记住年末的规矩。' },
    { speaker: 'tax_officer', name: '税务官', emotion: 'normal', text: '库存的清点只认上限。真超了，就把多余的卡拖去顶部卖掉换金币。未雨绸缪，总不是坏事。' }
  ],
  // 年末·腐化值讲解
  corruption: [
    { speaker: 'tax_officer', name: '税务官', emotion: 'normal', text: '最后，请您看一眼右上角的腐化值。' },
    { speaker: 'tax_officer', name: '税务官', emotion: 'normal', text: '这片星域不干净。抗税或者做了不该做的事情，它都会往上涨。' },
    { speaker: 'tax_officer', name: '税务官', emotion: 'normal', text: '等它涨满的那天——会有比我不客气得多的人来清账。' },
    { speaker: 'tax_officer', name: '税务官', emotion: 'greedy', text: '当然，也不是没有办法。只要您愿意双倍缴税——用双倍的诚意献给帝国——腐化值就能压下去一些。' },
    { speaker: 'tax_officer', name: '税务官', emotion: 'normal', text: '帝国的宽容，一向是明码标价的。' }
  ],
  // 年末·税务官告别（说完立绘退场）
  farewell: [
    { speaker: 'tax_officer', name: '税务官', emotion: 'normal', text: '好了。总督大人，好好活着，好好缴税。' },
    { speaker: 'tax_officer', name: '税务官', emotion: 'normal', text: '下一次税务的时候——我会来的。祝您一切顺利。' }
  ],
  // 年末·指挥官伏笔（告别之后单独登场）
  commanderFinal: [
    { speaker: 'commander', name: '指挥官', emotion: 'normal', text: '……总督。' },
    { speaker: 'commander', name: '指挥官', emotion: 'normal', text: '也许还存在另一条路。' },
    { speaker: 'commander', name: '指挥官', emotion: 'normal', text: '比缴税更直接的那种。您要是哪天想明白了——属下随时都在。' }
  ],
  // batch16 腐化线预警：税务官宣判 → 修女誓言（对话结束当回合修女叛变，旗舰下年登陆）
  corruptionWarn: [
    { speaker: 'tax_officer', name: '税务官', emotion: 'angry', text: '总督大人……不，叛徒。' },
    { speaker: 'tax_officer', name: '税务官', emotion: 'angry', text: '帝国的清算舰队已经在路上。背叛者，将被从上到下，消灭的连灰都不剩。' },
    { speaker: 'tax_officer', name: '税务官', emotion: 'normal', text: '这是我最后一次以税务官的身份对您说话。接下来登场的，是审判。' }
  ],
  corruptionSister: [
    { speaker: 'battle_sister', name: '战斗修女', emotion: 'normal', text: '总督，我们曾宣誓守护这座前哨。' },
    { speaker: 'battle_sister', name: '战斗修女', emotion: 'normal', text: '但律法高于一切——而您，已经成为了帝国的敌人。' },
    { speaker: 'battle_sister', name: '战斗修女', emotion: 'normal', text: '恕难从命。我们……永不背叛帝国。' }
  ],
  // 进第二年·赠种子（发放 gene_seed）
  seed: [
    { speaker: 'commander', name: '指挥官', emotion: 'normal', text: '总督。这颗基因种子赠予您——配上动力甲，也许再赌上一条人命，您就可以拥有最强大的士兵。' }
  ]
}