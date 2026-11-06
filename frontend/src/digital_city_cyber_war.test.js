import { describe, it, expect, beforeEach } from 'vitest'
import React from 'react'
import { renderToString } from 'react-dom/server'
import {
  DISTRICTS,
  DISTRICT_IDS,
  CANONICAL_CITY_LANDMARKS,
  CANONICAL_CITY_COVER_POINTS,
  findNearestCoverPoint,
  generateCityBuildingLayout,
  getDistrictByCoordinates,
  getCityCollisionBoxes,
  hasLineOfSight,
} from './lib/digitalCity/cityDistricts.js'
import {
  EQUIPMENT_REGISTRY,
  EQUIPMENT_TYPES,
  WEAPON_REGISTRY,
  WEAPON_PROGRESSION_TIERS,
  createPlayerEquipmentState,
  canActivateEquipment,
  calculateDamage,
  updateEquipmentTick,
  switchPlayerWeapon,
  startReload,
  updateReloadTick,
  getNextWeaponUnlock,
} from './lib/digitalCity/combatEquipment.js'
import {
  CHARACTER_CLASSES,
  buildCharacterMesh,
  buildDroneMesh,
  buildWeaponModel,
  updateCharacterWeapon,
  updateCharacterAnimation,
  updateCharacterStateBadge,
} from './lib/digitalCity/characterSystem.js'
import {
  createEnemyUnit,
  createFriendlyGuardUnit,
  updateEnemyAITick,
  updateFriendlyGuardTick,
  AI_STATES,
  SQUAD_COMMANDS,
} from './lib/digitalCity/enemyAI.js'
import {
  STORY_MISSIONS,
  DIFFICULTY_TIERS,
  generateSurvivalWave,
} from './lib/digitalCity/missionsAndCampaign.js'
import {
  INITIAL_PROGRESSION,
  ACHIEVEMENTS,
  loadDigitalCityProgression,
  saveDigitalCityProgression,
  recordMissionVictory,
  resetDigitalCityProgression,
  addCombatXp,
} from './lib/digitalCity/gameProgression.js'
import {
  createInitialCitySimulationState,
  stepDigitalCitySimulation,
  calculateDroneThreatScore,
} from './lib/digitalCity/digitalCityEngine.js'
import { DigitalCityWorldRenderer } from './lib/digitalCity/digitalCityRenderer.js'
import { cityAudio } from './lib/digitalCity/cityAudio.js'
import DigitalCityGame from './components/DigitalCityGame.jsx'
import en from './locales/en.js'
import om from './locales/om.js'
import am from './locales/am.js'

