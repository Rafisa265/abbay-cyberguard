/**
 * CyberShield Ethiopia — DIGITAL CITY: CYBER WAR
 * Master 3D Tactical Cyber Defense & Action Game Component
 *
 * Implements:
 * - 3D Third-Person Perspective Canvas (Three.js WebGL)
 * - 10-District Open Cyber City Metropolis
 * - Real-Time Tactical Combat (Threat Blaster, Firewall Shield, Network Pulse, Recovery Beacon, EMP)
 * - Intelligent Enemy AI (9 Classes + 5 Epic Multi-Phase Bosses)
 * - Friendly Cyber Guard Squad with Tactical Commands
 * - 15 Story Missions, Endless Survival Mode, City Defense, Boss Rush
 * - Interactive 11-Step Beginner Tutorial
 * - Trilingual UI (English, Afaan Oromoo, Amharic)
 * - 100% Offline-First. Zero Math.random (SR-09 compliant).
 */

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import * as THREE from 'three'
import {
  DISTRICTS,
  getDistrictByCoordinates,
} from '../lib/digitalCity/cityDistricts.js'
import {
  EQUIPMENT_REGISTRY,
  WEAPON_REGISTRY,
  canActivateEquipment,
  switchPlayerWeapon,
  startReload,
  getNextWeaponUnlock,
} from '../lib/digitalCity/combatEquipment.js'
import {
  STORY_MISSIONS,
  DIFFICULTY_TIERS,
  generateSurvivalWave,
} from '../lib/digitalCity/missionsAndCampaign.js'
import {
  loadDigitalCityProgression,
  saveDigitalCityProgression,
  recordMissionVictory,
  ACHIEVEMENTS,
} from '../lib/digitalCity/gameProgression.js'
import { cityAudio } from '../lib/digitalCity/cityAudio.js'
import { DigitalCityWorldRenderer } from '../lib/digitalCity/digitalCityRenderer.js'
import {
  createInitialCitySimulationState,
  stepDigitalCitySimulation,
} from '../lib/digitalCity/digitalCityEngine.js'
import { SQUAD_COMMANDS } from '../lib/digitalCity/enemyAI.js'

const WEAPON_SLOTS = [
  { id: 'cyber_assault_rifle', key: '1', name: 'Cyber Rifle', reqLv: 1, icon: '🔫' },
  { id: 'energy_pistol', key: '2', name: 'Energy Pistol', reqLv: 1, icon: '🎯' },
  { id: 'burst_rifle', key: '3', name: 'Burst Rifle', reqLv: 3, icon: '💥' },
  { id: 'tactical_shotgun', key: '4', name: 'Shotgun', reqLv: 4, icon: '🔥' },
  { id: 'precision_rifle', key: '5', name: 'Precision', reqLv: 5, icon: '🎯' },
  { id: 'heavy_energy_rifle', key: '6', name: 'Heavy Rifle', reqLv: 6, icon: '⚡' },
  { id: 'plasma_cannon', key: '7', name: 'Plasma Cannon', reqLv: 7, icon: '💣' },
  { id: 'long_range_sniper', key: '8', name: 'Sniper', reqLv: 8, icon: '🔭' },
  { id: 'quantum_blaster', key: '9', name: 'Quantum Blaster', reqLv: 10, icon: '⚛️' },
]

