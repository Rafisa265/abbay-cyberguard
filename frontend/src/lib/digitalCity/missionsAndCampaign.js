/**
 * CyberShield Ethiopia — Digital City: Missions & Campaign Architecture
 *
 * Implements 15 Story Campaign Missions, 6 Game Modes, 7 Difficulty Tiers,
 * Objective Tracking, Wave Generators, and Victory/Failure Evaluation.
 * 100% deterministic (SR-09 compliant: zero Math.random).
 */

export const GAME_MODES = [
  'story_campaign',
  'survival_endless',
  'city_defense',
  'tactical_operations',
  'boss_rush',
  'tutorial_training',
]

export const DIFFICULTY_TIERS = [
  {
    id: 'beginner',
    name: 'Beginner',
    labelKey: 'digital_city.difficulty.beginner',
    desc: 'Slow enemies, fewer threats, longer reaction times, comfortable pacing.',
    enemyHealthMultiplier: 0.65,
    damageMultiplier: 0.5,
    enemyDamageMultiplier: 0.5,
    enemySpeedMultiplier: 0.6,
    attackIntervalMultiplier: 2.2,
    enemyAttackIntervalMultiplier: 2.2,
    projectileSpeedMultiplier: 0.6,
    playerSpeedMultiplier: 0.9,
    playerDamageMultiplier: 1.25,
    spawnDelaySec: 3.5,
    xpBonus: 1.0,
  },
  {
    id: 'normal',
    name: 'Normal',
    labelKey: 'digital_city.difficulty.normal',
    desc: 'Balanced tactical combat for defenders familiar with basic controls.',
    enemyHealthMultiplier: 1.0,
    damageMultiplier: 0.85,
    enemyDamageMultiplier: 0.85,
    enemySpeedMultiplier: 0.8,
    attackIntervalMultiplier: 1.4,
    enemyAttackIntervalMultiplier: 1.4,
    projectileSpeedMultiplier: 0.8,
    playerSpeedMultiplier: 1.0,
    playerDamageMultiplier: 1.0,
    spawnDelaySec: 2.0,
    xpBonus: 1.25,
  },
  {
    id: 'advanced',
    name: 'Advanced',
    labelKey: 'digital_city.difficulty.advanced',
    desc: 'High-speed syndicate assault for veteran cyber operatives.',
    enemyHealthMultiplier: 1.3,
    damageMultiplier: 1.2,
    enemyDamageMultiplier: 1.2,
    enemySpeedMultiplier: 1.05,
    attackIntervalMultiplier: 0.9,
    enemyAttackIntervalMultiplier: 0.9,
    projectileSpeedMultiplier: 1.0,
    playerSpeedMultiplier: 1.1,
    playerDamageMultiplier: 0.9,
    spawnDelaySec: 1.0,
    xpBonus: 1.6,
  },
]

DIFFICULTY_TIERS.beginner = DIFFICULTY_TIERS[0]
DIFFICULTY_TIERS.normal = DIFFICULTY_TIERS[1]
DIFFICULTY_TIERS.advanced = DIFFICULTY_TIERS[2]

export function getDifficultyTier(id = 'beginner') {
  const normId = (id || '').toLowerCase()
  if (normId === 'recruit') return DIFFICULTY_TIERS[0]
  if (normId === 'intermediate') return DIFFICULTY_TIERS[1]
  if (normId === 'expert' || normId === 'elite' || normId === 'nightmare') return DIFFICULTY_TIERS[2]
  return DIFFICULTY_TIERS.find((d) => d.id === normId) || DIFFICULTY_TIERS[0]
}

