// 文件名: src/utils/minigameAssetBase.ts
/**
 * 小游戏素材 base 统一解析器
 * dev  : vite 直接托管 public/, base = BASE_URL（原行为不变）
 * prod : 素材不再打进安装包, 由主进程 titan-img://minigame 协议映射到 <安装目录>\games
 * 调用方保持 `${miniGameAssetBase}/games/<gameId>/...` 的拼接方式不变, dev/prod 同构
 */
export const miniGameAssetBase =
  import.meta.env.DEV
    ? (import.meta.env.BASE_URL || '/').replace(/\/$/, '')
    : 'titan-img://minigame'
