// Floater.ts 巴达布前哨 - 引擎：飘字对象池（伤害/+金币/月结算提示）
import { Container, Text, TextStyle } from 'pixi.js'

// batch65：PC端（2K/4K、27-32寸）飘字全局放大——原尺寸按手游视角设计，高分辨率下不可读
const FLOAT_SCALE = 1.5
const FLOAT_MIN_SIZE = 22

interface FloatItem {
  text: Text
  active: boolean
  vy: number
  life: number
  maxLife: number
}

export class Floater {
  private pool: FloatItem[] = []

  constructor(private layer: Container) {
    const style = new TextStyle({
      fontFamily: 'monospace',
      fontSize: 20,
      fontWeight: '900',
      fill: '#ffd75e',
      stroke: { color: '#000000', width: 4 }
    })
    for (let i = 0; i < 30; i++) {
      const text = new Text({ text: '', style })
      text.anchor.set(0.5, 0.5)
      text.visible = false
      this.layer.addChild(text)
      this.pool.push({ text, active: false, vy: 0, life: 0, maxLife: 0.9 })
    }
  }

  show(x: number, y: number, str: string, color = '#ffd75e', fontSize = 20): void {
    const item = this.pool.find(p => !p.active)
    if (!item) return
    item.active = true
    item.text.text = str
    item.text.style.fill = color
    // batch65：统一放大（所有伤害数字/拦截/警示/产出口径一致）
    item.text.style.fontSize = Math.max(Math.round(fontSize * FLOAT_SCALE), FLOAT_MIN_SIZE)
    item.text.position.set(x, y)
    item.text.alpha = 1
    item.text.visible = true
    item.vy = -55
    item.life = 0
    item.maxLife = 0.9
  }

  update(dt: number): void {
    for (const item of this.pool) {
      if (!item.active) continue
      item.life += dt
      item.text.y += item.vy * dt
      item.text.alpha = Math.max(0, 1 - item.life / item.maxLife)
      if (item.life >= item.maxLife) {
        item.active = false
        item.text.visible = false
      }
    }
  }

  clear(): void {
    for (const item of this.pool) {
      item.active = false
      item.text.visible = false
    }
  }
}