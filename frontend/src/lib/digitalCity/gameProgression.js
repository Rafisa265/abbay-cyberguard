/**
 * CyberShield Ethiopia — Digital City: Offline Player Progression & Achievements
 *
 * Manages player levels, XP, defense credits, mission completion states,
 * equipment upgrades, survival records, and unlocked achievements.
 *
 * 100% offline-first. Zero sensitive credential persistence.
 * Safe fallback to in-memory state. Persists via journey progression bridge.
 */

import { getJourneyProgress, saveJourneyProgress } from '../journey.js'
import { WEAPON_REGISTRY } from './combatEquipment.js'

export const INITIAL_PROGRESSION = {
  playerLevel: 1,
  currentXp: 0,
  xpToNextLevel: 1000,
  defenseCredits: 250,
  missionsCompleted: [],
  unlockedDistricts: ['central_command', 'financial', 'healthcare', 'university'],
  unlockedEquipment: [
    'threat_blaster',
    'cyber_assault_rifle',
    'energy_pistol',
    'firewall_shield',
    'network_pulse',
    'recovery_beacon',
  ],
  equipmentLevels: {
    threat_blaster: 1,
    cyber_assault_rifle: 1,
    energy_pistol: 1,
    burst_rifle: 1,
    tactical_shotgun: 1,
    precision_rifle: 1,
    heavy_energy_rifle: 1,
    plasma_cannon: 1,
    long_range_sniper: 1,
    quantum_blaster: 1,
    firewall_shield: 1,
    network_pulse: 1,
    security_drone: 1,
    recovery_beacon: 1,
    signal_scanner: 1,
    encryption_barrier: 1,
    emp_device: 1,
  },
  stats: {
    enemiesDefeated: 0,
    bossesDefeated: 0,
    infrastructureRestored: 0,
    survivalBestWave: 0,
    totalDamageDealt: 0,
    perfectParries: 0,
    playTimeSeconds: 0,
  },
  unlockedAchievements: [],
  selectedDifficulty: 'beginner',
  mouseSensitivity: 1.0,
  audioSettings: {
    masterVolume: 0.8,
    sfxVolume: 0.85,
    musicVolume: 0.7,
    commsVolume: 0.85,
    muted: false,
  },
  graphicsQuality: 'high',
}

export const ACHIEVEMENTS = [
  { id: 'first_defender', nameKey: 'digital_city.ach.first_defender', title: 'First Defender', desc: 'Complete the Recruit Orientation in Central Command.' },
  { id: 'city_guardian', nameKey: 'digital_city.ach.city_guardian', title: 'City Guardian', desc: 'Complete 5 story missions in Digital City.' },
  { id: 'network_protector', nameKey: 'digital_city.ach.network_protector', title: 'Network Protector', desc: 'Defend Tower 994 without losing communications.' },
  { id: 'malware_hunter', nameKey: 'digital_city.ach.malware_hunter', title: 'Malware Hunter', desc: 'Neutralize 50 malware and scout attacker units.' },
  { id: 'data_center_savior', nameKey: 'digital_city.ach.data_center_savior', title: 'Data Center Savior', desc: 'Prevent data exfiltration from INSA Sovereign Cloud Core.' },
  { id: 'ransomware_survivor', nameKey: 'digital_city.ach.ransomware_survivor', title: 'Ransomware Survivor', desc: 'Purge hospital life-support ransomware encryption.' },
  { id: 'elite_cyber_guard', nameKey: 'digital_city.ach.elite_cyber_guard', title: 'Elite Cyber Guard', desc: 'Reach Player Level 10 and unlock all tactical weapons and gadgets.' },
  { id: 'digital_city_champion', nameKey: 'digital_city.ach.digital_city_champion', title: 'Digital City Champion', desc: 'Complete all 15 campaign missions and defeat The Architect.' },
  { id: 'ghost_hunter', nameKey: 'digital_city.ach.ghost_hunter', title: 'Ghost Hunter', desc: 'Reveal and defeat The Phantom in the University District.' },
  { id: 'telecom_shield', nameKey: 'digital_city.ach.telecom_shield', title: 'Telecom Shield', desc: 'Neutralize The Signal Breaker in the Telecom District.' },
  { id: 'master_tactician', nameKey: 'digital_city.ach.master_tactician', title: 'Master Tactician', desc: 'Execute 15 perfect Firewall Shield parries.' },
  { id: 'untouchable', nameKey: 'digital_city.ach.untouchable', title: 'Untouchable', desc: 'Complete any mission with 100% shield integrity remaining.' },
  { id: 'sovereign_defender', nameKey: 'digital_city.ach.sovereign_defender', title: 'Sovereign Defender', desc: 'Defend all 10 city districts to 100% security integrity.' },
  { id: 'endless_sentinel', nameKey: 'digital_city.ach.endless_sentinel', title: 'Endless Sentinel', desc: 'Survive 10 consecutive waves in Survival Mode.' },
  { id: 'boss_slayer', nameKey: 'digital_city.ach.boss_slayer', title: 'Boss Slayer', desc: 'Defeat all 5 syndicate campaign bosses.' },
  { id: 'architect_neutralizer', nameKey: 'digital_city.ach.architect_neutralizer', title: 'Architect Neutralizer', desc: 'Defeat The Architect on Expert or Nightmare difficulty.' },
]

