# Team-Based Buy Menu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat 3-weapon buy menu with a full, CT-vs-T catalog where purchases equip weapons into primary/secondary slots and improve player properties (armor, max health, speed, weapon upgrades).

**Architecture:** Approach A — slot-based loadout. Weapons live in `primary`/`secondary` slots on `WeaponManager`; gear/upgrades are `StatEffect`s applied to `Player`/`HealthSystem`/the equipped `Weapon`. A team chosen on a pre-match screen filters the catalog. This plan covers singleplayer end-to-end; multiplayer sync is a documented follow-up plan.

**Tech Stack:** TypeScript, React 19, three.js, Vitest, jsdom, @testing-library/react.

**Conventions:**
- Run a single test file: `npx vitest run <path>`
- Run all tests: `npx vitest run`
- Typecheck: `npx tsc -b`
- Tests live in `__tests__/` next to source, named `*.test.ts(x)`.

**Type refinement vs spec:** the spec listed `StatEffect.weapon?: Partial<WeaponDef>`. This plan refines weapon upgrades to multiplier semantics (`WeaponUpgrade { ammoMult?, reloadMult?, damageMult? }`) because the buy items are "+50% ammo" / "−30% reload" style, which absolute `WeaponDef` fields can't express cleanly.

---

## File Structure

**Modify:**
- `src/types.ts` — add `Team`, `ItemKind`, `WeaponUpgrade`, `StatEffect`, `StoreItem`; widen `WeaponType`; add `'teamselect'` to `GameState`.
- `src/weapons/WeaponDefs.ts` — full weapon roster + `weaponVisual()`.
- `src/weapons/StoreCatalog.ts` — id-based catalog + `catalogForTeam`/`findItem`/`canAffordItem`.
- `src/weapons/Weapon.ts` — clone def per instance + `applyUpgrade()`.
- `src/weapons/WeaponManager.ts` — slot-based refactor.
- `src/systems/HealthSystem.ts` — armor + mutable max health.
- `src/player/Player.ts` — `armor`, `speedMult`, helpers, `resetLoadout()`.
- `src/ui/BuyMenu.tsx` — sectioned, team-filtered, owned-aware.
- `src/App.tsx` — team state, teamselect flow, buy wiring, slot keys, loadout reset.

**Create:**
- `src/player/applyPurchase.ts` — pure `applyItem()` applying a `StoreItem` to player + weapon manager.
- `src/ui/TeamSelect.tsx` — CT/T side-select screen.

**Update tests:** `WeaponManager.test.ts`, `WeaponManager.cycle.test.ts`, `StoreCatalog.test.ts`, `Weapon.test.ts`, `UI.test.tsx`. **New tests:** `applyPurchase.test.ts`, armor tests in `HealthSystem.test.ts`, `Player.test.ts` additions.

---

## Phase 1 — Types & Catalog Data

### Task 1: Types

**Files:**
- Modify: `src/types.ts`

- [ ] **Step 1: Widen `WeaponType` and add the new types**

In `src/types.ts`, replace the existing `WeaponType` line with the full roster and add the new types. The current line is:

```ts
export type WeaponType = 'pistol' | 'shotgun' | 'rifle'
```

Replace it with:

```ts
export type WeaponType =
  // secondary (pistols)
  | 'pistol' | 'usp' | 'glock' | 'deagle'
  // primary
  | 'm4' | 'aug' | 'ak' | 'galil' | 'mp5' | 'shotgun' | 'awp' | 'rifle'

export type Team = 'ct' | 't'

export type ItemKind = 'weapon' | 'armor' | 'health' | 'speed' | 'upgrade'

export interface WeaponUpgrade {
  ammoMult?: number    // multiplies maxAmmo (and refills)
  reloadMult?: number  // multiplies reloadTime
  damageMult?: number  // multiplies damage
}

export interface StatEffect {
  armor?: number       // +armor points
  maxHealth?: number   // +max HP (and full heal)
  speedMult?: number   // multiplies move speed
  weapon?: WeaponUpgrade // applied to the equipped weapon
}

export interface StoreItem {
  id: string
  name: string
  price: number
  kind: ItemKind
  team?: Team                       // omitted = both teams
  slot?: 'primary' | 'secondary'    // weapons only
  weaponType?: WeaponType           // weapons only
  effects?: StatEffect              // gear/upgrades
}
```

- [ ] **Step 2: Add `'teamselect'` to `GameState`**

Find the `GameState` union and add `'teamselect'`:

```ts
export type GameState = 'menu' | 'mpmenu' | 'settings' | 'teamselect' | 'playing' | 'paused' | 'gameover'
```

