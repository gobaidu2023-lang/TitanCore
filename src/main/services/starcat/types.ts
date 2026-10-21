export type OrbType = 'normal' | 'red' | 'blue' | 'gold' | 'green'

export type GameScreen =
  | 'menu'
  | 'intro'
  | 'playing'
  | 'supply1'
  | 'supply2'
  | 'stageClear'
  | 'gameOver'

export interface UpgradeCard {
  id: string
  name: string
  desc: string
  cost: number
}

export interface BulletEntity {
  id: number
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  life: number
  maxLife: number
}

export interface CannonOrbEntity {
  id: number
  x: number
  y: number
  vx: number
  vy: number
  targetX: number
  targetY: number
  radius: number
  life: number
  isDetonated: boolean
}

export interface ConstellationStarNode {
  x: number
  y: number
  connected: boolean
}

export interface DamageTextEntity {
  active: boolean
  x: number
  y: number
  vy: number
  text: string
  alpha: number
  life: number
  maxLife: number
  color: number
  scale: number
}

export interface GroundShockwave {
  active: boolean
  x: number
  y: number
  vx: number
  width: number
  height: number
  life: number
}