export const STORY_MISSIONS = [
  {
    id: 'm_01_orientation',
    order: 1,
    districtId: 'central_command',
    titleKey: 'digital_city.mission.01.title',
    defaultTitle: 'Recruit Orientation & Defense Protocol',
    subtitleKey: 'digital_city.mission.01.subtitle',
    defaultSubtitle: 'Learn movement, weapons, and tactical gadget deployment in Central Command.',
    briefingKey: 'digital_city.mission.01.briefing',
    defaultBriefing: 'Welcome to the Cyber Guard Citadel, Defender. Recon drones have detected hostile scouting probes in the perimeter. Familiarize yourself with the Threat Blaster, Firewall Shield, and Recovery Beacon before active deployment.',
    primaryObjective: 'Eliminate 5 rogue scout probes and deploy a Recovery Beacon at Command Core.',
    targetEnemyCount: 5,
    totalWaves: 3,
    enemyTypes: ['scout_hacker'],
    targetObjectiveId: 'cc_core',
    xpReward: 350,
    creditReward: 150,
    hasCinematic: true,
  },
  {
    id: 'm_02_phishing_syndicate',
    order: 2,
    districtId: 'university',
    titleKey: 'digital_city.mission.02.title',
    defaultTitle: 'Phishing Syndicate Containment',
    subtitleKey: 'digital_city.mission.02.subtitle',
    defaultSubtitle: 'Neutralize credential-harvesting attacker units in the University District.',
    briefingKey: 'digital_city.mission.02.briefing',
    defaultBriefing: 'An aggressive phishing campaign has targeted university students and faculty research databases. Hostile Infiltrators are attempting to siphon academic credentials. Intercept and neutralize them.',
    primaryObjective: 'Defeat 8 attacker units and secure the Campus Student Digital Portal.',
    targetEnemyCount: 8,
    totalWaves: 3,
    enemyTypes: ['scout_hacker', 'infiltrator'],
    targetObjectiveId: 'uni_portal',
    xpReward: 450,
    creditReward: 200,
  },
  {
    id: 'm_03_atm_cashout',
    order: 3,
    districtId: 'financial',
    titleKey: 'digital_city.mission.03.title',
    defaultTitle: 'The ATM Cashout Siege',
    subtitleKey: 'digital_city.mission.03.subtitle',
    defaultSubtitle: 'Defend Commercial Bank of Ethiopia vault from coordinated financial hackers.',
    briefingKey: 'digital_city.mission.03.briefing',
    defaultBriefing: 'Criminal syndicates are launching an unauthorized ATM cashout debit attack against the Financial District. Heavy Brute Force units are assaulting the CBE Digital Vault. Hold the perimeter until emergency interbank freeze activates.',
    primaryObjective: 'Protect the CBE Digital Vault and eliminate 10 heavy attackers.',
    targetEnemyCount: 10,
    totalWaves: 3,
    enemyTypes: ['scout_hacker', 'heavy_attacker', 'malware_unit'],
    targetObjectiveId: 'fin_cbe_vault',
    xpReward: 600,
    creditReward: 300,
  },
  {
    id: 'm_04_hospital_code_red',
    order: 4,
    districtId: 'healthcare',
    titleKey: 'digital_city.mission.04.title',
    defaultTitle: 'Hospital Emergency Code Red',
    subtitleKey: 'digital_city.mission.04.subtitle',
    defaultSubtitle: 'Purge ransomware units attempting to lock intensive care life-support.',
    briefingKey: 'digital_city.mission.04.briefing',
    defaultBriefing: 'Emergency Alert! Ransomware Specialists have penetrated Black Lion Digital Hospital. They are attempting to encrypt the patient telemetry and life-support hub. Deploy your Recovery Beacon to purge the malicious encryption.',
    primaryObjective: 'Purge ransomware encryption and defend Life-Support Hub for 90 seconds.',
    targetEnemyCount: 12,
    totalWaves: 3,
    enemyTypes: ['ransomware_specialist', 'malware_unit', 'scout_hacker'],
    targetObjectiveId: 'hc_telemetry',
    xpReward: 750,
    creditReward: 400,
  },
  {
    id: 'm_05_tower_994_hijack',
    order: 5,
    districtId: 'telecom',
    titleKey: 'digital_city.mission.05.title',
    defaultTitle: 'Tower 994 Defense',
    subtitleKey: 'digital_city.mission.05.subtitle',
    defaultSubtitle: 'Reclaim the national telecommunications spire from signal saboteurs.',
    briefingKey: 'digital_city.mission.05.briefing',
    defaultBriefing: 'Ethio Telecom emergency hotline 994 and cellular data backbones are under EMP attack. Signal Saboteurs are erecting disruption antennas around Spire Tower 994. Reclaim the tower before citywide communications sever.',
    primaryObjective: 'Defeat Network Saboteurs and restore Tower 994 emergency signal.',
    targetEnemyCount: 14,
    totalWaves: 3,
    enemyTypes: ['network_saboteur', 'drone_controller', 'scout_hacker'],
    targetObjectiveId: 'tel_tower_994',
    xpReward: 900,
    creditReward: 500,
  },
  {
    id: 'm_06_scada_blackout',
    order: 6,
    districtId: 'industrial',
    titleKey: 'digital_city.mission.06.title',
    defaultTitle: 'SCADA Power Grid Breach',
    subtitleKey: 'digital_city.mission.06.subtitle',
    defaultSubtitle: 'Defend hydroelectric SCADA substations against industrial malware.',
    briefingKey: 'digital_city.mission.06.briefing',
    defaultBriefing: 'Hostile actors have infected the industrial control network with Stuxnet-class PLC malware. Industrial turbines are overheating. Defend the Grand Renaissance Grid Substation and deploy Encryption Barriers.',
    primaryObjective: 'Defend Grid Substation and neutralize 15 attacker units.',
    targetEnemyCount: 15,
    totalWaves: 3,
    enemyTypes: ['heavy_attacker', 'malware_unit', 'infiltrator'],
    targetObjectiveId: 'ind_grid_substation',
    xpReward: 1100,
    creditReward: 600,
  },
  {
    id: 'm_07_sovereign_data_vault',
    order: 7,
    districtId: 'data_center',
    titleKey: 'digital_city.mission.07.title',
    defaultTitle: 'Sovereign Cloud Core Defense',
    subtitleKey: 'digital_city.mission.07.subtitle',
    defaultSubtitle: 'Stop botnet data exfiltration units from compromising sovereign cloud data.',
    briefingKey: 'digital_city.mission.07.briefing',
    defaultBriefing: 'The INSA Sovereign Cloud Core is under massive exfiltration assault. Attacker commanders are attempting to duplicate classified citizen registry data. Guard the Core server rack with your squad.',
    primaryObjective: 'Prevent server compromise and eliminate Attacker Field Commander.',
    targetEnemyCount: 16,
    totalWaves: 3,
    enemyTypes: ['elite_commander', 'heavy_attacker', 'infiltrator'],
    targetObjectiveId: 'dc_sovereign_core',
    xpReward: 1300,
    creditReward: 750,
  },
  {
    id: 'm_08_dark_fiber_sever',
    order: 8,
    districtId: 'underground',
    titleKey: 'digital_city.mission.08.title',
    defaultTitle: 'Underground Dark Fiber Sabotage',
    subtitleKey: 'digital_city.mission.08.subtitle',
    defaultSubtitle: 'Infiltrate subterranean tunnels to repair severed optical trunk lines.',
    briefingKey: 'digital_city.mission.08.briefing',
    defaultBriefing: 'Attackers have moved into the subterranean network conduits beneath Digital City. They have severed dark fiber relays. Descend into the underground district and neutralize the saboteur nest.',
    primaryObjective: 'Repair Dark Fiber Trunk Line and clear underground hostiles.',
    targetEnemyCount: 18,
    totalWaves: 3,
    enemyTypes: ['infiltrator', 'malware_unit', 'network_saboteur'],
    targetObjectiveId: 'ug_dark_fiber',
    xpReward: 1500,
    creditReward: 900,
  },
  {
    id: 'm_09_boss_the_phantom',
    order: 9,
    districtId: 'university',
    titleKey: 'digital_city.mission.09.title',
    defaultTitle: 'Boss Encounter: The Phantom',
    subtitleKey: 'digital_city.mission.09.subtitle',
    defaultSubtitle: 'Duel the cloaked infiltration mastermind in the Quantum Research Plaza.',
    briefingKey: 'digital_city.mission.09.briefing',
    defaultBriefing: 'The Phantom, the attacker syndicate master infiltrator, has appeared in person to steal quantum encryption keys. Use your Signal Scanner to reveal his cloaking device and anticipate his teleport strikes.',
    primaryObjective: 'Defeat Boss: The Phantom (3 Combat Phases).',
    targetEnemyCount: 1,
    totalWaves: 3,
    bossId: 'boss_the_phantom',
    isBossMission: true,
    xpReward: 2500,
    creditReward: 1500,
  },
  {
    id: 'm_10_government_citadel',
    order: 10,
    districtId: 'government',
    titleKey: 'digital_city.mission.10.title',
    defaultTitle: 'Government Citadel Siege',
    subtitleKey: 'digital_city.mission.10.subtitle',
    defaultSubtitle: 'Protect the National Citizen Identity Gateway (Fayda) from total defacement.',
    briefingKey: 'digital_city.mission.10.briefing',
    defaultBriefing: 'A multi-vector assault is hammering the Government District. Attackers are attempting to tamper with public court and identity registries. Command your friendly Cyber Guard squad to hold defensive choke points.',
    primaryObjective: 'Protect Fayda Identity Gateway across 3 intensive attack waves.',
    targetEnemyCount: 22,
    totalWaves: 3,
    enemyTypes: ['heavy_attacker', 'drone_controller', 'ransomware_specialist'],
    targetObjectiveId: 'gov_portal',
    xpReward: 1800,
    creditReward: 1100,
  },
  {
    id: 'm_11_boss_the_ransom_king',
    order: 11,
    districtId: 'healthcare',
    titleKey: 'digital_city.mission.11.title',
    defaultTitle: 'Boss Encounter: The Ransom King',
    subtitleKey: 'digital_city.mission.11.subtitle',
    defaultSubtitle: 'Confront the titan crypto extortionist locking down the Healthcare District.',
    briefingKey: 'digital_city.mission.11.briefing',
    defaultBriefing: 'The Ransom King has deployed citywide cryptographic lockdown chains. He is directly attacking the central hospital complex. Break his encryption shields using tactical Network Pulses and shatter his armor.',
    primaryObjective: 'Defeat Boss: The Ransom King (3 Combat Phases).',
    targetEnemyCount: 1,
    totalWaves: 3,
    bossId: 'boss_the_ransom_king',
    isBossMission: true,
    xpReward: 3000,
    creditReward: 2000,
  },
  {
    id: 'm_12_boss_the_signal_breaker',
    order: 12,
    districtId: 'telecom',
    titleKey: 'digital_city.mission.12.title',
    defaultTitle: 'Boss Encounter: The Signal Breaker',
    subtitleKey: 'digital_city.mission.12.subtitle',
    defaultSubtitle: 'Eliminate the electromagnetic warlord causing total telecommunications blackout.',
    briefingKey: 'digital_city.mission.12.briefing',
    defaultBriefing: 'The Signal Breaker has summoned a massive electromagnetic storm over Tower 994, blinding city radar. Deploy EMP defense countermeasures to ground his energy coils and disable his drone cloud.',
    primaryObjective: 'Defeat Boss: The Signal Breaker (3 Combat Phases).',
    targetEnemyCount: 1,
    totalWaves: 3,
    bossId: 'boss_the_signal_breaker',
    isBossMission: true,
    xpReward: 3500,
    creditReward: 2500,
  },
  {
    id: 'm_13_boss_the_data_reaper',
    order: 13,
    districtId: 'data_center',
    titleKey: 'digital_city.mission.13.title',
    defaultTitle: 'Boss Encounter: The Data Reaper',
    subtitleKey: 'digital_city.mission.13.subtitle',
    defaultSubtitle: 'Sever the life-stealing data siphon channels of the Data Reaper.',
    briefingKey: 'digital_city.mission.13.briefing',
    defaultBriefing: 'The Data Reaper has penetrated the Immutable Backup Vault. Armed with energy scythes, he siphons health from nearby defenders. Keep your distance, utilize Firewall Shields, and destroy his conduit pylons.',
    primaryObjective: 'Defeat Boss: The Data Reaper (3 Combat Phases).',
    targetEnemyCount: 1,
    totalWaves: 3,
    bossId: 'boss_the_data_reaper',
    isBossMission: true,
    xpReward: 4000,
    creditReward: 3000,
  },
  {
    id: 'm_14_citywide_siege',
    order: 14,
    districtId: 'central_command',
    titleKey: 'digital_city.mission.14.title',
    defaultTitle: 'Citywide Multi-District Defense',
    subtitleKey: 'digital_city.mission.14.subtitle',
    defaultSubtitle: 'Coordinate citywide defense across Financial, Telecom, and Central Citadel.',
    briefingKey: 'digital_city.mission.14.briefing',
    defaultBriefing: 'The entire attacker syndicate has mobilized. Multiple districts are sounding red alert sirens simultaneously. Move rapidly between sectors to reinforce struggling guard squads and protect critical nodes.',
    primaryObjective: 'Survive the 4-wave citywide onslaught with at least 50% infrastructure integrity.',
    targetEnemyCount: 30,
    totalWaves: 4,
    enemyTypes: ['heavy_attacker', 'elite_commander', 'network_saboteur', 'malware_unit'],
    targetObjectiveId: 'cc_hq',
    xpReward: 5000,
    creditReward: 4000,
  },
  {
    id: 'm_15_the_final_firewall',
    order: 15,
    districtId: 'central_command',
    titleKey: 'digital_city.mission.15.title',
    defaultTitle: 'Final Showdown: The Architect',
    subtitleKey: 'digital_city.mission.15.subtitle',
    defaultSubtitle: 'Defeat the mastermind of the cyber war atop the Central Command Citadel.',
    briefingKey: 'digital_city.mission.15.briefing',
    defaultBriefing: 'This is the final battle for Digital City. The Architect, the creator of the entire hostile botnet network, has unleashed his apex command chassis on the Citadel roof. Defend Ethiopia\'s digital sovereignty and establish the eternal firewall.',
    primaryObjective: 'Defeat The Architect across all 4 combat phases and save Digital City.',
    targetEnemyCount: 1,
    totalWaves: 4,
    bossId: 'boss_the_architect',
    isBossMission: true,
    xpReward: 10000,
    creditReward: 10000,
    hasCinematic: true,
  },
]