export default function DigitalCityGame({ t, lang = 'en', onNavigate, initialViewState, initialShowTouchControls }) {
  const canvasRef = useRef(null)
  const rendererRef = useRef(null)
  const animFrameRef = useRef(null)
  const simStateRef = useRef(null)

  // Input state refs (for direct 60 FPS loop access without re-rendering)
  const inputRef = useRef({
    forward: false,
    backward: false,
    left: false,
    right: false,
    sprint: false,
    jump: false,
    shoot: false,
    block: false,
    activatePulse: false,
    activateBeacon: false,
  })
  const cameraRotRef = useRef({ yaw: 0, pitch: 0.22 })
  const isPointerLockedRef = useRef(false)

  // React UI & Menu state
  const [viewState, setViewState] = useState(() => {
    if (initialViewState) return initialViewState
    if (typeof window !== 'undefined' && window.location.hash.includes('mode=settings')) return 'settings'
    if (typeof window !== 'undefined' && (window.location.hash.includes('mode=playing') || window.location.hash.includes('mode=factions') || window.location.hash.includes('mode=landmarks'))) return 'playing'
    return 'menu'
  }) // 'menu' | 'playing' | 'paused' | 'victory' | 'defeat' | 'mission_select' | 'settings' | 'tutorial'
  const [progression, setProgression] = useState(() => loadDigitalCityProgression())
  const [selectedMissionId, setSelectedMissionId] = useState('m_01_orientation')
  const [selectedDifficulty, setSelectedDifficulty] = useState(() => {
    const p = loadDigitalCityProgression()
    return p.selectedDifficulty || 'beginner'
  })
  const [currentGameMode, setCurrentGameMode] = useState(() => {
    if (typeof window !== 'undefined' && window.location.hash.includes('mode=factions')) return 'factions_demo'
    if (typeof window !== 'undefined' && window.location.hash.includes('mode=landmarks')) return 'landmarks_demo'
    return 'story_campaign'
  })

  // Mouse Look & Tactical Sensitivity state
  const [mouseSensitivity, setMouseSensitivity] = useState(() => {
    const p = loadDigitalCityProgression()
    return p.mouseSensitivity != null ? p.mouseSensitivity : 1.0
  })
  const mouseSensitivityRef = useRef(1.0)
  useEffect(() => {
    mouseSensitivityRef.current = mouseSensitivity
  }, [mouseSensitivity])

  const mouseLookDistanceRef = useRef(0)
  const hitMarkerTimerRef = useRef(0)
  const damageFlashRef = useRef(0)
  const lastRadioTimeRef = useRef(0)
  const [radioBanner, setRadioBanner] = useState(null)

  // Fullscreen, Compact HUD Mode, Visibility & Collapsible Intel Drawer
  const containerRef = useRef(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [hudMode, setHudMode] = useState('compact') // 'compact' | 'standard'
  const [isHudVisible, setIsHudVisible] = useState(true)
  const [showIntelDrawer, setShowIntelDrawer] = useState(false)

  // Touch & Mobile Controls State
  const [showTouchControls, setShowTouchControls] = useState(() => {
    if (initialShowTouchControls !== undefined) return initialShowTouchControls
    if (typeof window === 'undefined') return false
    return 'ontouchstart' in window || (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0) || window.innerWidth <= 900
  })
  const touchAimRef = useRef({ active: false, id: null, lastX: 0, lastY: 0 })
  const [joystickThumb, setJoystickThumb] = useState({ x: 0, y: 0, active: false })

  // Fullscreen toggle handler supporting vendor prefixes
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen().catch(() => {})
      } else if (containerRef.current.webkitRequestFullscreen) {
        containerRef.current.webkitRequestFullscreen()
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {})
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen()
      }
    }
  }, [])

  // Fullscreen change & responsive window resize listeners
  useEffect(() => {
    const handleFsChange = () => {
      const active = Boolean(document.fullscreenElement || document.webkitFullscreenElement)
      setIsFullscreen(active)
      if (rendererRef.current) {
        setTimeout(() => {
          rendererRef.current?.handleResize?.()
        }, 60)
      }
    }
    const handleWinResize = () => {
      if (rendererRef.current) {
        rendererRef.current.handleResize?.()
      }
      if (typeof window !== 'undefined' && window.innerWidth <= 900) {
        setShowTouchControls(true)
      }
    }
    document.addEventListener('fullscreenchange', handleFsChange)
    document.addEventListener('webkitfullscreenchange', handleFsChange)
    window.addEventListener('resize', handleWinResize)
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange)
      document.removeEventListener('webkitfullscreenchange', handleFsChange)
      window.removeEventListener('resize', handleWinResize)
    }
  }, [])

  // HUD live states (throttled to 10 FPS for React UI performance)
  const [hudState, setHudState] = useState({
    health: 120,
    maxHealth: 120,
    shield: 80,
    maxShield: 80,
    energy: 100,
    maxEnergy: 100,
    heat: 0,
    isOverheated: false,
    selectedWeaponId: 'threat_blaster',
    selectedGadgetId: 'firewall_shield',
    currentDistrictName: 'Central Command District',
    districtColor: '#00bbff',
    objectiveText: 'Eliminate rogue scout probes',
    objectiveProgress: '0 / 5',
    infrastructureHealth: 100,
    score: 0,
    credits: 250,
    squadCommand: SQUAD_COMMANDS.FOLLOW,
    survivalWave: 1,
    totalWaves: 3,
    isBossMission: false,
    gameMode: 'story_campaign',
    isShieldActive: false,
    hitMarkerTick: false,
    damageFlash: 0,
    compassAngle: 0,
    nearestHostileDist: null,
    livingHostilesCount: 0,
    currentAmmo: 30,
    magazineCapacity: 30,
    isReloading: false,
    reloadProgress: 0,
    unlockedEquipment: ['threat_blaster', 'cyber_assault_rifle', 'energy_pistol'],
    playerLevel: 1,
    currentXp: 0,
    xpToNextLevel: 1000,
    nextUnlock: null,
  })

  // Tutorial overlay step state (10 guided action-gated steps)
  const [tutorialStep, setTutorialStep] = useState(1) // 1 to 10
  const [showTutorialOverlay, setShowTutorialOverlay] = useState(() => {
    if (typeof window !== 'undefined' && (window.location.hash.includes('mode=playing') || window.location.hash.includes('mode=tutorial'))) return true
    return false
  })

  // Audio & Settings state
  const [audioSettings, setAudioSettings] = useState(() => progression.audioSettings || { masterVolume: 0.8, sfxVolume: 0.85, musicVolume: 0.7, commsVolume: 0.85, muted: false })
  const [graphicsQuality, setGraphicsQuality] = useState(() => progression.graphicsQuality || 'high')

  // 1. Initialize or Reset Simulation State
  const startMission = useCallback((missionId, mode = 'story_campaign', diff = selectedDifficulty) => {
    setSelectedMissionId(missionId)
    setCurrentGameMode(mode)

    const initialState = createInitialCitySimulationState({
      missionId,
      gameMode: mode,
      difficultyId: diff,
    })
    simStateRef.current = initialState

    // Check if tutorial should be shown for orientation mission
    if (missionId === 'm_01_orientation') {
      setShowTutorialOverlay(true)
      setTutorialStep(1)
    } else {
      setShowTutorialOverlay(false)
    }

    setViewState('playing')

    // Start procedural cinematic electronic-orchestral music & radio comms
    cityAudio.init()
    cityAudio.setVolumes({
      master: audioSettings.masterVolume,
      sfx: audioSettings.sfxVolume,
      music: audioSettings.musicVolume,
      comms: audioSettings.commsVolume ?? 0.85,
      muted: audioSettings.muted,
    })
    cityAudio.setMusicState('exploration')
  }, [selectedDifficulty, audioSettings])

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash.includes('mode=playing')) {
      startMission('m_01_orientation', 'story_campaign')
    }
  }, [startMission])

  // 2. Mouse Look & Pointer Lock Handlers
  const handleCanvasClick = useCallback(() => {
    if (viewState === 'playing' && canvasRef.current) {
      cityAudio.ensureContext()
      if (document.pointerLockElement !== canvasRef.current) {
        canvasRef.current.requestPointerLock?.()
      }
    }
  }, [viewState])

  useEffect(() => {
    const onPointerLockChange = () => {
      isPointerLockedRef.current = document.pointerLockElement === canvasRef.current
    }
    const onMouseMove = (e) => {
      if (!isPointerLockedRef.current) return
      const sensitivity = 0.0028 * (mouseSensitivityRef.current || 1.0)
      cameraRotRef.current.yaw -= e.movementX * sensitivity
      cameraRotRef.current.pitch = Math.max(-0.25, Math.min(0.85, cameraRotRef.current.pitch + e.movementY * sensitivity))

      if (showTutorialOverlay && tutorialStep === 2) {
        mouseLookDistanceRef.current += Math.abs(e.movementX) + Math.abs(e.movementY)
        if (mouseLookDistanceRef.current > 40) {
          setTutorialStep(3)
          mouseLookDistanceRef.current = 0
        }
      }
    }

    document.addEventListener('pointerlockchange', onPointerLockChange)
    document.addEventListener('mousemove', onMouseMove)
    return () => {
      document.removeEventListener('pointerlockchange', onPointerLockChange)
      document.removeEventListener('mousemove', onMouseMove)
    }
  }, [showTutorialOverlay, tutorialStep])

  // 3. Keyboard Input Handlers
  useEffect(() => {
    const onKeyDown = (e) => {
      if (viewState !== 'playing' && e.code !== 'Escape') return

      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          inputRef.current.forward = true
          if (showTutorialOverlay && tutorialStep === 1) setTutorialStep(2)
          break
        case 'KeyS':
        case 'ArrowDown':
          inputRef.current.backward = true
          if (showTutorialOverlay && tutorialStep === 1) setTutorialStep(2)
          break
        case 'KeyA':
        case 'ArrowLeft':
          inputRef.current.left = true
          if (showTutorialOverlay && tutorialStep === 1) setTutorialStep(2)
          break
        case 'KeyD':
        case 'ArrowRight':
          inputRef.current.right = true
          if (showTutorialOverlay && tutorialStep === 1) setTutorialStep(2)
          break
        case 'ShiftLeft':
        case 'ShiftRight':
          inputRef.current.sprint = true
          break
        case 'Space':
          inputRef.current.jump = true
          if (showTutorialOverlay && tutorialStep === 3) setTutorialStep(4)
          if (showTutorialOverlay && tutorialStep === 9) setTutorialStep(10)
          break
        case 'KeyQ':
          // Network Pulse Gadget
          inputRef.current.activatePulse = true
          if (simStateRef.current) {
            cityAudio.playNetworkPulse()
          }
          if (showTutorialOverlay && tutorialStep === 6) setTutorialStep(7)
          break
        case 'KeyE':
          // Recovery Beacon
          inputRef.current.activateBeacon = true
          if (simStateRef.current) {
            cityAudio.playRecoveryChime()
          }
          if (showTutorialOverlay && tutorialStep === 7) setTutorialStep(8)
          break
        // Weapon Switching (Keys 1-9)
        case 'Digit1':
          if (simStateRef.current) switchPlayerWeapon(simStateRef.current.equipment, 'cyber_assault_rifle', progression.playerLevel || 1)
          break
        case 'Digit2':
          if (simStateRef.current) switchPlayerWeapon(simStateRef.current.equipment, 'energy_pistol', progression.playerLevel || 1)
          break
        case 'Digit3':
          if (simStateRef.current) switchPlayerWeapon(simStateRef.current.equipment, 'burst_rifle', progression.playerLevel || 1)
          break
        case 'Digit4':
          if (simStateRef.current) switchPlayerWeapon(simStateRef.current.equipment, 'tactical_shotgun', progression.playerLevel || 1)
          break
        case 'Digit5':
          if (simStateRef.current) switchPlayerWeapon(simStateRef.current.equipment, 'precision_rifle', progression.playerLevel || 1)
          break
        case 'Digit6':
          if (simStateRef.current) switchPlayerWeapon(simStateRef.current.equipment, 'heavy_energy_rifle', progression.playerLevel || 1)
          break
        case 'Digit7':
          if (simStateRef.current) switchPlayerWeapon(simStateRef.current.equipment, 'plasma_cannon', progression.playerLevel || 1)
          break
        case 'Digit8':
          if (simStateRef.current) switchPlayerWeapon(simStateRef.current.equipment, 'long_range_sniper', progression.playerLevel || 1)
          break
        case 'Digit9':
          if (simStateRef.current) switchPlayerWeapon(simStateRef.current.equipment, 'quantum_blaster', progression.playerLevel || 1)
          break
        // Squad Commands
        case 'F1':
          e.preventDefault()
          if (simStateRef.current) simStateRef.current.squadCommand = SQUAD_COMMANDS.FOLLOW
          if (showTutorialOverlay && tutorialStep === 8) setTutorialStep(9)
          break
        case 'F2':
          e.preventDefault()
          if (simStateRef.current) simStateRef.current.squadCommand = SQUAD_COMMANDS.DEFEND
          if (showTutorialOverlay && tutorialStep === 8) setTutorialStep(9)
          break
        case 'F3':
          e.preventDefault()
          if (simStateRef.current) simStateRef.current.squadCommand = SQUAD_COMMANDS.ADVANCE
          if (showTutorialOverlay && tutorialStep === 8) setTutorialStep(9)
          break
        case 'F4':
          e.preventDefault()
          if (simStateRef.current) simStateRef.current.squadCommand = SQUAD_COMMANDS.FALL_BACK
          if (showTutorialOverlay && tutorialStep === 8) setTutorialStep(9)
          break
        case 'F5':
        case 'KeyC':
          e.preventDefault()
          if (simStateRef.current) simStateRef.current.squadCommand = SQUAD_COMMANDS.TAKE_COVER
          break
        case 'KeyR':
          // Reload & Heat Vent
          if (simStateRef.current) {
            startReload(simStateRef.current.equipment, performance.now())
            simStateRef.current.equipment.currentHeat = 0
            simStateRef.current.equipment.isOverheated = false
            cityAudio.playReload()
          }
          break
        case 'KeyH':
          setIsHudVisible((prev) => !prev)
          break
        case 'KeyM':
          // Quick Mute Toggle
          toggleMuteAudio()
          break
        case 'Escape':
          setViewState((prev) => (prev === 'playing' ? 'paused' : prev === 'paused' ? 'playing' : prev))
          break
        default:
          break
      }
    }

    const onKeyUp = (e) => {
      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          inputRef.current.forward = false
          break
        case 'KeyS':
        case 'ArrowDown':
          inputRef.current.backward = false
          break
        case 'KeyA':
        case 'ArrowLeft':
          inputRef.current.left = false
          break
        case 'KeyD':
        case 'ArrowRight':
          inputRef.current.right = false
          break
        case 'ShiftLeft':
        case 'ShiftRight':
          inputRef.current.sprint = false
          break
        case 'Space':
          inputRef.current.jump = false
          break
        case 'KeyQ':
          inputRef.current.activatePulse = false
          break
        case 'KeyE':
          inputRef.current.activateBeacon = false
          break
        default:
          break
      }
    }

    const onMouseDown = (e) => {
      if (viewState !== 'playing') return
      cityAudio.ensureContext()
      if (e.button === 0) {
        // Left Click: Threat Blaster Shoot
        inputRef.current.shoot = true
        cityAudio.playLaserFire(false)
        if (showTutorialOverlay && tutorialStep === 4) setTutorialStep(5)
      } else if (e.button === 2) {
        // Right Click: Firewall Shield Block
        inputRef.current.block = true
        cityAudio.playShieldDeflect()
        if (showTutorialOverlay && tutorialStep === 5) setTutorialStep(6)
      }
    }

    const onMouseUp = (e) => {
      if (e.button === 0) inputRef.current.shoot = false
      if (e.button === 2) inputRef.current.block = false
    }

    const onContextMenu = (e) => {
      if (viewState === 'playing') e.preventDefault()
    }

    const onWheel = (e) => {
      if (viewState !== 'playing' || !simStateRef.current) return
      const pLevel = progression.playerLevel || 1
      const available = WEAPON_SLOTS.filter((s) => pLevel >= s.reqLv)
      if (available.length <= 1) return
      const currentId = simStateRef.current.equipment.selectedWeaponId
      const currentIndex = available.findIndex((s) => s.id === currentId || (s.id === 'cyber_assault_rifle' && currentId === 'threat_blaster'))
      let nextIndex = 0
      if (e.deltaY > 0) {
        nextIndex = (currentIndex + 1) % available.length
      } else {
        nextIndex = (currentIndex - 1 + available.length) % available.length
      }
      const targetSlot = available[nextIndex]
      if (targetSlot) {
        switchPlayerWeapon(simStateRef.current.equipment, targetSlot.id, pLevel)
        cityAudio.ensureContext()
        cityAudio.playReload()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mouseup', onMouseUp)
    window.addEventListener('contextmenu', onContextMenu)
    window.addEventListener('wheel', onWheel, { passive: true })

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mouseup', onMouseUp)
      window.removeEventListener('contextmenu', onContextMenu)
      window.removeEventListener('wheel', onWheel)
    }
  }, [viewState, showTutorialOverlay, tutorialStep, progression.playerLevel])

  // 4. Initialize Three.js Renderer on Mount
  useEffect(() => {
    if (!canvasRef.current) return

    const renderer = new DigitalCityWorldRenderer(canvasRef.current, {
      graphicsQuality,
    })
    rendererRef.current = renderer

    const handleResize = () => {
      if (canvasRef.current && rendererRef.current) {
        rendererRef.current.handleResize(canvasRef.current.clientWidth, canvasRef.current.clientHeight)
      }
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
      renderer.dispose()
      cityAudio.stopAmbientMusic()
    }
  }, [graphicsQuality])

  // 5. High-Performance 60 FPS Game Loop
  useEffect(() => {
    let lastTime = performance.now()
    let hudThrottleTimer = 0

    const gameLoop = (currentTime) => {
      const dt = Math.min(0.05, (currentTime - lastTime) / 1000)
      lastTime = currentTime

      if (viewState === 'playing' && simStateRef.current && rendererRef.current) {
        const sim = simStateRef.current
        const renderer = rendererRef.current

        // Pass camera orientation to simulation for camera-relative forward movement
        sim.cameraRotation = { ...cameraRotRef.current }

        // Execute physics and simulation step
        const nextSim = stepDigitalCitySimulation(
          sim,
          inputRef.current,
          renderer.collisionBoxes,
          dt,
          currentTime
        )
        simStateRef.current = nextSim

        // Dispatch simulation audio events and radio chatter
        const nowMs = performance.now()
        if (nextSim.audioEvents && nextSim.audioEvents.length > 0) {
          nextSim.audioEvents.forEach((evt) => {
            switch (evt.type) {
              case 'footstep':
                cityAudio.playFootstep(evt.isSprinting)
                break
              case 'jump':
                cityAudio.playJump()
                break
              case 'land':
                cityAudio.playLand()
                break
              case 'player_fire':
                cityAudio.playEnergyRifle()
                break
              case 'plasma_fire':
                cityAudio.playEnemyPlasma()
                break
              case 'guard_fire':
                cityAudio.playEnergyRifle()
                break
              case 'shield_activate':
                cityAudio.playShieldActivate()
                break
              case 'shield_deflect':
                cityAudio.playShieldDeflect()
                break
              case 'armor_impact':
                cityAudio.playArmorImpact()
                break
              case 'player_hurt':
                cityAudio.playPlayerHurt()
                damageFlashRef.current = 0.35
                break
              case 'hit_marker':
                cityAudio.playHitMarker()
                hitMarkerTimerRef.current = 0.16
                break
              case 'enemy_hurt':
                cityAudio.playEnemyHurt()
                break
              case 'enemy_defeat':
                cityAudio.playEnemyDefeat(evt.isBoss)
                break
              case 'projectile_impact':
                cityAudio.playBulletImpact()
                break
              case 'alarm':
                cityAudio.playAlarm()
                break
              case 'network_pulse':
                cityAudio.playNetworkPulse()
                break
              case 'recovery_beacon':
                cityAudio.playRecoveryChime()
                break
              case 'radio_command':
                if (nowMs - lastRadioTimeRef.current > 2500) {
                  lastRadioTimeRef.current = nowMs
                  cityAudio.playRadioVoiceTransmission('guard')
                  const cmdKey = evt.command === SQUAD_COMMANDS.DEFEND ? 'squad_defend' :
                                 evt.command === SQUAD_COMMANDS.ATTACK_TARGET ? 'squad_attack' :
                                 evt.command === SQUAD_COMMANDS.REGROUP ? 'squad_regroup' : 'squad_follow'
                  setRadioBanner({
                    speaker: '📻 [SQUAD RADIO: Alpha-1]',
                    text: t(`digital_city.radio.${cmdKey}`),
                    timer: 3.5,
                  })
                }
                break
              case 'radio_enemy_spotted':
                if (nowMs - lastRadioTimeRef.current > 2500) {
                  lastRadioTimeRef.current = nowMs
                  cityAudio.playEnemyAlert()
                  cityAudio.playRadioVoiceTransmission('guard')
                  setRadioBanner({
                    speaker: '📻 [RECON RADIO: Scout-1]',
                    text: t('digital_city.radio.enemy_spotted'),
                    timer: 3.5,
                  })
                }
                break
              case 'radio_enemy_defeated':
                if (nowMs - lastRadioTimeRef.current > 2500) {
                  lastRadioTimeRef.current = nowMs
                  cityAudio.playRadioVoiceTransmission('guard')
                  setRadioBanner({
                    speaker: '📻 [SQUAD RADIO: Bravo-2]',
                    text: t('digital_city.radio.enemy_defeated'),
                    timer: 3.0,
                  })
                }
                break
              case 'radio_core_attacked':
                if (nowMs - lastRadioTimeRef.current > 3000) {
                  lastRadioTimeRef.current = nowMs
                  cityAudio.playObjectiveWarning()
                  cityAudio.playRadioVoiceTransmission('hq')
                  setRadioBanner({
                    speaker: '🚨 [HQ COMM: Central Command]',
                    text: t('digital_city.radio.core_attacked'),
                    timer: 4.0,
                  })
                }
                break
              case 'radio_under_fire':
                if (nowMs - lastRadioTimeRef.current > 2500) {
                  lastRadioTimeRef.current = nowMs
                  cityAudio.playRadioVoiceTransmission('guard')
                  setRadioBanner({
                    speaker: '⚠️ [SQUAD RADIO: Alpha-1]',
                    text: t('digital_city.radio.under_fire'),
                    timer: 3.0,
                  })
                }
                break
              default:
                break
            }
          })
        }

        // Tick down visual transient feedback timers
        hitMarkerTimerRef.current = Math.max(0, hitMarkerTimerRef.current - dt)
        damageFlashRef.current = Math.max(0, damageFlashRef.current - dt)

        // Decrement radio transmission banner
        setRadioBanner((prev) => {
          if (!prev) return null
          const nextTimer = prev.timer - dt
          if (nextTimer <= 0) return null
          return { ...prev, timer: nextTimer }
        })

        // Tutorial step 10 completion gating (neutralize hostile intruder)
        if (showTutorialOverlay && tutorialStep === 10 && nextSim.objectiveProgress.enemiesDefeated > 0) {
          setShowTutorialOverlay(false)
        }

        // Sync 3D meshes with simulation
        renderer.syncCharacters(nextSim.player, nextSim.friendlyGuards, nextSim.enemies)
        renderer.syncDrones(nextSim.drones)
        renderer.syncBeacons(nextSim.activeBeacons)
        renderer.syncShockwaves(nextSim.activeShockwaves)
        if (renderer.syncProjectiles) {
          renderer.syncProjectiles(nextSim.projectiles)
        }

        // Update 3D objective waypoint pillar over target district landmark
        const activeDistrict = nextSim.districts?.find((d) => d.id === nextSim.mission?.districtId)
        const targetObj = activeDistrict?.infrastructure?.[0] || { x: 0, z: -120, name: 'CENTRAL GOVERNMENT CITADEL' }
        if (renderer.updateObjectiveBeacon) {
          renderer.updateObjectiveBeacon(targetObj.x, targetObj.z, `DEFEND: ${targetObj.name || 'TARGET'}`, true)
        }

        renderer.updateCamera(nextSim.player, cameraRotRef.current)
        renderer.render()

        // Dynamic Music Intensity & Game State triggers
        if (nextSim.status === 'victory' && viewState !== 'victory') {
          setViewState('victory')
          cityAudio.playVictoryFanfare()
          setProgression(loadDigitalCityProgression())
        } else if (nextSim.status === 'defeat' && viewState !== 'defeat') {
          setViewState('defeat')
          cityAudio.playDefeatLament()
        } else if (nextSim.status === 'playing') {
          const hasActiveBoss = (nextSim.enemies || []).some((e) => e && e.isBoss && e.health > 0)
          const inCombat = (nextSim.enemies || []).some(
            (e) => e && e.health > 0 && (e.state === 'CHASE' || e.state === 'ATTACK')
          )
          if (hasActiveBoss) {
            cityAudio.setMusicState('boss')
          } else if (inCombat) {
            cityAudio.setMusicState('combat')
          } else {
            cityAudio.setMusicState('exploration')
          }

          // Trigger urgent danger siren when player health is critically low (<25%)
          if (nextSim.player && nextSim.player.health > 0 && nextSim.player.health <= (nextSim.player.maxHealth * 0.25)) {
            cityAudio.playDangerSiren()
          }
        }

        // Throttle React HUD updates to 10 FPS
        hudThrottleTimer += dt
        if (hudThrottleTimer >= 0.1) {
          hudThrottleTimer = 0
          const dist = getDistrictByCoordinates(nextSim.player.x, nextSim.player.z)
          let nearestHostile = null
          let minHostileDist = 9999
          const livingHostiles = (nextSim.enemies || []).filter((e) => e && e.health > 0)
          for (const en of livingHostiles) {
            const d = Math.hypot(en.x - nextSim.player.x, en.z - nextSim.player.z)
            if (d < minHostileDist) {
              minHostileDist = d
              nearestHostile = en
            }
          }
          setHudState({
            health: nextSim.player.health,
            maxHealth: nextSim.player.maxHealth,
            shield: nextSim.player.shield,
            maxShield: nextSim.player.maxShield,
            energy: nextSim.equipment.currentEnergy,
            maxEnergy: nextSim.equipment.maxEnergy,
            heat: nextSim.equipment.currentHeat,
            isOverheated: nextSim.equipment.isOverheated,
            selectedWeaponId: nextSim.equipment.selectedWeaponId,
            selectedGadgetId: nextSim.equipment.selectedGadgetId,
            currentAmmo: nextSim.equipment.ammo?.[nextSim.equipment.selectedWeaponId] ?? 30,
            magazineCapacity: EQUIPMENT_REGISTRY[nextSim.equipment.selectedWeaponId]?.magazineCapacity || 30,
            isReloading: !!nextSim.equipment.isReloading,
            reloadProgress: nextSim.equipment.reloadTotalTime > 0 ? (1 - nextSim.equipment.reloadTimer / nextSim.equipment.reloadTotalTime) : 0,
            unlockedEquipment: nextSim.equipment.unlockedEquipment || [],
            playerLevel: progression.playerLevel || 1,
            currentXp: progression.currentXp || 0,
            xpToNextLevel: progression.xpToNextLevel || 1000,
            nextUnlock: getNextWeaponUnlock(progression.playerLevel || 1),
            currentDistrictName: dist ? t(dist.nameKey) || dist.defaultName : 'Digital City',
            districtColor: dist ? dist.color : '#00bbff',
            objectiveText: nextSim.mission.primaryObjective,
            objectiveProgress: `${nextSim.objectiveProgress.enemiesDefeated} / ${nextSim.objectiveProgress.targetEnemies}`,
            infrastructureHealth: nextSim.objectiveProgress.infrastructureHealth != null ? nextSim.objectiveProgress.infrastructureHealth : 100,
            score: nextSim.score,
            credits: progression.defenseCredits,
            squadCommand: nextSim.squadCommand,
            survivalWave: nextSim.survivalWave || 1,
            totalWaves: nextSim.mission?.totalWaves || 3,
            isBossMission: Boolean(nextSim.mission?.isBossMission),
            gameMode: nextSim.gameMode || 'story_campaign',
            isShieldActive: nextSim.player.isShieldActive,
            hitMarkerTick: hitMarkerTimerRef.current > 0,
            damageFlash: damageFlashRef.current,
            compassAngle: (((-(cameraRotRef.current.yaw * 180) / Math.PI) % 360) + 360) % 360,
            nearestHostileDist: nearestHostile ? Math.round(minHostileDist) : null,
            livingHostilesCount: livingHostiles.length,
          })
        }
      }

      animFrameRef.current = requestAnimationFrame(gameLoop)
    }

    animFrameRef.current = requestAnimationFrame(gameLoop)
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    }
  }, [viewState, progression.defenseCredits, t, showTutorialOverlay, tutorialStep])

  // Audio volume change handler
  const handleVolumeChange = (type, val) => {
    const updated = { ...audioSettings, [type]: parseFloat(val) }
    setAudioSettings(updated)
    cityAudio.setVolumes({
      master: updated.masterVolume,
      sfx: updated.sfxVolume,
      music: updated.musicVolume,
      comms: updated.commsVolume ?? 0.85,
      muted: updated.muted,
    })
    const saved = saveDigitalCityProgression({ ...progression, audioSettings: updated })
    setProgression(saved)
  }

  // Quick mute toggle handler
  const toggleMuteAudio = () => {
    cityAudio.ensureContext()
    const nextMuted = !audioSettings.muted
    const updated = { ...audioSettings, muted: nextMuted }
    setAudioSettings(updated)
    cityAudio.setVolumes({
      master: updated.masterVolume,
      sfx: updated.sfxVolume,
      music: updated.musicVolume,
      comms: updated.commsVolume ?? 0.85,
      muted: nextMuted,
    })
    const saved = saveDigitalCityProgression({ ...progression, audioSettings: updated })
    setProgression(saved)
  }

  // Audio preview / test output
  const testAudioOutput = () => {
    cityAudio.ensureContext()
    cityAudio.playEnergyRifle()
    setTimeout(() => {
      cityAudio.playShieldDeflect()
    }, 160)
  }

  const currentMission = useMemo(() => {
    return STORY_MISSIONS.find((m) => m.id === selectedMissionId) || STORY_MISSIONS[0]
  }, [selectedMissionId])

  return (
    <div
      ref={containerRef}
      className="cyber-game-wrapper digital-city-container"
      style={{
        position: isFullscreen ? 'fixed' : 'relative',
        inset: isFullscreen ? 0 : undefined,
        zIndex: isFullscreen ? 9999 : undefined,
        width: isFullscreen ? '100vw' : '100%',
        height: isFullscreen ? '100vh' : 'calc(100vh - 70px)',
        minHeight: isFullscreen ? '100vh' : '620px',
        backgroundColor: '#060913',
        overflow: 'hidden',
        fontFamily: '"Noto Sans Ethiopic", "Noto Sans", system-ui, -apple-system, sans-serif',
        userSelect: 'none',
      }}
    >
      {/* 3D WebGL Canvas */}
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          cursor: viewState === 'playing' ? 'crosshair' : 'default',
        }}
      />

      {/* ==================================================================== */}
      {/* MAIN START MENU                                                      */}
      {/* ==================================================================== */}
      {viewState === 'menu' && (
        <div
          className="digital-city-menu-overlay start-modal-card"
          style={{
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(circle at center, rgba(6,9,19,0.85) 0%, rgba(6,9,19,0.98) 100%)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 30,
            padding: '2rem',
          }}
        >
          {/* Cyberpunk Title Logo */}
          <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '8px' }}>
              <span style={{ fontSize: '2.5rem' }}>🏙️</span>
              <span style={{ fontSize: '1.2rem', letterSpacing: '4px', color: '#00bbff', fontWeight: 800 }}>ABBAY CYBERGUARD</span>
              <span style={{ fontSize: '2.5rem' }}>⚔️</span>
            </div>
            <h1
              style={{
                fontSize: '3.2rem',
                margin: 0,
                fontWeight: 900,
                letterSpacing: '2px',
                color: '#38bdf8',
                background: 'linear-gradient(135deg, #38bdf8 0%, #00bbff 50%, #a855f7 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                textShadow: '0 0 35px rgba(0, 187, 255, 0.4)',
              }}
            >
              {t('digital_city.title')}
            </h1>
            <p style={{ color: '#94a3b8', fontSize: '1.1rem', marginTop: '0.5rem', maxWidth: '600px' }}>
              {t('digital_city.subtitle')}
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '10px' }}>
              <span className="badge" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid #38bdf8' }}>
                Player Level: {progression.playerLevel}
              </span>
              <span className="badge" style={{ background: 'rgba(250, 204, 21, 0.15)', color: '#facc15', border: '1px solid #facc15' }}>
                Credits: {progression.defenseCredits} ETB
              </span>
              <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid #10b981' }}>
                100% Offline Capable
              </span>
            </div>
          </div>

          {/* Menu Buttons Grid */}
          <div className="start-actions" style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', maxWidth: '380px' }}>
            <button
              type="button"
              className="btn primary btn-start-simulation"
              onClick={() => startMission('m_01_orientation', 'story_campaign')}
              style={{ padding: '0.85rem 1.5rem', fontSize: '1.1rem', fontWeight: 700 }}
            >
              🚀 {t('digital_city.menu.new_campaign')}
            </button>

            {progression.missionsCompleted.length > 0 && (
              <button
                type="button"
                className="btn ghost"
                onClick={() => {
                  const nextIdx = Math.min(STORY_MISSIONS.length - 1, progression.missionsCompleted.length)
                  startMission(STORY_MISSIONS[nextIdx].id, 'story_campaign')
                }}
                style={{ padding: '0.85rem 1.5rem', fontSize: '1.05rem', borderColor: '#38bdf8', color: '#38bdf8' }}
              >
                ▶️ {t('digital_city.menu.continue')}
              </button>
            )}

            <button
              type="button"
              className="btn ghost"
              onClick={() => setViewState('mission_select')}
              style={{ padding: '0.75rem 1.5rem' }}
            >
              🗺️ {t('digital_city.menu.mission_select')}
            </button>

            <button
              type="button"
              className="btn ghost"
              onClick={() => startMission('m_01_orientation', 'survival_endless')}
              style={{ padding: '0.75rem 1.5rem', color: '#f97316', borderColor: 'rgba(249, 115, 22, 0.4)' }}
            >
              🔥 {t('digital_city.menu.survival_mode')}
            </button>

            <button
              type="button"
              className="btn ghost"
              onClick={() => startMission('m_14_citywide_siege', 'city_defense')}
              style={{ padding: '0.75rem 1.5rem', color: '#10b981', borderColor: 'rgba(16, 185, 129, 0.4)' }}
            >
              🛡️ {t('digital_city.menu.city_defense')}
            </button>

            <button
              type="button"
              className="btn ghost"
              onClick={() => setViewState('settings')}
              style={{ padding: '0.75rem 1.5rem' }}
            >
              ⚙️ {t('digital_city.menu.settings')}
            </button>

            <button
              type="button"
              className="btn ghost"
              onClick={() => (onNavigate ? onNavigate('#/home') : (window.location.hash = '#/'))}
              style={{ padding: '0.75rem 1.5rem', color: '#94a3b8', borderColor: '#334155', marginTop: '8px' }}
            >
              ← {t('digital_city.menu.return_cybershield')}
            </button>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MISSION SELECTOR MODAL                                               */}
      {/* ==================================================================== */}
      {viewState === 'mission_select' && (
        <div
          className="digital-city-modal-overlay"
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(6,9,19,0.95)',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 35,
            padding: '2rem',
            overflowY: 'auto',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', maxWidth: '1100px', margin: '0 auto 1.5rem', width: '100%' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.8rem', color: '#38bdf8' }}>🗺️ {t('digital_city.menu.mission_select')}</h2>
              <p style={{ margin: '4px 0 0', color: '#94a3b8' }}>15 Progressive Story Operations Across the 10 Districts</p>
            </div>
            <button type="button" className="btn ghost" onClick={() => setViewState('menu')}>
              ✕ Back to Menu
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem', maxWidth: '1100px', margin: '0 auto', width: '100%' }}>
            {STORY_MISSIONS.map((m, index) => {
              const isCompleted = progression.missionsCompleted.includes(m.id)
              const isUnlocked = index === 0 || progression.missionsCompleted.includes(STORY_MISSIONS[index - 1].id)
              const dist = DISTRICTS.find((d) => d.id === m.districtId)

              return (
                <div
                  key={m.id}
                  className="card"
                  style={{
                    padding: '1.25rem',
                    background: isUnlocked ? 'rgba(15, 23, 42, 0.85)' : 'rgba(15, 23, 42, 0.4)',
                    border: `1px solid ${isCompleted ? '#10b981' : isUnlocked ? '#38bdf8' : '#334155'}`,
                    borderRadius: '8px',
                    opacity: isUnlocked ? 1 : 0.6,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span className="badge" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>
                        Operation #{m.order}
                      </span>
                      {dist && (
                        <span style={{ fontSize: '0.85rem', color: dist.color, fontWeight: 600 }}>
                          {dist.icon} {t(dist.nameKey) || dist.defaultName}
                        </span>
                      )}
                    </div>
                    <h3 style={{ margin: '0 0 6px', fontSize: '1.15rem' }}>{t(m.titleKey) || m.defaultTitle}</h3>
                    <p style={{ margin: '0 0 10px', fontSize: '0.85rem', color: '#94a3b8' }}>
                      {t(m.subtitleKey) || m.defaultSubtitle}
                    </p>
                    <div style={{ fontSize: '0.8rem', color: '#facc15', marginBottom: '12px' }}>
                      🏆 Rewards: +{m.xpReward} XP | +{m.creditReward} ETB
                    </div>
                  </div>

                  <div>
                    {isUnlocked ? (
                      <button
                        type="button"
                        className={`btn ${isCompleted ? 'ghost' : 'primary'}`}
                        style={{ width: '100%' }}
                        onClick={() => startMission(m.id, 'story_campaign')}
                      >
                        {isCompleted ? '✓ Replay Operation' : '▶️ Deploy to District'}
                      </button>
                    ) : (
                      <button type="button" className="btn ghost" disabled style={{ width: '100%', opacity: 0.5 }}>
                        🔒 Locked (Complete Operation #{index})
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* SETTINGS MODAL                                                       */}
      {/* ==================================================================== */}
      {viewState === 'settings' && (
        <div
          className="digital-city-modal-overlay"
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(6,9,19,0.95)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 35,
            padding: '2rem',
          }}
        >
          <div className="card" style={{ width: '100%', maxWidth: '480px', padding: '1.75rem', background: '#0f172a', border: '1px solid #38bdf8' }}>
            <h2 style={{ marginTop: 0, color: '#38bdf8' }}>⚙️ {t('digital_city.menu.settings')}</h2>

            {/* Tactical Combat Difficulty Selector */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px', fontSize: '0.9rem', color: '#cbd5e1' }}>
                {t('digital_city.settings.difficulty') || 'Tactical Combat Difficulty'}
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                {['beginner', 'normal', 'advanced'].map((diff) => (
                  <button
                    key={diff}
                    type="button"
                    className={`btn ${selectedDifficulty === diff ? 'primary' : 'ghost'}`}
                    onClick={() => {
                      setSelectedDifficulty(diff)
                      const saved = saveDigitalCityProgression({ ...progression, selectedDifficulty: diff })
                      setProgression(saved)
                      if (simStateRef.current) {
                        simStateRef.current.difficultyId = diff
                      }
                    }}
                    style={{ textTransform: 'capitalize', padding: '6px 8px', fontSize: '0.85rem' }}
                  >
                    {t(`digital_city.difficulty.${diff}`) || diff}
                  </button>
                ))}
              </div>
            </div>

            {/* Mouse Look Sensitivity */}
            <div style={{ marginBottom: '1.1rem' }}>
              <label style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.9rem' }}>
                <span>{t('digital_city.settings.sensitivity') || 'Mouse Look Sensitivity'}</span>
                <span style={{ color: '#38bdf8', fontWeight: 700 }}>{mouseSensitivity.toFixed(1)}x</span>
              </label>
              <input
                type="range"
                min="0.4"
                max="2.5"
                step="0.1"
                value={mouseSensitivity}
                onChange={(e) => {
                  const val = parseFloat(e.target.value)
                  setMouseSensitivity(val)
                  mouseSensitivityRef.current = val
                  const saved = saveDigitalCityProgression({ ...progression, mouseSensitivity: val })
                  setProgression(saved)
                }}
                style={{ width: '100%' }}
              />
            </div>

            {/* Graphics Quality */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px' }}>
                {t('digital_city.pause.graphics')}
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                {['low', 'medium', 'high', 'ultra'].map((q) => (
                  <button
                    key={q}
                    type="button"
                    className={`btn ${graphicsQuality === q ? 'primary' : 'ghost'}`}
                    onClick={() => {
                      setGraphicsQuality(q)
                      const saved = saveDigitalCityProgression({ ...progression, graphicsQuality: q })
                      setProgression(saved)
                    }}
                    style={{ textTransform: 'capitalize', padding: '6px 8px', fontSize: '0.85rem' }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>

            {/* Audio Sliders */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.9rem' }}>
                <span>{t('digital_city.pause.master_vol')}</span>
                <span>{(audioSettings.masterVolume * 100).toFixed(0)}%</span>
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={audioSettings.masterVolume}
                onChange={(e) => handleVolumeChange('masterVolume', e.target.value)}
                style={{ width: '100%' }}
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.9rem' }}>
                <span>{t('digital_city.pause.sfx_vol')}</span>
                <span>{(audioSettings.sfxVolume * 100).toFixed(0)}%</span>
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={audioSettings.sfxVolume}
                onChange={(e) => handleVolumeChange('sfxVolume', e.target.value)}
                style={{ width: '100%' }}
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.9rem' }}>
                <span>{t('digital_city.pause.music_vol')}</span>
                <span>{(audioSettings.musicVolume * 100).toFixed(0)}%</span>
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={audioSettings.musicVolume}
                onChange={(e) => handleVolumeChange('musicVolume', e.target.value)}
                style={{ width: '100%' }}
              />
            </div>

            {/* Tactical Radio Comms Volume */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.9rem' }}>
                <span>{t('digital_city.settings.comms_vol') || 'Radio Comms Volume'}</span>
                <span style={{ color: '#38bdf8' }}>{(((audioSettings.commsVolume ?? 0.85)) * 100).toFixed(0)}%</span>
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={audioSettings.commsVolume ?? 0.85}
                onChange={(e) => handleVolumeChange('commsVolume', e.target.value)}
                style={{ width: '100%' }}
              />
            </div>

            {/* Quick Audio Mute & Test Actions */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '1.25rem' }}>
              <button
                type="button"
                className={`btn ${audioSettings.muted ? 'danger' : 'ghost'}`}
                style={{ flex: 1, padding: '8px 12px', fontSize: '0.9rem' }}
                onClick={toggleMuteAudio}
              >
                {audioSettings.muted ? '🔇 ' + t('digital_city.pause.unmute') : '🔊 ' + t('digital_city.pause.mute')}
              </button>
              <button
                type="button"
                className="btn ghost"
                style={{ flex: 1, padding: '8px 12px', fontSize: '0.9rem' }}
                onClick={testAudioOutput}
              >
                🎵 {t('digital_city.pause.test_audio')}
              </button>
            </div>

            <button type="button" className="btn primary" style={{ width: '100%' }} onClick={() => setViewState('menu')}>
              Save & Return
            </button>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* IN-GAME COMBAT FEEDBACK & IMMERSIVE HUD                              */}
      {/* ==================================================================== */}
      {viewState === 'playing' && (
        <>
          {/* Full-screen Directional / Inset Damage Vignette */}
          {hudState.damageFlash > 0 && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                boxShadow: `inset 0 0 ${Math.round(40 + hudState.damageFlash * 90)}px rgba(239, 68, 68, ${Math.min(0.8, hudState.damageFlash * 2.2)})`,
                background: `radial-gradient(circle at center, transparent 60%, rgba(239, 68, 68, ${Math.min(0.35, hudState.damageFlash)}) 100%)`,
                zIndex: 11,
                transition: 'opacity 0.08s ease',
              }}
            />
          )}

          {/* Center Crosshair & Dynamic Hit Marker (Always Active for Aiming) */}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '32px',
              height: '32px',
              pointerEvents: 'none',
              zIndex: 12,
            }}
          >
            {/* Standard reticle */}
            <div style={{ position: 'absolute', top: '15px', left: '0', width: '32px', height: '2px', background: hudState.isShieldActive ? '#38bdf8' : 'rgba(255,255,255,0.7)' }} />
            <div style={{ position: 'absolute', top: '0', left: '15px', width: '2px', height: '32px', background: hudState.isShieldActive ? '#38bdf8' : 'rgba(255,255,255,0.7)' }} />

            {/* Dynamic Hit Marker X-Ticks */}
            {hudState.hitMarkerTick && (
              <div style={{ position: 'absolute', inset: 0 }}>
                <div style={{ position: 'absolute', top: '4px', left: '4px', width: '8px', height: '2px', background: '#38bdf8', transform: 'rotate(45deg)', boxShadow: '0 0 6px #00f0ff' }} />
                <div style={{ position: 'absolute', top: '4px', right: '4px', width: '8px', height: '2px', background: '#38bdf8', transform: 'rotate(-45deg)', boxShadow: '0 0 6px #00f0ff' }} />
                <div style={{ position: 'absolute', bottom: '4px', left: '4px', width: '8px', height: '2px', background: '#38bdf8', transform: 'rotate(-45deg)', boxShadow: '0 0 6px #00f0ff' }} />
                <div style={{ position: 'absolute', bottom: '4px', right: '4px', width: '8px', height: '2px', background: '#38bdf8', transform: 'rotate(45deg)', boxShadow: '0 0 6px #00f0ff' }} />
              </div>
            )}
          </div>

          {/* Critical Low Health Warning Banner (Always Active) */}
          {hudState.health < 40 && (
            <div
              style={{
                position: 'absolute',
                bottom: '80px',
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'rgba(239, 68, 68, 0.28)',
                border: '1px solid #ef4444',
                borderRadius: '20px',
                padding: '4px 16px',
                color: '#fca5a5',
                fontSize: '0.78rem',
                fontWeight: 800,
                letterSpacing: '1px',
                pointerEvents: 'none',
                zIndex: 14,
                boxShadow: '0 0 20px rgba(239, 68, 68, 0.65)',
              }}
            >
              ⚠️ CRITICAL HEALTH — TAKE COVER [C]
            </div>
          )}

          {/* Top Center Radio Transmission Pill */}
          {radioBanner && radioBanner.timer > 0 && (
            <div
              className="digital-city-radio-pill"
              style={{
                position: 'absolute',
                top: '18px',
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'rgba(15, 23, 42, 0.95)',
                border: '1px solid #38bdf8',
                boxShadow: '0 0 20px rgba(56, 189, 248, 0.4)',
                padding: '8px 18px',
                borderRadius: '24px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                zIndex: 22,
                pointerEvents: 'none',
                backdropFilter: 'blur(8px)',
              }}
            >
              <span style={{ fontSize: '1.25rem' }}>📻</span>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.72rem', color: '#38bdf8', fontWeight: 800, letterSpacing: '0.8px' }}>
                  {radioBanner.speaker}
                </span>
                <span style={{ fontSize: '0.88rem', color: '#f8fafc', fontWeight: 600 }}>
                  {radioBanner.text}
                </span>
              </div>
            </div>
          )}

          {/* Floating HUD Restore Button when HUD is Hidden */}
          {!isHudVisible && (
            <button
              type="button"
              className="btn ghost small"
              onClick={() => setIsHudVisible(true)}
              style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                pointerEvents: 'auto',
                zIndex: 30,
                background: 'rgba(10, 16, 31, 0.9)',
                color: '#38bdf8',
                border: '1px solid #38bdf8',
                backdropFilter: 'blur(8px)',
                padding: '5px 12px',
                fontSize: '0.75rem',
                fontWeight: 700,
                boxShadow: '0 0 15px rgba(56, 189, 248, 0.3)',
              }}
              title="Restore Combat HUD [H]"
            >
              👁️ {t('digital_city.hud.toggle_hud') || 'HUD [H]'}
            </button>
          )}

          {/* Full / Compact Combat HUD Overlay */}
          {isHudVisible && (() => {
            const waveDisplay = hudState.gameMode === 'endless_survival'
              ? `Wave ${hudState.survivalWave} (Endless)`
              : hudState.isBossMission
              ? `Phase ${hudState.survivalWave} of ${hudState.totalWaves || 3}`
              : `Wave ${hudState.survivalWave} of ${hudState.totalWaves || 3}`

            const nextUnlockDisplay = hudState.nextUnlock
              ? `Next: ${hudState.nextUnlock.defaultName} (Lv ${hudState.nextUnlock.unlockLevel || hudState.nextUnlock.requiredLevel})`
              : 'Max Arsenal'

            const weaponSlots = WEAPON_SLOTS

            const currentSlot = weaponSlots.find((s) => s.id === hudState.selectedWeaponId || (s.id === 'cyber_assault_rifle' && hudState.selectedWeaponId === 'threat_blaster')) || weaponSlots[0]

            return (
              <div
                className="digital-city-hud-layer"
                style={{
                  position: 'absolute',
                  inset: 0,
                  pointerEvents: 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  padding: hudMode === 'compact' ? '0.75rem 1rem' : '1.25rem',
                  zIndex: 10,
                }}
              >
                {/* Top Header Row: Vitality, Compass, Objective & Controls */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', width: '100%' }}>
                  {/* Top-Left: Player Vitality & Rank Card */}
                  <div
                    className="hud-panel"
                    style={{
                      background: 'rgba(10, 16, 31, 0.88)',
                      backdropFilter: 'blur(8px)',
                      padding: hudMode === 'compact' ? '0.5rem 0.85rem' : '0.85rem 1.15rem',
                      borderRadius: '8px',
                      border: '1px solid rgba(56, 189, 248, 0.35)',
                      minWidth: hudMode === 'compact' ? '210px' : '240px',
                      boxShadow: '0 4px 15px rgba(0, 0, 0, 0.4)',
                      pointerEvents: 'auto',
                    }}
                  >
                    {/* Shield Bar */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.5px' }}>
                      <span style={{ color: '#38bdf8' }}>🛡️ SHIELD / ARMOR</span>
                      <span style={{ color: '#38bdf8' }}>{Math.max(0, hudState.shield)} / {hudState.maxShield}</span>
                    </div>
                    <div style={{ height: '6px', background: '#1e293b', borderRadius: '3px', overflow: 'hidden', marginBottom: '6px', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
                      <div style={{ width: `${Math.min(100, Math.max(0, (hudState.shield / hudState.maxShield) * 100))}%`, height: '100%', background: 'linear-gradient(90deg, #0284c7 0%, #00f0ff 100%)', boxShadow: '0 0 8px rgba(0, 240, 255, 0.5)', transition: 'width 0.15s ease' }} />
                    </div>

                    {/* Health Bar */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.5px' }}>
                      <span style={{ color: hudState.health < 40 ? '#ef4444' : '#10b981' }}>❤️ HEALTH</span>
                      <span style={{ color: hudState.health < 40 ? '#ef4444' : '#10b981' }}>{Math.max(0, hudState.health)} / {hudState.maxHealth}</span>
                    </div>
                    <div style={{ height: '6px', background: '#1e293b', borderRadius: '3px', overflow: 'hidden', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                      <div style={{ width: `${Math.min(100, Math.max(0, (hudState.health / hudState.maxHealth) * 100))}%`, height: '100%', background: hudState.health < 40 ? 'linear-gradient(90deg, #b91c1c 0%, #ef4444 100%)' : 'linear-gradient(90deg, #059669 0%, #10b981 100%)', boxShadow: hudState.health < 40 ? '0 0 8px rgba(239, 68, 68, 0.6)' : '0 0 8px rgba(16, 185, 129, 0.5)', transition: 'width 0.15s ease' }} />
                    </div>

                    {/* Rank & XP Status */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '5px', fontSize: '0.7rem', color: '#94a3b8' }}>
                      <span style={{ color: '#38bdf8', fontWeight: 700 }}>
                        MILITARY RANK: LVL {hudState.playerLevel}
                      </span>
                      <span style={{ color: '#cbd5e1' }}>
                        XP: {hudState.currentXp} / {hudState.xpToNextLevel}
                      </span>
                    </div>
                  </div>

                  {/* Top-Center: Cybernetic Compass Ticker */}
                  <div
                    className="hud-compass-tape"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '2px',
                      background: 'rgba(10, 16, 31, 0.88)',
                      backdropFilter: 'blur(8px)',
                      border: '1px solid rgba(0, 240, 255, 0.35)',
                      borderRadius: '6px',
                      padding: '3px 12px',
                      boxShadow: '0 0 12px rgba(0, 240, 255, 0.2)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.78rem', fontFamily: 'monospace', fontWeight: 800 }}>
                      <span style={{ color: Math.abs(hudState.compassAngle - 0) < 22 || Math.abs(hudState.compassAngle - 360) < 22 ? '#00f0ff' : '#64748b' }}>N</span>
                      <span style={{ color: Math.abs(hudState.compassAngle - 45) < 22 ? '#00f0ff' : '#64748b' }}>NE</span>
                      <span style={{ color: Math.abs(hudState.compassAngle - 90) < 22 ? '#00f0ff' : '#64748b' }}>E</span>
                      <span style={{ color: Math.abs(hudState.compassAngle - 135) < 22 ? '#00f0ff' : '#64748b' }}>SE</span>
                      <span style={{ color: Math.abs(hudState.compassAngle - 180) < 22 ? '#00f0ff' : '#64748b' }}>S</span>
                      <span style={{ color: Math.abs(hudState.compassAngle - 225) < 22 ? '#00f0ff' : '#64748b' }}>SW</span>
                      <span style={{ color: Math.abs(hudState.compassAngle - 270) < 22 ? '#00f0ff' : '#64748b' }}>W</span>
                      <span style={{ color: Math.abs(hudState.compassAngle - 315) < 22 ? '#00f0ff' : '#64748b' }}>NW</span>
                      <span style={{ color: '#00f0ff', marginLeft: '4px', fontSize: '0.72rem' }}>{Math.round(hudState.compassAngle || 0)}°</span>
                    </div>
                    {hudState.nearestHostileDist !== null ? (
                      <div
                        style={{
                          marginTop: '3px',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          background: 'rgba(239, 68, 68, 0.25)',
                          border: '1px solid #ef4444',
                          color: '#f87171',
                          fontSize: '0.70rem',
                          fontWeight: 800,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px',
                          letterSpacing: '0.5px',
                        }}
                      >
                        <span>🚨</span>
                        <span>HOSTILE CONTACT: {hudState.nearestHostileDist}m ({hudState.livingHostilesCount} ACTIVE)</span>
                      </div>
                    ) : (
                      <div
                        style={{
                          marginTop: '3px',
                          fontSize: '0.68rem',
                          color: '#22c55e',
                          fontWeight: 700,
                          letterSpacing: '0.5px',
                        }}
                      >
                        ✓ SECTOR SECURED
                      </div>
                    )}
                  </div>

                  {/* Top-Right: Objective Card & Tactical Control Buttons */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                    {/* Objective Card */}
                    <div
                      className="hud-panel"
                      style={{
                        background: 'rgba(10, 16, 31, 0.88)',
                        backdropFilter: 'blur(8px)',
                        padding: '0.45rem 0.85rem',
                        borderRadius: '8px',
                        border: (showTutorialOverlay && tutorialStep === 9) ? '2px solid #facc15' : '1px solid rgba(250, 204, 21, 0.35)',
                        maxWidth: '440px',
                        minWidth: '280px',
                        boxShadow: (showTutorialOverlay && tutorialStep === 9) ? '0 0 16px rgba(250, 204, 21, 0.7)' : '0 4px 15px rgba(0, 0, 0, 0.4)',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.8px', color: '#facc15', fontWeight: 800 }}>
                        <span>🎯 {hudState.currentDistrictName}</span>
                        <span style={{ color: '#38bdf8', fontWeight: 700 }}>{waveDisplay}</span>
                      </div>
                      <div style={{ fontSize: '0.84rem', fontWeight: 600, color: '#f8fafc', margin: '2px 0 4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {hudState.objectiveText}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', color: '#94a3b8' }}>
                        <span>Intruders: <strong style={{ color: '#38bdf8' }}>{hudState.objectiveProgress}</strong></span>
                        <span>Infrastructure: <strong style={{ color: hudState.infrastructureHealth < 40 ? '#ef4444' : '#00f0ff' }}>{hudState.infrastructureHealth}%</strong></span>
                      </div>
                    </div>

                    {/* Quick Action Control Buttons */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', pointerEvents: 'auto', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className={`btn ghost small ${showIntelDrawer ? 'primary' : ''}`}
                        onClick={() => setShowIntelDrawer((prev) => !prev)}
                        title="Toggle Squad & Intel Drawer"
                        style={{
                          background: showIntelDrawer ? 'rgba(56, 189, 248, 0.25)' : 'rgba(10, 16, 31, 0.85)',
                          color: '#38bdf8',
                          border: '1px solid #38bdf8',
                          padding: '4px 10px',
                          fontSize: '0.74rem',
                          fontWeight: 700,
                        }}
                      >
                        📋 {showIntelDrawer ? (t('digital_city.hud.collapse_details') || 'Hide Intel') : (t('digital_city.hud.expand_details') || 'Intel')}
                      </button>

                      <button
                        type="button"
                        className="btn ghost small"
                        onClick={() => setHudMode((prev) => (prev === 'compact' ? 'standard' : 'compact'))}
                        title="Toggle Compact / Standard HUD"
                        style={{
                          background: 'rgba(10, 16, 31, 0.85)',
                          color: hudMode === 'compact' ? '#38bdf8' : '#facc15',
                          border: `1px solid ${hudMode === 'compact' ? '#38bdf8' : '#facc15'}`,
                          padding: '4px 10px',
                          fontSize: '0.74rem',
                          fontWeight: 700,
                        }}
                      >
                        {hudMode === 'compact' ? '🗜️ Compact' : '📐 Standard'}
                      </button>

                      <button
                        type="button"
                        className="btn ghost small"
                        onClick={() => setIsHudVisible((prev) => !prev)}
                        title="Toggle HUD (H)"
                        style={{
                          background: 'rgba(10, 16, 31, 0.85)',
                          color: '#94a3b8',
                          border: '1px solid #475569',
                          padding: '4px 8px',
                          fontSize: '0.74rem',
                        }}
                      >
                        👁️ HUD [H]
                      </button>

                      <button
                        type="button"
                        className="btn ghost small"
                        onClick={() => setShowTouchControls((prev) => !prev)}
                        title="Toggle On-Screen Touch Controls"
                        style={{
                          background: showTouchControls ? 'rgba(56, 189, 248, 0.25)' : 'rgba(10, 16, 31, 0.85)',
                          color: showTouchControls ? '#38bdf8' : '#94a3b8',
                          border: showTouchControls ? '1px solid #38bdf8' : '1px solid #475569',
                          padding: '4px 8px',
                          fontSize: '0.74rem',
                        }}
                      >
                        📱 {showTouchControls ? 'Touch: ON' : 'Touch: OFF'}
                      </button>

                      <button
                        type="button"
                        className="btn ghost small"
                        onClick={toggleFullscreen}
                        title="Toggle Browser Fullscreen"
                        style={{
                          background: 'rgba(10, 16, 31, 0.85)',
                          color: '#f8fafc',
                          border: '1px solid #475569',
                          padding: '4px 8px',
                          fontSize: '0.74rem',
                        }}
                      >
                        {isFullscreen ? '⛶ Exit' : '⛶ Fullscreen'}
                      </button>

                      <button
                        type="button"
                        className="btn ghost small"
                        onClick={() => setViewState('paused')}
                        style={{
                          background: 'rgba(10, 16, 31, 0.85)',
                          color: '#f8fafc',
                          border: '1px solid #475569',
                          padding: '4px 10px',
                          fontSize: '0.74rem',
                        }}
                      >
                        ⏸️ Pause [Esc]
                      </button>
                    </div>
                  </div>
                </div>

                {/* Collapsible Intel & Squad Drawer */}
                <div
                  className="hud-intel-drawer"
                  style={{
                    display: (showIntelDrawer || hudMode === 'standard') ? 'flex' : 'none',
                    flexDirection: 'column',
                    gap: '8px',
                    background: 'rgba(10, 16, 31, 0.94)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(56, 189, 248, 0.4)',
                    borderRadius: '8px',
                    padding: '0.75rem 1rem',
                    marginTop: '6px',
                    maxWidth: '560px',
                    pointerEvents: 'auto',
                    boxShadow: '0 8px 25px rgba(0, 0, 0, 0.5)',
                    zIndex: 15,
                  }}
                >
                  {/* Detailed District & Infrastructure */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: '#cbd5e1' }}>
                    <span style={{ color: hudState.districtColor, fontWeight: 700 }}>{hudState.currentDistrictName}</span>
                    <span>Infrastructure Integrity: <strong style={{ color: hudState.infrastructureHealth < 40 ? '#ef4444' : '#00f0ff' }}>{hudState.infrastructureHealth}%</strong></span>
                  </div>
                  <div style={{ height: '7px', background: '#1e293b', borderRadius: '4px', overflow: 'hidden', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
                    <div style={{ width: `${Math.min(100, Math.max(0, hudState.infrastructureHealth))}%`, height: '100%', background: hudState.infrastructureHealth < 40 ? '#ef4444' : 'linear-gradient(90deg, #0284c7 0%, #00f0ff 100%)', transition: 'width 0.2s ease' }} />
                  </div>

                  {/* Combat XP & Next Weapon Progression */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', color: '#94a3b8', gap: '8px' }}>
                    <span style={{ color: '#38bdf8', fontWeight: 700 }}>
                      MILITARY RANK: LVL {hudState.playerLevel}
                    </span>
                    <span style={{ color: '#cbd5e1' }}>
                      XP: {hudState.currentXp} / {hudState.xpToNextLevel}
                    </span>
                    <span style={{ color: '#a78bfa' }}>
                      {nextUnlockDisplay}
                    </span>
                  </div>

                  {/* Squad Commands [F1-F5 / C] */}
                  <div style={{ borderTop: '1px solid rgba(56, 189, 248, 0.2)', paddingTop: '6px' }}>
                    <div style={{ color: '#94a3b8', marginBottom: '5px', fontSize: '0.75rem', fontWeight: 700 }}>
                      {t('digital_city.hud.squad')} [F1-F5 / C]
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className={`badge ${hudState.squadCommand === SQUAD_COMMANDS.FOLLOW ? 'primary' : 'ghost'}`}
                        style={{
                          cursor: 'pointer',
                          border: hudState.squadCommand === SQUAD_COMMANDS.FOLLOW ? '1px solid #38bdf8' : '1px solid #334155',
                          background: hudState.squadCommand === SQUAD_COMMANDS.FOLLOW ? 'rgba(56, 189, 248, 0.25)' : 'rgba(15, 23, 42, 0.6)',
                          color: hudState.squadCommand === SQUAD_COMMANDS.FOLLOW ? '#38bdf8' : '#94a3b8',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontWeight: 600,
                          fontSize: '0.74rem',
                        }}
                        onClick={() => {
                          if (simStateRef.current) simStateRef.current.squadCommand = SQUAD_COMMANDS.FOLLOW
                          setHudState((prev) => ({ ...prev, squadCommand: SQUAD_COMMANDS.FOLLOW }))
                          if (showTutorialOverlay && tutorialStep === 8) setTutorialStep(9)
                        }}
                      >
                        F1: Follow
                      </button>
                      <button
                        type="button"
                        className={`badge ${hudState.squadCommand === SQUAD_COMMANDS.DEFEND ? 'primary' : 'ghost'}`}
                        style={{
                          cursor: 'pointer',
                          border: hudState.squadCommand === SQUAD_COMMANDS.DEFEND ? '1px solid #38bdf8' : '1px solid #334155',
                          background: hudState.squadCommand === SQUAD_COMMANDS.DEFEND ? 'rgba(56, 189, 248, 0.25)' : 'rgba(15, 23, 42, 0.6)',
                          color: hudState.squadCommand === SQUAD_COMMANDS.DEFEND ? '#38bdf8' : '#94a3b8',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontWeight: 600,
                          fontSize: '0.74rem',
                        }}
                        onClick={() => {
                          if (simStateRef.current) simStateRef.current.squadCommand = SQUAD_COMMANDS.DEFEND
                          setHudState((prev) => ({ ...prev, squadCommand: SQUAD_COMMANDS.DEFEND }))
                          if (showTutorialOverlay && tutorialStep === 8) setTutorialStep(9)
                        }}
                      >
                        F2: Defend
                      </button>
                      <button
                        type="button"
                        className={`badge ${hudState.squadCommand === SQUAD_COMMANDS.ADVANCE ? 'primary' : 'ghost'}`}
                        style={{
                          cursor: 'pointer',
                          border: hudState.squadCommand === SQUAD_COMMANDS.ADVANCE ? '1px solid #38bdf8' : '1px solid #334155',
                          background: hudState.squadCommand === SQUAD_COMMANDS.ADVANCE ? 'rgba(56, 189, 248, 0.25)' : 'rgba(15, 23, 42, 0.6)',
                          color: hudState.squadCommand === SQUAD_COMMANDS.ADVANCE ? '#38bdf8' : '#94a3b8',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontWeight: 600,
                          fontSize: '0.74rem',
                        }}
                        onClick={() => {
                          if (simStateRef.current) simStateRef.current.squadCommand = SQUAD_COMMANDS.ADVANCE
                          setHudState((prev) => ({ ...prev, squadCommand: SQUAD_COMMANDS.ADVANCE }))
                          if (showTutorialOverlay && tutorialStep === 8) setTutorialStep(9)
                        }}
                      >
                        F3: Advance
                      </button>
                      <button
                        type="button"
                        className={`badge ${hudState.squadCommand === SQUAD_COMMANDS.FALL_BACK ? 'primary' : 'ghost'}`}
                        style={{
                          cursor: 'pointer',
                          border: hudState.squadCommand === SQUAD_COMMANDS.FALL_BACK ? '1px solid #facc15' : '1px solid #334155',
                          background: hudState.squadCommand === SQUAD_COMMANDS.FALL_BACK ? 'rgba(250, 204, 21, 0.25)' : 'rgba(15, 23, 42, 0.6)',
                          color: hudState.squadCommand === SQUAD_COMMANDS.FALL_BACK ? '#facc15' : '#94a3b8',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontWeight: 600,
                          fontSize: '0.74rem',
                        }}
                        onClick={() => {
                          if (simStateRef.current) simStateRef.current.squadCommand = SQUAD_COMMANDS.FALL_BACK
                          setHudState((prev) => ({ ...prev, squadCommand: SQUAD_COMMANDS.FALL_BACK }))
                          if (showTutorialOverlay && tutorialStep === 8) setTutorialStep(9)
                        }}
                      >
                        F4: Fall Back
                      </button>
                      <button
                        type="button"
                        className={`badge ${hudState.squadCommand === SQUAD_COMMANDS.TAKE_COVER ? 'primary' : 'ghost'}`}
                        style={{
                          cursor: 'pointer',
                          border: hudState.squadCommand === SQUAD_COMMANDS.TAKE_COVER ? '1px solid #10b981' : '1px solid #334155',
                          background: hudState.squadCommand === SQUAD_COMMANDS.TAKE_COVER ? 'rgba(16, 185, 129, 0.25)' : 'rgba(15, 23, 42, 0.6)',
                          color: hudState.squadCommand === SQUAD_COMMANDS.TAKE_COVER ? '#34d399' : '#94a3b8',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontWeight: 600,
                          fontSize: '0.74rem',
                        }}
                        onClick={() => {
                          if (simStateRef.current) simStateRef.current.squadCommand = SQUAD_COMMANDS.TAKE_COVER
                          setHudState((prev) => ({ ...prev, squadCommand: SQUAD_COMMANDS.TAKE_COVER }))
                        }}
                      >
                        F5/C: Cover
                      </button>
                    </div>
                  </div>

                  {/* Weapon Progression Slots */}
                  <div style={{ borderTop: '1px solid rgba(56, 189, 248, 0.2)', paddingTop: '6px' }}>
                    <div style={{ color: '#94a3b8', marginBottom: '5px', fontSize: '0.75rem', fontWeight: 700 }}>
                      Tactical Arsenal [1-9 / Scroll]
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {weaponSlots.map((slot) => {
                        const isUnlocked = hudState.playerLevel >= slot.reqLv
                        const isSelected = hudState.selectedWeaponId === slot.id || (slot.id === 'cyber_assault_rifle' && hudState.selectedWeaponId === 'threat_blaster')
                        return (
                          <button
                            key={slot.key}
                            type="button"
                            disabled={!isUnlocked}
                            onClick={() => {
                              if (!isUnlocked || !simStateRef.current) return
                              switchPlayerWeapon(simStateRef.current.equipment, slot.id, hudState.playerLevel)
                              cityAudio.ensureContext()
                              cityAudio.playReload()
                              setHudState((prev) => ({
                                ...prev,
                                selectedWeaponId: slot.id,
                                currentAmmo: simStateRef.current.equipment.ammo?.[slot.id] ?? 30,
                                magazineCapacity: EQUIPMENT_REGISTRY[slot.id]?.magazineCapacity || 30,
                              }))
                            }}
                            style={{
                              cursor: isUnlocked ? 'pointer' : 'not-allowed',
                              padding: '4px 8px',
                              borderRadius: '6px',
                              background: isSelected ? 'rgba(56, 189, 248, 0.25)' : (isUnlocked ? 'rgba(15, 23, 42, 0.7)' : 'rgba(15, 23, 42, 0.3)'),
                              border: isSelected ? '2px solid #38bdf8' : (isUnlocked ? '1px solid rgba(56, 189, 248, 0.3)' : '1px solid rgba(100, 116, 139, 0.2)'),
                              color: isSelected ? '#38bdf8' : (isUnlocked ? '#f8fafc' : '#64748b'),
                              opacity: isUnlocked ? 1 : 0.6,
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              minWidth: '70px',
                              transition: 'all 0.15s ease',
                            }}
                            title={isUnlocked ? `Switch to ${slot.name} [${slot.key}]` : `Unlocks at Level ${slot.reqLv}`}
                          >
                            <div style={{ fontSize: '0.85rem' }}>{slot.icon}</div>
                            <div style={{ fontSize: '0.68rem', fontWeight: 700 }}>[{slot.key}] {slot.name}</div>
                            <div style={{ fontSize: '0.62rem', color: isSelected ? '#38bdf8' : '#94a3b8' }}>
                              {isUnlocked ? (isSelected ? 'ACTIVE' : 'READY') : `🔒 Lv ${slot.reqLv}`}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Utilities & Controls */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(56, 189, 248, 0.2)', paddingTop: '6px', fontSize: '0.74rem' }}>
                    <button
                      type="button"
                      className="btn ghost small"
                      onClick={toggleMuteAudio}
                      style={{
                        padding: '3px 8px',
                        color: audioSettings.muted ? '#ef4444' : '#10b981',
                        borderColor: audioSettings.muted ? '#ef4444' : '#10b981',
                      }}
                    >
                      {audioSettings.muted ? '🔇 Muted [M]' : '🔊 Audio [M]'}
                    </button>
                    {!showTutorialOverlay && (
                      <button
                        type="button"
                        className="btn ghost small"
                        onClick={() => {
                          setTutorialStep(1)
                          setShowTutorialOverlay(true)
                        }}
                        style={{ padding: '3px 8px', color: '#38bdf8', borderColor: '#38bdf8' }}
                      >
                        🔰 {t('digital_city.tutorial.replay') || 'Tutorial'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Bottom Bar: Squad Pill, Open Center, Weapon Dock & Gadgets */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '0.75rem', width: '100%' }}>
                  {/* Bottom-Left: Quick Squad Status Pill */}
                  <div
                    style={{
                      pointerEvents: 'auto',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      background: 'rgba(10, 16, 31, 0.85)',
                      backdropFilter: 'blur(8px)',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      border: '1px solid rgba(56, 189, 248, 0.3)',
                      fontSize: '0.75rem',
                    }}
                  >
                    <span style={{ color: '#94a3b8' }}>Squad:</span>
                    <button
                      type="button"
                      onClick={() => setShowIntelDrawer((prev) => !prev)}
                      className="badge primary"
                      style={{
                        cursor: 'pointer',
                        background: 'rgba(56, 189, 248, 0.25)',
                        color: '#38bdf8',
                        border: '1px solid #38bdf8',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontWeight: 700,
                        fontSize: '0.74rem',
                      }}
                      title="Click to toggle Squad & Intel Drawer"
                    >
                      {hudState.squadCommand.toUpperCase()} [F1-F5]
                    </button>
                  </div>

                  {/* Center 65%+ remains open for unobstructed aiming */}

                  {/* Bottom-Right: Tactical Weapon Dock & Gadgets */}
                  <div
                    className="hud-panel"
                    style={{
                      background: 'rgba(10, 16, 31, 0.88)',
                      backdropFilter: 'blur(8px)',
                      padding: '0.45rem 0.85rem',
                      borderRadius: '8px',
                      border: '1px solid rgba(56, 189, 248, 0.35)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      pointerEvents: 'auto',
                      boxShadow: '0 4px 15px rgba(0, 0, 0, 0.4)',
                    }}
                  >
                    {/* Active Weapon Indicator */}
                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: '75px' }}>
                      <span style={{ fontSize: '0.66rem', color: '#94a3b8', fontWeight: 600 }}>WEAPON [{currentSlot.key}]</span>
                      <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#38bdf8' }}>{currentSlot.name}</span>
                    </div>

                    {/* Live Ammunition & Reload Button */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', minWidth: '85px' }}>
                      <div style={{ fontSize: '0.92rem', fontWeight: 900, color: hudState.currentAmmo <= 5 ? '#f87171' : '#38bdf8', letterSpacing: '0.5px' }}>
                        {hudState.currentAmmo} / {hudState.magazineCapacity}
                      </div>
                      <button
                        type="button"
                        disabled={hudState.isReloading}
                        onClick={() => {
                          if (simStateRef.current) {
                            cityAudio.ensureContext()
                            startReload(simStateRef.current.equipment, performance.now())
                            simStateRef.current.equipment.currentHeat = 0
                            simStateRef.current.equipment.isOverheated = false
                            cityAudio.playReload()
                            setHudState((prev) => ({ ...prev, isReloading: true }))
                          }
                        }}
                        style={{
                          cursor: hudState.isReloading ? 'wait' : 'pointer',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          background: hudState.isReloading ? 'rgba(239, 68, 68, 0.3)' : 'rgba(56, 189, 248, 0.2)',
                          border: '1px solid rgba(56, 189, 248, 0.4)',
                          color: hudState.isReloading ? '#fca5a5' : '#38bdf8',
                          fontSize: '0.68rem',
                          fontWeight: 700,
                        }}
                      >
                        {hudState.isReloading ? 'RELOADING' : '[R] RELOAD'}
                      </button>
                      {hudState.isReloading && (
                        <div style={{ width: '100%', height: '3px', background: '#334155', borderRadius: '2px', overflow: 'hidden' }}>
                          <div style={{ width: `${Math.round(hudState.reloadProgress * 100)}%`, height: '100%', background: '#38bdf8' }} />
                        </div>
                      )}
                    </div>

                    <div style={{ width: '1px', height: '36px', background: '#334155' }} />

                    {/* Tactical Gadgets: Shield, Pulse, Beacon */}
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      {/* Firewall Shield */}
                      <div
                        style={{
                          textAlign: 'center',
                          cursor: 'pointer',
                          padding: '4px 7px',
                          borderRadius: '6px',
                          background: hudState.isShieldActive || (showTutorialOverlay && tutorialStep === 5) ? 'rgba(250, 204, 21, 0.25)' : 'rgba(250, 204, 21, 0.08)',
                          border: (showTutorialOverlay && tutorialStep === 5) ? '2px solid #facc15' : (hudState.isShieldActive ? '1px solid #facc15' : '1px solid rgba(250, 204, 21, 0.3)'),
                          boxShadow: (showTutorialOverlay && tutorialStep === 5) ? '0 0 14px rgba(250, 204, 21, 0.9)' : undefined,
                          transition: 'all 0.15s ease',
                        }}
                        onClick={() => {
                          cityAudio.ensureContext()
                          inputRef.current.block = !inputRef.current.block
                          if (inputRef.current.block) cityAudio.playShieldDeflect()
                          if (showTutorialOverlay && tutorialStep === 5) setTutorialStep(6)
                        }}
                        title="Toggle Firewall Shield"
                      >
                        <div style={{ fontSize: '1rem' }}>🛡️</div>
                        <div style={{ fontSize: '0.66rem', fontWeight: 700, color: '#f8fafc' }}>Shield</div>
                        <div style={{ fontSize: '0.6rem', color: '#facc15' }}>[R-Click]</div>
                      </div>

                      {/* Network Pulse */}
                      <div
                        style={{
                          textAlign: 'center',
                          cursor: 'pointer',
                          padding: '4px 7px',
                          borderRadius: '6px',
                          background: (showTutorialOverlay && tutorialStep === 6) ? 'rgba(168, 85, 247, 0.3)' : 'rgba(168, 85, 247, 0.12)',
                          border: (showTutorialOverlay && tutorialStep === 6) ? '2px solid #a855f7' : '1px solid rgba(168, 85, 247, 0.3)',
                          boxShadow: (showTutorialOverlay && tutorialStep === 6) ? '0 0 14px rgba(168, 85, 247, 0.9)' : undefined,
                          transition: 'all 0.15s ease',
                        }}
                        onClick={() => {
                          cityAudio.ensureContext()
                          inputRef.current.activatePulse = true
                          if (simStateRef.current) cityAudio.playNetworkPulse()
                          if (showTutorialOverlay && tutorialStep === 6) setTutorialStep(7)
                          setTimeout(() => { inputRef.current.activatePulse = false }, 80)
                        }}
                        title="Activate Network Pulse"
                      >
                        <div style={{ fontSize: '1rem' }}>💫</div>
                        <div style={{ fontSize: '0.66rem', fontWeight: 700, color: '#f8fafc' }}>Pulse</div>
                        <div style={{ fontSize: '0.6rem', color: '#c084fc' }}>[Q]</div>
                      </div>

                      {/* Recovery Beacon */}
                      <div
                        style={{
                          textAlign: 'center',
                          cursor: 'pointer',
                          padding: '4px 7px',
                          borderRadius: '6px',
                          background: (showTutorialOverlay && tutorialStep === 7) ? 'rgba(16, 185, 129, 0.3)' : 'rgba(16, 185, 129, 0.12)',
                          border: (showTutorialOverlay && tutorialStep === 7) ? '2px solid #10b981' : '1px solid rgba(16, 185, 129, 0.3)',
                          boxShadow: (showTutorialOverlay && tutorialStep === 7) ? '0 0 14px rgba(16, 185, 129, 0.9)' : undefined,
                          transition: 'all 0.15s ease',
                        }}
                        onClick={() => {
                          cityAudio.ensureContext()
                          inputRef.current.activateBeacon = true
                          if (simStateRef.current) cityAudio.playRecoveryChime()
                          if (showTutorialOverlay && tutorialStep === 7) setTutorialStep(8)
                          setTimeout(() => { inputRef.current.activateBeacon = false }, 80)
                        }}
                        title="Deploy Recovery Beacon"
                      >
                        <div style={{ fontSize: '1rem' }}>🗼</div>
                        <div style={{ fontSize: '0.66rem', fontWeight: 700, color: '#f8fafc' }}>Beacon</div>
                        <div style={{ fontSize: '0.6rem', color: '#34d399' }}>[E]</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })()}
        </>
      )}

      {/* ==================================================================== */}
      {/* RESPONSIVE MOBILE TOUCH CONTROLS (VIRTUAL JOYSTICK & ACTION BUTTONS) */}
      {/* ==================================================================== */}
      {viewState === 'playing' && showTouchControls && (
        <>
          {/* Virtual Movement Joystick (Bottom Left) */}
          <div
            className="digital-city-touch-joystick"
            style={{
              position: 'absolute',
              bottom: '24px',
              left: '20px',
              width: '120px',
              height: '120px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(34,211,238,0.12) 0%, rgba(15,23,42,0.65) 100%)',
              border: '2px solid rgba(34,211,238,0.45)',
              boxShadow: '0 0 16px rgba(34,211,238,0.25)',
              touchAction: 'none',
              zIndex: 35,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'auto',
            }}
            onTouchStart={(e) => {
              const touch = e.touches[0]
              const rect = e.currentTarget.getBoundingClientRect()
              const cx = rect.left + rect.width / 2
              const cy = rect.top + rect.height / 2
              const dx = touch.clientX - cx
              const dy = touch.clientY - cy
              const dist = Math.hypot(dx, dy)
              const maxR = 38
              const clX = dist > maxR ? (dx / dist) * maxR : dx
              const clY = dist > maxR ? (dy / dist) * maxR : dy
              setJoystickThumb({ x: clX, y: clY, active: true })
              inputRef.current.forward = clY < -10
              inputRef.current.backward = clY > 10
              inputRef.current.left = clX < -10
              inputRef.current.right = clX > 10
              if (showTutorialOverlay && tutorialStep === 1) setTutorialStep(2)
            }}
            onTouchMove={(e) => {
              const touch = e.touches[0]
              const rect = e.currentTarget.getBoundingClientRect()
              const cx = rect.left + rect.width / 2
              const cy = rect.top + rect.height / 2
              const dx = touch.clientX - cx
              const dy = touch.clientY - cy
              const dist = Math.hypot(dx, dy)
              const maxR = 38
              const clX = dist > maxR ? (dx / dist) * maxR : dx
              const clY = dist > maxR ? (dy / dist) * maxR : dy
              setJoystickThumb({ x: clX, y: clY, active: true })
              inputRef.current.forward = clY < -10
              inputRef.current.backward = clY > 10
              inputRef.current.left = clX < -10
              inputRef.current.right = clX > 10
              if (showTutorialOverlay && tutorialStep === 1) setTutorialStep(2)
            }}
            onTouchEnd={() => {
              setJoystickThumb({ x: 0, y: 0, active: false })
              inputRef.current.forward = false
              inputRef.current.backward = false
              inputRef.current.left = false
              inputRef.current.right = false
            }}
            onTouchCancel={() => {
              setJoystickThumb({ x: 0, y: 0, active: false })
              inputRef.current.forward = false
              inputRef.current.backward = false
              inputRef.current.left = false
              inputRef.current.right = false
            }}
          >
            {/* Inner Joystick Thumb */}
            <div
              style={{
                width: '46px',
                height: '46px',
                borderRadius: '50%',
                background: joystickThumb.active
                  ? 'radial-gradient(circle, #38bdf8 0%, #0284c7 100%)'
                  : 'radial-gradient(circle, rgba(56,189,248,0.7) 0%, rgba(2,132,199,0.7) 100%)',
                border: '2px solid #e0f2fe',
                boxShadow: joystickThumb.active ? '0 0 16px #38bdf8' : '0 0 8px rgba(56,189,248,0.5)',
                transform: `translate(${joystickThumb.x}px, ${joystickThumb.y}px)`,
                transition: joystickThumb.active ? 'none' : 'transform 0.15s ease-out',
                pointerEvents: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.8rem',
              }}
            >
              🕹️
            </div>
          </div>

          {/* Touch Look & Aim Trackpad Zone (Right screen half) */}
          <div
            className="digital-city-touch-aimzone"
            style={{
              position: 'absolute',
              top: '80px',
              right: '0',
              width: '45%',
              bottom: '120px',
              touchAction: 'none',
              zIndex: 15,
              pointerEvents: 'auto',
            }}
            onTouchStart={(e) => {
              const touch = e.touches[0]
              touchAimRef.current = {
                id: touch.identifier,
                lastX: touch.clientX,
                lastY: touch.clientY,
                active: true,
              }
            }}
            onTouchMove={(e) => {
              if (!touchAimRef.current.active) return
              for (let i = 0; i < e.touches.length; i++) {
                const touch = e.touches[i]
                if (touch.identifier === touchAimRef.current.id) {
                  const dx = touch.clientX - touchAimRef.current.lastX
                  const dy = touch.clientY - touchAimRef.current.lastY
                  touchAimRef.current.lastX = touch.clientX
                  touchAimRef.current.lastY = touch.clientY

                  const sensitivity = 0.0045 * (mouseSensitivityRef.current || 1.0)
                  cameraRotRef.current.yaw -= dx * sensitivity
                  cameraRotRef.current.pitch = Math.max(-0.25, Math.min(0.85, cameraRotRef.current.pitch + dy * sensitivity))

                  if (showTutorialOverlay && tutorialStep === 2) {
                    mouseLookDistanceRef.current += Math.abs(dx) + Math.abs(dy)
                    if (mouseLookDistanceRef.current > 30) {
                      setTutorialStep(3)
                      mouseLookDistanceRef.current = 0
                    }
                  }
                  break
                }
              }
            }}
            onTouchEnd={(e) => {
              for (let i = 0; i < e.changedTouches.length; i++) {
                if (e.changedTouches[i].identifier === touchAimRef.current.id) {
                  touchAimRef.current.active = false
                  break
                }
              }
            }}
            onTouchCancel={() => {
              touchAimRef.current.active = false
            }}
          />

          {/* Touch Action Buttons Cluster (Bottom Right) */}
          <div
            className="digital-city-touch-actions"
            style={{
              position: 'absolute',
              bottom: '24px',
              right: '20px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              gap: '10px',
              zIndex: 35,
              pointerEvents: 'auto',
              touchAction: 'none',
            }}
          >
            {/* Top row: Order, Shield, Jump */}
            <div style={{ display: 'flex', gap: '8px' }}>
              {/* Squad Order Cycler */}
              <button
                type="button"
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  background: 'rgba(15,23,42,0.85)',
                  border: '2px solid #a855f7',
                  color: '#c084fc',
                  fontSize: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 10px rgba(168,85,247,0.3)',
                  cursor: 'pointer',
                }}
                onTouchStart={(e) => {
                  e.preventDefault()
                  cityAudio.ensureContext()
                  if (simStateRef.current) {
                    const commands = [SQUAD_COMMANDS.FOLLOW, SQUAD_COMMANDS.DEFEND, SQUAD_COMMANDS.ADVANCE, SQUAD_COMMANDS.TAKE_COVER, SQUAD_COMMANDS.FALL_BACK]
                    const curIdx = commands.indexOf(simStateRef.current.squadCommand)
                    const nextCmd = commands[(curIdx + 1) % commands.length]
                    simStateRef.current.squadCommand = nextCmd
                    if (showTutorialOverlay && tutorialStep === 8) setTutorialStep(9)
                  }
                }}
                title="Cycle Squad Command"
              >
                👥
              </button>

              {/* Shield / Block */}
              <button
                type="button"
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  background: hudState.isShieldActive ? 'rgba(250,204,21,0.35)' : 'rgba(15,23,42,0.85)',
                  border: '2px solid #facc15',
                  color: '#facc15',
                  fontSize: '1.1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 10px rgba(250,204,21,0.3)',
                  cursor: 'pointer',
                }}
                onTouchStart={(e) => {
                  e.preventDefault()
                  cityAudio.ensureContext()
                  inputRef.current.block = !inputRef.current.block
                  if (inputRef.current.block) cityAudio.playShieldDeflect()
                  if (showTutorialOverlay && tutorialStep === 5) setTutorialStep(6)
                }}
                title="Firewall Shield"
              >
                🛡️
              </button>

              {/* Jump Button */}
              <button
                type="button"
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  background: 'rgba(15,23,42,0.85)',
                  border: '2px solid #38bdf8',
                  color: '#38bdf8',
                  fontSize: '1.1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 10px rgba(56,189,248,0.3)',
                  cursor: 'pointer',
                }}
                onTouchStart={(e) => {
                  e.preventDefault()
                  cityAudio.ensureContext()
                  inputRef.current.jump = true
                  if (showTutorialOverlay && tutorialStep === 3) setTutorialStep(4)
                  if (showTutorialOverlay && tutorialStep === 9) setTutorialStep(10)
                  setTimeout(() => { inputRef.current.jump = false }, 180)
                }}
                title="Jump"
              >
                ⬆️
              </button>
            </div>

            {/* Bottom row: Reload & Primary Fire */}
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              {/* Reload Button */}
              <button
                type="button"
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '50%',
                  background: 'rgba(15,23,42,0.85)',
                  border: '2px solid #10b981',
                  color: '#34d399',
                  fontSize: '1.1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 10px rgba(16,185,129,0.3)',
                  cursor: 'pointer',
                }}
                onTouchStart={(e) => {
                  e.preventDefault()
                  if (simStateRef.current) {
                    cityAudio.ensureContext()
                    startReload(simStateRef.current.equipment, performance.now())
                    simStateRef.current.equipment.currentHeat = 0
                    simStateRef.current.equipment.isOverheated = false
                    cityAudio.playReload()
                    setHudState((prev) => ({ ...prev, isReloading: true }))
                  }
                }}
                title="Reload Weapon"
              >
                🔄
              </button>

              {/* Primary Tactical Fire Button */}
              <button
                type="button"
                style={{
                  width: '68px',
                  height: '68px',
                  borderRadius: '50%',
                  background: 'radial-gradient(circle, #ef4444 0%, #b91c1c 100%)',
                  border: '3px solid #fecaca',
                  color: '#ffffff',
                  fontSize: '1.2rem',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 20px rgba(239,68,68,0.7)',
                  cursor: 'pointer',
                  fontWeight: 900,
                  letterSpacing: '1px',
                }}
                onTouchStart={(e) => {
                  e.preventDefault()
                  cityAudio.ensureContext()
                  inputRef.current.shoot = true
                  cityAudio.playLaserFire(false)
                  if (showTutorialOverlay && tutorialStep === 4) setTutorialStep(5)
                }}
                onTouchEnd={(e) => {
                  e.preventDefault()
                  inputRef.current.shoot = false
                }}
                onTouchCancel={() => {
                  inputRef.current.shoot = false
                }}
                title="Fire Weapon"
              >
                <span style={{ fontSize: '1.1rem', lineHeight: 1 }}>🎯</span>
                <span style={{ fontSize: '0.6rem', fontWeight: 900 }}>FIRE</span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* ==================================================================== */}
      {/* INTERACTIVE 10-STEP ACTION-GATED TUTORIAL OVERLAY                    */}
      {/* ==================================================================== */}
      {viewState === 'playing' && showTutorialOverlay && (
        <div
          className="digital-city-tutorial-toast"
          style={{
            position: 'absolute',
            bottom: '125px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(15, 23, 42, 0.96)',
            border: '2px solid #38bdf8',
            borderRadius: '10px',
            padding: '1.1rem 1.5rem',
            maxWidth: '560px',
            width: '90%',
            zIndex: 25,
            boxShadow: '0 0 30px rgba(56, 189, 248, 0.35)',
            pointerEvents: 'auto',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.82rem', color: '#38bdf8', fontWeight: 800, letterSpacing: '1px' }}>
              🔰 FIELD TUTORIAL: STEP {tutorialStep} / 10
            </span>
            <button
              type="button"
              className="btn ghost small"
              onClick={() => setShowTutorialOverlay(false)}
              style={{ padding: '2px 8px', fontSize: '0.75rem', borderColor: '#475569', color: '#94a3b8' }}
            >
              {t('digital_city.tutorial.skip') || 'Skip Tutorial'}
            </button>
          </div>
          <p style={{ margin: '0 0 10px', fontSize: '0.95rem', lineHeight: 1.5, color: '#f8fafc' }}>
            {t(`digital_city.tutorial.step${tutorialStep}`)}
          </p>
          <div
            style={{
              padding: '6px 10px',
              borderRadius: '6px',
              background: 'rgba(56, 189, 248, 0.12)',
              border: '1px dashed #38bdf8',
              marginBottom: '10px',
              fontSize: '0.85rem',
              color: '#38bdf8',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span>👉</span>
            <span>{t(`digital_city.tutorial.step${tutorialStep}_action`)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
              {tutorialStep === 3 || tutorialStep === 9 ? 'Press [Space] to proceed' : 'Execute required action to continue'}
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              {tutorialStep > 1 && (
                <button
                  type="button"
                  className="btn ghost small"
                  onClick={() => setTutorialStep((prev) => prev - 1)}
                >
                  ← Back
                </button>
              )}
              {(tutorialStep === 3 || tutorialStep === 9) && (
                <button
                  type="button"
                  className="btn primary small"
                  onClick={() => setTutorialStep((prev) => Math.min(10, prev + 1))}
                >
                  Continue [Space] →
                </button>
              )}
              {tutorialStep === 10 && (
                <button
                  type="button"
                  className="btn primary small"
                  onClick={() => setShowTutorialOverlay(false)}
                >
                  Complete Tutorial ✓
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* PAUSE OVERLAY                                                        */}
      {/* ==================================================================== */}
      {viewState === 'paused' && (
        <div
          className="digital-city-modal-overlay"
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(6,9,19,0.85)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 35,
          }}
        >
          <div className="card" style={{ width: '100%', maxWidth: '400px', padding: '2rem', textAlign: 'center', background: '#0f172a', border: '1px solid #38bdf8' }}>
            <h2 style={{ marginTop: 0, color: '#38bdf8' }}>⏸️ {t('digital_city.pause.title')}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '1.5rem' }}>
              <button type="button" className="btn primary" onClick={() => setViewState('playing')}>
                ▶️ {t('digital_city.pause.resume')}
              </button>
              <button
                type="button"
                className="btn ghost"
                onClick={() => {
                  setTutorialStep(1)
                  setShowTutorialOverlay(true)
                  setViewState('playing')
                }}
                style={{ color: '#38bdf8', borderColor: 'rgba(56, 189, 248, 0.4)' }}
              >
                🔄 {t('digital_city.tutorial.replay') || 'Replay Tutorial'}
              </button>
              <button
                type="button"
                className={`btn ${audioSettings.muted ? 'danger' : 'ghost'}`}
                onClick={toggleMuteAudio}
              >
                {audioSettings.muted ? '🔇 ' + t('digital_city.pause.unmute') : '🔊 ' + t('digital_city.pause.mute')}
              </button>
              <button type="button" className="btn ghost" onClick={() => setViewState('settings')}>
                ⚙️ {t('digital_city.menu.settings')}
              </button>
              <button
                type="button"
                className="btn ghost"
                onClick={() => {
                  cityAudio.stopMusic()
                  setViewState('menu')
                }}
                style={{ color: '#ef4444' }}
              >
                ✕ {t('digital_city.pause.abandon')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* VICTORY OVERLAY                                                      */}
      {/* ==================================================================== */}
      {viewState === 'victory' && (
        <div
          className="digital-city-modal-overlay"
          style={{
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(circle at center, rgba(16, 185, 129, 0.2) 0%, rgba(6, 9, 19, 0.95) 100%)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 40,
            padding: '2rem',
          }}
        >
          <div className="card" style={{ width: '100%', maxWidth: '480px', padding: '2rem', textAlign: 'center', background: '#0f172a', border: '2px solid #10b981' }}>
            <div style={{ fontSize: '3rem', marginBottom: '8px' }}>🏆</div>
            <h2 style={{ margin: '0 0 6px', color: '#10b981', fontSize: '2rem', fontWeight: 900 }}>
              {t('digital_city.victory.title')}
            </h2>
            <p style={{ margin: '0 0 1.5rem', color: '#94a3b8' }}>
              {t('digital_city.victory.subtitle')}
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginBottom: '1.5rem' }}>
              <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '12px', borderRadius: '6px' }}>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{t('digital_city.victory.xp_earned')}</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#10b981' }}>+{currentMission.xpReward} XP</div>
              </div>
              <div style={{ background: 'rgba(250, 204, 21, 0.1)', padding: '12px', borderRadius: '6px' }}>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{t('digital_city.victory.credits_earned')}</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#facc15' }}>+{currentMission.creditReward} ETB</div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                type="button"
                className="btn primary"
                onClick={() => {
                  const currentIdx = STORY_MISSIONS.findIndex((m) => m.id === selectedMissionId)
                  if (currentIdx !== -1 && currentIdx < STORY_MISSIONS.length - 1) {
                    startMission(STORY_MISSIONS[currentIdx + 1].id, 'story_campaign')
                  } else {
                    setViewState('menu')
                  }
                }}
              >
                🚀 {t('digital_city.victory.next_mission')}
              </button>
              <button
                type="button"
                className="btn ghost"
                onClick={() => {
                  cityAudio.stopMusic()
                  setViewState('menu')
                }}
              >
                ← Return to Tactical Menu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* DEFEAT OVERLAY                                                       */}
      {/* ==================================================================== */}
      {viewState === 'defeat' && (
        <div
          className="digital-city-modal-overlay"
          style={{
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(circle at center, rgba(239, 68, 68, 0.25) 0%, rgba(6, 9, 19, 0.95) 100%)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 40,
            padding: '2rem',
          }}
        >
          <div className="card" style={{ width: '100%', maxWidth: '440px', padding: '2rem', textAlign: 'center', background: '#0f172a', border: '2px solid #ef4444' }}>
            <div style={{ fontSize: '3rem', marginBottom: '8px' }}>⚠️</div>
            <h2 style={{ margin: '0 0 6px', color: '#ef4444', fontSize: '1.8rem', fontWeight: 900 }}>
              {t('digital_city.defeat.title')}
            </h2>
            <p style={{ margin: '0 0 1.5rem', color: '#94a3b8' }}>
              {t('digital_city.defeat.subtitle')}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button type="button" className="btn primary" onClick={() => startMission(selectedMissionId, currentGameMode)}>
                🔄 {t('digital_city.defeat.retry')}
              </button>
              <button
                type="button"
                className="btn ghost"
                onClick={() => {
                  cityAudio.stopMusic()
                  setViewState('menu')
                }}
              >
                ← {t('digital_city.defeat.menu')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