let inMemoryProgression = null

function syncWeaponUnlocks(progression) {
  if (!progression || !progression.unlockedEquipment) return
  if (typeof WEAPON_REGISTRY === 'object') {
    Object.values(WEAPON_REGISTRY).forEach((w) => {
      if (w.unlockLevel <= progression.playerLevel && !progression.unlockedEquipment.includes(w.id)) {
        progression.unlockedEquipment.push(w.id)
      }
    })
  }
}

/**
 * Resets player progression to initial state (for new game or testing)
 */
export function resetDigitalCityProgression() {
  inMemoryProgression = JSON.parse(JSON.stringify(INITIAL_PROGRESSION))
  syncWeaponUnlocks(inMemoryProgression)
  try {
    const journey = getJourneyProgress()
    if (journey && journey.game3d) {
      journey.game3d.digitalCity = JSON.parse(JSON.stringify(inMemoryProgression))
      saveJourneyProgress(journey)
    }
  } catch (err) {
    // In-memory fallback
  }
  return inMemoryProgression
}

/**
 * Loads player progression safely
 */
export function loadDigitalCityProgression() {
  if (inMemoryProgression) {
    syncWeaponUnlocks(inMemoryProgression)
    return inMemoryProgression
  }

  try {
    const journey = getJourneyProgress()
    if (journey && journey.game3d && journey.game3d.digitalCity) {
      inMemoryProgression = {
        ...INITIAL_PROGRESSION,
        ...journey.game3d.digitalCity,
        equipmentLevels: { ...INITIAL_PROGRESSION.equipmentLevels, ...(journey.game3d.digitalCity.equipmentLevels || {}) },
        stats: { ...INITIAL_PROGRESSION.stats, ...(journey.game3d.digitalCity.stats || {}) },
        audioSettings: { ...INITIAL_PROGRESSION.audioSettings, ...(journey.game3d.digitalCity.audioSettings || {}) },
      }
      syncWeaponUnlocks(inMemoryProgression)
      return inMemoryProgression
    }
  } catch (err) {
    // Fallback to in-memory state
  }

  inMemoryProgression = JSON.parse(JSON.stringify(INITIAL_PROGRESSION))
  syncWeaponUnlocks(inMemoryProgression)
  return inMemoryProgression
}

/**
 * Saves player progression safely
 */
export function saveDigitalCityProgression(state) {
  syncWeaponUnlocks(state)
  inMemoryProgression = { ...state }
  try {
    const journey = getJourneyProgress()
    if (journey) {
      if (!journey.game3d || typeof journey.game3d !== 'object') {
        journey.game3d = {}
      }
      journey.game3d.digitalCity = inMemoryProgression
      saveJourneyProgress(journey)
    }
  } catch (err) {
    // In-memory cache preserved
  }
  return inMemoryProgression
}