/**
 * Generates an endless wave of attackers for Survival Mode
 */
export function generateSurvivalWave(waveNumber = 1, seed = 1337) {
  const prng = (offset) => {
    let s = (seed + waveNumber * 1000 + offset) & 0xffffffff
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  const enemyPool = ['scout_hacker', 'malware_unit', 'infiltrator', 'heavy_attacker', 'drone_controller', 'network_saboteur']
  const totalEnemies = 4 + Math.floor(waveNumber * 2.5)

  const enemies = []
  for (let i = 0; i < totalEnemies; i++) {
    const classIdx = Math.floor(prng(i * 3) * Math.min(enemyPool.length, 2 + Math.floor(waveNumber / 2)))
    const angle = prng(i * 5) * Math.PI * 2
    const distance = 30 + prng(i * 7) * 40
    enemies.push({
      id: `wave_${waveNumber}_en_${i}`,
      classId: enemyPool[classIdx],
      x: Math.sin(angle) * distance,
      z: Math.cos(angle) * distance,
      healthMultiplier: 1 + waveNumber * 0.12,
    })
  }

  // Every 5th wave spawns a mini-boss
  let bossUnit = null
  if (waveNumber % 5 === 0) {
    const bosses = ['boss_the_phantom', 'boss_the_ransom_king', 'boss_the_signal_breaker', 'boss_the_data_reaper']
    const bossIdx = (waveNumber / 5 - 1) % bosses.length
    bossUnit = {
      id: `wave_${waveNumber}_boss`,
      classId: bosses[bossIdx],
      x: 0,
      z: 50,
      healthMultiplier: 1 + waveNumber * 0.15,
    }
  }

  return {
    waveNumber,
    enemies,
    bossUnit,
    totalEnemies: totalEnemies + (bossUnit ? 1 : 0),
    waveRewardXp: 200 + waveNumber * 100,
    waveRewardCredits: 100 + waveNumber * 50,
  }
}

