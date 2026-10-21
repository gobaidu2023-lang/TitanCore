import 'pixi.js/unsafe-eval'
import { Application, Container, Graphics, Sprite, Texture, AnimatedSprite, Text, TextStyle } from 'pixi.js'
import { BulletEntity, CannonOrbEntity, OrbType, GroundShockwave } from './types'
import { useStarCatStore } from '../../../stores/starcatStore'
import { useMiniGameStore } from '../../../stores/miniGameStore'
import { STAGE3_BOSS_CONFIG, STAGE1_BOSS_TRIGGER_SCORE } from './config'
import { miniGameAssetBase } from '../../../utils/minigameAssetBase'
import * as AudioSynth from './audioSynth'
import * as MiniGameAudio from '../miniGameAudio'

export const DESIGN_W = 1920
export const DESIGN_H = 1080

const FIXED_CONFIG = {
  planet: { x: 440, y: 1424, radius: 1001, spinSpeed: 0.002 },
  cat: { x: 500, yOffset: 250, scale: 1.55, animSpeed: 0.25 }
}

interface ParallaxStar {
  x: number; y: number; size: number; alpha: number; baseAlpha: number
  twinklePhase: number; twinkleSpeed: number; layer: number
}

interface HostileMeteor {
  active: boolean
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  rotationSpeed: number
  life: number
  isBossAttack: boolean
  isApexCutter?: boolean
  container: Container
  sprite: Sprite
  glow: Graphics
}

interface EnemyBodyNode {
  id: number
  type: OrbType
  x: number
  y: number
  baseY: number
  vx: number
  vy: number
  radius: number
  baseScale: number
  rotationSpeed: number
  floatFreq: number
  hzFreq: number
  time: number
  isDestroyed: boolean
  container: Container
  rimGlow: Graphics
  mainSprite: Sprite
}

interface ConstellationNode {
  x: number
  y: number
  color: number
  glowColor: number
  hzFreq: number
  connected: boolean
}

interface MoonBoss {
  active: boolean
  isRedMoon: boolean
  x: number
  y: number
  targetX: number
  radius: number
  scale: number
  hp: number
  maxHp: number
  shieldActive: boolean
  isRushing: boolean
  qteKeys: string[]
  qteCurrentIndex: number
  container: Container
  rimGlow: Graphics
  mainSprite: Sprite
}

interface Stage3FinalBoss {
  active: boolean
  x: number
  y: number
  targetX: number
  radius: number
  scale: number
  container: Container
  idleSprite: AnimatedSprite | null
  atk1Sprite: AnimatedSprite | null
  atk2Sprite: AnimatedSprite | null
  state: 'idle' | 'slam' | 'laser_charge' | 'laser_fire' | 'weak'
  stateTimer: number
  attackCooldown: number
  laserY: number
  laserDuration: number
  weakTimer: number
  weakQHits: number // 单轮虚弱期吸收 Q 炮的次数 (防融化锁)
  glow: Graphics
}

interface ParticleEntity {
  active: boolean
  x: number; y: number
  vx: number; vy: number
  alpha: number
  color: number
  size: number
  life: number
  maxLife: number
}

export class StarCatEngine {
  private app: Application | null = null
  private containerEl: HTMLElement
  private store: ReturnType<typeof useStarCatStore>
  private miniGameStore: ReturnType<typeof useMiniGameStore>

  /* ---- 关卡状态 ---- */
  public currentStage: 1 | 2 | 3 = 1
  public isPaused = false
  private timeScale = 1.0

  public pause() {
    this.isPaused = true
  }

  public resume() {
    this.isPaused = false
  }

  /* ---- 渲染层级 ---- */
  private bgViewportContainer = new Container()
  private bgSprite: Sprite | null = null
  private bgTexture: Texture | null = null

  private rootDesignStage = new Container()
  private starsLayer = new Graphics()
  private cometLayer = new Graphics()
  private meteorsLayer = new Container()
  private planetContainer = new Container()
  private catContainer = new Container()
  private bodiesLayer = new Container()
  private bulletsLayer = new Container()
  private bossLayer = new Container()
  private stage3BossLayer = new Container()
  private effectsLayer = new Graphics()
  private damageTextContainer = new Container()
  private crosshairLayer = new Graphics()
  private npcContainer = new Container()

  /* ---- 素材 ---- */
  private planetSprite: Sprite | null = null
  private textures = {
    star01: null as Texture | null,
    star02: null as Texture | null,
    moon: null as Texture | null,
    meteor: null as Texture | null
  }
  private catIdleSprite: AnimatedSprite | null = null
  private catAtkSprite: AnimatedSprite | null = null
  private npcSprite: AnimatedSprite | null = null

  /* ---- 关卡 3 Boss 素材序列帧 ---- */
  private bossIdleFrames: Texture[] = []
  private bossAtk1Frames: Texture[] = []
  private bossAtk2Frames: Texture[] = []
  private finalBoss: Stage3FinalBoss | null = null

  /* ---- 对象池与动态物理列表 ---- */
  private bodies: EnemyBodyNode[] = []
  private bullets: BulletEntity[] = []
  private cannonOrbs: CannonOrbEntity[] = []
  private particlePool: ParticleEntity[] = []
  private meteors: HostileMeteor[] = []
  private groundShockwaves: GroundShockwave[] = []
  private damageTextPool: { textObj: Text; active: boolean; x: number; y: number; vy: number; alpha: number; life: number; maxLife: number }[] = []
  private parallaxStars: ParallaxStar[] = []

  /* ---- Boss 状态 ---- */
  private currentBoss: MoonBoss | null = null
  private stage1BossSpawned = false
  private stage2MoonsSpawned = 0
  private stage2NextMoonTime = 0
  private constellationNodes: ConstellationNode[] = []

  /* ---- 滑块判定 ---- */
  private sliderDirection = 1
  private sliderSpeed = 1.45
  private skillCheckCooldown = 0

  /* ---- 角色控制与滞空重构 ---- */
  private catX = FIXED_CONFIG.cat.x
  private catGroundedY = 0
  private catCurrentY = 0
  private catVy = 0
  private isGrounded = true
  private moveDir = 0
  private mouseX = DESIGN_W * 0.7
  private mouseY = DESIGN_H * 0.4
  private invulnerableTimer = 0

  /* ---- 自动射击 ---- */
  private autoShootTimer = 0
  private readonly AUTO_SHOOT_INTERVAL = 0.11

  /* ---- 动效物理 ---- */
  private screenShakeIntensity = 0
  private hitStopTimer = 0

  /* ---- 节奏生成 ---- */
  private nextSpawnTime = 0
  public supplyMode = false
  private npcTargetX = DESIGN_W - 320
  private npcCurrentX = DESIGN_W + 300
  private npcFlyOut = false

  private entityIdCounter = 1
  private bulletIdCounter = 1
  private isDestroyed = false

  public onEnterSupply1: (() => void) | null = null
  public onEnterSupply2: (() => void) | null = null
  public onStageClear: (() => void) | null = null
  public onGameOver: (() => void) | null = null

  constructor(containerEl: HTMLElement) {
    this.containerEl = containerEl
    this.store = useStarCatStore()
    this.miniGameStore = useMiniGameStore()
    this.currentStage = (this.store.stage as 1 | 2 | 3) || 1
  }

  public async init(): Promise<void> {
    const w = this.containerEl.clientWidth
    const h = this.containerEl.clientHeight

    this.app = new Application()
    await this.app.init({
      width: w,
      height: h,
      backgroundColor: 0x020205,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2)
    })

    if (this.isDestroyed) {
      this.app.destroy(true)
      return
    }

    this.app.canvas.style.opacity = '0'
    this.containerEl.appendChild(this.app.canvas)
    this.containerEl.addEventListener('contextmenu', (e) => e.preventDefault())

    this.app.stage.addChild(this.bgViewportContainer)
    this.app.stage.addChild(this.rootDesignStage)

    this.rootDesignStage.addChild(this.starsLayer)
    this.rootDesignStage.addChild(this.cometLayer)
    this.rootDesignStage.addChild(this.meteorsLayer)
    this.rootDesignStage.addChild(this.planetContainer)
    this.rootDesignStage.addChild(this.catContainer)
    this.rootDesignStage.addChild(this.bodiesLayer)
    this.rootDesignStage.addChild(this.bulletsLayer)
    this.rootDesignStage.addChild(this.bossLayer)
    this.rootDesignStage.addChild(this.stage3BossLayer)
    this.rootDesignStage.addChild(this.effectsLayer)
    this.rootDesignStage.addChild(this.damageTextContainer)
    this.rootDesignStage.addChild(this.crosshairLayer)
    this.rootDesignStage.addChild(this.npcContainer)

    this.cometLayer.blendMode = 'add'
    this.effectsLayer.blendMode = 'add'

    this.initStarfield()
    this.initPools()
    await this.loadAllAssets()
    this.applyFixedSetup()
    this.updateDimensions(w, h)

    this.app.render()
    requestAnimationFrame(() => {
      if (this.app && !this.isDestroyed) {
        this.app.canvas.style.opacity = '1'
      }
    })

