/**
 * Your body, on file — the personal inputs the mentor ASKS for.
 *
 * The mentor (Claude Code) interviews you — height, weight, age, units — the
 * first time a goal or tile needs body math (peak pharmacokinetics scale by
 * bodyweight; fuel targets scale by all of it). It writes the answers here,
 * you reload. Never guessed, never required up front: every field is optional
 * and the math degrades gracefully to sensible defaults.
 *
 * Two write paths, same as goals/weights:
 *   · this file (DEFAULT_PROFILE) — the mentor edits it in VS Code
 *   · localStorage 'vitality:profile' — the connector or a UI can retune
 *     without a code change; it wins over the defaults
 *
 * Ask in their units, store metric. lib knows only cm/kg.
 */

export interface Profile {
  /** First name, for the greeting. */
  name?: string
  heightCm?: number
  weightKg?: number
  age?: number
  sex?: 'male' | 'female'
  /** How to TALK to them about it — storage stays metric. */
  units?: 'metric' | 'imperial'
  /** Body-composition direction — drives the Fuel kcal target. */
  goalShape?: 'bulk' | 'cut' | 'lean-bulk'
}

/** Blank until the mentor asks. Fallbacks live at the call sites. */
export const DEFAULT_PROFILE: Profile = {
  name: 'Leon',
  heightCm: 179,
  weightKg: 66.2,
  age: 16,
  sex: 'male',
  units: 'imperial',
  goalShape: 'lean-bulk',
}

/** The profile: localStorage override ('vitality:profile') if valid, else defaults. */
export function profile(): Profile {
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem('vitality:profile')
      if (raw) {
        const o = JSON.parse(raw)
        if (o && typeof o === 'object' && !Array.isArray(o)) return o as Profile
      }
    } catch {
      /* fall through */
    }
  }
  return DEFAULT_PROFILE
}

export function saveProfile(p: Profile): void {
  try {
    window.localStorage.setItem('vitality:profile', JSON.stringify(p))
  } catch {
    /* ignore */
  }
}

/** Bodyweight for tile math (peak PK etc.) — 75 kg until they've been asked. */
export function bodyWeightKg(): number {
  return profile().weightKg ?? 75
}

/** Daily kcal target for Fuel — Mifflin-St Jeor BMR, athlete activity
 *  multiplier (two-sport training), then shifted by goalShape. Recompute
 *  whenever weight, activity, or goalShape changes. */
export function fuelKcalTarget(): number {
  const p = profile()
  const kg = p.weightKg ?? 75
  const cm = p.heightCm ?? 175
  const age = p.age ?? 30
  const bmr = p.sex === 'female' ? 10 * kg + 6.25 * cm - 5 * age - 161 : 10 * kg + 6.25 * cm - 5 * age + 5
  const tdee = bmr * 1.725 // extra-active: hard training most days (taekwondo + soccer)
  const shift = p.goalShape === 'bulk' ? 400 : p.goalShape === 'cut' ? -400 : p.goalShape === 'lean-bulk' ? 250 : 0
  return Math.round((tdee + shift) / 10) * 10
}
