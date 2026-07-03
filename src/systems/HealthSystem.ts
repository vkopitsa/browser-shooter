export class HealthSystem {
  health: number
  maxHealth: number
  armor: number = 0
  invincibleTimer: number = 0
  isDead: boolean = false
  private baseMaxHealth: number

  constructor(maxHealth: number = 100) {
    this.health = maxHealth
    this.maxHealth = maxHealth
    this.baseMaxHealth = maxHealth
  }

  /** `pierceInvincible`: PvP bullets/grenades skip the invincibility window —
      it exists as an anti-spam mercy vs enemy AI, but in PvP it silently ate
      most hits (0.5s per hit, 1s after respawn = "my shots don't register"). */
  takeDamage(amount: number, pierceInvincible = false): boolean {
    if (this.isDead || amount <= 0) return false
    if (!pierceInvincible && this.invincibleTimer > 0) return false
    let toHealth = amount
    if (this.armor > 0) {
      const toArmor = Math.min(this.armor, amount * 0.5)
      this.armor -= toArmor
      toHealth = amount - toArmor
    }
    this.health = Math.max(0, this.health - toHealth)
    if (!pierceInvincible) this.invincibleTimer = 0.5
    if (this.health <= 0) {
      this.isDead = true
    }
    return true
  }

  heal(amount: number) {
    if (this.isDead) return
    this.health = Math.min(this.maxHealth, this.health + amount)
  }

  /** Raise the max-health cap and top the player up to it. */
  addMaxHealth(amount: number) {
    this.maxHealth += amount
    this.health = this.maxHealth
  }

  update(dt: number) {
    this.invincibleTimer = Math.max(0, this.invincibleTimer - dt)
  }

  reset() {
    this.maxHealth = this.baseMaxHealth
    this.health = this.maxHealth
    this.armor = 0
    this.isDead = false
    this.invincibleTimer = 0
  }

  /** Respawn: full health, clear death, brief spawn protection. Keeps maxHealth. */
  revive() {
    this.health = this.maxHealth
    this.armor = 0
    this.isDead = false
    this.invincibleTimer = 1
  }
}