    this.app.ticker.add((ticker) => {
      if (this.isDestroyed) return
      this.tick(ticker.deltaMS / 1000)
    })
  }

  private initPools() {
    this.particlePool = []
    for (let i = 0; i < 200; i++) {
      this.particlePool.push({
        active: false,
        x: 0, y: 0,
        vx: 0, vy: 0,
        alpha: 0,
        color: 0xffffff,
        size: 2,
        life: 0,
        maxLife: 0.35
      })
    }

    this.damageTextPool = []
    const style = new TextStyle({
      fontFamily: 'monospace',
      fontSize: 20,
      fontWeight: '900',
      fill: '#ffea00',
      stroke: { color: '#000000', width: 4 }
    })
    for (let i = 0; i < 35; i++) {
      const textObj = new Text({ text: '0', style })
      textObj.anchor.set(0.5, 0.5)
      textObj.visible = false
      this.damageTextContainer.addChild(textObj)
      this.damageTextPool.push({
        textObj,
        active: false,
        x: 0, y: 0, vy: 0,
        alpha: 0,
        life: 0, maxLife: 0.5
      })
    }
  }

  public spawnDamageText(x: number, y: number, dmg: number, isWeak = false) {
    const pooled = this.damageTextPool.find(t => !t.active)
    if (!pooled) return
    pooled.active = true
    pooled.x = x + (Math.random() - 0.5) * 30
    pooled.y = y - 10
    pooled.vy = -180 - Math.random() * 80
    pooled.alpha = 1.0
    pooled.life = 0
    pooled.maxLife = isWeak ? 0.65 : 0.45
    pooled.textObj.text = isWeak ? `CRIT ${dmg}` : `${dmg}`
    pooled.textObj.style.fill = isWeak ? '#ffea00' : '#00f3ff'
    pooled.textObj.style.fontSize = isWeak ? 26 : 18
    pooled.textObj.visible = true
    pooled.textObj.x = pooled.x
    pooled.textObj.y = pooled.y
    pooled.textObj.alpha = 1.0
  }

  private initStarfield() {
    this.parallaxStars = []
    const layers = [
      { count: 110, sizeRange: [0.5, 1.2] as const, alphaRange: [0.1, 0.35] as const },
      { count: 55,  sizeRange: [1.0, 2.0] as const, alphaRange: [0.25, 0.6] as const },
      { count: 20,  sizeRange: [1.5, 3.0] as const, alphaRange: [0.45, 0.9] as const }
    ]
    layers.forEach((layer, layerIdx) => {
      for (let i = 0; i < layer.count; i++) {
        this.parallaxStars.push({
          x: Math.random() * DESIGN_W,
          y: Math.random() * DESIGN_H,
          size: layer.sizeRange[0] + Math.random() * (layer.sizeRange[1] - layer.sizeRange[0]),
          alpha: layer.alphaRange[0] + Math.random() * (layer.alphaRange[1] - layer.alphaRange[0]),
          baseAlpha: layer.alphaRange[0] + Math.random() * (layer.alphaRange[1] - layer.alphaRange[0]),
          twinklePhase: Math.random() * Math.PI * 2,
          twinkleSpeed: 0.5 + Math.random() * 2,
          layer: layerIdx
        })
      }
    })
  }

  /* ==================== 陨石生成 ==================== */

  private spawnMeteor(isBossAttack = false, targetX?: number, targetY?: number) {
    let startX = DESIGN_W + 100
    let startY = Math.random() * DESIGN_H * 0.4
    let speed = 480 + Math.random() * 320
    let angle = Math.PI * 0.78 + Math.random() * 0.35

    if (isBossAttack) {
      startX = (this.finalBoss ? this.finalBoss.x : STAGE3_BOSS_CONFIG.targetX) + (Math.random() - 0.5) * 160
      startY = (this.finalBoss ? this.finalBoss.y - 120 : 200)
      const tx = targetX ?? this.catX
      const ty = targetY ?? (this.catCurrentY - 40)
      angle = Math.atan2(ty - startY, tx - startX)
      speed = this.store.boss.isEnraged ? 840 : 660
    }

    const container = new Container()
    const glow = new Graphics()
    container.addChild(glow)

    const sp = new Sprite(this.textures.meteor || Texture.WHITE)
    sp.anchor.set(0.5, 0.5)
    const scale = STAGE3_BOSS_CONFIG.meteorScale * (isBossAttack ? 1.0 : 0.6)
    sp.scale.set(scale)
    sp.tint = isBossAttack ? 0x242736 : 0x444455
    container.addChild(sp)
    this.meteorsLayer.addChild(container)

    const hitboxRadius = 140 * scale

    this.meteors.push({
      active: true,
      x: startX,
      y: startY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: hitboxRadius,
      rotationSpeed: (Math.random() - 0.5) * 0.08,
      life: 0,
      isBossAttack,
      isApexCutter: false,
      container,
      sprite: sp,
      glow
    })
  }

  // 专用于惩罚空中挂机滞空的“天顶横切黑曜石流星”
  private spawnApexCutterMeteor(targetY: number) {
    const container = new Container()
    const glow = new Graphics()
    container.addChild(glow)

    const sp = new Sprite(this.textures.meteor || Texture.WHITE)
    sp.anchor.set(0.5, 0.5)
    const scale = STAGE3_BOSS_CONFIG.meteorScale * 1.15
    sp.scale.set(scale)
    sp.tint = 0x202230
    container.addChild(sp)
    this.meteorsLayer.addChild(container)

    const hitboxRadius = 140 * scale

    this.meteors.push({
      active: true,
      x: DESIGN_W + 120,
      y: targetY,
      vx: -980,
      vy: 0,
      radius: hitboxRadius,
      rotationSpeed: -0.15,
      life: 0,
      isBossAttack: true,
      isApexCutter: true,
      container,
      sprite: sp,
      glow
    })
  }

  private async loadAllAssets() {
    const resolve = (fn: string) => {
      return `${miniGameAssetBase}/games/starcat/${fn}`
    }
    const loadTex = (src: string): Promise<Texture> => new Promise((res, rej) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => { try { res(Texture.from(img)) } catch (e) { rej(e) } }
      img.onerror = () => rej(new Error(`[StarCat] 资源加载失败: ${src}`))
      img.src = src
    })
    const loadSeq = async (folder: string, prefix: string, count: number) => {
      const out: Texture[] = []
      for (let i = 1; i <= count; i++) {
        const path = resolve(`${folder}/${prefix}${String(i).padStart(3, '0')}.png`)
        try { out.push(await loadTex(path)) } catch {}
      }
      return out
    }

    try {
      this.bgTexture = await loadTex(resolve('背景.png'))
      this.bgSprite = new Sprite(this.bgTexture)
      this.bgViewportContainer.addChild(this.bgSprite)
    } catch {}

    try {
      const planetTex = await loadTex(resolve('星球.png'))
      this.planetSprite = new Sprite(planetTex)
      this.planetSprite.anchor.set(0.5, 0.5)
      this.planetContainer.addChild(this.planetSprite)
    } catch {}

    try {
      this.textures.star01 = await loadTex(resolve('装饰星星01.png'))
      this.textures.star02 = await loadTex(resolve('装饰星星02.png'))
      this.textures.moon = await loadTex(resolve('装饰月亮01.png'))
      this.textures.meteor = await loadTex(resolve('装饰陨石01.png'))
    } catch (e) { console.warn('[StarCat] 基础素材异常:', e) }

    const idleFrames = await loadSeq('cat_idle', 'cat_idle_', 19)
    if (idleFrames.length > 0) {
      this.catIdleSprite = new AnimatedSprite(idleFrames)
      this.catIdleSprite.anchor.set(0.5, 1.0)
      this.catIdleSprite.animationSpeed = FIXED_CONFIG.cat.animSpeed
      this.catIdleSprite.play()
      this.catContainer.addChild(this.catIdleSprite)
    }

    const atkFrames = await loadSeq('cat_atk', 'cat_atk_', 11)
    if (atkFrames.length > 0) {
      this.catAtkSprite = new AnimatedSprite(atkFrames)
      this.catAtkSprite.anchor.set(0.5, 1.0)
      this.catAtkSprite.loop = false
      this.catAtkSprite.animationSpeed = 0.35
      this.catAtkSprite.visible = false
      this.catAtkSprite.onComplete = () => {
        if (!this.store.qte.isCharging && this.catAtkSprite && this.catIdleSprite) {
          this.catAtkSprite.visible = false
          this.catIdleSprite.visible = true
          this.catIdleSprite.play()
        }
      }
      this.catContainer.addChild(this.catAtkSprite)
    }

    const npcFrames = await loadSeq('npc_idle', 'npc_idle_', 41)
    if (npcFrames.length > 0) {
      this.npcSprite = new AnimatedSprite(npcFrames)
      this.npcSprite.anchor.set(0.5, 1.0)
      this.npcSprite.animationSpeed = 0.18
      this.npcSprite.play()
      this.npcSprite.scale.set(1.45)
      this.npcContainer.addChild(this.npcSprite)
      this.npcContainer.visible = false
    }

    this.bossIdleFrames = await loadSeq('boss_idle', 'boss_idle_', 34)
    this.bossAtk1Frames = await loadSeq('boss_atk1', 'boss_atk1_', 31)
    this.bossAtk2Frames = await loadSeq('boss_atk2', 'boss_atk2_', 41)
  }

  private applyFixedSetup() {
    if (this.planetSprite) {
      this.planetSprite.x = FIXED_CONFIG.planet.x
      this.planetSprite.y = FIXED_CONFIG.planet.y
      this.planetSprite.width = FIXED_CONFIG.planet.radius * 2
      this.planetSprite.height = FIXED_CONFIG.planet.radius * 2
    }

    this.catGroundedY = FIXED_CONFIG.planet.y - FIXED_CONFIG.planet.radius + FIXED_CONFIG.cat.yOffset
    if (this.isGrounded) this.catCurrentY = this.catGroundedY

    const setup = (sp: AnimatedSprite | null) => {
      if (!sp) return
      sp.x = this.catX
      sp.y = this.catCurrentY
      sp.scale.x = -Math.abs(FIXED_CONFIG.cat.scale)
      sp.scale.y = Math.abs(FIXED_CONFIG.cat.scale)
    }
    setup(this.catIdleSprite)
    setup(this.catAtkSprite)
  }

  public updateDimensions(w: number, h: number) {
    if (!this.app || !this.app.renderer) return
    this.app.renderer.resize(w, h)

    if (this.bgSprite && this.bgTexture) {
      const tw = this.bgTexture.width || 1920
      const th = this.bgTexture.height || 1080
      const coverScale = Math.max(w / tw, h / th) * 1.08
      this.bgSprite.scale.set(coverScale)
      this.bgSprite.anchor.set(0.5, 1.0)
      this.bgSprite.x = w / 2
      this.bgSprite.y = h + 4
    }

    const scale = Math.min(w / DESIGN_W, h / DESIGN_H)
    this.rootDesignStage.scale.set(scale)
    this.rootDesignStage.x = (w - DESIGN_W * scale) / 2
    this.rootDesignStage.y = (h - DESIGN_H * scale) / 2
  }

  private screenToDesignCoords(screenX: number, screenY: number) {
    const s = this.rootDesignStage.scale.x || 1
    return { x: (screenX - this.rootDesignStage.x) / s, y: (screenY - this.rootDesignStage.y) / s }
  }

  /* ==================== 彻底清屏 ==================== */

  public clearAllEntities() {
    this.effectsLayer.clear()

    for (const b of this.bodies) {
      if (b && b.container) {
        this.bodiesLayer.removeChild(b.container)
        b.container.destroy({ children: true })
      }
    }
    this.bodies = []
    this.bullets = []
    this.cannonOrbs = []
    this.groundShockwaves = []

    for (const m of this.meteors) {
      if (m && m.container) {
        this.meteorsLayer.removeChild(m.container)
        m.container.destroy({ children: true })
      }
    }
    this.meteors = []

    for (const p of this.particlePool) p.active = false
    for (const dt of this.damageTextPool) {
      dt.active = false
      dt.textObj.visible = false
    }

    if (this.currentBoss) {
      if (this.currentBoss.container && this.currentBoss.container.parent) {
        this.bossLayer.removeChild(this.currentBoss.container)
      }
      this.currentBoss.container?.destroy({ children: true })
      this.currentBoss = null
    }

    if (this.finalBoss) {
      if (this.finalBoss.container && this.finalBoss.container.parent) {
        this.stage3BossLayer.removeChild(this.finalBoss.container)
      }
      this.finalBoss.container?.destroy({ children: true })
      this.finalBoss = null
      this.store.boss.active = false
    }

    this.constellationNodes = []
    this.store.qte.active = false
    this.store.qte.skillCheckActive = false
    this.store.qte.isCharging = false
    this.timeScale = 1.0
  }

  /* ==================== 输入控制 ==================== */

  public handleMouseMove(e: MouseEvent) {
    if (this.isPaused) return
    const rect = this.containerEl.getBoundingClientRect()
    const c = this.screenToDesignCoords(e.clientX - rect.left, e.clientY - rect.top)
    this.mouseX = c.x
    this.mouseY = c.y
  }

  public handleMouseDown(e: MouseEvent) {
    if (this.isPaused || this.supplyMode) return
    if (this.store.qte.skillCheckActive) {
      this.resolveSkillCheck()
    }
  }

  public handleKeyDown(code: string) {
    if (this.isPaused || this.supplyMode) return

    if (code === 'KeyQ') {
      this.triggerStarCannon()
      return
    }

    if (code === 'Space') {
      if (this.store.qte.skillCheckActive) {
        this.resolveSkillCheck()
        return
      }
    }

    const inputKey = code.replace('Key', '')

    if (this.store.qte.active && !this.store.qte.skillCheckActive && this.currentBoss) {
      const qteKeyPool = ['W', 'A', 'S', 'D']
      if (qteKeyPool.includes(inputKey)) {
        const targetKey = this.currentBoss.qteKeys[this.currentBoss.qteCurrentIndex]
        if (inputKey === targetKey) {
          this.currentBoss.qteCurrentIndex++
          this.store.qte.currentIndex = this.currentBoss.qteCurrentIndex
          AudioSynth.playShieldCrackSound()
          this.triggerHitStop(0.04)

          if (this.currentBoss.isRedMoon) {
            this.store.qte.linesCount = this.currentBoss.qteCurrentIndex
            if (this.currentBoss.qteCurrentIndex >= this.currentBoss.qteKeys.length) {
              this.store.qte.skillCheckActive = true
              this.store.qte.isCharging = true
              if (this.catIdleSprite && this.catAtkSprite) {
                this.catIdleSprite.visible = false
                this.catAtkSprite.visible = true
                this.catAtkSprite.gotoAndPlay(0)
              }
            }
          } else {
            if (this.currentBoss.qteCurrentIndex >= this.currentBoss.qteKeys.length) {
              this.currentBoss.shieldActive = false
              this.currentBoss.isRushing = true
              this.store.qte.active = false
              this.timeScale = 1.0
              this.screenShakeIntensity = 14
              AudioSynth.playShieldCrackSound()
            }
          }
        } else {
          const severeDmg = Math.max(25, Math.floor(this.store.maxHp * 0.5))
          this.applyDamage(severeDmg)
          this.screenShakeIntensity = 28
          AudioSynth.playBossExplodeSound()

          this.currentBoss.qteCurrentIndex = 0
          this.store.qte.currentIndex = 0
          this.store.qte.linesCount = 0
        }
        return
      }
    }

    if (code === 'KeyA' || code === 'ArrowLeft') this.moveDir = -1
    else if (code === 'KeyD' || code === 'ArrowRight') this.moveDir = 1

    if (code === 'KeyW' || code === 'ArrowUp') {
      if (this.isGrounded) {
        this.catVy = -1350
        this.isGrounded = false
      }
    } else if (code === 'KeyS' || code === 'ArrowDown') {
      if (!this.isGrounded) {
        this.catVy += 2400
      }
    }
  }

  public handleKeyUp(code: string) {
    if (this.isPaused) return
    if ((code === 'KeyA' || code === 'ArrowLeft') && this.moveDir === -1) this.moveDir = 0
    if ((code === 'KeyD' || code === 'ArrowRight') && this.moveDir === 1) this.moveDir = 0
  }

  /* ==================== 歼星炮 ==================== */

  public triggerStarCannon(forceDirect = false) {
    if (!forceDirect) {
      if (!this.store.upgrades.includes('star_cannon')) return
      if (this.store.energy < 80) return
      this.store.energy -= 80
    }

    AudioSynth.playCannonLaunchSound()
    const startX = this.catX + 42
    const startY = this.catCurrentY - 72

    const targetX = forceDirect && this.currentBoss ? this.currentBoss.x : (this.finalBoss ? this.finalBoss.x : this.mouseX)
    const targetY = forceDirect && this.currentBoss ? this.currentBoss.y : (this.finalBoss ? this.finalBoss.y : this.mouseY)

    const angle = Math.atan2(targetY - startY, targetX - startX)
    const speed = 480

    this.cannonOrbs.push({
      id: this.bulletIdCounter++,
      x: startX,
      y: startY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      targetX,
      targetY,
      radius: 54,
      life: 0,
      isDetonated: false
    })

    if (this.catAtkSprite && this.catIdleSprite) {
      this.catIdleSprite.visible = false
      this.catAtkSprite.visible = true
      this.catAtkSprite.gotoAndPlay(0)
    }
  }

  private detonateCannonOrb(orb: CannonOrbEntity) {
    orb.isDetonated = true
    this.screenShakeIntensity = 38
    this.triggerHitStop(0.20)
    AudioSynth.playCannonMetalTearSound()

    const aoeRadius = 750
    this.createBurst(orb.x, orb.y, 0x00f3ff, 120, 3.0)
    this.createBurst(orb.x, orb.y, 0xffffff, 80, 2.2)
    this.createBurst(orb.x, orb.y, 0xffaa00, 50, 1.8)

    for (const body of this.bodies) {
      if (!body || body.isDestroyed) continue
      if (Math.hypot(body.x - orb.x, body.y - orb.y) <= aoeRadius) {
        body.isDestroyed = true
        this.createBurst(body.x, body.y, 0xffffff, 18, 1.0)
        this.miniGameStore.addSessionScore(30)
      }
    }

    for (const m of this.meteors) {
      if (!m || !m.active) continue
      if (Math.hypot(m.x - orb.x, m.y - orb.y) <= aoeRadius) {
        m.active = false
        this.createBurst(m.x, m.y, 0x8844ff, 25, 1.6)
        this.miniGameStore.addSessionScore(50)
      }
    }

    if (this.currentBoss && this.currentBoss.active) {
      const distToBoss = Math.hypot(this.currentBoss.x - orb.x, this.currentBoss.y - orb.y)
      if (distToBoss <= aoeRadius + this.currentBoss.radius) {
        if (this.currentBoss.shieldActive) {
          this.createBurst(this.currentBoss.x, this.currentBoss.y, 0x00f3ff, 60, 2.0)
          AudioSynth.playShieldCrackSound()
        } else {
          this.destroyMoonBoss(this.currentBoss)
          return
        }
      }
    }

    if (this.finalBoss && this.finalBoss.active) {
      const distToBoss = Math.hypot(this.finalBoss.x - orb.x, this.finalBoss.y - orb.y)
      if (distToBoss <= aoeRadius + this.finalBoss.radius) {
        const isWeak = this.finalBoss.state === 'weak'
        let dmg = 1000

        if (isWeak) {
          if (this.finalBoss.weakQHits === 0) {
            this.finalBoss.weakQHits++
            dmg = 7500
            this.finalBoss.x = Math.min(DESIGN_W - 80, this.finalBoss.x + 55)
            this.createBurst(this.finalBoss.x, this.finalBoss.y, 0xffea00, 60, 2.8)
          } else {
            dmg = 1000
            this.createBurst(this.finalBoss.x, this.finalBoss.y, 0x00f3ff, 30, 1.4)
          }
        } else {
          this.createBurst(this.finalBoss.x, this.finalBoss.y, 0x00f3ff, 35, 1.5)
        }

        this.store.boss.hp = Math.max(0, this.store.boss.hp - dmg)
        this.spawnDamageText(this.finalBoss.x, this.finalBoss.y - 140, dmg, isWeak && this.finalBoss.weakQHits === 1)
        this.store.addCombo()

        if (this.store.boss.hp <= 0) {
          this.finishStage3Boss()
        }
      }
    }
  }

  private resolveSkillCheck() {
    if (!this.store.qte.skillCheckActive || !this.currentBoss) return

    const pos = this.store.qte.sliderPos
    const isHit = pos >= this.store.qte.sweetSpotMin && pos <= this.store.qte.sweetSpotMax

    if (isHit) {
      AudioSynth.playSkillCheckHitSound()
      this.store.qte.skillCheckActive = false
      this.store.qte.active = false
      this.store.qte.isCharging = false
      this.timeScale = 1.0

      this.currentBoss.shieldActive = false
      this.triggerStarCannon(true)
    } else {
      this.store.qte.skillCheckActive = false
      this.store.qte.isCharging = false
      if (this.catIdleSprite && this.catAtkSprite) {
        this.catAtkSprite.visible = false
        this.catIdleSprite.visible = true
        this.catIdleSprite.play()
      }

      this.applyDamage(20)
      this.screenShakeIntensity = 20
      AudioSynth.playBossExplodeSound()

      this.skillCheckCooldown = 5.0
      this.currentBoss.qteCurrentIndex = 0
      this.store.qte.currentIndex = 0
      this.store.qte.linesCount = 0
    }
  }

  /* ==================== 射击系统 ==================== */

  private fireAutoBullet() {
    if (this.supplyMode || this.store.screen !== 'playing') return

    AudioSynth.playLaserSound()
    const startX = this.catX + 42
    const startY = this.catCurrentY - 72
    const baseAngle = Math.atan2(this.mouseY - startY, this.mouseX - startX)
    const speed = 1450

    const spawnBullet = (ang: number) => {
      this.bullets.push({
        id: this.bulletIdCounter++,
        x: startX,
        y: startY,
        vx: Math.cos(ang) * speed,
        vy: Math.sin(ang) * speed,
        radius: 9,
        life: 0,
        maxLife: 1.6
      })
    }

    if (this.store.upgrades.includes('triple_shot')) {
      spawnBullet(baseAngle)
      spawnBullet(baseAngle - 0.16)
      spawnBullet(baseAngle + 0.16)
    } else {
      spawnBullet(baseAngle)
    }
  }

  /* ==================== 敌怪生成 ==================== */

  private spawnSpaceStar(type: OrbType = 'normal', customX?: number, customY?: number, customVx?: number, customVy?: number) {
    const loop = this.store.loop || 1
    const speedMulti = 1 + Math.min(0.4, (loop - 1) * 0.10)

    const sx = customX ?? (DESIGN_W + 70)
    const sy = customY ?? (140 + Math.random() * 580)

    let tex = this.textures.star01
    let tint = 0xffffff
    let baseSpeed = (this.currentStage === 2 ? 380 + Math.random() * 90 : 230) * speedMulti
    let radiusBase = 64

    switch (type) {
      case 'normal':
        tex = Math.random() < 0.5 ? this.textures.star01 : this.textures.star02
        break
      case 'red':
        tex = this.textures.star02
        tint = 0xff2a48
        baseSpeed = (this.currentStage === 2 ? 460 + Math.random() * 90 : (this.currentStage === 3 ? 520 : 270)) * speedMulti
        radiusBase = 58
        break
      case 'blue':
        tex = this.textures.star02
        tint = 0x0088ff
        baseSpeed = (this.currentStage === 2 ? 390 : 220) * speedMulti
        radiusBase = 60
        break
    }

    const baseScale = 0.22 + Math.random() * 0.14
    const radius = radiusBase * baseScale

    const container = new Container()
    const rimGlow = new Graphics()
    container.addChild(rimGlow)

    const mainSprite = new Sprite(tex || Texture.WHITE)
    mainSprite.anchor.set(0.5, 0.5)
    mainSprite.scale.set(baseScale)
    mainSprite.tint = tint
    container.addChild(mainSprite)

    this.bodiesLayer.addChild(container)

    this.bodies.push({
      id: this.entityIdCounter++,
      type,
      x: sx,
      y: sy,
      baseY: sy,
      vx: customVx !== undefined ? customVx * speedMulti : -baseSpeed,
      vy: customVy !== undefined ? customVy * speedMulti : 0,
      radius,
      baseScale,
      rotationSpeed: (Math.random() - 0.5) * 0.05,
      floatFreq: 2.2 + Math.random() * 2.5,
      hzFreq: 6 + Math.random() * 8,
      time: Math.random() * Math.PI * 2,
      isDestroyed: false,
      container,
      rimGlow,
      mainSprite
    })
  }

  private spawnStage1Wave() {
    const waveType = Math.random()
    if (waveType < 0.5) {
      for (let i = 0; i < 3; i++) {
        setTimeout(() => {
          if (this.currentStage === 1 && !this.supplyMode && !this.isDestroyed) {
            this.spawnSpaceStar('normal', DESIGN_W + 50 + i * 45, 260 + i * 60)
          }
        }, i * 180)
      }
    } else {
      this.spawnSpaceStar('blue', DESIGN_W + 60, this.catGroundedY - 25, -280, 0)
    }
  }

  private spawnStage2AntiAfkWave() {
    const pattern = Math.floor(Math.random() * 3)

    if (pattern === 0) {
      this.spawnSpaceStar('red', DESIGN_W + 40, 80, -420, 240)
      this.spawnSpaceStar('normal', DESIGN_W + 120, 40, -420, 240)
    } else if (pattern === 1) {
      this.spawnSpaceStar('red', DESIGN_W + 60, this.catGroundedY - 28, -440, 0)
      this.spawnSpaceStar('blue', DESIGN_W + 60, this.catGroundedY - 260, -400, 0)
    } else {
      for (let k = 0; k < 3; k++) {
        this.spawnSpaceStar(k === 1 ? 'red' : 'normal', DESIGN_W + 60 + k * 80, 200 + k * 110, -430, 0)
      }
    }
  }

  private spawnStage1Moon() {
    this.stage1BossSpawned = true
    this.createMoonBoss(false, 3, ['W', 'A', 'D'])
  }

  public startStage2() {
    this.currentStage = 2
    this.store.stage = 2
    this.stage2MoonsSpawned = 0
    this.stage2NextMoonTime = performance.now() + 5000
    this.supplyMode = false
    this.npcFlyOut = true
  }

  private spawnStage2Moon() {
    this.stage2MoonsSpawned++
    if (this.stage2MoonsSpawned >= 3) {
      this.createMoonBoss(true, 6, ['W', 'A', 'S', 'D', 'W', 'D'])
    } else {
      this.createMoonBoss(false, 4, ['W', 'S', 'A', 'D'])
    }
  }

  private createMoonBoss(isRedMoon: boolean, qteLen: number, keys: string[]) {
    const tex = this.textures.moon || Texture.WHITE
    const container = new Container()
    const rimGlow = new Graphics()
    container.addChild(rimGlow)

    const scale = isRedMoon ? 0.92 : 0.58
    const mainSprite = new Sprite(tex)
    mainSprite.anchor.set(0.5, 0.5)
    mainSprite.scale.set(scale)
    mainSprite.tint = isRedMoon ? 0xff2222 : 0xffffff
    container.addChild(mainSprite)

    this.bossLayer.addChild(container)

    const targetX = isRedMoon ? DESIGN_W * 0.68 : DESIGN_W * 0.72
    const targetY = isRedMoon ? 400 : 420

    this.currentBoss = {
      active: true,
      isRedMoon,
      x: DESIGN_W + 220,
      y: targetY,
      targetX,
      radius: isRedMoon ? 96 : 66,
      scale,
      hp: 15,
      maxHp: 15,
      shieldActive: true,
      isRushing: false,
      qteKeys: keys,
      qteCurrentIndex: 0,
      container,
      rimGlow,
      mainSprite
    }

    this.store.qte.active = true
    this.store.qte.keys = [...keys]
    this.store.qte.currentIndex = 0
    this.store.qte.isRedMoon = isRedMoon
    this.store.qte.linesCount = 0
    this.store.qte.skillCheckActive = false
    this.timeScale = 0.28

    if (isRedMoon) {
      this.constellationNodes = [
        { x: targetX - 320, y: targetY - 200, color: 0x00f3ff, glowColor: 0x00aaff, hzFreq: 8,  connected: false },
        { x: targetX + 320, y: targetY - 180, color: 0xffd700, glowColor: 0xff8800, hzFreq: 12, connected: false },
        { x: targetX + 360, y: targetY + 160, color: 0x00ff88, glowColor: 0x00aa44, hzFreq: 6,  connected: false },
        { x: targetX - 300, y: targetY + 220, color: 0xcc44ff, glowColor: 0x8800cc, hzFreq: 10, connected: false },
        { x: targetX + 40,  y: targetY - 330, color: 0xff8800, glowColor: 0xff2200, hzFreq: 14, connected: false }
      ]
    }
  }

  private destroyMoonBoss(boss: MoonBoss) {
    boss.active = false
    this.triggerHitStop(0.15)
    this.screenShakeIntensity = 25
    this.timeScale = 1.0
    AudioSynth.playBossExplodeSound()

    this.createBurst(boss.x, boss.y, boss.isRedMoon ? 0xff0000 : 0xffffff, 90, 1.8)

    const loopMultiplier = 1 + (this.store.loop - 1) * 0.5
    if (this.currentStage === 1) {
      this.miniGameStore.addSessionScore(Math.floor(3000 * loopMultiplier))
      this.clearAllEntities()
      setTimeout(() => {
        if (!this.isDestroyed) this.enterSupply1()
      }, 500)
    } else if (this.currentStage === 2) {
      if (boss.isRedMoon) {
        this.miniGameStore.addSessionScore(Math.floor(10000 * loopMultiplier))
        this.clearAllEntities()
        setTimeout(() => {
          if (!this.isDestroyed) this.enterSupply2()
        }, 500)
      } else {
        this.miniGameStore.addSessionScore(Math.floor(3000 * loopMultiplier))
        if (boss.container && boss.container.parent) this.bossLayer.removeChild(boss.container)
        boss.container?.destroy({ children: true })
        this.currentBoss = null
        this.stage2NextMoonTime = performance.now() + 8000
      }
    }
  }

  /* ==================== 关卡 3 终极决战 ==================== */

  public startStage3() {
    this.clearAllEntities()
    this.currentStage = 3
    this.store.stage = 3
    this.supplyMode = false
    this.npcFlyOut = true

    this.store.energy = 80

    AudioSynth.startSynthBGM()

    const container = new Container()
    const glow = new Graphics()
    container.addChild(glow)

    const scale = STAGE3_BOSS_CONFIG.scale

    let idleSp: AnimatedSprite | null = null
    let atk1Sp: AnimatedSprite | null = null
    let atk2Sp: AnimatedSprite | null = null

    if (this.bossIdleFrames.length > 0) {
      idleSp = new AnimatedSprite(this.bossIdleFrames)
      idleSp.anchor.set(0.5, 0.5)
      idleSp.animationSpeed = 0.22
      idleSp.scale.set(scale)
      idleSp.play()
      container.addChild(idleSp)
    }

    if (this.bossAtk1Frames.length > 0) {
      atk1Sp = new AnimatedSprite(this.bossAtk1Frames)
      atk1Sp.anchor.set(0.5, 0.5)
      atk1Sp.animationSpeed = 0.35
      atk1Sp.scale.set(scale)
      atk1Sp.loop = false
      atk1Sp.visible = false
      container.addChild(atk1Sp)
    }

    if (this.bossAtk2Frames.length > 0) {
      atk2Sp = new AnimatedSprite(this.bossAtk2Frames)
      atk2Sp.anchor.set(0.5, 0.5)
      atk2Sp.animationSpeed = 0.32
      atk2Sp.scale.set(scale)
      atk2Sp.loop = false
      atk2Sp.visible = false
      container.addChild(atk2Sp)
    }

    this.stage3BossLayer.addChild(container)

    const loop = this.store.loop || 1
    const totalBossHp = Math.floor(STAGE3_BOSS_CONFIG.hp * (1 + (loop - 1) * 0.25))

    this.finalBoss = {
      active: true,
      x: DESIGN_W + 300,
      y: STAGE3_BOSS_CONFIG.y,
      targetX: STAGE3_BOSS_CONFIG.targetX,
      radius: 120 * (scale / 1.4),
      scale,
      container,
      idleSprite: idleSp,
      atk1Sprite: atk1Sp,
      atk2Sprite: atk2Sp,
      state: 'idle',
      stateTimer: 0,
      attackCooldown: 1.8,
      laserY: 0,
      laserDuration: 0,
      weakTimer: 0,
      weakQHits: 0,
      glow
    }

    this.store.boss.active = true
    this.store.boss.hp = totalBossHp
    this.store.boss.maxHp = totalBossHp
    this.store.boss.isWeak = false
    this.store.boss.isEnraged = false
    this.store.boss.stateName = 'NORMAL'
  }

  public startNextLoop() {
    this.clearAllEntities()
    this.currentStage = 1
    this.stage1BossSpawned = false
    this.stage2MoonsSpawned = 0
    this.supplyMode = false
    this.npcFlyOut = true
  }

  private finishStage3Boss() {
    if (!this.finalBoss) return
    this.finalBoss.active = false
    this.triggerHitStop(0.35)
    this.screenShakeIntensity = 45
    AudioSynth.playBossExplodeSound()
    AudioSynth.stopSynthBGM()

    this.createBurst(this.finalBoss.x, this.finalBoss.y, 0x00f3ff, 180, 3.5)
    this.createBurst(this.finalBoss.x, this.finalBoss.y, 0xffd700, 100, 2.5)

    const loopMultiplier = 1 + (this.store.loop - 1) * 0.5
    this.miniGameStore.addSessionScore(Math.floor(30000 * loopMultiplier))

    setTimeout(() => {
      this.clearAllEntities()
      this.store.screen = 'stageClear'
      this.supplyMode = true
      this.npcCurrentX = DESIGN_W + 280
      this.npcFlyOut = false
      if (this.npcContainer) {
        this.npcContainer.visible = true
        this.npcContainer.x = this.npcCurrentX
        this.npcContainer.y = this.catGroundedY - 10
      }
      this.onStageClear?.()
    }, 1200)
  }

  private enterSupply1() {
    this.supplyMode = true
    this.npcCurrentX = DESIGN_W + 280
    this.npcFlyOut = false
    if (this.npcContainer) {
      this.npcContainer.visible = true
      this.npcContainer.x = this.npcCurrentX
      this.npcContainer.y = this.catGroundedY - 10
    }

    setTimeout(() => {
      if (!this.isDestroyed && this.supplyMode) {
        this.store.screen = 'supply1'
        this.onEnterSupply1?.()
      }
    }, 1200)
  }

  private enterSupply2() {
    this.supplyMode = true
    this.npcCurrentX = DESIGN_W + 280
    this.npcFlyOut = false
    if (this.npcContainer) {
      this.npcContainer.visible = true
      this.npcContainer.x = this.npcCurrentX
      this.npcContainer.y = this.catGroundedY - 10
    }

    setTimeout(() => {
      if (!this.isDestroyed && this.supplyMode) {
        this.store.screen = 'supply2'
        this.onEnterSupply2?.()
      }
    }, 1000)
  }

  public exitSupplyToRight(cb?: () => void) {
    this.npcFlyOut = true
    setTimeout(() => {
      if (this.npcContainer) this.npcContainer.visible = false
      cb?.()
    }, 1000)
  }

  private applyDamage(dmg: number) {
    if (this.invulnerableTimer > 0) return

    this.store.hp = Math.max(0, this.store.hp - dmg)
    this.screenShakeIntensity = 18
    this.store.breakCombo()

    if (this.store.upgrades.includes('energy_shield')) {
      this.invulnerableTimer = 0.5
      this.store.isInvulnerable = true
    }

    if (this.store.hp <= 0) {
      this.store.screen = 'gameOver'
      AudioSynth.stopSynthBGM()
      this.onGameOver?.()
    }
  }

  private createBurst(x: number, y: number, color: number, count = 30, intensity = 1) {
    let spawned = 0
    for (const p of this.particlePool) {
      if (!p.active) {
        p.active = true
        p.x = x
        p.y = y
        const angle = Math.random() * Math.PI * 2
        const speed = (130 + Math.random() * 420) * intensity
        p.vx = Math.cos(angle) * speed
        p.vy = Math.sin(angle) * speed
        p.alpha = 1
        p.color = color
        p.size = 2.5 + Math.random() * 4
        p.life = 0
        p.maxLife = 0.35
        spawned++
        if (spawned >= count) break
      }
    }
  }

  private triggerHitStop(seconds: number) {
    this.hitStopTimer = seconds
  }

  /* ==================== 物理主循环 ==================== */

  private tick(dt: number) {
    if (this.isPaused) return
    if (this.hitStopTimer > 0) {
      this.hitStopTimer -= dt
      return
    }

    const now = performance.now()
    const audioBass = MiniGameAudio.isActive() ? MiniGameAudio.getBassEnergy() : 0
    const bass = Math.max(audioBass, AudioSynth.getSynthBass())
    const scaledDt = dt * this.timeScale

    if (this.invulnerableTimer > 0) {
      this.invulnerableTimer -= dt
      if (this.invulnerableTimer <= 0) this.store.isInvulnerable = false
    }

    const recoveryRate = this.store.upgrades.includes('energy_recycle') ? 14 : 7
    this.store.energy = Math.min(this.store.maxEnergy, this.store.energy + recoveryRate * dt)

    if (this.npcContainer && this.npcContainer.visible) {
      if (this.npcFlyOut) {
        this.npcCurrentX += 800 * dt
      } else if (this.npcCurrentX > this.npcTargetX) {
        this.npcCurrentX -= 450 * dt
      }
      this.npcContainer.x = this.npcCurrentX
    }

    if (this.supplyMode || this.store.screen !== 'playing') {
      this.render(bass)
      return
    }

    const spinDelta = FIXED_CONFIG.planet.spinSpeed * dt * 60 + bass * 0.18 * dt * 60
    if (this.planetSprite) this.planetSprite.rotation += spinDelta

    for (const s of this.parallaxStars) {
      if (!s) continue
      const spd = [4, 9, 20][s.layer] * (1 + bass * 0.5)
      s.x -= spd * scaledDt
      if (s.x < 0) s.x += DESIGN_W
    }

    // 地面等离子冲击波物理
    for (let i = this.groundShockwaves.length - 1; i >= 0; i--) {
      const sw = this.groundShockwaves[i]
      if (!sw) continue
      sw.x += sw.vx * dt
      sw.life += dt

      if (sw.active && Math.abs(sw.x - this.catX) < sw.width * 0.6) {
        if (this.catCurrentY >= this.catGroundedY - 35) {
          sw.active = false
          this.applyDamage(24)
          this.createBurst(this.catX, this.catGroundedY - 20, 0x00f3ff, 25, 1.4)
        }
      }

      if (sw.x < -150 || sw.life > 3.0 || !sw.active) {
        this.groundShockwaves.splice(i, 1)
      }
    }

    // 敌对陨石物理
    for (let i = this.meteors.length - 1; i >= 0; i--) {
      const m = this.meteors[i]
      if (!m) continue
      if (!m.active) {
        if (m.container) {
          this.meteorsLayer.removeChild(m.container)
          m.container.destroy({ children: true })
        }
        this.meteors.splice(i, 1)
        continue
      }

      m.x += m.vx * scaledDt
      m.y += m.vy * scaledDt
      m.life += scaledDt

      if (m.container) {
        m.container.x = m.x
        m.container.y = m.y
      }
      if (m.sprite) m.sprite.rotation += m.rotationSpeed

      if (m.isBossAttack && m.glow) {
        m.glow.clear()
        const pulse = Math.sin(now * 0.008 + m.life * 5) * 0.2 + 0.5
        m.glow.circle(0, 0, m.radius * 1.3)
          .stroke({ width: 2, color: m.isApexCutter ? 0xff0055 : 0x00f3ff, alpha: pulse })
        m.glow.circle(0, 0, m.radius * 1.05)
          .stroke({ width: 1.5, color: 0x8844ff, alpha: 0.6 })
      }

      if (m.isBossAttack) {
        const d = Math.hypot(m.x - this.catX, m.y - (this.catCurrentY - 50))
        if (d < m.radius + 32) {
          m.active = false
          this.applyDamage(m.isApexCutter ? 32 : 26)
          this.createBurst(m.x, m.y, 0x8844ff, 20, 1.2)
        }
      }

      if (m.x < -200 || m.y > DESIGN_H + 200 || m.life > 4.5) {
        m.active = false
        if (m.container) {
          this.meteorsLayer.removeChild(m.container)
          m.container.destroy({ children: true })
        }
        this.meteors.splice(i, 1)
      }
    }

    // 玩家水平位移与 Apex Float 纵向跳跃
    this.catX += this.moveDir * 450 * dt
    this.catX = Math.max(250, Math.min(750, this.catX))

    if (!this.isGrounded) {
      const isApex = Math.abs(this.catVy) < 300
      const currentGravity = isApex ? 900 : 1850
      this.catVy += currentGravity * dt
      this.catCurrentY += this.catVy * dt

      if (this.catCurrentY >= this.catGroundedY) {
        this.catCurrentY = this.catGroundedY
        this.catVy = 0
        this.isGrounded = true
      }
    }

    if (this.catIdleSprite) { this.catIdleSprite.x = this.catX; this.catIdleSprite.y = this.catCurrentY }
    if (this.catAtkSprite) { this.catAtkSprite.x = this.catX; this.catAtkSprite.y = this.catCurrentY }

    this.autoShootTimer += dt
    if (this.autoShootTimer >= this.AUTO_SHOOT_INTERVAL) {
      this.autoShootTimer = 0
      this.fireAutoBullet()
    }

    // 关卡进度触发
    if (this.currentStage === 1) {
      if (this.miniGameStore.sessionScore >= STAGE1_BOSS_TRIGGER_SCORE && !this.stage1BossSpawned) {
        this.spawnStage1Moon()
      }
    } else if (this.currentStage === 2) {
      if (!this.currentBoss && now >= this.stage2NextMoonTime) {
        this.spawnStage2Moon()
      }
    }

    // 杂兵弹幕生成节奏
    if (!this.currentBoss || !this.currentBoss.isRedMoon) {
      if (now > this.nextSpawnTime) {
        if (this.currentStage === 1) {
          this.spawnStage1Wave()
          this.nextSpawnTime = now + (550 + Math.random() * 250) / (1 + bass * 0.5)
        } else if (this.currentStage === 2) {
          this.spawnStage2AntiAfkWave()
          this.nextSpawnTime = now + (420 + Math.random() * 200) / (1 + bass * 0.7)
        } else {
          this.spawnSpaceStar(Math.random() < 0.75 ? 'red' : 'normal')
          this.nextSpawnTime = now + 480 / (1 + bass * 0.8)
        }
      }
    }

    // 敌怪更新
    for (let i = this.bodies.length - 1; i >= 0; i--) {
      const node = this.bodies[i]
      if (!node) continue
      node.time += scaledDt
      node.x += node.vx * scaledDt
      node.baseY += node.vy * scaledDt

      const floatAmp = 35 + bass * 280
      node.y = node.baseY + Math.sin(node.time * node.floatFreq) * floatAmp

      if (node.container) {
        node.container.x = node.x
        node.container.y = node.y
      }
      if (node.mainSprite) node.mainSprite.rotation += node.rotationSpeed

      const distToCat = Math.hypot(node.x - this.catX, node.y - (this.catCurrentY - 60))
      if (distToCat < node.radius + 36 && !node.isDestroyed) {
        this.applyDamage(node.type === 'red' ? 25 : 12)
        node.isDestroyed = true
        this.createBurst(node.x, node.y, 0xffaa00, 10, 0.6)
      }

      if (node.x < -120 || node.y > DESIGN_H + 120 || node.isDestroyed) {
        if (node.container) {
          this.bodiesLayer.removeChild(node.container)
          node.container.destroy({ children: true })
        }
        this.bodies.splice(i, 1)
      }
    }

    // 子弹更新与伤害命中判定
    const baseBulletDmg = this.store.upgrades.includes('weapon_boost') ? 30 : 10
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i]
      if (!b) continue
      b.x += b.vx * dt
      b.y += b.vy * dt
      b.life += dt

      let bulletHit = false

      // 击中第 1/2 关 Boss
      if (this.currentBoss && this.currentBoss.active) {
        const d = Math.hypot(b.x - this.currentBoss.x, b.y - this.currentBoss.y)
        if (d <= this.currentBoss.radius + b.radius) {
          bulletHit = true
          this.createBurst(b.x, b.y, 0x00f3ff, 6, 0.5)

          if (!this.currentBoss.shieldActive && !this.currentBoss.isRedMoon) {
            this.currentBoss.hp--
            this.store.addCombo()
            this.spawnDamageText(this.currentBoss.x, this.currentBoss.y - 40, baseBulletDmg)
            if (this.currentBoss.hp <= 0) {
              this.destroyMoonBoss(this.currentBoss)
              return // 彻底清屏后直接跳出本帧，防止访问 null
            }
          }
        }
      }

      // 击中关卡 3 终极 Boss
      if (this.finalBoss && this.finalBoss.active) {
        const d = Math.hypot(b.x - this.finalBoss.x, b.y - this.finalBoss.y)
        if (d <= this.finalBoss.radius + b.radius) {
          bulletHit = true
          this.createBurst(b.x, b.y, 0x00f3ff, 8, 0.6)

          const isWeak = this.finalBoss.state === 'weak'
          const actualDmg = isWeak ? Math.floor(baseBulletDmg * 3.0) : Math.max(1, Math.floor(baseBulletDmg * 0.4))

          this.store.boss.hp = Math.max(0, this.store.boss.hp - actualDmg)
          this.store.addCombo()
          this.spawnDamageText(this.finalBoss.x, this.finalBoss.y - 120, actualDmg, isWeak)

          if (this.store.boss.hp <= 0) {
            this.finishStage3Boss()
            return
          }
        }
      }

      if (!bulletHit) {
        for (const node of this.bodies) {
          if (!node || node.isDestroyed) continue
          if (Math.hypot(b.x - node.x, b.y - node.y) <= node.radius + b.radius + 8) {
            node.isDestroyed = true
            bulletHit = true
            this.createBurst(node.x, node.y, node.type === 'red' ? 0xff2a48 : 0xffffff, 14, 0.9)
            AudioSynth.playCaptureSound(node.type)

            this.store.addCombo()
            this.spawnDamageText(node.x, node.y, baseBulletDmg)

            const scoreBase = node.type === 'red' ? 40 : 20
            this.miniGameStore.addSessionScore(scoreBase)
            if (node.type === 'normal') this.store.whiteStars++
            break
          }
        }
      }

      if (bulletHit || b.life >= b.maxLife || b.x < -50 || b.x > DESIGN_W + 50 || b.y < -50 || b.y > DESIGN_H + 50) {
        this.bullets.splice(i, 1)
      }
    }

    // 歼星炮更新
    for (let i = this.cannonOrbs.length - 1; i >= 0; i--) {
      const orb = this.cannonOrbs[i]
      if (!orb) continue
      orb.x += orb.vx * dt
      orb.y += orb.vy * dt
      orb.life += dt

      const distToTarget = Math.hypot(orb.x - orb.targetX, orb.y - orb.targetY)
      if (distToTarget <= 35 || orb.life >= 2.5) {
        this.detonateCannonOrb(orb)
        this.cannonOrbs.splice(i, 1)
      }
    }

    // 关卡 3 Boss 状态机
    if (this.finalBoss && this.finalBoss.active) {
      if (this.finalBoss.x > this.finalBoss.targetX) {
        this.finalBoss.x -= 200 * dt
      }
      if (this.finalBoss.container) {
        this.finalBoss.container.x = this.finalBoss.x
        this.finalBoss.container.y = this.finalBoss.y
      }

      const isEnraged = this.store.boss.hp <= STAGE3_BOSS_CONFIG.enrageHp
      this.store.boss.isEnraged = isEnraged
      if (isEnraged) {
        this.finalBoss.idleSprite && (this.finalBoss.idleSprite.tint = 0xff3333)
        this.finalBoss.atk1Sprite && (this.finalBoss.atk1Sprite.tint = 0xff3333)
        this.finalBoss.atk2Sprite && (this.finalBoss.atk2Sprite.tint = 0xff3333)
      }

      this.finalBoss.stateTimer += dt

      switch (this.finalBoss.state) {
        case 'idle':
          this.store.boss.stateName = isEnraged ? 'OVERDRIVE' : 'ARMOR'
          this.store.boss.isWeak = false
          if (this.finalBoss.idleSprite) this.finalBoss.idleSprite.visible = true
          if (this.finalBoss.atk1Sprite) this.finalBoss.atk1Sprite.visible = false
          if (this.finalBoss.atk2Sprite) this.finalBoss.atk2Sprite.visible = false

          this.finalBoss.attackCooldown -= dt
          if (this.finalBoss.attackCooldown <= 0) {
            if (Math.random() < 0.5) {
              this.finalBoss.state = 'slam'
              this.finalBoss.stateTimer = 0
              if (this.finalBoss.idleSprite) this.finalBoss.idleSprite.visible = false
              if (this.finalBoss.atk1Sprite) {
                this.finalBoss.atk1Sprite.visible = true
                this.finalBoss.atk1Sprite.gotoAndPlay(0)
              }
            } else {
              this.finalBoss.state = 'laser_charge'
              this.finalBoss.stateTimer = 0
              this.finalBoss.laserY = this.catGroundedY - 42
              AudioSynth.playTelegraphSound()
              if (this.finalBoss.idleSprite) this.finalBoss.idleSprite.visible = false
              if (this.finalBoss.atk2Sprite) {
                this.finalBoss.atk2Sprite.visible = true
                this.finalBoss.atk2Sprite.gotoAndPlay(0)
              }
            }
          }
          break

        case 'slam':
          this.store.boss.stateName = 'SLAM'

          if (this.finalBoss.stateTimer >= 0.50 && this.finalBoss.stateTimer - dt < 0.50) {
            this.screenShakeIntensity = 30
            AudioSynth.playGroundSlamSound()
            AudioSynth.playShockwaveSound()

            this.groundShockwaves.push({
              active: true,
              x: this.finalBoss.x - 80,
              y: this.catGroundedY - 20,
              vx: -780,
              width: 80,
              height: 42,
              life: 0
            })
          }

          if (this.finalBoss.stateTimer >= 0.72 && this.finalBoss.stateTimer - dt < 0.72) {
            const cutterCount = isEnraged ? 4 : 3
            for (let m = 0; m < cutterCount; m++) {
              this.spawnApexCutterMeteor(this.catGroundedY - 180 - m * 35)
            }
          }

          if (this.finalBoss.stateTimer >= 1.25) {
            this.finalBoss.state = 'idle'
            const loop = this.store.loop || 1
            const cdBase = isEnraged ? 0.9 : 1.4
            this.finalBoss.attackCooldown = Math.max(0.65, cdBase - (loop - 1) * 0.12)
          }
          break

        case 'laser_charge':
          this.store.boss.stateName = 'LASER'
          if (this.finalBoss.stateTimer >= 0.90) {
            this.finalBoss.state = 'laser_fire'
            this.finalBoss.stateTimer = 0
            this.finalBoss.laserDuration = 0.70
            AudioSynth.playLaserBeamSound()
          }
          break

        case 'laser_fire':
          this.finalBoss.laserDuration -= dt
          this.screenShakeIntensity = 16

          if (this.catCurrentY > this.finalBoss.laserY - 32) {
            this.applyDamage(52 * dt)
          }

          if (this.finalBoss.laserDuration <= 0) {
            this.finalBoss.state = 'weak'
            this.finalBoss.stateTimer = 0
            this.finalBoss.weakTimer = 2.8
            this.finalBoss.weakQHits = 0
          }
          break

        case 'weak':
          this.store.boss.stateName = 'WEAK'
          this.store.boss.isWeak = true
          this.finalBoss.weakTimer -= dt
          if (this.finalBoss.idleSprite) this.finalBoss.idleSprite.visible = true
          if (this.finalBoss.atk2Sprite) this.finalBoss.atk2Sprite.visible = false

          if (this.finalBoss.weakTimer <= 0) {
            this.finalBoss.state = 'idle'
            const loop = this.store.loop || 1
            const cdBase = isEnraged ? 0.8 : 1.3
            this.finalBoss.attackCooldown = Math.max(0.6, cdBase - (loop - 1) * 0.12)
          }
          break
      }
    }

    // ==================== 第一/二关 Boss 运动与撞击修复 ====================
    if (this.currentBoss && this.currentBoss.active) {
      if (this.currentBoss.isRushing) {
        const rushSpeed = this.currentStage === 2 ? 780 : 680
        this.currentBoss.x -= rushSpeed * dt
        const dy = (this.catCurrentY - 60) - this.currentBoss.y
        this.currentBoss.y += Math.sign(dy) * 180 * dt

        const dToCat = Math.hypot(this.currentBoss.x - this.catX, this.currentBoss.y - (this.catCurrentY - 60))
        if (dToCat <= this.currentBoss.radius + 36) {
          // 致命修复：撞击玩家只扣血、震退并弹开，绝不能调用 destroyMoonBoss 误触发胜利！
          this.applyDamage(35)
          AudioSynth.playShieldCrackSound()
          this.screenShakeIntensity = 24
          this.triggerHitStop(0.08)
          this.createBurst(this.catX, this.catCurrentY - 50, 0xff2a48, 20, 1.2)

          // 震退弹回右侧
          this.currentBoss.x = Math.min(DESIGN_W + 180, this.currentBoss.x + 460)
          this.currentBoss.y = 400
          this.currentBoss.isRushing = false

          // 1.2 秒后重新发起冲锋，迫使玩家开火将其击落
          const bossRef = this.currentBoss
          setTimeout(() => {
            if (bossRef && bossRef.active && !this.isDestroyed) {
              bossRef.isRushing = true
            }
          }, 1200)
        }

        // 冲出左侧后绕回右方重新冲锋
        if (this.currentBoss.x < -140) {
          this.currentBoss.x = DESIGN_W + 180
          this.currentBoss.y = 400
        }
      } else {
        if (this.currentBoss.x > this.currentBoss.targetX) {
          this.currentBoss.x -= 260 * scaledDt
        }
      }

      // 绝不可删的安全守卫：确保 boss 依然存活才更新显示
      if (!this.currentBoss || !this.currentBoss.active) return

      if (this.currentBoss.container) {
        this.currentBoss.container.x = this.currentBoss.x
        this.currentBoss.container.y = this.currentBoss.y
      }
      if (this.currentBoss.mainSprite) {
        this.currentBoss.mainSprite.rotation += 0.005
      }

      if (this.currentBoss.isRedMoon && this.currentBoss.mainSprite) {
        const pulse = 0.92 * (1 + bass * 0.22)
        this.currentBoss.mainSprite.scale.set(pulse)
      }

      if (this.currentBoss.rimGlow) {
        this.currentBoss.rimGlow.clear()
        const breath = 0.15 + Math.sin(now * 0.005) * 0.08
        const col = this.currentBoss.isRedMoon ? 0xff0000 : (this.currentBoss.isRushing ? 0xffaa00 : 0x00f3ff)
        this.currentBoss.rimGlow.circle(0, 0, this.currentBoss.radius * (1.25 + bass * 0.35))
          .fill({ color: col, alpha: this.currentBoss.shieldActive ? breath * 2 : breath * 0.8 })
      }
    }

    if (this.store.qte.skillCheckActive) {
      this.store.qte.sliderPos += this.sliderDirection * this.sliderSpeed * dt
      if (this.store.qte.sliderPos >= 1) {
        this.store.qte.sliderPos = 1
        this.sliderDirection = -1
      } else if (this.store.qte.sliderPos <= 0) {
        this.store.qte.sliderPos = 0
        this.sliderDirection = 1
      }
    }

    for (const p of this.particlePool) {
      if (!p || !p.active) continue
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.vx *= 0.92
      p.vy *= 0.92
      p.life += dt
      p.alpha = Math.max(0, 1 - p.life / p.maxLife)
      if (p.life >= p.maxLife || p.alpha <= 0.01) p.active = false
    }

    for (const dtItem of this.damageTextPool) {
      if (!dtItem || !dtItem.active) continue
      dtItem.y += dtItem.vy * dt
      dtItem.life += dt
      dtItem.alpha = Math.max(0, 1 - dtItem.life / dtItem.maxLife)
      dtItem.textObj.x = dtItem.x
      dtItem.textObj.y = dtItem.y
      dtItem.textObj.alpha = dtItem.alpha
      if (dtItem.life >= dtItem.maxLife) {
        dtItem.active = false
        dtItem.textObj.visible = false
      }
    }

    if (this.screenShakeIntensity > 0) {
      this.screenShakeIntensity = Math.max(0, this.screenShakeIntensity - dt * 45)
      this.rootDesignStage.pivot.set(
        (Math.random() - 0.5) * this.screenShakeIntensity,
        (Math.random() - 0.5) * this.screenShakeIntensity
      )
    } else {
      this.rootDesignStage.pivot.set(0, 0)
    }

    this.render(bass)
  }

  /* ==================== 渲染系统 ==================== */

  private render(bass: number) {
    this.effectsLayer.clear()
    const now = performance.now()

    this.starsLayer.clear()
    for (const s of this.parallaxStars) {
      if (!s) continue
      this.starsLayer.circle(s.x, s.y, s.size).fill({ color: 0xffffff, alpha: s.alpha })
    }

    for (const b of this.bullets) {
      if (!b) continue
      this.effectsLayer.circle(b.x, b.y, b.radius).fill({ color: 0xffffff, alpha: 0.95 })
      this.effectsLayer.circle(b.x, b.y, b.radius * 2.2).fill({ color: 0x00f3ff, alpha: 0.25 })
    }

    for (const orb of this.cannonOrbs) {
      if (!orb) continue
      this.effectsLayer.circle(orb.x, orb.y, orb.radius).fill({ color: 0x00f3ff, alpha: 0.4 })
      this.effectsLayer.circle(orb.x, orb.y, orb.radius * 0.6).fill({ color: 0xffffff, alpha: 0.95 })
      this.effectsLayer.circle(orb.x, orb.y, orb.radius * 1.6).stroke({ width: 3, color: 0x00f3ff, alpha: 0.8 })
    }

    for (const sw of this.groundShockwaves) {
      if (!sw || !sw.active) continue
      this.effectsLayer.ellipse(sw.x, sw.y, sw.width, sw.height * 0.5)
        .fill({ color: 0x00f3ff, alpha: 0.65 })
      this.effectsLayer.ellipse(sw.x, sw.y, sw.width * 0.6, sw.height * 0.3)
        .fill({ color: 0xffffff, alpha: 0.95 })
    }

    for (const node of this.bodies) {
      if (!node || node.isDestroyed || node.type !== 'red') continue
      const hzJitter = Math.sin(now * 0.001 * node.hzFreq * Math.PI * 2) * 5
      const currentRadius = node.radius * 1.3 + hzJitter * 0.5

      this.effectsLayer.circle(node.x, node.y, currentRadius * 2.0).fill({ color: 0xff0044, alpha: 0.35 })
      this.effectsLayer.circle(node.x, node.y, currentRadius).fill({ color: 0xff2a48, alpha: 0.85 })
      this.effectsLayer.circle(node.x, node.y, currentRadius * 0.45).fill({ color: 0xffffff, alpha: 0.95 })

      if (Math.random() < 0.25) {
        const sparkAngle = Math.random() * Math.PI * 2
        const sparkDist = currentRadius * 1.8
        this.effectsLayer.moveTo(node.x, node.y)
          .lineTo(node.x + Math.cos(sparkAngle) * sparkDist, node.y + Math.sin(sparkAngle) * sparkDist)
          .stroke({ width: 1.5, color: 0xffaa00, alpha: 0.85 })
      }
    }

    if (this.finalBoss && this.finalBoss.active) {
      if (this.finalBoss.state === 'laser_charge') {
        const pulse = 0.5 + Math.sin(now * 0.04) * 0.4
        this.effectsLayer.moveTo(this.finalBoss.x, this.finalBoss.laserY)
          .lineTo(0, this.finalBoss.laserY)
          .stroke({ width: 2.5, color: 0xff0044, alpha: pulse })
      } else if (this.finalBoss.state === 'laser_fire') {
        this.effectsLayer.moveTo(this.finalBoss.x, this.finalBoss.laserY)
          .lineTo(0, this.finalBoss.laserY)
          .stroke({ width: 52, color: 0xff0055, alpha: 0.45 })
        this.effectsLayer.moveTo(this.finalBoss.x, this.finalBoss.laserY)
          .lineTo(0, this.finalBoss.laserY)
          .stroke({ width: 20, color: 0xffffff, alpha: 0.95 })
      } else if (this.finalBoss.state === 'weak') {
        this.effectsLayer.circle(this.finalBoss.x - 40, this.finalBoss.y, 48)
          .stroke({ width: 3.5, color: 0xffea00, alpha: 0.9 })
        this.effectsLayer.circle(this.finalBoss.x - 40, this.finalBoss.y, 20)
          .fill({ color: 0xffea00, alpha: 0.55 })
      }
    }

    if (this.currentBoss && this.currentBoss.active && this.currentBoss.isRedMoon && this.constellationNodes.length > 0) {
      const connCount = this.store.qte.linesCount
      const bossX = this.currentBoss.x
      const bossY = this.currentBoss.y

      for (let idx = 0; idx < this.constellationNodes.length; idx++) {
        const node = this.constellationNodes[idx]
        if (!node) continue
        const isConnected = idx < connCount

        const hzJitter = Math.sin(now * 0.001 * node.hzFreq * Math.PI * 2) * 5
        const currentRadius = (16 + hzJitter * 0.4) * (isConnected ? 1.2 : 1.0)

        this.effectsLayer.circle(node.x, node.y, currentRadius * 1.8)
          .fill({ color: node.glowColor, alpha: isConnected ? 0.4 : 0.15 })
        this.effectsLayer.circle(node.x, node.y, currentRadius)
          .fill({ color: node.color, alpha: isConnected ? 1.0 : 0.6 })
        this.effectsLayer.circle(node.x, node.y, currentRadius * 0.45)
          .fill({ color: 0xffffff, alpha: 0.95 })

        if (isConnected) {
          const dx = bossX - node.x
          const dy = bossY - node.y
          this.effectsLayer.moveTo(node.x, node.y).lineTo(bossX, bossY)
            .stroke({ width: 5, color: node.color, alpha: 0.35 })
          this.effectsLayer.moveTo(node.x, node.y).lineTo(bossX, bossY)
            .stroke({ width: 2, color: 0xffffff, alpha: 0.75 })

          const flowSpeed = 0.0018
          for (let p = 0; p < 4; p++) {
            const phase = ((now * flowSpeed + p / 4) % 1)
            const px = node.x + dx * phase
            const py = node.y + dy * phase
            this.effectsLayer.circle(px, py, 6).fill({ color: 0xffffff, alpha: 0.9 })
          }
        }
      }
    }

    for (const p of this.particlePool) {
      if (p && p.active && p.alpha > 0.01) {
        this.effectsLayer.circle(p.x, p.y, p.size).fill({ color: p.color, alpha: p.alpha })
      }
    }

    this.crosshairLayer.clear()
    const mx = this.mouseX, my = this.mouseY
    this.crosshairLayer.circle(mx, my, 14).stroke({ width: 1.5, color: 0x00f3ff, alpha: 0.7 })
    this.crosshairLayer.moveTo(mx - 20, my).lineTo(mx + 20, my).stroke({ width: 1.5, color: 0x00f3ff, alpha: 0.8 })
    this.crosshairLayer.moveTo(mx, my - 20).lineTo(mx, my + 20).stroke({ width: 1.5, color: 0x00f3ff, alpha: 0.8 })
  }

  public destroy() {
    this.isDestroyed = true
    this.isPaused = false
    AudioSynth.stopSynthBGM()
    if (this.app) {
      this.app.destroy(true, { children: true })
      this.app = null
    }
    this.bodies = []
    this.bullets = []
    this.cannonOrbs = []
    this.meteors = []
    this.groundShockwaves = []
    this.particlePool = []
    this.damageTextPool = []
  }
}