- [ ] **Step 3: Typecheck (expect failures elsewhere — that's fine for now)**

Run: `npx tsc -b`
Expected: errors only in files that consume the old `STORE_CATALOG`/`WeaponManager` shapes (fixed in later tasks). No errors *inside* `src/types.ts`.

- [ ] **Step 4: Commit**

```bash
git add src/types.ts
git commit -m "feat(types): add team/item/stat types and widen WeaponType"
```

---

### Task 2: Weapon roster + visual mapping

**Files:**
- Modify: `src/weapons/WeaponDefs.ts`
- Test: `src/weapons/__tests__/WeaponDefs.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `src/weapons/__tests__/WeaponDefs.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { WEAPON_DEFS, weaponVisual } from '../WeaponDefs'
import type { WeaponType } from '../../types'

const ALL: WeaponType[] = [
  'pistol', 'usp', 'glock', 'deagle',
  'm4', 'aug', 'ak', 'galil', 'mp5', 'shotgun', 'awp', 'rifle',
]

describe('WeaponDefs', () => {
  it('defines every weapon type with positive stats', () => {
    for (const t of ALL) {
      const def = WEAPON_DEFS[t]
      expect(def, t).toBeDefined()
      expect(def.damage).toBeGreaterThan(0)
      expect(def.maxAmmo).toBeGreaterThan(0)
    }
  })

  it('maps weapons to existing visual classes (no new assets)', () => {
    expect(weaponVisual('usp')).toBe('pistol')
    expect(weaponVisual('deagle')).toBe('pistol')
    expect(weaponVisual('shotgun')).toBe('shotgun')
    expect(weaponVisual('ak')).toBe('rifle')
    expect(weaponVisual('awp')).toBe('rifle')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/weapons/__tests__/WeaponDefs.test.ts`
Expected: FAIL — `weaponVisual` is not exported / missing defs.

- [ ] **Step 3: Implement the full roster + mapping**

Replace the entire contents of `src/weapons/WeaponDefs.ts` with:

```ts
import type { WeaponDef, WeaponType } from '../types'

export const WEAPON_DEFS: Record<WeaponType, WeaponDef> = {
  // --- secondary (pistols) ---
  pistol: { name: 'Pistol', damage: 25, fireRate: 0.3,  maxAmmo: 60, spread: 0.02,  range: 50, reloadTime: 1.5 },
  usp:    { name: 'USP',    damage: 28, fireRate: 0.32, maxAmmo: 60, spread: 0.018, range: 50, reloadTime: 1.6 },
  glock:  { name: 'Glock',  damage: 22, fireRate: 0.18, maxAmmo: 60, spread: 0.025, range: 45, reloadTime: 1.5 },
  deagle: { name: 'Deagle', damage: 50, fireRate: 0.4,  maxAmmo: 35, spread: 0.03,  range: 55, reloadTime: 1.8 },

  // --- primary ---
  m4:      { name: 'M4',      damage: 24, fireRate: 0.09, maxAmmo: 90,  spread: 0.04,  range: 65,  reloadTime: 2.4 },
  aug:     { name: 'AUG',     damage: 28, fireRate: 0.1,  maxAmmo: 90,  spread: 0.045, range: 70,  reloadTime: 2.6 },
  ak:      { name: 'AK-47',   damage: 30, fireRate: 0.1,  maxAmmo: 90,  spread: 0.05,  range: 65,  reloadTime: 2.5 },
  galil:   { name: 'Galil',   damage: 22, fireRate: 0.09, maxAmmo: 105, spread: 0.05,  range: 60,  reloadTime: 2.6 },
  mp5:     { name: 'MP5',     damage: 18, fireRate: 0.07, maxAmmo: 90,  spread: 0.05,  range: 45,  reloadTime: 2.0 },
  shotgun: { name: 'Shotgun', damage: 15, fireRate: 0.8,  maxAmmo: 30,  spread: 0.15,  range: 20,  reloadTime: 2.0 },
  awp:     { name: 'AWP',     damage: 100, fireRate: 1.2, maxAmmo: 20,  spread: 0.005, range: 120, reloadTime: 3.0 },
  rifle:   { name: 'Rifle',   damage: 20, fireRate: 0.1,  maxAmmo: 90,  spread: 0.05,  range: 60,  reloadTime: 2.5 },
}

/** Existing render/audio assets only know these three classes. */
export type WeaponVisual = 'pistol' | 'shotgun' | 'rifle'

const VISUAL: Record<WeaponType, WeaponVisual> = {
  pistol: 'pistol', usp: 'pistol', glock: 'pistol', deagle: 'pistol',
  shotgun: 'shotgun',
  m4: 'rifle', aug: 'rifle', ak: 'rifle', galil: 'rifle', mp5: 'rifle', awp: 'rifle', rifle: 'rifle',
}

/** Map any weapon to an existing visual/audio class so no new assets are needed. */
export function weaponVisual(type: WeaponType): WeaponVisual {
  return VISUAL[type]
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/weapons/__tests__/WeaponDefs.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/weapons/WeaponDefs.ts src/weapons/__tests__/WeaponDefs.test.ts
git commit -m "feat(weapons): full weapon roster + visual-class mapping"
```

---

### Task 3: Store catalog (id-based, team-aware)

**Files:**
- Modify: `src/weapons/StoreCatalog.ts`
- Test: `src/weapons/__tests__/StoreCatalog.test.ts` (replace)

- [ ] **Step 1: Replace the test**

Replace the entire contents of `src/weapons/__tests__/StoreCatalog.test.ts` with:

```ts
import { describe, it, expect } from 'vitest'
import { STORE_CATALOG, catalogForTeam, findItem, canAffordItem } from '../StoreCatalog'

describe('StoreCatalog', () => {
  it('every item has a unique id and non-negative price', () => {
    const ids = STORE_CATALOG.map((i) => i.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const i of STORE_CATALOG) expect(i.price).toBeGreaterThanOrEqual(0)
  })

  it('catalogForTeam keeps shared + own-team items, drops other team', () => {
    const ct = catalogForTeam('ct')
    expect(ct.some((i) => i.id === 'm4')).toBe(true)      // CT weapon
    expect(ct.some((i) => i.id === 'ak')).toBe(false)     // T weapon excluded
    expect(ct.some((i) => i.id === 'kevlar')).toBe(true)  // shared gear
    const t = catalogForTeam('t')
    expect(t.some((i) => i.id === 'ak')).toBe(true)
    expect(t.some((i) => i.id === 'm4')).toBe(false)
  })

  it('findItem returns the item by id', () => {
    expect(findItem('m4')?.weaponType).toBe('m4')
    expect(findItem('nope')).toBeUndefined()
  })

  it('canAffordItem compares money to price', () => {
    expect(canAffordItem(100, 'm4')).toBe(false)
    expect(canAffordItem(3000, 'm4')).toBe(true)
    expect(canAffordItem(0, 'nope')).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/weapons/__tests__/StoreCatalog.test.ts`
Expected: FAIL — new exports don't exist.

- [ ] **Step 3: Implement the catalog**

Replace the entire contents of `src/weapons/StoreCatalog.ts` with:

```ts
import type { StoreItem, Team } from '../types'

export const STORE_CATALOG: StoreItem[] = [
  // --- secondary (pistols) ---
  { id: 'pistol', name: 'Pistol', price: 0,   kind: 'weapon', slot: 'secondary', weaponType: 'pistol' },
  { id: 'usp',    name: 'USP',    price: 200, kind: 'weapon', slot: 'secondary', weaponType: 'usp',   team: 'ct' },
  { id: 'glock',  name: 'Glock',  price: 200, kind: 'weapon', slot: 'secondary', weaponType: 'glock', team: 't' },
  { id: 'deagle', name: 'Deagle', price: 700, kind: 'weapon', slot: 'secondary', weaponType: 'deagle' },

  // --- primary ---
  { id: 'm4',      name: 'M4',      price: 2700, kind: 'weapon', slot: 'primary', weaponType: 'm4',    team: 'ct' },
  { id: 'aug',     name: 'AUG',     price: 3300, kind: 'weapon', slot: 'primary', weaponType: 'aug',   team: 'ct' },
  { id: 'ak',      name: 'AK-47',   price: 2500, kind: 'weapon', slot: 'primary', weaponType: 'ak',    team: 't' },
  { id: 'galil',   name: 'Galil',   price: 2000, kind: 'weapon', slot: 'primary', weaponType: 'galil', team: 't' },
  { id: 'mp5',     name: 'MP5',     price: 1500, kind: 'weapon', slot: 'primary', weaponType: 'mp5' },
  { id: 'shotgun', name: 'Shotgun', price: 1200, kind: 'weapon', slot: 'primary', weaponType: 'shotgun' },
  { id: 'awp',     name: 'AWP',     price: 4750, kind: 'weapon', slot: 'primary', weaponType: 'awp' },

  // --- gear (shared) ---
  { id: 'kevlar',        name: 'Kevlar',        price: 650,  kind: 'armor',  effects: { armor: 50 } },
  { id: 'kevlar_helmet', name: 'Kevlar + Helmet', price: 1000, kind: 'armor', effects: { armor: 100 } },
  { id: 'medkit',        name: 'Medkit',        price: 800,  kind: 'health', effects: { maxHealth: 25 } },
  { id: 'boots',         name: 'Light Boots',   price: 500,  kind: 'speed',  effects: { speedMult: 1.15 } },

  // --- upgrades (shared, applied to equipped weapon) ---
  { id: 'ext_mag',     name: 'Extended Mag', price: 300, kind: 'upgrade', effects: { weapon: { ammoMult: 1.5 } } },
  { id: 'fast_reload', name: 'Fast Reload',  price: 400, kind: 'upgrade', effects: { weapon: { reloadMult: 0.7 } } },
]

/** Items available to a team: shared (no team) plus that team's own. */
export function catalogForTeam(team: Team): StoreItem[] {
  return STORE_CATALOG.filter((i) => i.team === undefined || i.team === team)
}

export function findItem(id: string): StoreItem | undefined {
  return STORE_CATALOG.find((i) => i.id === id)
}

export function canAffordItem(money: number, id: string): boolean {
  const item = findItem(id)
  return !!item && money >= item.price
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/weapons/__tests__/StoreCatalog.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/weapons/StoreCatalog.ts src/weapons/__tests__/StoreCatalog.test.ts
git commit -m "feat(weapons): id-based, team-aware store catalog"
```

---

## Phase 2 — Stats Layer

### Task 4: Armor + mutable max health on HealthSystem

**Files:**
- Modify: `src/systems/HealthSystem.ts`
- Test: `src/systems/__tests__/HealthSystem.test.ts` (append)

- [ ] **Step 1: Add the failing tests**

Append these tests inside the `describe('HealthSystem', ...)` block in `src/systems/__tests__/HealthSystem.test.ts` (before its closing `})`):

```ts
  it('defaults armor to 0', () => {
    expect(health.armor).toBe(0)
  })

  it('splits damage between armor and health when armored', () => {
    health.armor = 100
    health.takeDamage(50)
    expect(health.health).toBe(75) // half of 50 to health
    expect(health.armor).toBe(75)  // half of 50 to armor
  })

  it('armor absorbs only what it has, rest hits health', () => {
    health.armor = 10
    health.takeDamage(50) // armor can take min(10, 25)=10, health takes 40
    expect(health.armor).toBe(0)
    expect(health.health).toBe(60)
  })

  it('addMaxHealth raises the cap and tops up', () => {
    health.takeDamage(40) // health 60
    health.addMaxHealth(25)
    expect(health.maxHealth).toBe(125)
    expect(health.health).toBe(125)
  })

  it('reset clears armor and restores base max health', () => {
    health.armor = 50
    health.addMaxHealth(25)
    health.reset()
    expect(health.armor).toBe(0)
    expect(health.maxHealth).toBe(100)
    expect(health.health).toBe(100)
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/systems/__tests__/HealthSystem.test.ts`
Expected: FAIL — `armor`/`addMaxHealth` missing; damage not split.

- [ ] **Step 3: Implement**

Replace the entire contents of `src/systems/HealthSystem.ts` with:

```ts
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

  takeDamage(amount: number): boolean {
    if (this.invincibleTimer > 0 || this.isDead) return false
    let toHealth = amount
    if (this.armor > 0) {
      const toArmor = Math.min(this.armor, amount * 0.5)
      this.armor -= toArmor
      toHealth = amount - toArmor
    }
    this.health = Math.max(0, this.health - toHealth)
    this.invincibleTimer = 0.5
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
}
```

- [ ] **Step 4: Run tests to verify they pass (including the existing ones)**

Run: `npx vitest run src/systems/__tests__/HealthSystem.test.ts`
Expected: PASS (existing tests still pass since armor defaults to 0).

- [ ] **Step 5: Commit**

```bash
git add src/systems/HealthSystem.ts src/systems/__tests__/HealthSystem.test.ts
git commit -m "feat(health): armor damage split + mutable max health"
```

---

### Task 5: Player armor / speed multiplier

**Files:**
- Modify: `src/player/Player.ts`
- Test: `src/player/__tests__/Player.test.ts` (append)

- [ ] **Step 1: Add the failing tests**

Append inside the existing top-level `describe(...)` block in `src/player/__tests__/Player.test.ts` (before its closing `})`):

```ts
  it('exposes armor through the health system', () => {
    const p = new Player()
    expect(p.armor).toBe(0)
    p.addArmor(50)
    expect(p.armor).toBe(50)
    p.addArmor(80) // caps at 100
    expect(p.armor).toBe(100)
  })

  it('defaults speedMult to 1 and resets loadout', () => {
    const p = new Player()
    expect(p.speedMult).toBe(1)
    p.speedMult = 1.15
    p.addArmor(50)
    p.addMaxHealth(25)
    p.resetLoadout()
    expect(p.speedMult).toBe(1)
    expect(p.armor).toBe(0)
    expect(p.maxHealth).toBe(100)
  })
```

> If `src/player/__tests__/Player.test.ts` imports `Player` differently, match the existing import. The class is `import { Player } from '../Player'`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/player/__tests__/Player.test.ts`
Expected: FAIL — `armor`/`speedMult`/`addArmor`/`addMaxHealth`/`resetLoadout` missing.

- [ ] **Step 3: Implement**

In `src/player/Player.ts`:

(a) Add `speedMult` next to the other public fields (after `jumpHeight`):

```ts
  speed: number = 12
  jumpHeight: number = 8
  speedMult: number = 1
```

(b) Add these members after the existing `get maxHealth()` getter:

```ts
  get armor(): number {
    return this.healthSystem.armor
  }

  set armor(value: number) {
    this.healthSystem.armor = value
  }

  addArmor(amount: number) {
    this.healthSystem.armor = Math.min(100, this.healthSystem.armor + amount)
  }

  addMaxHealth(amount: number) {
    this.healthSystem.addMaxHealth(amount)
  }

  /** Reset purchased stats (called on death / match restart). */
  resetLoadout() {
    this.speedMult = 1
    this.healthSystem.reset()
  }
```

(c) Apply `speedMult` to movement. In `update(...)`, change the two velocity lines:

```ts
    this.velocity.x = direction.x * this.speed
    this.velocity.z = direction.z * this.speed
```

to:

```ts
    this.velocity.x = direction.x * this.speed * this.speedMult
    this.velocity.z = direction.z * this.speed * this.speedMult
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/player/__tests__/Player.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/player/Player.ts src/player/__tests__/Player.test.ts
git commit -m "feat(player): armor accessor, speed multiplier, loadout reset"
```

---

### Task 6: Per-instance weapon def + upgrades

**Files:**
- Modify: `src/weapons/Weapon.ts`
- Test: `src/weapons/__tests__/Weapon.test.ts` (append)

- [ ] **Step 1: Add the failing tests**

Append inside the existing `describe(...)` block in `src/weapons/__tests__/Weapon.test.ts` (before its closing `})`):

```ts
  it('does not share its def with WEAPON_DEFS (safe to upgrade)', async () => {
    const { WEAPON_DEFS } = await import('../WeaponDefs')
    const w = new Weapon('ak')
    expect(w.def).not.toBe(WEAPON_DEFS.ak)
    expect(w.def.damage).toBe(WEAPON_DEFS.ak.damage)
  })

  it('applyUpgrade multiplies ammo and refills', () => {
    const w = new Weapon('ak') // maxAmmo 90
    w.ammo = 10
    w.applyUpgrade({ ammoMult: 1.5 })
    expect(w.def.maxAmmo).toBe(135)
    expect(w.ammo).toBe(135)
  })

  it('applyUpgrade multiplies reload time and damage', () => {
    const w = new Weapon('ak') // reload 2.5, damage 30
    w.applyUpgrade({ reloadMult: 0.7, damageMult: 2 })
    expect(w.def.reloadTime).toBeCloseTo(1.75)
    expect(w.def.damage).toBe(60)
  })
```

> If `Weapon.test.ts` does not already import `Weapon`, it is `import { Weapon } from '../Weapon'`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/weapons/__tests__/Weapon.test.ts`
Expected: FAIL — def is shared; `applyUpgrade` missing.

- [ ] **Step 3: Implement**

In `src/weapons/Weapon.ts`:

(a) Update the import to include `WeaponUpgrade`:

```ts
import type { WeaponDef, WeaponType, WeaponUpgrade } from '../types'
```

(b) In the constructor, clone the def so upgrades never mutate the shared table. Change:

```ts
    this.def = WEAPON_DEFS[type]
```

to:

```ts
    this.def = { ...WEAPON_DEFS[type] }
```

(c) Add this method after `addAmmo(...)`:

```ts
  applyUpgrade(mod: WeaponUpgrade) {
    if (mod.ammoMult != null) {
      this.def.maxAmmo = Math.round(this.def.maxAmmo * mod.ammoMult)
      this.ammo = this.def.maxAmmo
    }
    if (mod.reloadMult != null) this.def.reloadTime *= mod.reloadMult
    if (mod.damageMult != null) this.def.damage = Math.round(this.def.damage * mod.damageMult)
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/weapons/__tests__/Weapon.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/weapons/Weapon.ts src/weapons/__tests__/Weapon.test.ts
git commit -m "feat(weapons): per-instance def clone + applyUpgrade"
```

---

## Phase 3 — Loadout

### Task 7: Slot-based WeaponManager

**Files:**
- Modify: `src/weapons/WeaponManager.ts`
- Test: `src/weapons/__tests__/WeaponManager.test.ts` (replace)
- Test: `src/weapons/__tests__/WeaponManager.cycle.test.ts` (replace)

- [ ] **Step 1: Replace the main test**

Replace the entire contents of `src/weapons/__tests__/WeaponManager.test.ts` with:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { WeaponManager } from '../WeaponManager'

describe('WeaponManager (slots)', () => {
  let m: WeaponManager
  beforeEach(() => { m = new WeaponManager() })

  it('starts with a pistol secondary and no primary, secondary selected', () => {
    expect(m.secondary.type).toBe('pistol')
    expect(m.primary).toBeNull()
    expect(m.currentSlot).toBe('secondary')
    expect(m.current.type).toBe('pistol')
  })

  it('equipping a primary selects it', () => {
    m.equip('ak', 'primary')
    expect(m.primary?.type).toBe('ak')
    expect(m.currentSlot).toBe('primary')
    expect(m.current.type).toBe('ak')
  })

  it('equipping a secondary replaces and selects it', () => {
    m.equip('deagle', 'secondary')
    expect(m.secondary.type).toBe('deagle')
    expect(m.current.type).toBe('deagle')
  })

  it('selectSlot ignores primary when none equipped', () => {
    m.selectSlot('primary')
    expect(m.currentSlot).toBe('secondary')
    m.equip('m4', 'primary')
    m.selectSlot('secondary')
    expect(m.current.type).toBe('pistol')
    m.selectSlot('primary')
    expect(m.current.type).toBe('m4')
  })

  it('switchTo selects the slot holding that weapon type', () => {
    m.equip('ak', 'primary')
    m.switchTo('pistol')
    expect(m.current.type).toBe('pistol')
    m.switchTo('ak')
    expect(m.current.type).toBe('ak')
  })

  it('update advances both equipped weapons', () => {
    m.equip('ak', 'primary')
    m.primary!.shoot()
    m.secondary.shoot()
    m.update(2)
    expect(m.primary!.fireTimer).toBe(0)
    expect(m.secondary.fireTimer).toBe(0)
  })

  it('addAmmo targets the matching equipped weapon', () => {
    m.equip('ak', 'primary')
    m.primary!.ammo = 10
    m.addAmmo('ak', 5)
    expect(m.primary!.ammo).toBe(15)
  })

  it('reset clears primary and restores pistol secondary', () => {
    m.equip('ak', 'primary')
    m.equip('deagle', 'secondary')
    m.reset()
    expect(m.primary).toBeNull()
    expect(m.secondary.type).toBe('pistol')
    expect(m.currentSlot).toBe('secondary')
  })
})
```

- [ ] **Step 2: Replace the cycle test**

Replace the entire contents of `src/weapons/__tests__/WeaponManager.cycle.test.ts` with:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { WeaponManager } from '../WeaponManager'

describe('WeaponManager.cycleNext', () => {
  let m: WeaponManager
  beforeEach(() => { m = new WeaponManager() })

  it('stays on secondary when no primary is equipped', () => {
    m.cycleNext()
    expect(m.current.type).toBe('pistol')
  })

  it('toggles between primary and secondary when both exist', () => {
    m.equip('m4', 'primary') // selects primary
    expect(m.current.type).toBe('m4')
    m.cycleNext()
    expect(m.current.type).toBe('pistol')
    m.cycleNext()
    expect(m.current.type).toBe('m4')
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/weapons/__tests__/WeaponManager.test.ts src/weapons/__tests__/WeaponManager.cycle.test.ts`
Expected: FAIL — old array-based API.

- [ ] **Step 4: Implement the slot-based manager**

Replace the entire contents of `src/weapons/WeaponManager.ts` with:

```ts
import { Weapon } from './Weapon'
import type { WeaponType } from '../types'

export type Slot = 'primary' | 'secondary'

export class WeaponManager {
  primary: Weapon | null = null
  secondary: Weapon
  currentSlot: Slot = 'secondary'

  constructor() {
    this.secondary = new Weapon('pistol')
  }

  get current(): Weapon {
    if (this.currentSlot === 'primary' && this.primary) return this.primary
    return this.secondary
  }

  equip(type: WeaponType, slot: Slot) {
    const weapon = new Weapon(type)
    if (slot === 'primary') this.primary = weapon
    else this.secondary = weapon
    this.currentSlot = slot
  }

  selectSlot(slot: Slot) {
    if (slot === 'primary' && !this.primary) return
    this.currentSlot = slot
  }

  cycleNext() {
    if (!this.primary) { this.currentSlot = 'secondary'; return }
    this.currentSlot = this.currentSlot === 'primary' ? 'secondary' : 'primary'
  }

  switchTo(type: WeaponType) {
    if (this.primary?.type === type) this.currentSlot = 'primary'
    else if (this.secondary.type === type) this.currentSlot = 'secondary'
  }

  update(dt: number) {
    this.primary?.update(dt)
    this.secondary.update(dt)
  }

  addAmmo(type: WeaponType, amount: number) {
    if (this.primary?.type === type) this.primary.addAmmo(amount)
    else if (this.secondary.type === type) this.secondary.addAmmo(amount)
  }

  reset() {
    this.primary = null
    this.secondary = new Weapon('pistol')
    this.currentSlot = 'secondary'
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/weapons/__tests__/WeaponManager.test.ts src/weapons/__tests__/WeaponManager.cycle.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/weapons/WeaponManager.ts src/weapons/__tests__/WeaponManager.test.ts src/weapons/__tests__/WeaponManager.cycle.test.ts
git commit -m "feat(weapons): slot-based WeaponManager (primary/secondary)"
```

---

### Task 8: applyItem (purchase → effect)

**Files:**
- Create: `src/player/applyPurchase.ts`
- Test: `src/player/__tests__/applyPurchase.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `src/player/__tests__/applyPurchase.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { applyItem } from '../applyPurchase'
import { Player } from '../Player'
import { WeaponManager } from '../../weapons/WeaponManager'
import { findItem } from '../../weapons/StoreCatalog'

function ctx() {
  return { player: new Player(), wm: new WeaponManager() }
}

describe('applyItem', () => {
  it('equips a primary weapon into its slot', () => {
    const { player, wm } = ctx()
    applyItem(findItem('ak')!, player, wm)
    expect(wm.primary?.type).toBe('ak')
    expect(wm.current.type).toBe('ak')
  })

  it('equips a secondary weapon into its slot', () => {
    const { player, wm } = ctx()
    applyItem(findItem('deagle')!, player, wm)
    expect(wm.secondary.type).toBe('deagle')
  })

  it('armor gear raises armor', () => {
    const { player, wm } = ctx()
    applyItem(findItem('kevlar')!, player, wm)
    expect(player.armor).toBe(50)
  })

  it('medkit raises max health', () => {
    const { player, wm } = ctx()
    applyItem(findItem('medkit')!, player, wm)
    expect(player.maxHealth).toBe(125)
  })

  it('boots increase speed multiplier', () => {
    const { player, wm } = ctx()
    applyItem(findItem('boots')!, player, wm)
    expect(player.speedMult).toBeCloseTo(1.15)
  })

  it('upgrade applies to the currently equipped weapon', () => {
    const { player, wm } = ctx()
    applyItem(findItem('ak')!, player, wm) // ak maxAmmo 90, now current
    applyItem(findItem('ext_mag')!, player, wm)
    expect(wm.current.def.maxAmmo).toBe(135)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/player/__tests__/applyPurchase.test.ts`
Expected: FAIL — `applyItem` does not exist.

- [ ] **Step 3: Implement**

Create `src/player/applyPurchase.ts`:

```ts
import type { StoreItem } from '../types'
import type { Player } from './Player'
import type { WeaponManager } from '../weapons/WeaponManager'

/** Apply a purchased item's effect to the player and weapon manager.
 *  Does NOT check affordability or deduct money — the caller owns the economy. */
export function applyItem(item: StoreItem, player: Player, wm: WeaponManager): void {
  switch (item.kind) {
    case 'weapon':
      if (item.weaponType && item.slot) wm.equip(item.weaponType, item.slot)
      break
    case 'armor':
      if (item.effects?.armor) player.addArmor(item.effects.armor)
      break
    case 'health':
      if (item.effects?.maxHealth) player.addMaxHealth(item.effects.maxHealth)
      break
    case 'speed':
      if (item.effects?.speedMult) player.speedMult *= item.effects.speedMult
      break
    case 'upgrade':
      if (item.effects?.weapon) wm.current.applyUpgrade(item.effects.weapon)
      break
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/player/__tests__/applyPurchase.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/player/applyPurchase.ts src/player/__tests__/applyPurchase.test.ts
git commit -m "feat(player): applyItem maps purchases to stat/weapon effects"
```

---

## Phase 4 — UI

### Task 9: TeamSelect screen

**Files:**
- Create: `src/ui/TeamSelect.tsx`
- Test: `src/ui/__tests__/TeamSelect.test.tsx` (create)

- [ ] **Step 1: Write the failing test**

Create `src/ui/__tests__/TeamSelect.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TeamSelect } from '../TeamSelect'

describe('TeamSelect', () => {
  it('calls onSelect with ct or t', () => {
    const onSelect = vi.fn()
    render(<TeamSelect onSelect={onSelect} />)
    fireEvent.click(screen.getByText(/Counter-Terrorist/i))
    expect(onSelect).toHaveBeenCalledWith('ct')
    fireEvent.click(screen.getByText(/^Terrorist/i))
    expect(onSelect).toHaveBeenCalledWith('t')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui/__tests__/TeamSelect.test.tsx`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement**

Create `src/ui/TeamSelect.tsx`:

```tsx
import type { Team } from '../types'

interface TeamSelectProps {
  onSelect: (team: Team) => void
}

export function TeamSelect({ onSelect }: TeamSelectProps) {
  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 16,
      background: '#0d0d14', fontFamily: 'monospace', color: '#fff',
    }}>
      <h2 style={{ margin: 0 }}>CHOOSE YOUR SIDE</h2>
      <div style={{ display: 'flex', gap: 24 }}>
        <button
          onClick={() => onSelect('ct')}
          style={{ padding: '20px 32px', background: '#1d3a5f', color: '#fff', border: '1px solid #3a6ea5', cursor: 'pointer', fontSize: 16 }}
        >
          Counter-Terrorist
        </button>
        <button
          onClick={() => onSelect('t')}
          style={{ padding: '20px 32px', background: '#5f3a1d', color: '#fff', border: '1px solid #a5703a', cursor: 'pointer', fontSize: 16 }}
        >
          Terrorist
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/ui/__tests__/TeamSelect.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/ui/TeamSelect.tsx src/ui/__tests__/TeamSelect.test.tsx
git commit -m "feat(ui): CT/T team-select screen"
```

---

### Task 10: Sectioned, team-filtered BuyMenu

**Files:**
- Modify: `src/ui/BuyMenu.tsx`
- Test: `src/ui/__tests__/BuyMenu.test.tsx` (create)
- Test: `src/ui/__tests__/UI.test.tsx` (update if it renders BuyMenu)

- [ ] **Step 1: Write the failing test**

Create `src/ui/__tests__/BuyMenu.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BuyMenu } from '../BuyMenu'

describe('BuyMenu', () => {
  it('shows the team catalog and hides the other team', () => {
    render(<BuyMenu team="ct" money={16000} owned={[]} onBuy={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByText('M4')).toBeTruthy()       // CT weapon
    expect(screen.queryByText('AK-47')).toBeNull()    // T weapon hidden
    expect(screen.getByText('Kevlar')).toBeTruthy()   // shared gear
  })

  it('calls onBuy with the item id', () => {
    const onBuy = vi.fn()
    render(<BuyMenu team="t" money={16000} owned={[]} onBuy={onBuy} onClose={vi.fn()} />)
    fireEvent.click(screen.getByText('AK-47'))
    expect(onBuy).toHaveBeenCalledWith('ak')
  })

  it('disables items the player cannot afford', () => {
    render(<BuyMenu team="ct" money={100} owned={[]} onBuy={vi.fn()} onClose={vi.fn()} />)
    const m4 = screen.getByText('M4').closest('button') as HTMLButtonElement
    expect(m4.disabled).toBe(true)
  })

  it('marks owned items and does not fire onBuy for them', () => {
    const onBuy = vi.fn()
    render(<BuyMenu team="ct" money={16000} owned={['m4']} onBuy={onBuy} onClose={vi.fn()} />)
    const m4 = screen.getByText('M4').closest('button') as HTMLButtonElement
    expect(m4.disabled).toBe(true)
    fireEvent.click(m4)
    expect(onBuy).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui/__tests__/BuyMenu.test.tsx`
Expected: FAIL — `BuyMenu` has the old `{ money, onBuy(type), onClose }` signature.

- [ ] **Step 3: Implement**

Replace the entire contents of `src/ui/BuyMenu.tsx` with:

```tsx
import { catalogForTeam, canAffordItem } from '../weapons/StoreCatalog'
import type { ItemKind, Team } from '../types'

interface BuyMenuProps {
  team: Team
  money: number
  owned: string[]            // ids already purchased this life
  onBuy: (id: string) => void
  onClose: () => void
}

const SECTIONS: { title: string; kinds: ItemKind[]; slot?: 'primary' | 'secondary' }[] = [
  { title: 'Pistols', kinds: ['weapon'], slot: 'secondary' },
  { title: 'Primary', kinds: ['weapon'], slot: 'primary' },
  { title: 'Gear', kinds: ['armor', 'health', 'speed'] },
  { title: 'Upgrades', kinds: ['upgrade'] },
]

export function BuyMenu({ team, money, owned, onBuy, onClose }: BuyMenuProps) {
  const catalog = catalogForTeam(team)
  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.6)', zIndex: 50, fontFamily: 'monospace', color: '#fff',
    }}>
      <div style={{ background: '#15151f', border: '1px solid #3a3a55', padding: 24, minWidth: 360, maxHeight: '80vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>BUY MENU · {team === 'ct' ? 'CT' : 'T'}</h2>
          <span>${money}</span>
        </div>

        {SECTIONS.map((section) => {
          const items = catalog.filter(
            (i) => section.kinds.includes(i.kind) && (section.slot ? i.slot === section.slot : true),
          )
          if (items.length === 0) return null
          return (
            <div key={section.title} style={{ marginBottom: 12 }}>
              <div style={{ color: '#8a8aad', fontSize: 12, margin: '8px 0 4px' }}>{section.title}</div>
              {items.map((item) => {
                const isOwned = owned.includes(item.id)
                const affordable = canAffordItem(money, item.id)
                const disabled = isOwned || !affordable
                return (
                  <button
                    key={item.id}
                    disabled={disabled}
                    onClick={() => onBuy(item.id)}
                    style={{
                      display: 'flex', justifyContent: 'space-between', width: '100%', padding: '8px 14px',
                      margin: '4px 0', background: disabled ? '#1a1a24' : '#23233a',
                      color: disabled ? '#666' : '#fff', border: '1px solid #3a3a55',
                      cursor: disabled ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <span>{item.name}</span>
                    <span>{isOwned ? 'OWNED' : item.price === 0 ? 'FREE' : `$${item.price}`}</span>
                  </button>
                )
              })}
            </div>
          )
        })}

        <button onClick={onClose} style={{ marginTop: 12, width: '100%', padding: 10, background: '#3a3a55', color: '#fff', border: 'none', cursor: 'pointer' }}>
          CLOSE (B)
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/ui/__tests__/BuyMenu.test.tsx`
Expected: PASS

- [ ] **Step 5: Fix UI.test.tsx if it renders BuyMenu**

Run: `npx vitest run src/ui/__tests__/UI.test.tsx`
If it FAILS because it renders `<BuyMenu .../>` with the old props, update that render to the new signature, e.g.:

```tsx
render(<BuyMenu team="ct" money={1000} owned={[]} onBuy={() => {}} onClose={() => {}} />)
```

and adjust assertions to the new content (section titles like "Pistols"/"Gear", `$` prices). If `UI.test.tsx` does not import `BuyMenu`, skip this step. Re-run until PASS.

- [ ] **Step 6: Commit**

```bash
git add src/ui/BuyMenu.tsx src/ui/__tests__/BuyMenu.test.tsx src/ui/__tests__/UI.test.tsx
git commit -m "feat(ui): sectioned, team-filtered, owned-aware buy menu"
```

---

## Phase 5 — App Wiring

### Task 11: Wire team-select, buying, and slot keys into App

**Files:**
- Modify: `src/App.tsx`

This task is integration glue over three.js + React refs, so it is verified by typecheck + the existing suite + a manual run rather than a new unit test.

- [ ] **Step 1: Imports and state**

In `src/App.tsx`:

(a) Update imports near the existing UI/weapon imports:

```ts
import { BuyMenu } from './ui/BuyMenu'
import { TeamSelect } from './ui/TeamSelect'
```

```ts
import { findItem, canAffordItem } from './weapons/StoreCatalog'
import { applyItem } from './player/applyPurchase'
import { weaponVisual } from './weapons/WeaponDefs'
```

Remove the now-unused `import { STORE_CATALOG } from './weapons/StoreCatalog'`.

(b) Add team + owned + maxHealth state next to `const [money, setMoney] = useState(16000)`:

```ts
  const [team, setTeam] = useState<Team>('ct')
  const [owned, setOwned] = useState<string[]>([])
  const [maxHealth, setMaxHealth] = useState(100)
```

Ensure `Team` is imported from `./types` (add it to the existing type import).

- [ ] **Step 2: Route singleplayer start through team-select**

Find where `MainMenu`'s `onSingleplayer={startGame}` is wired (the `gameState === 'menu'` block). Change it to open the team screen first:

```tsx
        <MainMenu
          onSingleplayer={() => updateGameState('teamselect')}
          onMultiplayer={() => updateGameState('mpmenu')}
          onSettings={() => updateGameState('settings')}
        />
```

- [ ] **Step 3: Render the TeamSelect screen**

Add a new block alongside the other `gameState === ...` blocks (e.g. after the `settings` block):

```tsx
      {gameState === 'teamselect' && (
        <TeamSelect onSelect={(t) => { setTeam(t); startGame() }} />
      )}
```

- [ ] **Step 4: Reset loadout + owned on (re)start**

In `startGame` (and any restart path that calls `setMoney(16000)` / `data.money = 16000`), reset the loadout. Locate the restart reset near `setMoney(16000); setStoreOpen(false)` and add:

```ts
    setOwned([])
    setMaxHealth(100)
    data.session.weaponManager.reset()
    data.session.player.resetLoadout()
    setWeaponName(data.session.weaponManager.current.def.name)
    setAmmo(data.session.weaponManager.current.ammo)
```

> If `startGame` constructs a fresh session, `reset()`/`resetLoadout()` are still safe no-ops on fresh objects. The goal: after starting, primary is empty, secondary is pistol, armor 0, speedMult 1, maxHealth 100.

- [ ] **Step 5: Replace the buy handler**

Replace the `onBuy` handler in the `gameState === 'playing' && storeOpen` BuyMenu block with the id-based, effect-applying version, and pass the new props:

```tsx
      {gameState === 'playing' && storeOpen && (
        <BuyMenu
          team={team}
          money={money}
          owned={owned}
          onBuy={(id) => {
            const data = gameDataRef.current
            const item = findItem(id)
            if (item && !owned.includes(id) && canAffordItem(data.money, id)) {
              data.money -= item.price
              setMoney(data.money)
              applyItem(item, data.session.player, data.session.weaponManager)
              setOwned((prev) => [...prev, id])
              setMaxHealth(data.session.player.maxHealth)
              const wm = data.session.weaponManager
              setWeaponName(wm.current.def.name)
              setAmmo(wm.current.ammo)
              data.viewmodel?.setWeapon(weaponVisual(wm.current.type))
            }
          }}
          onClose={() => setStoreOpen(false)}
        />
      )}
```

> Note: buying no longer auto-closes the menu (you can buy several items), matching CS. Closing is via the CLOSE button or `B`.

- [ ] **Step 6: Swap weapon-switch keys to slots**

Replace the `weaponKeys` block in the `keydown` handler:

```ts
      const weaponKeys: Record<string, number> = { Digit1: 0, Digit2: 1, Digit3: 2 }
      if (e.code in weaponKeys) {
        data.session.weaponManager.switchByIndex(weaponKeys[e.code])
        setWeaponName(data.session.weaponManager.current.def.name)
        setAmmo(data.session.weaponManager.current.ammo)
        data.viewmodel?.setWeapon(data.session.weaponManager.current.type)
      }
```

with slot selection:

```ts
      const slotKeys: Record<string, 'primary' | 'secondary'> = { Digit1: 'primary', Digit2: 'secondary' }
      if (e.code in slotKeys) {
        const wm = data.session.weaponManager
        wm.selectSlot(slotKeys[e.code])
        setWeaponName(wm.current.def.name)
        setAmmo(wm.current.ammo)
        data.viewmodel?.setWeapon(weaponVisual(wm.current.type))
      }
```

- [ ] **Step 7: Use `weaponVisual()` at the remaining weapon-type call sites**

Update the other places that pass a raw `weaponManager.current.type` to the viewmodel/audio so the widened `WeaponType` still maps to an existing asset:

- In `onCycleWeapon`: `gameDataRef.current.viewmodel?.setWeapon(weaponVisual(wm.current.type))`
- In the fire/audio path: `data.audio.playWeaponShoot(weaponVisual(session.weaponManager.current.type), session.player.position)`

Search `src/App.tsx` for `.current.type` and wrap each viewmodel/audio argument in `weaponVisual(...)`.

- [ ] **Step 8: Feed real max health to the HUD**

In the `gameState === 'playing'` HUD, change `maxHealth={100}` to `maxHealth={maxHealth}`.

- [ ] **Step 9: Typecheck and run the full suite**

Run: `npx tsc -b`
Expected: no errors.

Run: `npx vitest run`
Expected: all tests PASS. If a net/session test references `weaponManager.weapons`/`switchByIndex`/`currentIndex`, update it to the slot API (`primary`/`secondary`/`current`/`selectSlot`).

- [ ] **Step 10: Manual smoke test**

Run: `npm run dev`, open the app.
Verify: Singleplayer → team screen → pick a side → in-game press **B** → menu shows your team's weapons + shared gear/upgrades in sections; buying a primary swaps your weapon and equips slot **1**; buying Kevlar/Medkit/Boots changes survivability/HUD max health; money decreases and bought items show OWNED. Press **1**/**2** to switch primary/secondary.

- [ ] **Step 11: Commit**

```bash
git add src/App.tsx
git commit -m "feat(app): team-select flow, id-based buying with stat effects, slot keys"
```

---

## Follow-up (separate plan): Multiplayer sync

Out of scope here because it needs its own pass over `src/net/` (NetHost/NetClient/RemotePlayerManager) and host-authoritative economy. That plan should:

- Add `team?: Team` and `armor?: number` to `EntityState` in `src/session/protocol.ts`.
- Add `{ type: 'buy'; playerId: string; itemId: string }` to `NetMessage`.
- Track per-player money host-side; validate team + affordability + not-owned on the host; apply via the existing `applyItem`; broadcast `armor`/`team`/`weaponType` in snapshots.
- Client sends `buy` on click and reflects confirmed state from snapshots.
- Tests extend `NetHost.test.ts` / `NetClient.test.ts` (reject unaffordable / wrong-team / unknown item; armor+team in snapshot).

The singleplayer feature in this plan is complete and shippable without it.

---

## Self-Review Notes

- **Spec coverage:** full catalog (Tasks 2–3), CT/T different weapons + shared gear (Task 3 + Task 10 filter), property improvements — armor/maxHealth/speed/weapon-upgrade (Tasks 4–6, 8), team chosen before match (Tasks 1, 9, 11), buy menu UI (Task 10), loadout reset on death/restart (Tasks 5, 7, 11). Multiplayer sync intentionally deferred to a follow-up plan (documented above).
- **Type consistency:** `WeaponType` widened once (Task 1) and consumed everywhere; `weaponVisual()` keeps render/audio on existing assets; `applyItem(item, player, wm)` signature matches its callers (Tasks 8, 11); `BuyMenu` props `{ team, money, owned, onBuy(id), onClose }` consistent across Tasks 10–11; `WeaponManager` slot API (`primary`/`secondary`/`current`/`equip`/`selectSlot`/`cycleNext`/`switchTo`/`addAmmo`/`reset`) consistent across Tasks 7–8, 11.
- **No placeholders:** every code step contains full code; every test step has runnable assertions and an exact command.