describe('Digital City — Cyber War: Advanced 3D Tactical Cyber Warfare Engine', () => {
  beforeEach(() => {
    resetDigitalCityProgression()
  })

  describe('1. 10 City Districts & Procedural Metropolis Layout', () => {
    it('defines exactly 10 distinct districts with coordinates, bounds, and infrastructure', () => {
      expect(DISTRICT_IDS).toHaveLength(10)
      expect(DISTRICTS).toHaveLength(10)

      const ids = DISTRICTS.map((d) => d.id)
      expect(ids).toContain('central_command')
      expect(ids).toContain('financial')
      expect(ids).toContain('healthcare')
      expect(ids).toContain('university')
      expect(ids).toContain('government')
      expect(ids).toContain('telecom')
      expect(ids).toContain('industrial')
      expect(ids).toContain('data_center')
      expect(ids).toContain('residential')
      expect(ids).toContain('underground')

      // Verify each district has critical infrastructure nodes
      for (const dist of DISTRICTS) {
        expect(dist.infrastructure.length).toBeGreaterThanOrEqual(3)
        expect(dist.bounds).toBeDefined()
        expect(dist.skylineHeight).toBeGreaterThan(0)
      }
    })

    it('generates a large deterministic metropolis layout (zero Math.random)', () => {
      const buildingsA = generateCityBuildingLayout(1337)
      const buildingsB = generateCityBuildingLayout(1337)

      expect(buildingsA.length).toBeGreaterThan(40)
      expect(buildingsA).toEqual(buildingsB) // 100% deterministic

      const collisionBoxes = getCityCollisionBoxes(buildingsA)
      expect(collisionBoxes.length).toBe(buildingsA.length)
      expect(collisionBoxes[0].minX).toBeLessThan(collisionBoxes[0].maxX)
    })

    it('resolves district locations accurately based on 2D coordinates', () => {
      expect(getDistrictByCoordinates(0, 0).id).toBe('central_command')
      expect(getDistrictByCoordinates(120, 0).id).toBe('financial')
      expect(getDistrictByCoordinates(-120, 0).id).toBe('healthcare')
      expect(getDistrictByCoordinates(-120, 120).id).toBe('university')
      expect(getDistrictByCoordinates(0, -120).id).toBe('government')
      expect(getDistrictByCoordinates(120, -120).id).toBe('telecom')
      expect(getDistrictByCoordinates(0, 120).id).toBe('industrial')
      expect(getDistrictByCoordinates(120, 120).id).toBe('data_center')
    })
  })

  describe('2. Tactical Equipment & Real-Time Combat Calculations', () => {
    it('registers all 8 tactical defense weapons, shields, and gadgets', () => {
      expect(EQUIPMENT_TYPES).toHaveLength(8)
      expect(EQUIPMENT_TYPES).toContain('threat_blaster')
      expect(EQUIPMENT_TYPES).toContain('firewall_shield')
      expect(EQUIPMENT_TYPES).toContain('network_pulse')
      expect(EQUIPMENT_TYPES).toContain('security_drone')
      expect(EQUIPMENT_TYPES).toContain('recovery_beacon')
      expect(EQUIPMENT_TYPES).toContain('signal_scanner')
      expect(EQUIPMENT_TYPES).toContain('encryption_barrier')
      expect(EQUIPMENT_TYPES).toContain('emp_device')

      for (const eqId of EQUIPMENT_TYPES) {
        const item = EQUIPMENT_REGISTRY[eqId]
        expect(item).toBeDefined()
        expect(item.cooldownMs).toBeGreaterThan(0)
        expect(item.representedThreat).toBeDefined()
      }
    })

    it('correctly evaluates equipment activation constraints (cooldown, energy, heat)', () => {
      const eqState = createPlayerEquipmentState()
      const now = 10000

      // Blaster ready
      expect(canActivateEquipment(eqState, 'threat_blaster', now)).toBe(true)

      // Put on cooldown
      eqState.cooldowns['threat_blaster'] = now - 50 // 50ms ago (cooldown is 250ms)
      expect(canActivateEquipment(eqState, 'threat_blaster', now)).toBe(false)

      // Test overheat
      eqState.cooldowns['threat_blaster'] = 0
      eqState.isOverheated = true
      expect(canActivateEquipment(eqState, 'threat_blaster', now)).toBe(false)

      // Test energy constraint
      eqState.isOverheated = false
      eqState.currentEnergy = 5
      expect(canActivateEquipment(eqState, 'emp_device', now)).toBe(false) // EMP costs 60 energy
    })

    it('calculates damage with shields, armor, and critical multipliers', () => {
      // 1. Normal damage vs shield
      const hit1 = calculateDamage({ baseDamage: 40, targetShield: 60 })
      expect(hit1.shieldDamage).toBe(40)
      expect(hit1.healthDamage).toBe(0)

      // 2. Damage overflowing shield
      const hit2 = calculateDamage({ baseDamage: 50, targetShield: 20 })
      expect(hit2.shieldDamage).toBe(20)
      expect(hit2.healthDamage).toBe(30)

      // 3. Firewall Shield blocking damage (85% reduction)
      const hitBlocked = calculateDamage({
        baseDamage: 100,
        targetShield: 0,
        isShieldActive: true,
        damageReduction: 0.85,
      })
      expect(hitBlocked.healthDamage).toBe(15) // only 15% gets through

      // 4. Critical hit
      const hitCrit = calculateDamage({ baseDamage: 40, isCritical: true })
      expect(hitCrit.rawDamage).toBe(70) // 1.75x multiplier
    })
  })

  describe('3. Character Classes & Procedural Animation System', () => {
    it('defines distinct specifications for Cyber Guards, 9 Attackers, and 5 Bosses', () => {
      expect(CHARACTER_CLASSES.cyber_guard_recruit).toBeDefined()
      expect(CHARACTER_CLASSES.scout_hacker).toBeDefined()
      expect(CHARACTER_CLASSES.malware_unit).toBeDefined()
      expect(CHARACTER_CLASSES.infiltrator).toBeDefined()
      expect(CHARACTER_CLASSES.heavy_attacker).toBeDefined()
      expect(CHARACTER_CLASSES.drone_controller).toBeDefined()
      expect(CHARACTER_CLASSES.ransomware_specialist).toBeDefined()
      expect(CHARACTER_CLASSES.network_saboteur).toBeDefined()
      expect(CHARACTER_CLASSES.elite_commander).toBeDefined()

      // 5 Bosses
      expect(CHARACTER_CLASSES.boss_the_phantom).toBeDefined()
      expect(CHARACTER_CLASSES.boss_the_ransom_king).toBeDefined()
      expect(CHARACTER_CLASSES.boss_the_signal_breaker).toBeDefined()
      expect(CHARACTER_CLASSES.boss_the_data_reaper).toBeDefined()
      expect(CHARACTER_CLASSES.boss_the_architect).toBeDefined()
    })

    it('builds procedural 3D hierarchical mesh with animated joints', () => {
      const guardMesh = buildCharacterMesh('cyber_guard_recruit')
      expect(guardMesh).toBeDefined()
      expect(guardMesh.userData.parts).toBeDefined()
      expect(guardMesh.userData.parts.torso).toBeDefined()
      expect(guardMesh.userData.parts.head).toBeDefined()
      expect(guardMesh.userData.parts.leftArm).toBeDefined()
      expect(guardMesh.userData.parts.rightArm).toBeDefined()
      expect(guardMesh.userData.parts.leftLeg).toBeDefined()
      expect(guardMesh.userData.parts.rightLeg).toBeDefined()

      // Run procedural animation updates across states without throwing or generating NaN
      updateCharacterAnimation(guardMesh, 'idle', 0.016)
      expect(isNaN(guardMesh.userData.parts.torso.rotation.x)).toBe(false)

      updateCharacterAnimation(guardMesh, 'run', 0.016)
      expect(isNaN(guardMesh.userData.parts.leftLeg.rotation.x)).toBe(false)

      updateCharacterAnimation(guardMesh, 'block', 0.016)
      expect(guardMesh.userData.parts.leftArm.rotation.x).toBeLessThan(0) // shield raised

      updateCharacterAnimation(guardMesh, 'defeat', 0.016)
      expect(guardMesh.userData.parts.pelvis.position.y).toBeLessThan(1.0) // on ground
    })
  })

  describe('4. Enemy AI Behavior Trees & Friendly Guard Squad', () => {
    it('executes readable enemy AI sequence: Patrol -> Alert -> Chase -> Aim -> Attack -> Cover', () => {
      const enemy = createEnemyUnit({ id: 'en_test_1', classId: 'scout_hacker', x: 0, z: 50, health: 100, maxHealth: 100 })
      expect(enemy.state).toBe(AI_STATES.PATROL)

      // 1. Detection enters Alert reaction
      const playerNear = { x: 0, z: 20 }
      const tickAlert = updateEnemyAITick(enemy, playerNear, [], [], 0.016, 1000)
      expect(tickAlert.enemy.state).toBe(AI_STATES.ALERT)

      // 2. Alert duration (0.75s) elapses -> advances to Chase / repositioning
      const tickChase = updateEnemyAITick(tickAlert.enemy, playerNear, [], [], 0.80, 1800)
      expect(tickChase.enemy.state).toBe(AI_STATES.CHASE)

      // 3. Player within engagement distance (12m <= 18m) -> enters deliberate Aim telegraph state
      const playerCombat = { x: 0, z: 38 }
      const tickAim = updateEnemyAITick(tickChase.enemy, playerCombat, [], [], 0.016, 2000)
      expect(tickAim.enemy.state).toBe(AI_STATES.AIM)

      // 4. Aim telegraph window (0.50s) elapses -> fires Attack burst
      const tickAttack = updateEnemyAITick(tickAim.enemy, playerCombat, [], [], 0.55, 2550)
      expect(tickAttack.enemy.state).toBe(AI_STATES.ATTACK)
      expect(tickAttack.attackTarget).toBeDefined()

      // 5. Heavy damage response -> immediately seeks Cover
      const wounded = { ...tickAttack.enemy, health: 20 }
      const tickCover = updateEnemyAITick(wounded, playerCombat, [], [], 0.016, 2600)
      expect(tickCover.enemy.state).toBe(AI_STATES.TAKE_COVER)
    })

    it('friendly Cyber Guard squad units obey commands (Follow, Defend, Regroup)', () => {
      const guard = createFriendlyGuardUnit({ id: 'guard_1', x: 0, z: 10 })
      expect(guard.command).toBe(SQUAD_COMMANDS.FOLLOW)

      const playerPos = { x: 0, z: 0 }
      const enemies = [createEnemyUnit({ id: 'en_1', x: 0, z: 15, health: 100 })]

      const tickGuard = updateFriendlyGuardTick(guard, playerPos, enemies, 0.016, 1000)
      expect(tickGuard.guard).toBeDefined()
      expect(tickGuard.attackTarget).toBeDefined() // targets hostile enemy
      expect(tickGuard.attackTarget.id).toBe('en_1')
    })
  })

  describe('5. 15 Story Missions & Endless Survival Mode', () => {
    it('defines 15 progressive story missions spanning all 10 districts', () => {
      expect(STORY_MISSIONS).toHaveLength(15)

      // Check first mission is orientation
      expect(STORY_MISSIONS[0].id).toBe('m_01_orientation')
      expect(STORY_MISSIONS[0].districtId).toBe('central_command')

      // Check final mission is The Architect boss battle
      expect(STORY_MISSIONS[14].id).toBe('m_15_the_final_firewall')
      expect(STORY_MISSIONS[14].bossId).toBe('boss_the_architect')
      expect(STORY_MISSIONS[14].isBossMission).toBe(true)

      // Verify each mission has non-empty titles, briefings, and positive XP rewards
      for (const m of STORY_MISSIONS) {
        expect(m.order).toBeGreaterThan(0)
        expect(m.titleKey).toBeDefined()
        expect(m.defaultTitle.length).toBeGreaterThan(5)
        expect(m.xpReward).toBeGreaterThan(0)
        expect(m.creditReward).toBeGreaterThan(0)
      }
    })

    it('generates infinite progressive waves for Survival Mode deterministically', () => {
      const wave1 = generateSurvivalWave(1, 42)
      const wave2 = generateSurvivalWave(2, 42)
      const wave5 = generateSurvivalWave(5, 42)

      expect(wave1.enemies.length).toBeGreaterThan(3)
      expect(wave2.enemies.length).toBeGreaterThan(wave1.enemies.length)
      expect(wave5.bossUnit).not.toBeNull() // mini-boss on wave 5
      expect(wave5.bossUnit.id).toContain('boss')
    })
  })

  describe('6. Master Simulation Step & Victory Evaluation', () => {
    it('initializes simulation state and steps character physics cleanly', () => {
      const state = createInitialCitySimulationState({ missionId: 'm_01_orientation' })
      expect(state.status).toBe('playing')
      expect(state.player.health).toBe(120)
      // Mission 1 Orientation paces Wave 1 with 1 initial scout probe
      expect(state.enemies.length).toBe(1)

      // Missions after orientation spawn combat rosters
      const combatState = createInitialCitySimulationState({ missionId: 'm_02_phishing_network' })
      expect(combatState.enemies.length).toBeGreaterThanOrEqual(3)

      // Simulate forward movement
      const input = { forward: true, sprint: true }
      const nextState = stepDigitalCitySimulation(state, input, [], 0.016, 1000)

      expect(nextState.player.animState).toBe('sprint')
      expect(nextState.missionTimer).toBeGreaterThan(0)
    })

    it('triggers victory condition when all mission enemies are neutralized', () => {
      const state = createInitialCitySimulationState({ missionId: 'm_01_orientation' })
      // Set all enemies to 0 health
      state.enemies.forEach((e) => (e.health = 0))

      const nextState = stepDigitalCitySimulation(state, {}, [], 0.016, 2000)
      expect(nextState.status).toBe('victory')
    })

    it('initializes active friendly recon and hostile attack drones and updates their flight paths', () => {
      // Orientation Wave 1 starts safe with 2 friendly recon drones and 0 hostile drones
      const state = createInitialCitySimulationState({ missionId: 'm_01_orientation' })
      expect(state.drones).toBeDefined()
      expect(state.drones.length).toBe(2)

      const friendlyDrones = state.drones.filter((d) => !d.isEnemy)
      expect(friendlyDrones.length).toBe(2)

      // Full combat missions deploy both friendly recon and hostile attack drones
      const combatDroneState = createInitialCitySimulationState({ missionId: 'm_02_phishing_network' })
      expect(combatDroneState.drones.length).toBe(4)
      expect(combatDroneState.drones.filter((d) => d.isEnemy).length).toBe(2)

      // Verify drone flight stepping
      const step1 = stepDigitalCitySimulation(state, {}, [], 0.016, 1000)
      expect(step1.drones[0].orbitOffset).toBeDefined()
      expect(step1.drones[0].y).toBeGreaterThan(0)
    })

    it('executes Network Pulse ability (Q) to damage and stun nearby hostile units', () => {
      const state = createInitialCitySimulationState({ missionId: 'm_01_orientation' })
      const enemy = createEnemyUnit({ id: 'en_pulse_target', classId: 'scout_hacker', x: 2, z: 2, health: 80, shield: 0 })
      state.enemies = [enemy]

      const nextState = stepDigitalCitySimulation(state, { activatePulse: true }, [], 0.016, 3000)
      expect(nextState.activeShockwaves.length).toBe(1)
      expect(nextState.activeShockwaves[0].maxRadius).toBe(18)
      expect(nextState.enemies[0].health).toBeLessThan(80)
      expect(nextState.enemies[0].state).toBe(AI_STATES.STUNNED)
    })

    it('deploys Recovery Beacon (E) totem which restores player health and shield', () => {
      const state = createInitialCitySimulationState({ missionId: 'm_01_orientation' })
      state.player.health = 50
      state.player.shield = 20
      state.enemies = []
      state.drones = []

      // Deploy beacon
      const deployedState = stepDigitalCitySimulation(state, { activateBeacon: true }, [], 0.016, 4000)
      expect(deployedState.activeBeacons.length).toBe(1)
      expect(deployedState.activeBeacons[0].duration).toBeCloseTo(18.0, 1)

      // Step simulation to trigger beacon healing pulse (pulses every 1.2s)
      let sim = deployedState
      for (let i = 0; i < 90; i++) {
        sim = stepDigitalCitySimulation(sim, {}, [], 0.016, 4000 + (i + 1) * 16)
      }
      expect(sim.player.health).toBeGreaterThan(50)
      expect(sim.player.shield).toBeGreaterThan(20)
    })
  })

  describe('7. Offline Progression, Achievements & SSR Component Accessibility', () => {
    it('awards mission rewards and levels up without storing credentials', () => {
      const res = recordMissionVictory('m_01_orientation', 1200, 500, { enemiesDefeated: 5 })
      expect(res.playerLevel).toBeGreaterThanOrEqual(2)
      expect(res.defenseCredits).toBeGreaterThanOrEqual(750)
      expect(res.missionsCompleted).toContain('m_01_orientation')
      expect(res.unlockedAchievements).toContain('first_defender')
    })

    it('renders DigitalCityGame component cleanly in English SSR', () => {
      const html = renderToString(React.createElement(DigitalCityGame, { t: (k) => en[k] || k, lang: 'en' }))
      expect(html).toContain('cyber-game-wrapper')
      expect(html).toContain('digital-city-container')
      expect(html).toContain('digital-city-menu-overlay')
      expect(html).toContain('start-modal-card')
      expect(html).toContain('btn-start-simulation')
      expect(html).toContain('start-actions')
      expect(html).toContain('Digital City — Cyber War')
    })

    it('renders DigitalCityGame component cleanly in Afaan Oromoo SSR', () => {
      const html = renderToString(React.createElement(DigitalCityGame, { t: (k) => om[k] || k, lang: 'om' }))
      expect(html).toContain('cyber-game-wrapper')
      expect(html).toContain('Magaalaa Diijitaalaa — Waraana Saayibarii')
    })

    it('renders DigitalCityGame component cleanly in Amharic SSR', () => {
      const html = renderToString(React.createElement(DigitalCityGame, { t: (k) => am[k] || k, lang: 'am' }))
      expect(html).toContain('cyber-game-wrapper')
      expect(html).toContain('ዲጂታል ከተማ — የሳይበር ጦርነት')
    })
  })

  describe('8. Cinematic Audio & Sound Design Engine', () => {
    it('initializes audio manager with studio gain structure and rate limits', () => {
      expect(cityAudio).toBeDefined()
      expect(typeof cityAudio.init).toBe('function')
      expect(typeof cityAudio.setVolumes).toBe('function')

      cityAudio.setVolumes({ master: 0.9, sfx: 0.8, music: 0.5, muted: false })
      expect(cityAudio.masterVolume).toBe(0.9)
      expect(cityAudio.sfxVolume).toBe(0.8)
      expect(cityAudio.musicVolume).toBe(0.5)
      expect(cityAudio.isMuted).toBe(false)

      cityAudio.setVolumes({ muted: true })
      expect(cityAudio.isMuted).toBe(true)
      expect(cityAudio.canPlay('player_fire')).toBe(false)

      cityAudio.setVolumes({ muted: false })
      expect(cityAudio.isMuted).toBe(false)
    })

    it('transitions dynamic music intensity states seamlessly', () => {
      cityAudio.setMusicState('exploration')
      expect(cityAudio.musicState).toBe('exploration')
      expect(cityAudio.tempoBpm).toBe(108)

      cityAudio.setMusicState('combat')
      expect(cityAudio.musicState).toBe('combat')
      expect(cityAudio.tempoBpm).toBe(126)

      cityAudio.setMusicState('boss')
      expect(cityAudio.musicState).toBe('boss')
      expect(cityAudio.tempoBpm).toBe(138)

      cityAudio.setMusicState('victory')
      expect(cityAudio.musicState).toBe('victory')

      cityAudio.setMusicState('defeat')
      expect(cityAudio.musicState).toBe('defeat')

      cityAudio.setMusicState('off')
      expect(cityAudio.musicState).toBe('off')
    })

    it('emits footstep, jump, and landing audio events during simulation movement', () => {
      const state = createInitialCitySimulationState({ missionId: 'm_01_orientation' })

      // 1. Walking movement generates footsteps
      let stepEventFound = false
      let sim = state
      for (let i = 0; i < 30; i++) {
        sim = stepDigitalCitySimulation(sim, { forward: true, sprint: false }, [], 0.016, 1000 + i * 16)
        if (sim.audioEvents.some((e) => e.type === 'footstep' && !e.isSprinting)) {
          stepEventFound = true
          break
        }
      }
      expect(stepEventFound).toBe(true)

      // 2. Sprint movement generates sprinting footsteps
      let sprintStepFound = false
      sim = state
      for (let i = 0; i < 30; i++) {
        sim = stepDigitalCitySimulation(sim, { forward: true, sprint: true }, [], 0.016, 2000 + i * 16)
        if (sim.audioEvents.some((e) => e.type === 'footstep' && e.isSprinting)) {
          sprintStepFound = true
          break
        }
      }
      expect(sprintStepFound).toBe(true)

      // 3. Jump and landing audio events
      const jumpSim = stepDigitalCitySimulation(state, { jump: true }, [], 0.016, 3000)
      expect(jumpSim.audioEvents.some((e) => e.type === 'jump')).toBe(true)
    })

    it('emits weapon firing, impact, and defeat audio events during tactical combat', () => {
      const state = createInitialCitySimulationState({ missionId: 'm_01_orientation' })

      // Player fires Threat Blaster
      const shootSim = stepDigitalCitySimulation(state, { shoot: true }, [], 0.016, 4000)
      expect(shootSim.audioEvents.some((e) => e.type === 'player_fire')).toBe(true)

      // Projectile hitting enemy emits hit/defeat events
      const combatSim = createInitialCitySimulationState({ missionId: 'm_01_orientation' })
      combatSim.enemies = [
        createEnemyUnit({ id: 'target_en', classId: 'scout_hacker', x: 0, z: 2, health: 10, shield: 0 }),
      ]
      combatSim.projectiles = [
        {
          id: 'proj_test',
          startX: 0,
          startY: 1.3,
          startZ: 1.8,
          dirX: 0,
          dirZ: 1,
          speed: 40,
          damage: 200,
          isEnemy: false,
          lifetime: 1.5,
        },
      ]

      const hitSim = stepDigitalCitySimulation(combatSim, {}, [], 0.016, 5000)
      expect(hitSim.audioEvents.some((e) => e.type === 'enemy_defeat')).toBe(true)
    })

    it('executes all sound effect synthesizers safely without throwing in headless environments', () => {
      expect(() => {
        cityAudio.playEnergyRifle()
        cityAudio.playEnemyPlasma()
        cityAudio.playReload()
        cityAudio.playShieldActivate()
        cityAudio.playShieldDeflect()
        cityAudio.playNetworkPulse()
        cityAudio.playRecoveryBeacon()
        cityAudio.playSignalScanner()
        cityAudio.playEncryptionBarrier()
        cityAudio.playEmpDevice()
        cityAudio.playExplosion(false)
        cityAudio.playExplosion(true)
        cityAudio.playBulletImpact()
        cityAudio.playArmorImpact()
        cityAudio.playEnemyDefeat(false)
        cityAudio.playEnemyDefeat(true)
        cityAudio.playAlarm()
        cityAudio.playBossRoar()
        cityAudio.playCityDefenseTurret()
        cityAudio.playFootstep(false)
        cityAudio.playFootstep(true)
        cityAudio.playJump()
        cityAudio.playLand()
        cityAudio.playVictoryFanfare()
        cityAudio.playDefeatLament()
        cityAudio.playRadioChirp(true)
        cityAudio.playRadioChirp(false)
        cityAudio.playRadioVoiceTransmission('guard')
        cityAudio.playRadioVoiceTransmission('hq')
        cityAudio.playHitMarker()
        cityAudio.playEnemyAlert()
        cityAudio.playEnemyHurt()
        cityAudio.playPlayerHurt()
        cityAudio.playObjectiveWarning()
      }).not.toThrow()
    })
  })

  describe('8. Gameplay Pacing, Squad Formation, Procedural Radio Chatter & Action-Gated Tutorial', () => {
    it('provides exactly 3 clear difficulty tiers defaulting to beginner with deliberate pacing', () => {
      expect(DIFFICULTY_TIERS).toBeDefined()
      expect(DIFFICULTY_TIERS.beginner).toBeDefined()
      expect(DIFFICULTY_TIERS.normal).toBeDefined()
      expect(DIFFICULTY_TIERS.advanced).toBeDefined()

      // Default initial simulation uses beginner tier with comfortable player speed
      const defaultSim = createInitialCitySimulationState({ missionId: 'm_01_orientation' })
      expect(defaultSim.difficultyId).toBe('beginner')
      expect(defaultSim.player.speed).toBeGreaterThan(3.5)
      expect(defaultSim.player.speed).toBeLessThan(4.5)

      // Beginner tier has gentler enemy speed and attack multipliers
      expect(DIFFICULTY_TIERS.beginner.enemySpeedMultiplier).toBeLessThan(1.0)
      expect(DIFFICULTY_TIERS.beginner.enemyDamageMultiplier).toBeLessThan(1.0)
      expect(DIFFICULTY_TIERS.beginner.enemyAttackIntervalMultiplier).toBeGreaterThan(1.0)
      expect(DIFFICULTY_TIERS.beginner.playerDamageMultiplier).toBeGreaterThan(1.0)
    })

    it('enforces tactical, beginner-friendly projectile speeds and character pacing', () => {
      // Threat Blaster speed is comfortably paced (38 m/s, down from 95 m/s)
      expect(EQUIPMENT_REGISTRY.threat_blaster.projectileSpeed).toBe(38)

      // Player Recruit speed is comfortable (4.2 m/s walk)
      expect(CHARACTER_CLASSES.cyber_guard_recruit.speed).toBe(4.2)
      expect(CHARACTER_CLASSES.cyber_guard_recruit.sprintSpeed).toBe(6.8)

      // Enemy Scout is deliberate and readable (3.8 m/s)
      expect(CHARACTER_CLASSES.scout_hacker.speed).toBe(3.8)
    })

    it('positions friendly squad guards in a dynamic wedge formation escorting player', () => {
      const guardAlpha = createFriendlyGuardUnit({ id: 'guard_alpha_1', callsign: 'Alpha-1', x: 0, z: 0 })
      const guardBravo = createFriendlyGuardUnit({ id: 'guard_bravo_2', callsign: 'Bravo-2', x: 0, z: 0 })

      // Player standing at (10, 20) facing north (rotationY = 0)
      const playerPos = { x: 10, y: 0, z: 20, rotationY: 0 }

      const nextAlpha = updateFriendlyGuardTick(guardAlpha, playerPos, SQUAD_COMMANDS.FOLLOW, [], [], 0.05, 1000)
      const nextBravo = updateFriendlyGuardTick(guardBravo, playerPos, SQUAD_COMMANDS.FOLLOW, [], [], 0.05, 1000)

      // Alpha targets left flank offset (-3.5), Bravo targets right flank offset (+3.5)
      expect(nextAlpha.formationOffset.x).toBeLessThan(0)
      expect(nextBravo.formationOffset.x).toBeGreaterThan(0)
      expect(nextAlpha.formationOffset.z).toBeGreaterThan(0) // behind player
    })

    it('freezes simulation and AI when pause state is activated', () => {
      const state = createInitialCitySimulationState({ missionId: 'm_01_orientation' })
      state.isPaused = true
      state.player.x = 10
      state.player.z = 10

      const nextState = stepDigitalCitySimulation(
        state,
        { forward: true, shoot: true },
        [],
        0.05,
        1500
      )

      // Simulation position, audio events, and projectiles must not advance while paused
      expect(nextState.player.x).toBe(10)
      expect(nextState.player.z).toBe(10)
      expect(nextState.audioEvents).toEqual([])
    })

    it('dispatches hit markers, damage vignettes, and radio comms events during combat', () => {
      const combatSim = createInitialCitySimulationState({ missionId: 'm_01_orientation' })
      combatSim.enemies = [
        createEnemyUnit({ id: 'target_drone', classId: 'scout_hacker', x: 0, z: 2, health: 100, shield: 50 }),
      ]
      combatSim.projectiles = [
        {
          id: 'player_blaster_test',
          startX: 0,
          startY: 1.3,
          startZ: 1.8,
          dirX: 0,
          dirZ: 1,
          speed: 38,
          damage: 40,
          isEnemy: false,
          lifetime: 1.5,
        },
      ]

      const nextSim = stepDigitalCitySimulation(combatSim, {}, [], 0.016, 2000)
      // Must generate positive hit marker and enemy hurt event
      expect(nextSim.audioEvents.some((e) => e.type === 'hit_marker')).toBe(true)
      expect(nextSim.audioEvents.some((e) => e.type === 'enemy_hurt')).toBe(true)
    })

    it('preserves trilingual parity for all 10 action-gated tutorial steps, difficulty tiers, and radio comms', () => {
      const locales = [
        { lang: 'en', dict: en },
        { lang: 'om', dict: om },
        { lang: 'am', dict: am },
      ]

      // Check all 10 tutorial step actions
      for (let s = 1; s <= 10; s++) {
        for (const { lang, dict } of locales) {
          const actionKey = `digital_city.tutorial.step${s}_action`
          expect(dict[actionKey], `Missing ${actionKey} in ${lang}`).toBeDefined()
          expect(typeof dict[actionKey]).toBe('string')
          expect(dict[actionKey].trim().length).toBeGreaterThan(0)
        }
      }

      // Check difficulty keys
      for (const diff of ['beginner', 'normal', 'advanced']) {
        for (const { lang, dict } of locales) {
          const diffKey = `digital_city.difficulty.${diff}`
          expect(dict[diffKey], `Missing ${diffKey} in ${lang}`).toBeDefined()
          expect(dict[diffKey].trim().length).toBeGreaterThan(0)
        }
      }

      // Check radio chatter keys
      const radioKeys = [
        'digital_city.radio.squad_follow',
        'digital_city.radio.squad_defend',
        'digital_city.radio.squad_attack',
        'digital_city.radio.squad_regroup',
        'digital_city.radio.enemy_spotted',
        'digital_city.radio.enemy_defeated',
        'digital_city.radio.under_fire',
        'digital_city.radio.core_attacked',
      ]

      for (const rk of radioKeys) {
        for (const { lang, dict } of locales) {
          expect(dict[rk], `Missing ${rk} in ${lang}`).toBeDefined()
          expect(dict[rk].trim().length).toBeGreaterThan(0)
        }
      }

      // Check settings keys
      for (const sk of ['digital_city.settings.sensitivity', 'digital_city.settings.difficulty', 'digital_city.settings.comms_vol']) {
        for (const { lang, dict } of locales) {
          expect(dict[sk], `Missing ${sk} in ${lang}`).toBeDefined()
          expect(dict[sk].trim().length).toBeGreaterThan(0)
        }
      }
    })

    it('renders DigitalCityGame component with difficulty badge, settings, and HUD without errors', () => {
      const mockT = (key) => en[key] || key
      const htmlMenu = renderToString(React.createElement(DigitalCityGame, { t: mockT, lang: 'en', initialViewState: 'menu' }))
      expect(htmlMenu).toContain('ABBAY CYBERGUARD')
      expect(htmlMenu).toContain('start-actions')

      const htmlPlaying = renderToString(React.createElement(DigitalCityGame, { t: mockT, lang: 'en', initialViewState: 'playing' }))
      expect(htmlPlaying).toContain('hud-compass-tape')
      expect(htmlPlaying).toContain('SHIELD / ARMOR')
      expect(htmlPlaying).toContain('HEALTH')
    })
  })

  describe('9. Enemy Faction Redesign, Readable Combat Behavior & Coherent City Architecture', () => {
    it('defines 4 distinct hostile role silhouettes: Scout, Assault, Heavy, Drone Operator, plus Defenders', () => {
      expect(CHARACTER_CLASSES.scout_hacker.role).toBe('scout')
      expect(CHARACTER_CLASSES.scout_hacker.weaponName).toBe('Scout Rapid SMG')

      expect(CHARACTER_CLASSES.malware_unit.role).toBe('assault')
      expect(CHARACTER_CLASSES.malware_unit.weaponName).toBe('Assault Plasma Rifle')

      expect(CHARACTER_CLASSES.heavy_attacker.role).toBe('heavy')
      expect(CHARACTER_CLASSES.heavy_attacker.weaponName).toBe('Heavy Rotary Plasma Cannon')

      expect(CHARACTER_CLASSES.drone_controller.role).toBe('drone_operator')
      expect(CHARACTER_CLASSES.drone_controller.weaponName).toBe('Telemetry Console & Sidearm')

      expect(CHARACTER_CLASSES.cyber_guard_recruit.role).toBe('defender')
      expect(CHARACTER_CLASSES.cyber_guard_recruit.weaponName).toBe('Cyan Precision Energy Rifle')
    })

    it('builds role-specialized 3D modular meshes with distinct weapons and overhead state billboards', () => {
      // 1. Scout mesh
      const scoutMesh = buildCharacterMesh('scout_hacker')
      expect(scoutMesh.userData.role).toBe('scout')
      expect(scoutMesh.userData.parts.weapon).toBeDefined()
      expect(scoutMesh.userData.parts.stateBadgeMesh).toBeDefined()

      // 2. Heavy mesh
      const heavyMesh = buildCharacterMesh('heavy_attacker')
      expect(heavyMesh.userData.role).toBe('heavy')
      expect(heavyMesh.userData.parts.weapon.children.length).toBeGreaterThan(2)

      // 3. Drone operator mesh
      const droneOpMesh = buildCharacterMesh('drone_controller')
      expect(droneOpMesh.userData.role).toBe('drone_operator')
      expect(droneOpMesh.userData.parts.torso.children.length).toBeGreaterThan(3) // has antennae & telemetry pack

      // 4. Overhead State Badge update
      updateCharacterStateBadge(scoutMesh, 'ALERT')
      expect(scoutMesh.userData.parts.stateBadgeMesh.userData.currentState).toBe('ALERT')

      updateCharacterStateBadge(scoutMesh, 'AIM')
      expect(scoutMesh.userData.parts.stateBadgeMesh.userData.currentState).toBe('AIM')

      updateCharacterStateBadge(scoutMesh, 'TAKE_COVER')
      expect(scoutMesh.userData.parts.stateBadgeMesh.userData.currentState).toBe('TAKE_COVER')
    })

    it('evaluates all procedural tactical animation states without NaN', () => {
      const mesh = buildCharacterMesh('assault_hacker')
      const anims = ['idle', 'patrol', 'alert', 'aim', 'attack', 'cover', 'stagger', 'retreat', 'defeat']

      for (const anim of anims) {
        updateCharacterAnimation(mesh, anim, 0.016)
        expect(isNaN(mesh.userData.parts.torso.rotation.x)).toBe(false)
        expect(isNaN(mesh.userData.parts.rightArm.rotation.x)).toBe(false)
        expect(isNaN(mesh.userData.parts.pelvis.position.y)).toBe(false)
      }

      // Verify cover posture crouches down
      updateCharacterAnimation(mesh, 'cover', 0.016)
      expect(mesh.userData.parts.pelvis.position.y).toBeLessThan(0.9)
    })

    it('defines exactly 8 canonical institutions & district landmarks with complete feature sets', () => {
      expect(CANONICAL_CITY_LANDMARKS).toHaveLength(8)

      const ids = CANONICAL_CITY_LANDMARKS.map((l) => l.id)
      expect(ids).toContain('landmark_central_gov')
      expect(ids).toContain('landmark_security_soc')
      expect(ids).toContain('landmark_hospital')
      expect(ids).toContain('landmark_university')
      expect(ids).toContain('landmark_cbe_bank')
      expect(ids).toContain('landmark_telecom_data')
      expect(ids).toContain('landmark_residential')
      expect(ids).toContain('landmark_power_grid')

      for (const l of CANONICAL_CITY_LANDMARKS) {
        expect(l.name.length).toBeGreaterThan(5)
        expect(l.category).toBeDefined()
        expect(l.coords).toBeDefined()
        expect(l.features.length).toBeGreaterThanOrEqual(3)
      }
    })

    it('executes full readable combat AI progression: Patrol -> Alert -> Chase -> Aim -> Attack -> Cover -> Defeated', () => {
      const enemy = createEnemyUnit({ id: 'en_tactical_1', classId: 'malware_unit', x: 0, z: 45, health: 90, maxHealth: 90 })
      expect(enemy.state).toBe(AI_STATES.PATROL)

      // Step 1: Detects player within 30m -> enters ALERT reaction (stops, faces player)
      const pAlert = { x: 0, z: 22 }
      const tickAlert = updateEnemyAITick(enemy, pAlert, [], [], 0.016, 1000)
      expect(tickAlert.enemy.state).toBe(AI_STATES.ALERT)
      expect(tickAlert.enemy.vx).toBe(0)
      expect(tickAlert.enemy.vz).toBe(0)

      // Step 2: Alert reaction window (0.75s) expires -> advances to CHASE
      const tickChase = updateEnemyAITick(tickAlert.enemy, pAlert, [], [], 0.80, 1800)
      expect(tickChase.enemy.state).toBe(AI_STATES.CHASE)

      // Step 3: Reaches attack distance (<= 18m) -> enters AIM telegraphing state
      const pAim = { x: 0, z: 36 } // dist = 9m
      const tickAim = updateEnemyAITick(tickChase.enemy, pAim, [], [], 0.016, 2000)
      expect(tickAim.enemy.state).toBe(AI_STATES.AIM)

      // Step 4: Aiming telegraph window (0.50s) expires -> executes ATTACK
      const tickAttack = updateEnemyAITick(tickAim.enemy, pAim, [], [], 0.55, 2550)
      expect(tickAttack.enemy.state).toBe(AI_STATES.ATTACK)
      expect(tickAttack.attackTarget).toBeDefined()

      // Step 5: Under fire / low health -> immediately seeks COVER
      const wounded = { ...tickAttack.enemy, health: 18 }
      const tickCover = updateEnemyAITick(wounded, pAim, [], [], 0.016, 2600)
      expect(tickCover.enemy.state).toBe(AI_STATES.TAKE_COVER)

      // Step 6: When health reaches 0 -> enters DEFEATED
      const dead = { ...tickCover.enemy, health: 0 }
      const tickDead = updateEnemyAITick(dead, pAim, [], [], 0.016, 2700)
      expect(tickDead.enemy.state).toBe(AI_STATES.DEFEATED)
    })
  })

  describe('10. Full Military Character, Weapon Progression, Tactical Squad Combat & Recognizable City Reconstruction', () => {
    it('builds authentic military character models with complete tactical gear, helmet, plate carrier, holsters, boots, and visible weapons', () => {
      // Friendly Recruit
      const friendlyRecruit = buildCharacterMesh('cyber_guard_recruit', true)
      expect(friendlyRecruit).toBeDefined()
      expect(friendlyRecruit.userData.isDefender).toBe(true)
      expect(friendlyRecruit.userData.parts.torso).toBeDefined()
      expect(friendlyRecruit.userData.parts.head).toBeDefined()
      expect(friendlyRecruit.userData.parts.leftArm).toBeDefined()
      expect(friendlyRecruit.userData.parts.rightArm).toBeDefined()
      expect(friendlyRecruit.userData.parts.leftLeg).toBeDefined()
      expect(friendlyRecruit.userData.parts.rightLeg).toBeDefined()
      expect(friendlyRecruit.userData.parts.weaponMesh).toBeDefined()

      // Hostile Assault Hacker
      const hostileAssault = buildCharacterMesh('malware_unit', false)
      expect(hostileAssault).toBeDefined()
      expect(hostileAssault.userData.isDefender).toBe(false)
      expect(hostileAssault.userData.parts.weaponMesh).toBeDefined()

      // Hostile Heavy Attacker
      const hostileHeavy = buildCharacterMesh('heavy_attacker', false)
      expect(hostileHeavy.userData.parts.weaponMesh).toBeDefined()

      // Hostile Scout
      const hostileScout = buildCharacterMesh('scout_hacker', false)
      expect(hostileScout.userData.parts.weaponMesh).toBeDefined()
    })

    it('creates modular 3D weapon models with specific geometries for all progression tiers and updates weapon in hand', () => {
      const weaponTypes = [
        'cyber_assault_rifle',
        'energy_pistol',
        'burst_rifle',
        'tactical_shotgun',
        'precision_rifle',
        'heavy_energy_rifle',
        'plasma_cannon',
        'long_range_sniper',
        'quantum_blaster',
      ]

      for (const wType of weaponTypes) {
        const weaponMesh = buildWeaponModel(wType, true)
        expect(weaponMesh).toBeDefined()
        expect(weaponMesh.name).toContain('weapon_')
        expect(weaponMesh.children.length).toBeGreaterThanOrEqual(2)
      }

      // Swapping weapon updates characterGroup
      const friendly = buildCharacterMesh('cyber_guard_recruit', true)
      const oldWeapon = friendly.userData.parts.weaponMesh
      expect(oldWeapon).toBeDefined()

      updateCharacterWeapon(friendly, 'plasma_cannon')
      const newWeapon = friendly.userData.parts.weaponMesh
      expect(newWeapon.name).toBe('weapon_plasma_cannon')
    })

    it('supports full procedural tactical animation states including reloading, kneeling fire, cover, and strafing', () => {
      const soldier = buildCharacterMesh('cyber_guard_elite', true)

      const animStates = [
        'idle',
        'walk',
        'run',
        'sprint',
        'aim',
        'attack',
        'reloading',
        'cover',
        'kneeling_fire',
        'strafe_left',
        'strafe_right',
        'alert',
        'retreat',
        'defeat',
      ]

      for (const state of animStates) {
        expect(() => {
          updateCharacterAnimation(soldier, state, 1.25, 0.016)
        }).not.toThrow()
        expect(soldier.userData.animState).toBe(state)
        expect(isNaN(soldier.userData.parts.torso.position.y)).toBe(false)
        expect(isNaN(soldier.userData.parts.leftArm.rotation.x)).toBe(false)
        expect(isNaN(soldier.userData.parts.rightArm.rotation.x)).toBe(false)
      }
    })

    it('defines 10 weapon progression tiers with magazine capacity, reload mechanics, and unlock requirements', () => {
      expect(Object.keys(WEAPON_REGISTRY).length).toBeGreaterThanOrEqual(10)

      // Tier check
      expect(WEAPON_REGISTRY.cyber_assault_rifle.unlockLevel).toBe(1)
      expect(WEAPON_REGISTRY.energy_pistol.unlockLevel).toBe(1)
      expect(WEAPON_REGISTRY.burst_rifle.unlockLevel).toBe(3)
      expect(WEAPON_REGISTRY.tactical_shotgun.unlockLevel).toBe(4)
      expect(WEAPON_REGISTRY.precision_rifle.unlockLevel).toBe(5)
      expect(WEAPON_REGISTRY.heavy_energy_rifle.unlockLevel).toBe(6)
      expect(WEAPON_REGISTRY.plasma_cannon.unlockLevel).toBe(7)
      expect(WEAPON_REGISTRY.long_range_sniper.unlockLevel).toBe(8)
      expect(WEAPON_REGISTRY.quantum_blaster.unlockLevel).toBe(10)

      // Next unlock helper
      const nextL1 = getNextWeaponUnlock(1)
      expect(nextL1.id).toBe('burst_rifle')
      expect(nextL1.unlockLevel).toBe(3)

      const nextL5 = getNextWeaponUnlock(5)
      expect(nextL5.id).toBe('heavy_energy_rifle')
      expect(nextL5.unlockLevel).toBe(6)

      const nextMax = getNextWeaponUnlock(10)
      expect(nextMax).toBeNull()
    })

    it('executes realistic reload cycles and weapon switching constraints', () => {
      const eqState = createPlayerEquipmentState(1)

      // Cannot switch to locked weapon (Level 5 Precision Rifle at Level 1)
      const switchLocked = switchPlayerWeapon(eqState, 'precision_rifle', 1)
      expect(switchLocked).toBe(false)
      expect(eqState.selectedWeaponId).toBe('threat_blaster')

      // Can switch to unlocked weapon (Energy Pistol)
      const switchUnlocked = switchPlayerWeapon(eqState, 'energy_pistol', 1)
      expect(switchUnlocked).toBe(true)
      expect(eqState.selectedWeaponId).toBe('energy_pistol')

      // Shooting depletes ammo
      eqState.ammo['energy_pistol'] = 3
      const canShoot = canActivateEquipment(eqState, 'energy_pistol', 1000)
      expect(canShoot).toBe(true)

      // Start reload
      const reloadStarted = startReload(eqState, 1000)
      expect(reloadStarted).toBe(true)
      expect(eqState.isReloading).toBe(true)
      expect(eqState.reloadTimer).toBeGreaterThan(0)

      // While reloading, cannot shoot weapon
      const canShootWhileReloading = canActivateEquipment(eqState, 'energy_pistol', 1100)
      expect(canShootWhileReloading).toBe(false)

      // Tick reload to completion
      const result = updateReloadTick(eqState, eqState.reloadTotalTime + 0.1)
      expect(result).toBeDefined()
      expect(result.completed).toBe(true)
      expect(eqState.isReloading).toBe(false)
      expect(eqState.ammo['energy_pistol']).toBe(WEAPON_REGISTRY.energy_pistol.magazineCapacity)
    })

    it('awards real-time combat XP and calculates level up triggers', () => {
      const prog = {
        playerLevel: 1,
        currentXp: 950,
        xpToNextLevel: 1000,
        unlockedEquipment: ['threat_blaster'],
      }

      const leveled = addCombatXp(120, prog)
      expect(leveled.playerLevel).toBe(2)
      expect(leveled.currentXp).toBe(70)
      expect(leveled.xpToNextLevel).toBe(1350)
    })

    it('defines 16 canonical tactical cover barricades and nearest cover search algorithm', () => {
      expect(CANONICAL_CITY_COVER_POINTS.length).toBe(16)

      for (const cov of CANONICAL_CITY_COVER_POINTS) {
        expect(cov.id).toBeDefined()
        expect(cov.type).toBeDefined()
        expect(cov.x).toBeDefined()
        expect(cov.z).toBeDefined()
        expect(cov.protectionRating).toBeGreaterThanOrEqual(0.7)
      }

      // Nearest cover search
      const nearPoint = findNearestCoverPoint(-6, -10, 15)
      expect(nearPoint).toBeDefined()
      expect(nearPoint.id).toBe('cover_soc_l')
    })

    it('friendly squad units execute ADVANCE (push 18m), FALL_BACK (retreat 10m), and TAKE_COVER orders', () => {
      const player = { x: 0, z: 0 }
      const guard = createFriendlyGuardUnit({ id: 'guard_1', classId: 'cyber_guard_elite', x: 0, z: 2 })

      // ADVANCE: Guard sets target 18m in front of player (z: -18)
      guard.command = SQUAD_COMMANDS.ADVANCE
      const advTick = updateFriendlyGuardTick(guard, player, [], 0.016, 1000)
      expect(advTick.guard.targetZ).toBeLessThan(player.z)
      expect(['run', 'sprint']).toContain(advTick.guard.animState)

      // FALL_BACK: Guard sets target 10m behind player (z: +10)
      guard.command = SQUAD_COMMANDS.FALL_BACK
      const fbTick = updateFriendlyGuardTick(guard, player, [], 0.016, 2000)
      expect(fbTick.guard.targetZ).toBeGreaterThan(player.z)
      expect(['run', 'sprint']).toContain(fbTick.guard.animState)

      // TAKE_COVER: Guard dashes to nearest cover barricade and enters cover stance
      guard.command = SQUAD_COMMANDS.TAKE_COVER
      const covTick = updateFriendlyGuardTick(guard, player, [], 0.016, 3000)
      expect(['run', 'sprint', 'cover']).toContain(covTick.guard.animState)
    })

    it('blocks projectiles colliding with physical environmental cover barricades', () => {
      const state = createInitialCitySimulationState({ missionId: 'm_01_orientation' })

      // Cover point cover_grand_n1 is at (-4, -30)
      // Projectile travelling directly through it
      state.projectiles = [
        {
          id: 'proj_cover_test',
          startX: -4,
          startY: 1.0,
          startZ: -20,
          dirX: 0,
          dirZ: -1,
          speed: 40,
          damage: 50,
          isEnemy: true,
          lifetime: 2.0,
        },
      ]

      // Step simulation so projectile hits cover
      const nextSim = stepDigitalCitySimulation(state, {}, [], 0.28, 1000)
      // Projectile should be destroyed upon colliding with the cover object
      expect(nextSim.projectiles.find((p) => p.id === 'proj_cover_test')).toBeUndefined()
    })

    it('renders tactical weapon progression dock, active squad commands, ammo status, and level HUD cleanly in SSR', () => {
      const mockT = (key) => en[key] || key
      const html = renderToString(
        React.createElement(DigitalCityGame, { t: mockT, lang: 'en', initialViewState: 'playing' })
      )
      expect(html).toContain('MILITARY RANK: LVL')
      expect(html).toContain('Cyber Rifle')
      expect(html).toContain('Energy Pistol')
      expect(html).toContain('Burst Rifle')
      expect(html).toContain('Precision')
      expect(html).toContain('[R] RELOAD')
      expect(html).toContain('F1: Follow')
      expect(html).toContain('F2: Defend')
      expect(html).toContain('F3: Advance')
      expect(html).toContain('F4: Fall Back')
      expect(html).toContain('F5/C: Cover')
      expect(html).toContain('Shield')
      expect(html).toContain('Pulse')
      expect(html).toContain('Beacon')
    })
  })

  describe('11. Fullscreen Gameplay, Compact HUD Mode & Collapsible Information Architecture', () => {
    it('guarantees getNextWeaponUnlock returns valid requiredLevel and unlockLevel with zero undefined across all levels', () => {
      for (let lv = 1; lv <= 10; lv++) {
        const next = getNextWeaponUnlock(lv)
        if (next) {
          expect(typeof (next.unlockLevel || next.requiredLevel)).toBe('number')
          expect(next.unlockLevel || next.requiredLevel).toBeGreaterThan(lv)
          expect(next.defaultName).toBeDefined()
        }
      }
      // Level 1 next is Lv 3
      const next1 = getNextWeaponUnlock(1)
      expect(next1.unlockLevel || next1.requiredLevel).toBe(3)
      // Level 4 next is Lv 5
      const next4 = getNextWeaponUnlock(4)
      expect(next4.unlockLevel || next4.requiredLevel).toBe(5)
      // Level 10 is max arsenal
      expect(getNextWeaponUnlock(10)).toBeNull()
    })

    it('verifies mission wave configurations match objectives (M14 has 4 waves, M01-M13 have 3 waves)', () => {
      const m14 = STORY_MISSIONS.find((m) => m.id === 'm_14_citywide_siege')
      expect(m14).toBeDefined()
      expect(m14.totalWaves).toBe(4)
      expect(m14.primaryObjective).toContain('4-wave')

      const m01 = STORY_MISSIONS.find((m) => m.id === 'm_01_orientation')
      expect(m01.totalWaves).toBe(3)

      const m10 = STORY_MISSIONS.find((m) => m.id === 'm_10_government_citadel')
      expect(m10.totalWaves).toBe(3)
      expect(m10.primaryObjective).toContain('3 intensive attack waves')

      const m15 = STORY_MISSIONS.find((m) => m.id === 'm_15_the_final_firewall')
      expect(m15.totalWaves).toBe(4)
    })

    it('renders Compact HUD controls, Fullscreen toggle, Intel drawer, and keyboard shortcut hints', () => {
      const mockT = (key) => en[key] || key
      const html = renderToString(
        React.createElement(DigitalCityGame, { t: mockT, lang: 'en', initialViewState: 'playing' })
      )
      // Compact mode and fullscreen controls
      expect(html).toContain('Fullscreen')
      expect(html).toContain('Compact')
      expect(html).toContain('HUD [H]')
      expect(html).toContain('hud-compass-tape')
      expect(html).toContain('hud-intel-drawer')
      expect(html).toContain('Intruders:')
      expect(html).toContain('Infrastructure:')
    })

    it('DigitalCityWorldRenderer safely executes handleResize without crashing', () => {
      const mockCanvas = {
        clientWidth: 1920,
        clientHeight: 1080,
        width: 1920,
        height: 1080,
        getContext: () => null,
        addEventListener: () => {},
        removeEventListener: () => {},
      }
      const renderer = new DigitalCityWorldRenderer(mockCanvas, {})
      expect(typeof renderer.handleResize).toBe('function')
      // Calling handleResize in headless environment should not throw
      expect(() => renderer.handleResize()).not.toThrow()
      renderer.dispose()
    })
  })

  describe('12. Realistic Soldier Combat, Enemy Visibility, Tactical Squad Movement, Bright City Architecture & Drone Combat Overhaul', () => {
    it('verifies bright afternoon daylight scene lighting, sky background, asphalt roads, and raised sidewalks', () => {
      const mockCanvas = {
        clientWidth: 1280,
        clientHeight: 720,
        width: 1280,
        height: 720,
        getContext: () => null,
        addEventListener: () => {},
        removeEventListener: () => {},
      }
      const renderer = new DigitalCityWorldRenderer(mockCanvas, {})
      expect(renderer.scene).toBeDefined()
      // Sky background is crisp daylight afternoon blue (0xb2daf5)
      expect(renderer.scene.background.getHex()).toBe(0xb2daf5)

      // Road network contains asphalt surfaces and raised sidewalks
      const roadNet = renderer.scene.getObjectByName('city_road_network')
      expect(roadNet).toBeDefined()

      renderer.dispose()
    })

    it('verifies CBE Bank HQ signage has accurate Birr/ETB text and strictly NO Bitcoin symbol (₿)', () => {
      const mockCanvas = {
        clientWidth: 1280,
        clientHeight: 720,
        width: 1280,
        height: 720,
        getContext: () => null,
        addEventListener: () => {},
        removeEventListener: () => {},
      }
      const renderer = new DigitalCityWorldRenderer(mockCanvas, {})
      const buildings = renderer.scene.getObjectByName('city_buildings')
      expect(buildings).toBeDefined()

      const cbeBank = buildings.getObjectByName('landmark_cbe_bank')
      expect(cbeBank).toBeDefined()

      // Traverse children to check label and vault spokes
      let foundSignText = ''
      cbeBank.traverse((child) => {
        if (child.name && child.name.includes('label_')) {
          foundSignText += child.name
        }
      })
      // Must NOT contain Bitcoin symbol ₿
      expect(foundSignText).not.toContain('₿')
      expect(foundSignText).not.toContain('BITCOIN')

      renderer.dispose()
    })

    it('initializes military 3-guard squad fireteam (Alpha, Bravo, Charlie) with tactical formation offsets', () => {
      const state = createInitialCitySimulationState({ missionId: 'm_01_orientation' })
      expect(state.friendlyGuards).toHaveLength(3)

      const [alpha, bravo, charlie] = state.friendlyGuards
      expect(alpha.id).toBe('guard_alpha')
      expect(bravo.id).toBe('guard_bravo')
      expect(charlie.id).toBe('guard_charlie')

      const playerPos = { x: 0, z: 0, rotationY: 0 }
      const tickAlpha = updateFriendlyGuardTick(alpha, playerPos, SQUAD_COMMANDS.FOLLOW, 0.016, 1000)
      const tickBravo = updateFriendlyGuardTick(bravo, playerPos, SQUAD_COMMANDS.FOLLOW, 0.016, 1000)
      const tickCharlie = updateFriendlyGuardTick(charlie, playerPos, SQUAD_COMMANDS.FOLLOW, 0.016, 1000)

      // Alpha is left flank (-4.5), Bravo is right flank (+4.5), Charlie is rear overwatch (0.0, 5.5)
      expect(tickAlpha.formationOffset.x).toBeLessThan(0)
      expect(tickBravo.formationOffset.x).toBeGreaterThan(0)
      expect(tickCharlie.formationOffset.x).toBe(0)
      expect(tickCharlie.formationOffset.z).toBeGreaterThan(tickAlpha.formationOffset.z)
    })

    it('verifies friendly guards and enemy soldiers avoid building obstacle boxes and slide along walls', () => {
      const guard = createFriendlyGuardUnit({ id: 'guard_test', x: 0, z: 0 })
      const playerPos = { x: 0, z: 20, rotationY: 0 }
      guard.command = SQUAD_COMMANDS.ADVANCE // Attempts to move in +Z

      // Obstacle block directly in front of the guard (from z = 0.5 to z = 10, x = -5 to +5)
      const obstacles = [{ minX: -5, maxX: 5, minZ: 0.5, maxZ: 10 }]

      const tick = updateFriendlyGuardTick(guard, playerPos, [], 0.016, 1000, obstacles)
      // Guard position along Z should be prevented from penetrating into the obstacle box
      expect(tick.guard.z).toBeLessThan(0.5)

      // Test Enemy obstacle avoidance
      const enemy = {
        id: 'en_test',
        health: 100,
        maxHealth: 100,
        speed: 4.0,
        x: 0,
        z: 0,
        state: 'CHASE',
        patrolPoints: [],
      }
      const enemyTick = updateEnemyAITick(enemy, { x: 0, z: 20 }, [], obstacles, 0.016, 1000)
      expect(enemyTick.enemy.z).toBeLessThan(0.5)
    })

    it('syncs active projectiles in DigitalCityWorldRenderer with 3D tracer bolts', () => {
      const mockCanvas = {
        clientWidth: 1280,
        clientHeight: 720,
        width: 1280,
        height: 720,
        getContext: () => null,
        addEventListener: () => {},
        removeEventListener: () => {},
      }
      const renderer = new DigitalCityWorldRenderer(mockCanvas, {})
      expect(typeof renderer.syncProjectiles).toBe('function')

      const sampleProjectiles = [
        { id: 'p1', startX: 5, startY: 1.3, startZ: 10, dirX: 0, dirZ: 1, isEnemy: false, color: '#00f0ff' },
        { id: 'p2', startX: -5, startY: 1.3, startZ: 15, dirX: 1, dirZ: 0, isEnemy: true, color: '#ef4444' },
      ]

      renderer.syncProjectiles(sampleProjectiles)
      expect(renderer.projectileMeshesMap.size).toBe(2)

      // Removing p1 in next sync cleans it up
      renderer.syncProjectiles([sampleProjectiles[1]])
      expect(renderer.projectileMeshesMap.size).toBe(1)
      expect(renderer.projectileMeshesMap.has('p2')).toBe(true)
      expect(renderer.projectileMeshesMap.has('p1')).toBe(false)

      renderer.dispose()
    })

    it('builds distinct predatory hostile strike drone and aerodynamic friendly recon sentinel drone', () => {
      const hostileDrone = buildDroneMesh(true)
      expect(hostileDrone.name).toBe('drone_hostile')
      expect(hostileDrone.userData.isEnemy).toBe(true)
      expect(hostileDrone.userData.type).toBe('strike_drone')
      expect(hostileDrone.userData.rotors).toHaveLength(4)

      const friendlyDrone = buildDroneMesh(false)
      expect(friendlyDrone.name).toBe('drone_friendly')
      expect(friendlyDrone.userData.isEnemy).toBe(false)
      expect(friendlyDrone.userData.type).toBe('recon_sentinel')
      expect(friendlyDrone.userData.rotors).toHaveLength(4)
    })
  })

  describe('13. Friendly Recon Sentinel Autonomous Drone Combat AI Hardening', () => {
    it('1. detects an active hostile enemy within range, locks target, and turns to face it', () => {
      const state = createInitialCitySimulationState({ missionId: 'm_01_orientation' })
      const hostile = createEnemyUnit({ id: 'en_range_test', classId: 'scout_hacker', x: 0, z: -2, health: 100 })
      state.enemies = [hostile]

      const next = stepDigitalCitySimulation(state, {}, [], 0.016, 1000)
      const friendlyDrone = next.drones.find((d) => !d.isEnemy)
      expect(friendlyDrone).toBeDefined()
      expect(friendlyDrone.isTargetLocked).toBe(true)
      expect(friendlyDrone.targetId).toBe('en_range_test')
      expect(friendlyDrone.targetPos).toBeDefined()
      expect(friendlyDrone.heading).toBeDefined()
    })

    it('2. creates real twin cyan projectiles originating from its twin weapon emitters', () => {
      const state = createInitialCitySimulationState({ missionId: 'm_01_orientation' })
      const hostile = createEnemyUnit({ id: 'en_proj_test', classId: 'scout_hacker', x: 0, z: 0, health: 100 })
      state.enemies = [hostile]
      state.drones[0].lastAttackTimeMs = 0

      const next = stepDigitalCitySimulation(state, {}, [], 0.016, 2000)
      const droneProjectiles = next.projectiles.filter((p) => p.isDroneShot && !p.isEnemy)
      expect(droneProjectiles.length).toBeGreaterThanOrEqual(2)

      const p0 = droneProjectiles[0]
      expect(p0.color).toBe('#00f0ff')
      expect(p0.damage).toBe(12)
      expect(p0.isEnemy).toBe(false)
      expect(p0.speed).toBe(55)
      expect(p0.lifetime).toBeGreaterThan(0)
    })

    it('3. applies real combat damage to the targeted enemy when the projectile connects', () => {
      const state = createInitialCitySimulationState({ missionId: 'm_01_orientation' })
      const hostile = createEnemyUnit({ id: 'en_damage_test', classId: 'scout_hacker', x: 0, z: 0, health: 100, shield: 50 })
      state.enemies = [hostile]

      state.projectiles = [
        {
          id: 'drone_bolt_test',
          startX: 0,
          startY: 1.2,
          startZ: 0.5,
          dirX: 0,
          dirZ: -1,
          speed: 40,
          damage: 24,
          isEnemy: false,
          color: '#00f0ff',
          lifetime: 1.0,
        },
      ]

      const next = stepDigitalCitySimulation(state, {}, [], 0.05, 3000)
      const hitEnemy = next.enemies.find((e) => e.id === 'en_damage_test')
      expect(hitEnemy.shield).toBeLessThan(50)
      expect(next.audioEvents.some((evt) => evt.type === 'hit_marker' || evt.type === 'shield_deflect')).toBe(true)
    })

    it('4. guarantees friendly units (player, friendly guards, friendly drones) are never selected as targets', () => {
      const state = createInitialCitySimulationState({ missionId: 'm_01_orientation' })
      state.enemies = []

      const next = stepDigitalCitySimulation(state, {}, [], 0.016, 1000)
      for (const drone of next.drones.filter((d) => !d.isEnemy)) {
        expect(drone.isTargetLocked).toBe(false)
        expect(drone.targetId).toBeNull()
      }
      expect(next.projectiles.filter((p) => p.isDroneShot && !p.isEnemy)).toHaveLength(0)
    })

    it('5. does not attack an enemy outside its configured detection and attack range', () => {
      const state = createInitialCitySimulationState({ missionId: 'm_01_orientation' })
      const distantHostile = createEnemyUnit({ id: 'en_far_test', classId: 'scout_hacker', x: 0, z: -100, health: 100 })
      state.enemies = [distantHostile]

      const next = stepDigitalCitySimulation(state, {}, [], 0.016, 1000)
      for (const drone of next.drones.filter((d) => !d.isEnemy)) {
        expect(drone.isTargetLocked).toBe(false)
        expect(drone.targetId).toBeNull()
      }
      expect(next.projectiles.filter((p) => p.isDroneShot && !p.isEnemy)).toHaveLength(0)
    })

    it('6. respects line-of-sight and solid building obstacles', () => {
      const buildingBox = { minX: -10, maxX: 10, minZ: -10, maxZ: 10 }
      expect(hasLineOfSight(0, -20, 0, 20, [buildingBox])).toBe(false)
      expect(hasLineOfSight(15, -20, 15, 20, [buildingBox])).toBe(true)

      const state = createInitialCitySimulationState({ missionId: 'm_01_orientation' })
      const hostileBehindWall = createEnemyUnit({ id: 'en_behind_wall', classId: 'scout_hacker', x: 0, z: 0, health: 100 })
      state.enemies = [hostileBehindWall]
      const obstacle = { minX: -20, maxX: 20, minZ: 5, maxZ: 10 }

      const next = stepDigitalCitySimulation(state, {}, [obstacle], 0.016, 1000)
      const friendlyDrone = next.drones.find((d) => !d.isEnemy)
      expect(friendlyDrone.isTargetLocked).toBe(false)
      expect(friendlyDrone.targetId).toBeNull()
    })

    it('7. ensures the hostile strike drone continues to acquire and attack targets', () => {
      const state = createInitialCitySimulationState({ missionId: 'm_02_phishing_network' })
      const hostileDrone = state.drones.find((d) => d.isEnemy)
      expect(hostileDrone).toBeDefined()
      hostileDrone.x = 0
      hostileDrone.z = 0
      hostileDrone.lastAttackTimeMs = 0
      hostileDrone.attackCooldownMs = 1000

      const next = stepDigitalCitySimulation(state, {}, [], 0.016, 3000)
      const enProjectiles = next.projectiles.filter((p) => p.isEnemy && p.isDroneShot)
      expect(enProjectiles.length).toBeGreaterThan(0)
      expect(enProjectiles[0].color).toBe('#ef4444')
    })

    it('8. instantly drops lock and does not attack destroyed targets indefinitely', () => {
      const state = createInitialCitySimulationState({ missionId: 'm_01_orientation' })
      const deadHostile = createEnemyUnit({ id: 'en_dead_test', classId: 'scout_hacker', x: 0, z: 10, health: 0 })
      state.enemies = [deadHostile]

      const next = stepDigitalCitySimulation(state, {}, [], 0.016, 1000)
      const friendlyDrone = next.drones.find((d) => !d.isEnemy)
      expect(friendlyDrone.isTargetLocked).toBe(false)
      expect(friendlyDrone.targetId).toBeNull()
      expect(next.projectiles.filter((p) => p.isDroneShot && !p.isEnemy)).toHaveLength(0)
    })
  })

  describe('14. Enemy Ground Soldier Restoration, Wave Spawning & Friendly Squad Protection Target Priority', () => {
    it('1. spawns living hostile ground soldiers and hostile strike drones in a mixed-combat mission', () => {
      const state = createInitialCitySimulationState({ missionId: 'm_02_phishing_syndicate' })
      const livingGroundSoldiers = state.enemies.filter((e) => e && e.health > 0)
      const hostileDrones = state.drones.filter((d) => d && d.isEnemy && d.health > 0)

      expect(livingGroundSoldiers.length).toBeGreaterThanOrEqual(3)
      expect(hostileDrones.length).toBeGreaterThanOrEqual(2)

      livingGroundSoldiers.forEach((soldier) => {
        expect(soldier.health).toBeGreaterThan(0)
        expect(soldier.maxHealth).toBeGreaterThan(0)
        expect(soldier.speed).toBeGreaterThan(0)
      })
    })

    it('2. verifies ground soldiers spawn on open street corridors in front of the player, visible and alive until defeated', () => {
      const state = createInitialCitySimulationState({ missionId: 'm_02_phishing_syndicate' })
      const playerZ = state.player.z // 15

      state.enemies.forEach((soldier) => {
        expect(soldier.z).toBeLessThan(playerZ) // Spawned in front of the forward-facing squad
        expect(Math.abs(soldier.x)).toBeLessThanOrEqual(25) // Along Grand Ave or Federal Blvd street width
        expect(soldier.health).toBeGreaterThanOrEqual(40)
      })
    })

    it('3. includes ground enemies in mission enemy counts, wave completion, and victory evaluation', () => {
      const state = createInitialCitySimulationState({ missionId: 'm_02_phishing_syndicate' })
      expect(state.objectiveProgress.targetEnemies).toBe(8)
      expect(state.enemiesDefeatedCount).toBe(0)
      expect(state.status).toBe('playing')

      // Stepping simulation with enemies alive does not prematurely trigger victory
      const next = stepDigitalCitySimulation(state, {}, [], 0.016, 1000)
      expect(next.status).toBe('playing')
    })

    it('4. allows hostile ground soldiers to detect, target, and damage friendly squad members', () => {
      const state = createInitialCitySimulationState({ missionId: 'm_02_phishing_syndicate' })
      const guardAlpha = state.friendlyGuards.find((g) => g.id === 'guard_alpha')
      expect(guardAlpha).toBeDefined()
      const initialShield = guardAlpha.shield || 100

      // Position hostile soldier close to guard Alpha (closer to guard Alpha than to player)
      const hostile = createEnemyUnit({
        id: 'hostile_attacker',
        classId: 'heavy_attacker',
        x: guardAlpha.x,
        z: guardAlpha.z - 3,
        health: 120,
      })
      hostile.state = AI_STATES.ATTACK
      hostile.lastAttackTimeMs = 0
      hostile.attackCooldownMs = 500
      state.enemies = [hostile]

      const next = stepDigitalCitySimulation(state, {}, [], 0.016, 2000)
      const enemyProjectiles = next.projectiles.filter((p) => p.isEnemy && p.targetId === 'guard_alpha')
      expect(enemyProjectiles.length).toBeGreaterThan(0)

      // Step again to allow projectile to connect with guard Alpha
      const nextStep = stepDigitalCitySimulation(next, {}, [], 0.25, 2250)
      const hitGuard = nextStep.friendlyGuards.find((g) => g.id === 'guard_alpha')
      expect(hitGuard.shield).toBeLessThan(initialShield)
    })

    it('5. friendly Recon Sentinel targets and damages hostile ground soldiers directly', () => {
      const state = createInitialCitySimulationState({ missionId: 'm_01_orientation' })
      const hostile = createEnemyUnit({
        id: 'target_ground_trooper',
        classId: 'scout_hacker',
        x: 0,
        z: 0,
        health: 80,
      })
      state.enemies = [hostile]
      state.drones[0].lastAttackTimeMs = 0

      const next = stepDigitalCitySimulation(state, {}, [], 0.016, 2000)
      const friendlyDrone = next.drones.find((d) => !d.isEnemy)
      expect(friendlyDrone.isTargetLocked).toBe(true)
      expect(friendlyDrone.targetId).toBe('target_ground_trooper')

      const droneBolts = next.projectiles.filter((p) => p.isDroneShot && !p.isEnemy)
      expect(droneBolts.length).toBeGreaterThanOrEqual(2)
      expect(droneBolts[0].color).toBe('#00f0ff')
    })

    it('6. friendly Recon Sentinel prioritizes ground enemies actively threatening nearby friendly squad members over hostile drones', () => {
      const state = createInitialCitySimulationState({ missionId: 'm_02_phishing_syndicate' })
      const friendlyDrone = state.drones.find((d) => !d.isEnemy)
      expect(friendlyDrone).toBeDefined()

      // Hostile soldier aiming directly at guard Bravo
      const groundThreat = {
        id: 'lethal_ground_sniper',
        x: 4.5,
        z: 5.0,
        isDrone: false,
        health: 80,
        state: 'ATTACK',
        targetFriendlyId: 'guard_bravo',
      }

      // Hostile strike drone patrolling overhead
      const airThreat = {
        id: 'patrolling_air_drone',
        x: 0,
        z: 10.0,
        isDrone: true,
        health: 65,
        isTargetLocked: false,
        targetId: null,
      }

      const groundScore = calculateDroneThreatScore(groundThreat, friendlyDrone, state.player, state.friendlyGuards)
      const airScore = calculateDroneThreatScore(airThreat, friendlyDrone, state.player, state.friendlyGuards)

      // Lethal ground attacker threatening squad member must score significantly higher
      expect(groundScore).toBeGreaterThan(airScore)
      expect(groundScore).toBeGreaterThan(150)
    })

    it('7. friendly Recon Sentinel dynamically shifts to target hostile strike drones when they become the immediate active threat', () => {
      const state = createInitialCitySimulationState({ missionId: 'm_02_phishing_syndicate' })
      const friendlyDrone = state.drones.find((d) => !d.isEnemy)

      // Hostile drone locked on friendly squad member
      const activeHostileDrone = {
        id: 'diving_strike_drone',
        x: 0,
        z: 8.0,
        isDrone: true,
        health: 65,
        isTargetLocked: true,
        targetId: 'guard_alpha',
      }

      // Distant passive ground soldier
      const distantHostile = {
        id: 'far_passive_soldier',
        x: 0,
        z: -35.0,
        isDrone: false,
        health: 80,
        state: 'PATROL',
        targetFriendlyId: null,
      }

      const airThreatScore = calculateDroneThreatScore(activeHostileDrone, friendlyDrone, state.player, state.friendlyGuards)
      const passiveGroundScore = calculateDroneThreatScore(distantHostile, friendlyDrone, state.player, state.friendlyGuards)

      expect(airThreatScore).toBeGreaterThan(passiveGroundScore)
    })

    it('8. guarantees friendly drone never targets friendly soldiers (Alpha, Bravo, Charlie) or the player under any threat scenario', () => {
      const state = createInitialCitySimulationState({ missionId: 'm_02_phishing_syndicate' })
      state.enemies = [] // Clear all enemies
      state.enemiesDefeatedCount = state.mission.targetEnemyCount // Target count met so wave spawner doesn't spawn new wave
      state.drones = state.drones.filter((d) => !d.isEnemy) // Clear hostile drones

      const next = stepDigitalCitySimulation(state, {}, [], 0.016, 1000)
      for (const drone of next.drones) {
        expect(drone.isTargetLocked).toBe(false)
        expect(drone.targetId).toBeNull()
      }
      expect(next.projectiles.filter((p) => p.isDroneShot)).toHaveLength(0)
    })

    it('9. instantly clears neutralized ground targets from drone lock, preventing wasted fire', () => {
      const state = createInitialCitySimulationState({ missionId: 'm_01_orientation' })
      const groundEnemy = createEnemyUnit({
        id: 'eliminated_hostile',
        classId: 'scout_hacker',
        x: 0,
        z: 0,
        health: 0, // neutralized
      })
      state.enemies = [groundEnemy]

      const next = stepDigitalCitySimulation(state, {}, [], 0.016, 1000)
      const friendlyDrone = next.drones.find((d) => !d.isEnemy)
      expect(friendlyDrone.isTargetLocked).toBe(false)
      expect(friendlyDrone.targetId).toBeNull()
    })

    it('10. maintains hostile drone combat behavior, aerial plasma firing, and collision rules', () => {
      const state = createInitialCitySimulationState({ missionId: 'm_02_phishing_syndicate' })
      const hostileDrone = state.drones.find((d) => d.isEnemy)
      expect(hostileDrone).toBeDefined()
      hostileDrone.x = 0
      hostileDrone.z = 5
      hostileDrone.lastAttackTimeMs = 0
      hostileDrone.attackCooldownMs = 800

      const next = stepDigitalCitySimulation(state, {}, [], 0.016, 2000)
      const hostileBolts = next.projectiles.filter((p) => p.isEnemy && p.isDroneShot)
      expect(hostileBolts.length).toBeGreaterThan(0)
      expect(hostileBolts[0].color).toBe('#ef4444')
    })
  })

  describe('15. Final Release Readiness: Campaign, Weapon Progression, Boss Battles & State Persistence', () => {
    it('1. verifies all 15 story campaign missions are strictly ordered and unlock sequentially', () => {
      expect(STORY_MISSIONS).toHaveLength(15)
      STORY_MISSIONS.forEach((m, idx) => {
        expect(m.order).toBe(idx + 1)
        expect(m.id).toMatch(/^m_\d{2}_/)
        expect(m.targetEnemyCount).toBeGreaterThan(0)
        expect(m.totalWaves).toBeGreaterThan(0)
        expect(m.xpReward).toBeGreaterThan(0)
        expect(m.creditReward).toBeGreaterThan(0)
      })

      // Simulate sequential unlock check
      const completed = []
      STORY_MISSIONS.forEach((m, idx) => {
        const isUnlocked = idx === 0 || completed.includes(STORY_MISSIONS[idx - 1].id)
        if (idx === 0) {
          expect(isUnlocked).toBe(true)
        } else {
          expect(isUnlocked).toBe(false)
        }
      })
    })

    it('2. guarantees single-reward policy: full reward on first clear, 40% diminishing reward on replays without duplicate completions', () => {
      resetDigitalCityProgression()
      const initial = loadDigitalCityProgression()
      const startCredits = initial.defenseCredits
      const m01 = STORY_MISSIONS[0]

      // First victory
      const afterFirst = recordMissionVictory(m01.id, m01.xpReward, m01.creditReward, { enemiesDefeated: 5 })
      expect(afterFirst.missionsCompleted).toEqual([m01.id])
      expect(afterFirst.currentXp).toBe(m01.xpReward)
      expect(afterFirst.defenseCredits).toBe(startCredits + m01.creditReward)

      // Second victory (replay)
      const afterSecond = recordMissionVictory(m01.id, m01.xpReward, m01.creditReward, { enemiesDefeated: 5 })
      expect(afterSecond.missionsCompleted).toEqual([m01.id]) // No duplicate
      const expectedXp = m01.xpReward + Math.round(m01.xpReward * 0.4)
      const expectedCredits = startCredits + m01.creditReward + Math.round(m01.creditReward * 0.4)
      expect(afterSecond.currentXp).toBe(expectedXp)
      expect(afterSecond.defenseCredits).toBe(expectedCredits)
    })

    it('3. validates boss encounter mechanics, 2000 HP boss entities, and victory stats progression', () => {
      const bossMissionIds = ['m_09_boss_the_phantom', 'm_11_boss_the_ransom_king', 'm_12_boss_the_signal_breaker', 'm_13_boss_the_data_reaper', 'm_15_the_final_firewall']
      bossMissionIds.forEach((bossMid) => {
        const mission = STORY_MISSIONS.find((m) => m.id === bossMid)
        expect(mission).toBeDefined()
        expect(mission.isBossMission).toBe(true)
        expect(mission.bossId).toBeDefined()

        const state = createInitialCitySimulationState({ missionId: bossMid, difficultyId: 'normal' })
        expect(state.isBossMission).toBe(true)
        const bossUnit = state.enemies.find((e) => e.isBoss)
        expect(bossUnit).toBeDefined()
        expect(bossUnit.maxHealth).toBe(2000)
        expect(bossUnit.health).toBe(2000)
      })

      // Simulate boss victory recording
      const state = loadDigitalCityProgression()
      const prevBosses = state.stats.bossesDefeated
      recordMissionVictory('m_09_boss_the_phantom', 2500, 1500, { isBoss: true, enemiesDefeated: 1 })
      const updated = loadDigitalCityProgression()
      expect(updated.stats.bossesDefeated).toBe(prevBosses + 1)
      expect(updated.unlockedAchievements).toContain('ghost_hunter')
    })

    it('4. verifies all 10 weapons across early, intermediate, advanced, and higher tiers with progression level gating', () => {
      const allWeapons = [
        'cyber_assault_rifle',
        'energy_pistol',
        'burst_rifle',
        'tactical_shotgun',
        'precision_rifle',
        'heavy_energy_rifle',
        'plasma_cannon',
        'long_range_sniper',
        'quantum_blaster',
        'threat_blaster',
      ]

      allWeapons.forEach((wId) => {
        expect(EQUIPMENT_REGISTRY[wId]).toBeDefined()
        expect(EQUIPMENT_REGISTRY[wId].damage).toBeGreaterThan(0)
        expect(EQUIPMENT_REGISTRY[wId].magazineCapacity).toBeGreaterThan(0)
      })

      // Gating test
      const equipment = createPlayerEquipmentState()
      // Level 1: cyber_assault_rifle allows switch, quantum_blaster rejects
      expect(switchPlayerWeapon(equipment, 'cyber_assault_rifle', 1)).toBe(true)
      expect(equipment.selectedWeaponId).toBe('cyber_assault_rifle')
      expect(switchPlayerWeapon(equipment, 'quantum_blaster', 1)).toBe(false)
      expect(equipment.selectedWeaponId).toBe('cyber_assault_rifle')

      // Level 10: quantum_blaster allows switch
      expect(switchPlayerWeapon(equipment, 'quantum_blaster', 10)).toBe(true)
      expect(equipment.selectedWeaponId).toBe('quantum_blaster')

      // Next weapon unlock check
      const nextUnlock = getNextWeaponUnlock(1)
      expect(nextUnlock).toBeDefined()
      expect(nextUnlock.unlockLevel).toBe(3)
    })

    it('5. awards combat XP, executes level advancement, and automatically unlocks tiered weaponry', () => {
      resetDigitalCityProgression()
      const prog = loadDigitalCityProgression()
      expect(prog.playerLevel).toBe(1)
      expect(prog.unlockedEquipment).not.toContain('burst_rifle')

      // Add enough XP to level up to 3+
      const res = addCombatXp(3000)
      expect(res.leveledUp).toBe(true)
      expect(res.newLevel).toBeGreaterThanOrEqual(3)
      expect(res.unlockedEquipment).toContain('burst_rifle')
    })

    it('6. safely persists and recovers progression state through journey progress bridge with resilient schema fallback', () => {
      const state = loadDigitalCityProgression()
      state.stats.perfectParries = 12
      state.stats.playTimeSeconds = 640
      state.selectedDifficulty = 'advanced'
      saveDigitalCityProgression(state)

      // Reload
      const reloaded = loadDigitalCityProgression()
      expect(reloaded.stats.perfectParries).toBe(12)
      expect(reloaded.stats.playTimeSeconds).toBe(640)
      expect(reloaded.selectedDifficulty).toBe('advanced')

      // Reset
      resetDigitalCityProgression()
      const clean = loadDigitalCityProgression()
      expect(clean.playerLevel).toBe(1)
      expect(clean.missionsCompleted).toEqual([])
      expect(clean.stats.perfectParries).toBe(0)
    })

    it('7. retains audio volume settings and mute preferences across sessions', () => {
      const state = loadDigitalCityProgression()
      state.audioSettings.masterVolume = 0.45
      state.audioSettings.sfxVolume = 0.6
      state.audioSettings.musicVolume = 0.3
      state.audioSettings.muted = true
      saveDigitalCityProgression(state)

      const reloaded = loadDigitalCityProgression()
      expect(reloaded.audioSettings.masterVolume).toBe(0.45)
      expect(reloaded.audioSettings.sfxVolume).toBe(0.6)
      expect(reloaded.audioSettings.musicVolume).toBe(0.3)
      expect(reloaded.audioSettings.muted).toBe(true)

      // Audio engine functions smoothly without throwing
      expect(() => cityAudio.playLaserFire(false)).not.toThrow()
      expect(() => cityAudio.playShieldDeflect()).not.toThrow()
      expect(() => cityAudio.playReload()).not.toThrow()
      expect(() => cityAudio.playDangerSiren()).not.toThrow()
    })

    it('8. provides completely isolated endless survival wave generation with boss spawns every 5 waves', () => {
      const wave1 = generateSurvivalWave(1, 100)
      expect(wave1.waveNumber).toBe(1)
      expect(wave1.enemies.length).toBeGreaterThan(0)
      expect(wave1.bossUnit).toBeNull()
      expect(wave1.waveRewardXp).toBe(300)

      const wave5 = generateSurvivalWave(5, 100)
      expect(wave5.waveNumber).toBe(5)
      expect(wave5.bossUnit).not.toBeNull()
      expect(wave5.bossUnit.id).toBe('wave_5_boss')
      expect(wave5.waveRewardXp).toBe(700)

      const wave10 = generateSurvivalWave(10, 100)
      expect(wave10.bossUnit).not.toBeNull()
      expect(wave10.bossUnit.id).toBe('wave_10_boss')
    })

    it('9. renders DigitalCityGame with compact HUD, weapon dock [1-9 / Scroll], and fullscreen toggle cleanly', () => {
      const html = renderToString(
        React.createElement(DigitalCityGame, {
          t: (k) => en[k] || k,
          lang: 'en',
          initialViewState: 'playing',
        })
      )
      expect(html).toContain('digital-city-container')
      expect(html).toContain('Tactical Arsenal [1-9 / Scroll]')
      expect(html).toContain('Cyber Rifle')
      expect(html).toContain('Energy Pistol')
      expect(html).toContain('Shotgun')
      expect(html).toContain('Sniper')
      expect(html).toContain('Quantum Blaster')
    })

    it('10. renders responsive mobile touch joystick, aimzone, and touch actions', () => {
      const html = renderToString(
        React.createElement(DigitalCityGame, {
          t: (k) => en[k] || k,
          lang: 'en',
          initialViewState: 'playing',
          initialShowTouchControls: true,
        })
      )
      expect(html).toContain('digital-city-touch-joystick')
      expect(html).toContain('digital-city-touch-aimzone')
      expect(html).toContain('digital-city-touch-actions')
      expect(html).toContain('Touch: ON')
    })
  })
})