/**
 * Grants combat XP during gameplay and evaluates level ups & weapon unlocks
 */
export function addCombatXp(amount = 50, missionStats = {}) {
  let current
  if (missionStats && missionStats.playerLevel !== undefined) {
    current = { ...missionStats }
  } else {
    current = loadDigitalCityProgression()
  }

  current.currentXp += amount

  let leveledUp = false
  const newlyUnlockedWeapons = []

  while (current.currentXp >= current.xpToNextLevel) {
    current.currentXp -= current.xpToNextLevel
    current.playerLevel += 1
    current.xpToNextLevel = Math.round(current.xpToNextLevel * 1.35)
    leveledUp = true
  }

  if (leveledUp) {
    if (!current.unlockedEquipment) current.unlockedEquipment = []
    Object.values(WEAPON_REGISTRY).forEach((w) => {
      if (w.unlockLevel <= current.playerLevel && !current.unlockedEquipment.includes(w.id)) {
        current.unlockedEquipment.push(w.id)
        newlyUnlockedWeapons.push(w)
      }
    })
  }

  if (missionStats.enemiesDefeated && current.stats) {
    current.stats.enemiesDefeated += missionStats.enemiesDefeated
  }

  saveDigitalCityProgression(current)
  return {
    ...current,
    progression: current,
    leveledUp,
    newLevel: current.playerLevel,
    newlyUnlockedWeapons,
  }
}

/**
 * Records mission completion and rewards
 */
export function recordMissionVictory(missionId, xpReward, creditReward, missionStats = {}) {
  const current = loadDigitalCityProgression()

  const isFirstTime = !current.missionsCompleted.includes(missionId)
  if (isFirstTime) {
    current.missionsCompleted.push(missionId)
  }

  const xpEarned = isFirstTime ? xpReward : Math.round(xpReward * 0.4)
  const creditsEarned = isFirstTime ? creditReward : Math.round(creditReward * 0.4)

  current.currentXp += xpEarned
  current.defenseCredits += creditsEarned

  let leveledUp = false
  while (current.currentXp >= current.xpToNextLevel) {
    current.currentXp -= current.xpToNextLevel
    current.playerLevel += 1
    current.xpToNextLevel = Math.round(current.xpToNextLevel * 1.35)
    leveledUp = true
  }

  syncWeaponUnlocks(current)

  current.stats.enemiesDefeated += missionStats.enemiesDefeated || 0
  if (missionStats.isBoss) {
    current.stats.bossesDefeated += 1
  }

  checkAchievements(current, missionId, missionStats)
  return saveDigitalCityProgression(current)
}

function checkAchievements(state, missionId, stats) {
  const unlocked = new Set(state.unlockedAchievements)

  if (missionId === 'm_01_orientation') unlocked.add('first_defender')
  if (state.missionsCompleted.length >= 5) unlocked.add('city_guardian')
  if (missionId === 'm_05_tower_994_hijack') unlocked.add('network_protector')
  if (state.stats.enemiesDefeated >= 50) unlocked.add('malware_hunter')
  if (missionId === 'm_07_sovereign_data_vault') unlocked.add('data_center_savior')
  if (missionId === 'm_04_hospital_code_red') unlocked.add('ransomware_survivor')
  if (state.playerLevel >= 10) unlocked.add('elite_cyber_guard')
  if (state.missionsCompleted.length >= 15) unlocked.add('digital_city_champion')
  if (missionId === 'm_09_boss_the_phantom') unlocked.add('ghost_hunter')
  if (missionId === 'm_12_boss_the_signal_breaker') unlocked.add('telecom_shield')
  if (state.stats.bossesDefeated >= 5) unlocked.add('boss_slayer')
  if (missionId === 'm_15_the_final_firewall' && (state.selectedDifficulty === 'expert' || state.selectedDifficulty === 'nightmare')) {
    unlocked.add('architect_neutralizer')
  }

  state.unlockedAchievements = Array.from(unlocked)
}
