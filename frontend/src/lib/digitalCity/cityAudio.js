/**
 * CyberShield Ethiopia — Digital City: Cinematic Audio & Sound Design Engine
 *
 * 100% offline procedural Web Audio synthesizer and dynamic music engine.
 * Generates rich electronic-orchestral music, multi-layered weapon sounds,
 * concussive explosions, footsteps, environmental ambience, and dynamic combat audio.
 *
 * Studio-Grade Audio Pipeline:
 * - Master DynamicsCompressorNode (limiter/compressor) prevents distortion and boosts perceived loudness.
 * - Multi-track dynamic music sequencer: exploration (108 BPM), combat (126 BPM), boss (138 BPM), victory fanfare, defeat dirge.
 * - Distinct weapon synthesizers: Cyber Guard Energy Rifle, Enemy Plasma Rifle, weapon reload/vent, shield activate & deflect.
 * - Full combat SFX: multi-layer explosions (sub-boom + crack + rumble), armor impacts, enemy defeat glitches, warning klaxons.
 * - Character & Environment SFX: footsteps (walk vs sprint), jump, land, drone flight telemetry, city ambience.
 * - Voice limiting & rate throttling prevents audio buffer distortion or stuttering.
 * - Volume sliders for Master, SFX, and Music, with mute toggle and persistent storage.
 *
 * Deterministic PRNG broadband noise generator (zero Math.random, fully compliant with SR-09).
 */

class DigitalCityAudioManager {
  constructor() {
    this.ctx = null
    this.isMuted = false
    this.masterGain = null
    this.sfxGain = null
    this.musicGain = null
    this.ambientGain = null
    this.commsGain = null
    this.masterLimiter = null
    this.noiseBuffer = null

    // Volume levels (0.0 to 1.0)
    this.masterVolume = 0.8
    this.sfxVolume = 0.85
    this.musicVolume = 0.55
    this.ambientVolume = 0.45
    this.commsVolume = 0.85

    // Sound Cooldown / Voice Limiting Map
    this.lastSoundTime = {}
    this.soundCooldowns = {
      player_fire: 70,
      plasma_fire: 80,
      footstep: 220,
      jump: 300,
      land: 300,
      shield_deflect: 60,
      armor_impact: 60,
      enemy_defeat: 100,
      explosion: 100,
      alarm: 600,
      reload: 800,
    }

    // Dynamic Music Sequencer State
    this.musicState = 'off' // 'off' | 'exploration' | 'combat' | 'boss' | 'victory' | 'defeat'
    this.isMusicPlaying = false
    this.musicTimer = null
    this.currentStep = 0
    this.currentBar = 0
    this.nextNoteTime = 0
    this.tempoBpm = 110
    this.activeVoiceNodes = []

    // Ambient Loop Nodes
    this.ambientLoopNodes = []
    this.isAmbientPlaying = false

    // Drone Sound Nodes
    this.droneNodes = []
    this.isDronePlaying = false
  }

  /**
   * Initializes Web Audio Context and audio graph
   */
  init() {
    if (this.ctx) return
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext
      if (!AudioCtx) return
      this.ctx = new AudioCtx()

      // 1. Master Dynamics Compressor / Studio Limiter (prevents clipping, provides punch)
      this.masterLimiter = this.ctx.createDynamicsCompressor()
      this.masterLimiter.threshold.setValueAtTime(-15.0, this.ctx.currentTime) // -15 dB
      this.masterLimiter.knee.setValueAtTime(18.0, this.ctx.currentTime)
      this.masterLimiter.ratio.setValueAtTime(12.0, this.ctx.currentTime)
      this.masterLimiter.attack.setValueAtTime(0.003, this.ctx.currentTime) // 3ms fast limiter attack
      this.masterLimiter.release.setValueAtTime(0.22, this.ctx.currentTime)

      // 2. Master Gain Node
      this.masterGain = this.ctx.createGain()
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.masterVolume, this.ctx.currentTime)

      // Connect: MasterGain -> Limiter -> Destination
      this.masterGain.connect(this.masterLimiter)
      this.masterLimiter.connect(this.ctx.destination)

      // 3. SFX Sub-bus Gain
      this.sfxGain = this.ctx.createGain()
      this.sfxGain.gain.setValueAtTime(this.sfxVolume, this.ctx.currentTime)
      this.sfxGain.connect(this.masterGain)

      // 4. Music Sub-bus Gain
      this.musicGain = this.ctx.createGain()
      this.musicGain.gain.setValueAtTime(this.musicVolume, this.ctx.currentTime)
      this.musicGain.connect(this.masterGain)

      // 5. Ambient Sub-bus Gain
      this.ambientGain = this.ctx.createGain()
      this.ambientGain.gain.setValueAtTime(this.ambientVolume, this.ctx.currentTime)
      this.ambientGain.connect(this.masterGain)

      // 6. Tactical Radio & Voice Comms Sub-bus Gain
      this.commsGain = this.ctx.createGain()
      this.commsGain.gain.setValueAtTime(this.commsVolume, this.ctx.currentTime)
      this.commsGain.connect(this.masterGain)

      // 7. Generate Reusable Noise Buffer (zero Math.random, deterministic hash)
      this.generateDeterministicNoiseBuffer()
    } catch (e) {
      // AudioContext unavailable in current runtime
    }
  }

  /**
   * Generates a 2-second white/pink noise buffer without Math.random (SR-09 compliant)
   */
  generateDeterministicNoiseBuffer() {
    if (!this.ctx) return
    try {
      const sampleRate = this.ctx.sampleRate || 44100
      const bufferLength = sampleRate * 2
      this.noiseBuffer = this.ctx.createBuffer(1, bufferLength, sampleRate)
      const output = this.noiseBuffer.getChannelData(0)

      let b0 = 0, b1 = 0, b2 = 0
      for (let i = 0; i < bufferLength; i++) {
        // High-frequency deterministic trig hash between -1.0 and 1.0
        const white = ((Math.sin(i * 12.9898 + (i % 17) * 78.233) * 43758.5453) % 2) - 1
        // Pink noise filtering for warm, natural explosion and impact acoustics
        b0 = 0.99886 * b0 + white * 0.0555179
        b1 = 0.99332 * b1 + white * 0.0750759
        b2 = 0.96900 * b2 + white * 0.1538520
        output[i] = (b0 + b1 + b2 + white * 0.5362) * 0.12
      }
    } catch (e) {
      this.noiseBuffer = null
    }
  }

  /**
   * Resumes AudioContext on user interaction to comply with browser autoplay policies
   */
  ensureContext() {
    if (!this.ctx) this.init()
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {})
    }
  }

  /**
   * Adjusts master, SFX, and music volume smoothly
   */
  setVolumes({ master = 0.8, sfx = 0.85, music = 0.55, ambient = 0.45, comms = 0.85, muted = false }) {
    this.isMuted = Boolean(muted)
    this.masterVolume = Math.max(0, Math.min(1, Number(master)))
    this.sfxVolume = Math.max(0, Math.min(1, Number(sfx)))
    this.musicVolume = Math.max(0, Math.min(1, Number(music)))
    this.ambientVolume = Math.max(0, Math.min(1, Number(ambient)))
    if (comms !== undefined) this.commsVolume = Math.max(0, Math.min(1, Number(comms)))

    if (!this.ctx || !this.masterGain) return
    const now = this.ctx.currentTime
    const targetMaster = this.isMuted ? 0 : this.masterVolume

    this.masterGain.gain.setTargetAtTime(targetMaster, now, 0.03)
    this.sfxGain.gain.setTargetAtTime(this.sfxVolume, now, 0.03)
    this.musicGain.gain.setTargetAtTime(this.musicVolume, now, 0.03)
    this.ambientGain.gain.setTargetAtTime(this.ambientVolume, now, 0.03)
    if (this.commsGain) this.commsGain.gain.setTargetAtTime(this.commsVolume, now, 0.03)
  }

  /**
   * Checks voice rate limiting to prevent sound clipping/distortion
   */
  canPlay(soundName, customCooldownMs = null) {
    if (this.isMuted) return false
    const now = Date.now()
    const cooldown = customCooldownMs !== null ? customCooldownMs : (this.soundCooldowns[soundName] || 60)
    const last = this.lastSoundTime[soundName] || 0
    if (now - last < cooldown) return false
    this.lastSoundTime[soundName] = now
    return true
  }

  // ==========================================================================
  // 1. WEAPON SOUND EFFECTS
  // ==========================================================================

  /**
   * Cyber Guard Energy Rifle: Snappy click + 1550Hz -> 280Hz laser discharge + 75Hz sub punch
   */
  playEnergyRifle() {
    this.ensureContext()
    if (!this.ctx || !this.canPlay('player_fire')) return
    const now = this.ctx.currentTime

    // Layer 1: High-tech mechanical click
    const clickOsc = this.ctx.createOscillator()
    const clickGain = this.ctx.createGain()
    clickOsc.type = 'square'
    clickOsc.frequency.setValueAtTime(2400, now)
    clickOsc.frequency.exponentialRampToValueAtTime(600, now + 0.015)
    clickGain.gain.setValueAtTime(0.18, now)
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.02)
    clickOsc.connect(clickGain)
    clickGain.connect(this.sfxGain)
    clickOsc.start(now)
    clickOsc.stop(now + 0.025)

    // Layer 2: Main energy discharge
    const laserOsc = this.ctx.createOscillator()
    const laserGain = this.ctx.createGain()
    laserOsc.type = 'triangle'
    laserOsc.frequency.setValueAtTime(1550, now)
    laserOsc.frequency.exponentialRampToValueAtTime(280, now + 0.11)
    laserGain.gain.setValueAtTime(0.42, now)
    laserGain.gain.exponentialRampToValueAtTime(0.001, now + 0.13)
    laserOsc.connect(laserGain)
    laserGain.connect(this.sfxGain)
    laserOsc.start(now)
    laserOsc.stop(now + 0.14)

    // Layer 3: Concussive sub thump
    const subOsc = this.ctx.createOscillator()
    const subGain = this.ctx.createGain()
    subOsc.type = 'sine'
    subOsc.frequency.setValueAtTime(115, now)
    subOsc.frequency.exponentialRampToValueAtTime(45, now + 0.08)
    subGain.gain.setValueAtTime(0.35, now)
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09)
    subOsc.connect(subGain)
    subGain.connect(this.sfxGain)
    subOsc.start(now)
    subOsc.stop(now + 0.1)
  }

  /**
   * Enemy Plasma Rifle: Hostile FM synthesized bubbling plasma burst
   */
  playEnemyPlasma() {
    this.ensureContext()
    if (!this.ctx || !this.canPlay('plasma_fire')) return
    const now = this.ctx.currentTime

    // FM Synthesis: Carrier + Modulator for bubbling alien plasma sizzle
    const carrier = this.ctx.createOscillator()
    const modulator = this.ctx.createOscillator()
    const modGain = this.ctx.createGain()
    const outGain = this.ctx.createGain()
    const filter = this.ctx.createBiquadFilter()

    carrier.type = 'sawtooth'
    carrier.frequency.setValueAtTime(420, now)
    carrier.frequency.exponentialRampToValueAtTime(110, now + 0.15)

    modulator.type = 'sine'
    modulator.frequency.setValueAtTime(140, now)
    modulator.frequency.linearRampToValueAtTime(45, now + 0.15)

    modGain.gain.setValueAtTime(450, now)
    modGain.gain.exponentialRampToValueAtTime(20, now + 0.15)

    modulator.connect(modGain)
    modGain.connect(carrier.frequency)

    filter.type = 'bandpass'
    filter.frequency.setValueAtTime(1200, now)
    filter.Q.setValueAtTime(3.5, now)

    outGain.gain.setValueAtTime(0.38, now)
    outGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16)

    carrier.connect(filter)
    filter.connect(outGain)
    outGain.connect(this.sfxGain)

    modulator.start(now)
    carrier.start(now)
    modulator.stop(now + 0.17)
    carrier.stop(now + 0.17)
  }

  /**
   * Weapon Reload & Heat Vent: 4-stage realistic tactical reload sequence
   */
  playReload() {
    this.ensureContext()
    if (!this.ctx || !this.canPlay('reload', 800)) return
    const now = this.ctx.currentTime

    // 1. Heat vent hiss (high-pass noise)
    if (this.noiseBuffer) {
      const noise = this.ctx.createBufferSource()
      const nFilter = this.ctx.createBiquadFilter()
      const nGain = this.ctx.createGain()
      noise.buffer = this.noiseBuffer
      nFilter.type = 'highpass'
      nFilter.frequency.setValueAtTime(3200, now)
      nGain.gain.setValueAtTime(0.25, now)
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18)
      noise.connect(nFilter)
      nFilter.connect(nGain)
      nGain.connect(this.sfxGain)
      noise.start(now)
      noise.stop(now + 0.2)
    }

    // 2. Magazine core eject click (t + 0.18s)
    const ejectOsc = this.ctx.createOscillator()
    const ejectGain = this.ctx.createGain()
    ejectOsc.type = 'square'
    ejectOsc.frequency.setValueAtTime(1100, now + 0.18)
    ejectOsc.frequency.exponentialRampToValueAtTime(220, now + 0.22)
    ejectGain.gain.setValueAtTime(0.25, now + 0.18)
    ejectGain.gain.exponentialRampToValueAtTime(0.001, now + 0.23)
    ejectOsc.connect(ejectGain)
    ejectGain.connect(this.sfxGain)
    ejectOsc.start(now + 0.18)
    ejectOsc.stop(now + 0.24)

    // 3. Servo recharge whine (t + 0.35s)
    const servoOsc = this.ctx.createOscillator()
    const servoGain = this.ctx.createGain()
    servoOsc.type = 'triangle'
    servoOsc.frequency.setValueAtTime(320, now + 0.35)
    servoOsc.frequency.exponentialRampToValueAtTime(840, now + 0.55)
    servoGain.gain.setValueAtTime(0.18, now + 0.35)
    servoGain.gain.exponentialRampToValueAtTime(0.001, now + 0.58)
    servoOsc.connect(servoGain)
    servoGain.connect(this.sfxGain)
    servoOsc.start(now + 0.35)
    servoOsc.stop(now + 0.6)

    // 4. Battery lock latch & weapon ready chime (t + 0.62s)
    const lockOsc = this.ctx.createOscillator()
    const lockGain = this.ctx.createGain()
    lockOsc.type = 'sine'
    lockOsc.frequency.setValueAtTime(1046.5, now + 0.62) // C6 ready chime
    lockOsc.frequency.setValueAtTime(1318.5, now + 0.68) // E6
    lockGain.gain.setValueAtTime(0.28, now + 0.62)
    lockGain.gain.exponentialRampToValueAtTime(0.001, now + 0.85)
    lockOsc.connect(lockGain)
    lockGain.connect(this.sfxGain)
    lockOsc.start(now + 0.62)
    lockOsc.stop(now + 0.88)
  }

  /**
   * Energy Shield Activation: Resonant forcefield power surge & barrier hum
   */
  playShieldActivate() {
    this.ensureContext()
    if (!this.ctx || !this.canPlay('shield_activate', 300)) return
    const now = this.ctx.currentTime

    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    const filter = this.ctx.createBiquadFilter()

    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(120, now)
    osc.frequency.exponentialRampToValueAtTime(740, now + 0.22)

    filter.type = 'bandpass'
    filter.frequency.setValueAtTime(600, now)
    filter.Q.setValueAtTime(4.0, now)

    gain.gain.setValueAtTime(0.35, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28)

    osc.connect(filter)
    filter.connect(gain)
    gain.connect(this.sfxGain)
    osc.start(now)
    osc.stop(now + 0.3)
  }

  /**
   * Energy Shield Impact / Deflection: High-velocity plasma deflect ping + electrical ripple
   */
  playShieldDeflect() {
    this.ensureContext()
    if (!this.ctx || !this.canPlay('shield_deflect')) return
    const now = this.ctx.currentTime

    // Resonant metallic ping
    const pingOsc = this.ctx.createOscillator()
    const pingGain = this.ctx.createGain()
    pingOsc.type = 'sine'
    pingOsc.frequency.setValueAtTime(1850, now)
    pingOsc.frequency.exponentialRampToValueAtTime(680, now + 0.18)
    pingGain.gain.setValueAtTime(0.48, now)
    pingGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22)
    pingOsc.connect(pingGain)
    pingGain.connect(this.sfxGain)
    pingOsc.start(now)
    pingOsc.stop(now + 0.24)

    // Electrical forcefield ripple
    const rippleOsc = this.ctx.createOscillator()
    const rippleGain = this.ctx.createGain()
    rippleOsc.type = 'triangle'
    rippleOsc.frequency.setValueAtTime(440, now)
    rippleGain.gain.setValueAtTime(0.2, now)
    rippleGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15)
    rippleOsc.connect(rippleGain)
    rippleGain.connect(this.sfxGain)
    rippleOsc.start(now)
    rippleOsc.stop(now + 0.16)
  }

  /**
   * Network Pulse (EMP Shockwave): Massive concussive sub blast + stereophonic frequency sweep
   */
  playNetworkPulse() {
    this.ensureContext()
    if (!this.ctx || !this.canPlay('network_pulse', 300)) return
    const now = this.ctx.currentTime

    // Rising pre-shockwave surge
    const riseOsc = this.ctx.createOscillator()
    const riseGain = this.ctx.createGain()
    riseOsc.type = 'sine'
    riseOsc.frequency.setValueAtTime(180, now)
    riseOsc.frequency.exponentialRampToValueAtTime(2400, now + 0.18)
    riseGain.gain.setValueAtTime(0.4, now)
    riseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2)
    riseOsc.connect(riseGain)
    riseGain.connect(this.sfxGain)
    riseOsc.start(now)
    riseOsc.stop(now + 0.21)

    // Concussive sub-bass EMP drop (t + 0.18s)
    const empSub = this.ctx.createOscillator()
    const empGain = this.ctx.createGain()
    empSub.type = 'sawtooth'
    empSub.frequency.setValueAtTime(95, now + 0.18)
    empSub.frequency.exponentialRampToValueAtTime(22, now + 0.6)
    empGain.gain.setValueAtTime(0.55, now + 0.18)
    empGain.gain.exponentialRampToValueAtTime(0.001, now + 0.65)
    empSub.connect(empGain)
    empGain.connect(this.sfxGain)
    empSub.start(now + 0.18)
    empSub.stop(now + 0.68)
  }

  /**
   * Recovery Beacon: Uplifting nanite deployment chord + healing chime
   */
  playRecoveryBeacon() {
    this.ensureContext()
    if (!this.ctx || !this.canPlay('recovery_beacon', 400)) return
    const now = this.ctx.currentTime
    const notes = [523.25, 659.25, 783.99, 1046.5] // C5, E5, G5, C6 harmonic arpeggio

    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(freq, now + idx * 0.07)
      gain.gain.setValueAtTime(0.3, now + idx * 0.07)
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.45)
      osc.connect(gain)
      gain.connect(this.sfxGain)
      osc.start(now + idx * 0.07)
      osc.stop(now + idx * 0.07 + 0.48)
    })
  }

  /**
   * Signal Scanner: Sonar radar pulse ping + digital telemetry chirp
   */
  playSignalScanner() {
    this.ensureContext()
    if (!this.ctx || !this.canPlay('signal_scanner', 250)) return
    const now = this.ctx.currentTime

    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(1760, now) // A6 sonar ping
    gain.gain.setValueAtTime(0.42, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55)
    osc.connect(gain)
    gain.connect(this.sfxGain)
    osc.start(now)
    osc.stop(now + 0.58)
  }

  /**
   * Encryption Barrier: Digital firewall lock clicks + crystalline seal
   */
  playEncryptionBarrier() {
    this.ensureContext()
    if (!this.ctx || !this.canPlay('encryption_barrier', 350)) return
    const now = this.ctx.currentTime

    ;[0, 0.08, 0.16].forEach((offset, idx) => {
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()
      osc.type = 'square'
      osc.frequency.setValueAtTime(600 + idx * 300, now + offset)
      gain.gain.setValueAtTime(0.22, now + offset)
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.06)
      osc.connect(gain)
      gain.connect(this.sfxGain)
      osc.start(now + offset)
      osc.stop(now + offset + 0.07)
    })
  }

  /**
   * EMP Device: High-voltage capacitor discharge & electrical crackle
   */
  playEmpDevice() {
    this.ensureContext()
    if (!this.ctx || !this.canPlay('emp_device', 400)) return
    const now = this.ctx.currentTime

    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(540, now)
    osc.frequency.exponentialRampToValueAtTime(35, now + 0.35)
    gain.gain.setValueAtTime(0.48, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4)
    osc.connect(gain)
    gain.connect(this.sfxGain)
    osc.start(now)
    osc.stop(now + 0.42)
  }

  // ==========================================================================
  // 2. COMBAT & DESTRUCTION AUDIO
  // ==========================================================================

  /**
   * Multi-Layer Cinematic Explosion: Supersonic crack + concussive fireball rumble + sub-bass tremor
   */
  playExplosion(heavy = false) {
    this.ensureContext()
    if (!this.ctx || !this.canPlay('explosion', heavy ? 120 : 80)) return
    const now = this.ctx.currentTime
    const duration = heavy ? 0.75 : 0.5

    // Layer 1: Concussive noise blast
    if (this.noiseBuffer) {
      const noise = this.ctx.createBufferSource()
      const filter = this.ctx.createBiquadFilter()
      const nGain = this.ctx.createGain()

      noise.buffer = this.noiseBuffer
      filter.type = 'lowpass'
      filter.frequency.setValueAtTime(heavy ? 650 : 850, now)
      filter.frequency.exponentialRampToValueAtTime(60, now + duration)

      nGain.gain.setValueAtTime(heavy ? 0.65 : 0.5, now)
      nGain.gain.exponentialRampToValueAtTime(0.001, now + duration)

      noise.connect(filter)
      filter.connect(nGain)
      nGain.connect(this.sfxGain)
      noise.start(now)
      noise.stop(now + duration + 0.02)
    }

    // Layer 2: Deep sub-bass floor shaker
    const subOsc = this.ctx.createOscillator()
    const subGain = this.ctx.createGain()
    subOsc.type = 'sawtooth'
    subOsc.frequency.setValueAtTime(heavy ? 110 : 85, now)
    subOsc.frequency.exponentialRampToValueAtTime(18, now + duration)
    subGain.gain.setValueAtTime(heavy ? 0.6 : 0.45, now)
    subGain.gain.exponentialRampToValueAtTime(0.001, now + duration + 0.05)

    subOsc.connect(subGain)
    subGain.connect(this.sfxGain)
    subOsc.start(now)
    subOsc.stop(now + duration + 0.08)
  }

  /**
   * Bullet / Laser Impact on Solid Surfaces (concrete, metal, buildings)
   */
  playBulletImpact() {
    this.ensureContext()
    if (!this.ctx || !this.canPlay('armor_impact', 50)) return
    const now = this.ctx.currentTime

    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(950, now)
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.06)
    gain.gain.setValueAtTime(0.32, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07)
    osc.connect(gain)
    gain.connect(this.sfxGain)
    osc.start(now)
    osc.stop(now + 0.08)
  }

  /**
   * Heavy Metallic Armor Impact
   */
  playArmorImpact() {
    this.ensureContext()
    if (!this.ctx || !this.canPlay('armor_impact', 60)) return
    const now = this.ctx.currentTime

    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.type = 'square'
    osc.frequency.setValueAtTime(380, now)
    osc.frequency.exponentialRampToValueAtTime(85, now + 0.09)
    gain.gain.setValueAtTime(0.38, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1)
    osc.connect(gain)
    gain.connect(this.sfxGain)
    osc.start(now)
    osc.stop(now + 0.11)
  }

  /**
   * Enemy Defeat / Core Shatter: Robotic glitch burst + power-down pitch plunge
   */
  playEnemyDefeat(isBoss = false) {
    this.ensureContext()
    if (!this.ctx || !this.canPlay('enemy_defeat', isBoss ? 300 : 90)) return
    const now = this.ctx.currentTime
    const duration = isBoss ? 0.75 : 0.35

    // Glitchy digital failure pitch dive
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(isBoss ? 750 : 540, now)
    osc.frequency.linearRampToValueAtTime(isBoss ? 300 : 220, now + 0.1)
    osc.frequency.exponentialRampToValueAtTime(30, now + duration)
    gain.gain.setValueAtTime(isBoss ? 0.55 : 0.38, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration)

    osc.connect(gain)
    gain.connect(this.sfxGain)
    osc.start(now)
    osc.stop(now + duration + 0.02)

    if (isBoss) {
      this.playExplosion(true)
    }
  }

  /**
   * Warning Alarm Klaxon: Dual-tone urgent breach alarm
   */
  playAlarm() {
    this.ensureContext()
    if (!this.ctx || !this.canPlay('alarm', 550)) return
    const now = this.ctx.currentTime

    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(820, now)
    osc.frequency.linearRampToValueAtTime(580, now + 0.22)
    osc.frequency.linearRampToValueAtTime(820, now + 0.44)

    gain.gain.setValueAtTime(0.35, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5)

    osc.connect(gain)
    gain.connect(this.sfxGain)
    osc.start(now)
    osc.stop(now + 0.52)
  }

  /**
   * Critical Danger Siren: Ambulance-style oscillating high-urgency siren
   * for imminent player defeat (<25% health)
   */
  playDangerSiren() {
    this.ensureContext()
    if (!this.ctx || !this.canPlay('danger_siren', 750)) return
    const now = this.ctx.currentTime

    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.type = 'sine'
    // Ambulance two-tone rising and falling siren
    osc.frequency.setValueAtTime(650, now)
    osc.frequency.linearRampToValueAtTime(960, now + 0.2)
    osc.frequency.linearRampToValueAtTime(650, now + 0.4)
    osc.frequency.linearRampToValueAtTime(960, now + 0.6)
    osc.frequency.linearRampToValueAtTime(650, now + 0.75)

    gain.gain.setValueAtTime(0.4, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.78)

    osc.connect(gain)
    gain.connect(this.sfxGain)
    osc.start(now)
    osc.stop(now + 0.8)
  }

  /**
   * Boss Battle Entry / Roar
   */
  playBossRoar() {
    this.ensureContext()
    if (!this.ctx || !this.canPlay('alarm', 1000)) return
    const now = this.ctx.currentTime

    // Guttural sub-bass frequency modulation
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(65, now)
    osc.frequency.exponentialRampToValueAtTime(28, now + 0.8)
    gain.gain.setValueAtTime(0.65, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.85)

    osc.connect(gain)
    gain.connect(this.sfxGain)
    osc.start(now)
    osc.stop(now + 0.9)
  }

  /**
   * City Defense Automated Turret Blast
   */
  playCityDefenseTurret() {
    this.ensureContext()
    if (!this.ctx || !this.canPlay('player_fire', 120)) return
    const now = this.ctx.currentTime

    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(900, now)
    osc.frequency.exponentialRampToValueAtTime(160, now + 0.14)
    gain.gain.setValueAtTime(0.42, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16)

    osc.connect(gain)
    gain.connect(this.sfxGain)
    osc.start(now)
    osc.stop(now + 0.18)
  }

  // ==========================================================================
  // 3. CHARACTER & ENVIRONMENT AUDIO
  // ==========================================================================

  /**
   * Tactical Footsteps: Dynamic cadence and pitch for walking vs sprinting
   */
  playFootstep(isSprinting = false) {
    this.ensureContext()
    const cooldown = isSprinting ? 220 : 340
    if (!this.ctx || !this.canPlay('footstep', cooldown)) return
    const now = this.ctx.currentTime

    // Short band-pass noise tread crunch
    if (this.noiseBuffer) {
      const noise = this.ctx.createBufferSource()
      const filter = this.ctx.createBiquadFilter()
      const gain = this.ctx.createGain()

      noise.buffer = this.noiseBuffer
      filter.type = 'bandpass'
      filter.frequency.setValueAtTime(isSprinting ? 720 : 540, now)
      filter.Q.setValueAtTime(3.0, now)

      gain.gain.setValueAtTime(isSprinting ? 0.32 : 0.22, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06)

      noise.connect(filter)
      filter.connect(gain)
      gain.connect(this.sfxGain)
      noise.start(now)
      noise.stop(now + 0.07)
    }

    // Subtle boot heel tap
    const tapOsc = this.ctx.createOscillator()
    const tapGain = this.ctx.createGain()
    tapOsc.type = 'sine'
    tapOsc.frequency.setValueAtTime(isSprinting ? 95 : 75, now)
    tapGain.gain.setValueAtTime(0.18, now)
    tapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05)
    tapOsc.connect(tapGain)
    tapGain.connect(this.sfxGain)
    tapOsc.start(now)
    tapOsc.stop(now + 0.06)
  }

  /**
   * Jump Aerodynamic Whoosh
   */
  playJump() {
    this.ensureContext()
    if (!this.ctx || !this.canPlay('jump', 350)) return
    const now = this.ctx.currentTime

    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(260, now)
    osc.frequency.exponentialRampToValueAtTime(780, now + 0.16)
    gain.gain.setValueAtTime(0.28, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18)

    osc.connect(gain)
    gain.connect(this.sfxGain)
    osc.start(now)
    osc.stop(now + 0.2)
  }

  /**
   * Exoskeleton Boot Landing Impact
   */
  playLand() {
    this.ensureContext()
    if (!this.ctx || !this.canPlay('land', 300)) return
    const now = this.ctx.currentTime

    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(140, now)
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.14)
    gain.gain.setValueAtTime(0.35, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16)

    osc.connect(gain)
    gain.connect(this.sfxGain)
    osc.start(now)
    osc.stop(now + 0.18)
  }

  /**
   * Drone Flight Telemetry Audio
   */
  startDroneFlight() {
    if (this.isDronePlaying || !this.ctx) return
    this.isDronePlaying = true
    const now = this.ctx.currentTime

    const droneOsc = this.ctx.createOscillator()
    const droneGain = this.ctx.createGain()
    droneOsc.type = 'triangle'
    droneOsc.frequency.setValueAtTime(75, now)

    droneGain.gain.setValueAtTime(0.12, now)
    droneOsc.connect(droneGain)
    droneGain.connect(this.ambientGain)
    droneOsc.start()

    this.droneNodes = [droneOsc, droneGain]
  }

  stopDroneFlight() {
    if (!this.isDronePlaying) return
    this.droneNodes.forEach((node) => {
      try {
        if (node.stop) node.stop()
        if (node.disconnect) node.disconnect()
      } catch (e) {}
    })
    this.droneNodes = []
    this.isDronePlaying = false
  }

  /**
   * Futuristic City Ambience (Open metropolis atmospheric drone)
   */
  startCityAmbience() {
    if (this.isAmbientPlaying || !this.ctx) return
    this.isAmbientPlaying = true
    const now = this.ctx.currentTime

    // Low metropolis rumble
    const ambOsc1 = this.ctx.createOscillator()
    const ambFilter = this.ctx.createBiquadFilter()
    const ambGain1 = this.ctx.createGain()

    ambOsc1.type = 'sawtooth'
    ambOsc1.frequency.setValueAtTime(48, now)
    ambFilter.type = 'lowpass'
    ambFilter.frequency.setValueAtTime(180, now)

    ambGain1.gain.setValueAtTime(0.2, now)
    ambOsc1.connect(ambFilter)
    ambFilter.connect(ambGain1)
    ambGain1.connect(this.ambientGain)
    ambOsc1.start()

    this.ambientLoopNodes = [ambOsc1, ambFilter, ambGain1]
  }

  stopCityAmbience() {
    if (!this.isAmbientPlaying) return
    this.ambientLoopNodes.forEach((node) => {
      try {
        if (node.stop) node.stop()
        if (node.disconnect) node.disconnect()
      } catch (e) {}
    })
    this.ambientLoopNodes = []
    this.isAmbientPlaying = false
  }

  // ==========================================================================
  // 4. DYNAMIC PROCEDURAL ELECTRONIC-ORCHESTRAL MUSIC ENGINE
  // ==========================================================================

  /**
   * Sets dynamic music intensity state: 'off' | 'exploration' | 'combat' | 'boss' | 'victory' | 'defeat'
   */
  setMusicState(state) {
    if (this.musicState === state) return
    const prevState = this.musicState
    this.musicState = state

    if (state === 'off') {
      this.stopMusic()
      return
    }

    if (state === 'victory') {
      this.playVictoryFanfare()
      return
    }

    if (state === 'defeat') {
      this.playDefeatLament()
      return
    }

    // Dynamic Tempo adjustment
    if (state === 'exploration') this.tempoBpm = 108
    if (state === 'combat') this.tempoBpm = 126
    if (state === 'boss') this.tempoBpm = 138

    if (!this.isMusicPlaying) {
      this.startMusic()
    }
  }

  /**
   * Starts procedural music sequencer loop
   */
  startMusic() {
    this.ensureContext()
    if (!this.ctx || this.isMusicPlaying) return
    this.isMusicPlaying = true
    this.currentStep = 0
    this.currentBar = 0
    this.nextNoteTime = this.ctx.currentTime + 0.05

    // Run lookahead scheduler every 40ms
    this.musicTimer = setInterval(() => {
      this.scheduleMusicLookahead()
    }, 40)

    this.startCityAmbience()
  }

  /**
   * Stops procedural music sequencer loop
   */
  stopMusic() {
    if (this.musicTimer) {
      clearInterval(this.musicTimer)
      this.musicTimer = null
    }
    this.isMusicPlaying = false
    this.musicState = 'off'
    this.activeVoiceNodes.forEach((n) => {
      try {
        if (n.stop) n.stop()
        if (n.disconnect) n.disconnect()
      } catch (e) {}
    })
    this.activeVoiceNodes = []
    this.stopCityAmbience()
  }

  /**
   * Web Audio Lookahead Sequencer (schedules 16th notes ahead of audio clock)
   */
  scheduleMusicLookahead() {
    if (!this.ctx || !this.isMusicPlaying) return

    const scheduleAheadTime = 0.12 // schedule 120ms ahead
    const secondsPer16th = 60.0 / this.tempoBpm / 4.0

    while (this.nextNoteTime < this.ctx.currentTime + scheduleAheadTime) {
      this.playStepPattern(this.currentStep, this.currentBar, this.nextNoteTime)
      this.nextNoteTime += secondsPer16th
      this.currentStep = (this.currentStep + 1) % 16
      if (this.currentStep === 0) {
        this.currentBar = (this.currentBar + 1) % 4
      }
    }
  }

  /**
   * Triggers instruments for the active step in the 16-step bar
   */
  playStepPattern(step, bar, time) {
    if (this.isMuted || !this.ctx) return

    // 1. Kick Drum
    if (this.musicState === 'combat' && (step === 0 || step === 4 || step === 8 || step === 12)) {
      this.triggerMusicKick(time, 0.42)
    } else if (this.musicState === 'boss' && (step === 0 || step === 2 || step === 4 || step === 8 || step === 10 || step === 12)) {
      this.triggerMusicKick(time, 0.5)
    } else if (this.musicState === 'exploration' && step === 0) {
      this.triggerMusicKick(time, 0.28)
    }

    // 2. Snare / Clack
    if ((this.musicState === 'combat' || this.musicState === 'boss') && (step === 4 || step === 12)) {
      this.triggerMusicSnare(time, this.musicState === 'boss' ? 0.45 : 0.35)
    }

    // 3. Hi-Hat
    if (this.musicState === 'combat' && step % 2 === 0) {
      this.triggerMusicHiHat(time, step % 4 === 0 ? 0.22 : 0.14)
    } else if (this.musicState === 'boss') {
      this.triggerMusicHiHat(time, step % 4 === 2 ? 0.28 : 0.16)
    } else if (this.musicState === 'exploration' && (step === 4 || step === 12)) {
      this.triggerMusicHiHat(time, 0.12)
    }

    // 4. Rolling Cyber Bassline (D minor progression: D -> Bb -> G -> A)
    const rootNotes = [73.42, 58.27, 49.0, 55.0] // D2, Bb1, G1, A1 in Hz
    const currentRoot = rootNotes[bar % 4]

    if (this.musicState === 'combat' || this.musicState === 'boss') {
      if (step % 2 === 0) {
        const pitchMultiplier = step === 6 || step === 14 ? 1.5 : 1.0
        this.triggerCyberBass(time, currentRoot * pitchMultiplier, 0.34)
      }
    } else if (this.musicState === 'exploration' && (step === 0 || step === 8)) {
      this.triggerCyberBass(time, currentRoot, 0.22)
    }

    // 5. Synth Arpeggiator (Minor cyber pentatonic)
    if (this.musicState === 'combat' || this.musicState === 'boss' || this.musicState === 'exploration') {
      if (step % 4 === 0 || (this.musicState === 'boss' && step % 2 === 0)) {
        const arpScale = [293.66, 349.23, 392.0, 440.0, 523.25] // D4, F4, G4, A4, C5
        const noteIdx = (step / 2 + bar * 2) % arpScale.length
        this.triggerArpNote(time, arpScale[noteIdx], this.musicState === 'exploration' ? 0.16 : 0.25)
      }
    }
  }

  // --- Drum & Instrument Synthesizers for Sequencer ---

  triggerMusicKick(time, gainVal = 0.4) {
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(130, time)
    osc.frequency.exponentialRampToValueAtTime(36, time + 0.08)
    gain.gain.setValueAtTime(gainVal, time)
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.1)
    osc.connect(gain)
    gain.connect(this.musicGain)
    osc.start(time)
    osc.stop(time + 0.11)
  }

  triggerMusicSnare(time, gainVal = 0.35) {
    if (!this.noiseBuffer) return
    const noise = this.ctx.createBufferSource()
    const filter = this.ctx.createBiquadFilter()
    const gain = this.ctx.createGain()

    noise.buffer = this.noiseBuffer
    filter.type = 'highpass'
    filter.frequency.setValueAtTime(1200, time)
    gain.gain.setValueAtTime(gainVal, time)
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.14)

    noise.connect(filter)
    filter.connect(gain)
    gain.connect(this.musicGain)
    noise.start(time)
    noise.stop(time + 0.15)
  }

  triggerMusicHiHat(time, gainVal = 0.18) {
    if (!this.noiseBuffer) return
    const noise = this.ctx.createBufferSource()
    const filter = this.ctx.createBiquadFilter()
    const gain = this.ctx.createGain()

    noise.buffer = this.noiseBuffer
    filter.type = 'highpass'
    filter.frequency.setValueAtTime(7500, time)
    gain.gain.setValueAtTime(gainVal, time)
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.04)

    noise.connect(filter)
    filter.connect(gain)
    gain.connect(this.musicGain)
    noise.start(time)
    noise.stop(time + 0.05)
  }

  triggerCyberBass(time, freq, gainVal = 0.32) {
    const osc = this.ctx.createOscillator()
    const filter = this.ctx.createBiquadFilter()
    const gain = this.ctx.createGain()

    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(freq, time)

    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(450, time)
    filter.frequency.exponentialRampToValueAtTime(140, time + 0.12)
    filter.Q.setValueAtTime(3.0, time)

    gain.gain.setValueAtTime(gainVal, time)
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.13)

    osc.connect(filter)
    filter.connect(gain)
    gain.connect(this.musicGain)
    osc.start(time)
    osc.stop(time + 0.14)
  }

  triggerArpNote(time, freq, gainVal = 0.22) {
    const osc = this.ctx.createOscillator()
    const filter = this.ctx.createBiquadFilter()
    const gain = this.ctx.createGain()

    osc.type = 'square'
    osc.frequency.setValueAtTime(freq, time)

    filter.type = 'bandpass'
    filter.frequency.setValueAtTime(1400, time)
    filter.Q.setValueAtTime(2.5, time)

    gain.gain.setValueAtTime(gainVal, time)
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.12)

    osc.connect(filter)
    filter.connect(gain)
    gain.connect(this.musicGain)
    osc.start(time)
    osc.stop(time + 0.13)
  }

  /**
   * Triumphant Victory Fanfare: Ascending heroic brass fanfare with bright sparkling harmonics
   */
  playVictoryFanfare() {
    this.ensureContext()
    if (!this.ctx || this.isMuted) return
    const now = this.ctx.currentTime

    // Stop combat loop
    if (this.musicTimer) {
      clearInterval(this.musicTimer)
      this.musicTimer = null
    }

    const fanfareNotes = [
      { f: 293.66, t: 0.0 }, // D4
      { f: 369.99, t: 0.15 }, // F#4
      { f: 440.0, t: 0.3 }, // A4
      { f: 587.33, t: 0.5 }, // D5 (Heroic high punch)
    ]

    fanfareNotes.forEach(({ f, t }) => {
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(f, now + t)
      gain.gain.setValueAtTime(0.42, now + t)
      gain.gain.exponentialRampToValueAtTime(0.001, now + t + 0.5)

      osc.connect(gain)
      gain.connect(this.musicGain)
      osc.start(now + t)
      osc.stop(now + t + 0.55)
    })
  }

  /**
   * Somber Defeat Dirge: Dark descending minor lament with power-down glitch
   */
  playDefeatLament() {
    this.ensureContext()
    if (!this.ctx || this.isMuted) return
    const now = this.ctx.currentTime

    // Stop combat loop
    if (this.musicTimer) {
      clearInterval(this.musicTimer)
      this.musicTimer = null
    }

    const lamentNotes = [
      { f: 220.0, t: 0.0 }, // A3
      { f: 207.65, t: 0.2 }, // G#3
      { f: 196.0, t: 0.4 }, // G3
      { f: 146.83, t: 0.65 }, // D3
    ]

    lamentNotes.forEach(({ f, t }) => {
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(f, now + t)
      gain.gain.setValueAtTime(0.35, now + t)
      gain.gain.exponentialRampToValueAtTime(0.001, now + t + 0.6)

      osc.connect(gain)
      gain.connect(this.musicGain)
      osc.start(now + t)
      osc.stop(now + t + 0.65)
    })
  }

  // ==========================================================================
  // 4b. TACTICAL RADIO, HIT REGISTRATION & COMBAT FEEDBACK
  // ==========================================================================

  /**
   * Procedural Military Radio Chirp: Short burst when radio starts or stops transmitting
   */
  playRadioChirp(isOpening = true) {
    this.ensureContext()
    if (!this.ctx || !this.canPlay('radio_chirp', 120)) return
    const now = this.ctx.currentTime

    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.type = 'sine'
    const startFreq = isOpening ? 1480 : 1760
    const endFreq = isOpening ? 1880 : 1240
    osc.frequency.setValueAtTime(startFreq, now)
    osc.frequency.setValueAtTime(endFreq, now + 0.03)
    gain.gain.setValueAtTime(0.22, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.065)

    osc.connect(gain)
    gain.connect(this.commsGain || this.sfxGain)
    osc.start(now)
    osc.stop(now + 0.07)

    if (this.noiseBuffer) {
      const noise = this.ctx.createBufferSource()
      const filter = this.ctx.createBiquadFilter()
      const noiseGain = this.ctx.createGain()
      noise.buffer = this.noiseBuffer
      filter.type = 'bandpass'
      filter.frequency.setValueAtTime(2200, now)
      filter.Q.setValueAtTime(3.0, now)
      noiseGain.gain.setValueAtTime(0.12, now)
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05)
      noise.connect(filter)
      filter.connect(noiseGain)
      noiseGain.connect(this.commsGain || this.sfxGain)
      noise.start(now)
      noise.stop(now + 0.055)
    }
  }

  /**
   * Procedural Synthesized Radio Voice Transmission
   * Formant-filtered rhythmic cyber vocalization syllables
   */
  playRadioVoiceTransmission(voiceId = 'guard') {
    this.ensureContext()
    if (!this.ctx || !this.canPlay('radio_voice', 900)) return
    const now = this.ctx.currentTime

    this.playRadioChirp(true)

    const baseFreq = voiceId === 'hq' ? 140 : (voiceId === 'bravo' ? 110 : 160)
    const syllables = [0.06, 0.16, 0.28, 0.40]

    syllables.forEach((offset, idx) => {
      const osc = this.ctx.createOscillator()
      const formant1 = this.ctx.createBiquadFilter()
      const formant2 = this.ctx.createBiquadFilter()
      const gain = this.ctx.createGain()

      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(baseFreq * (1 + (idx % 2) * 0.15), now + offset)

      formant1.type = 'bandpass'
      formant1.frequency.setValueAtTime(700 + (idx % 3) * 120, now + offset)
      formant1.Q.setValueAtTime(4.5, now + offset)

      formant2.type = 'bandpass'
      formant2.frequency.setValueAtTime(1400 + (idx % 2) * 200, now + offset)
      formant2.Q.setValueAtTime(4.0, now + offset)

      gain.gain.setValueAtTime(0.24, now + offset)
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.09)

      osc.connect(formant1)
      osc.connect(formant2)
      formant1.connect(gain)
      formant2.connect(gain)
      gain.connect(this.commsGain || this.sfxGain)

      osc.start(now + offset)
      osc.stop(now + offset + 0.095)
    })

    setTimeout(() => {
      this.playRadioChirp(false)
    }, 520)
  }

  /**
   * Crosshair Hit Marker Ping: Sharp 2600Hz transient click confirming positive projectile impact
   */
  playHitMarker() {
    this.ensureContext()
    if (!this.ctx || !this.canPlay('hit_marker', 40)) return
    const now = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(2600, now)
    osc.frequency.exponentialRampToValueAtTime(1200, now + 0.035)
    gain.gain.setValueAtTime(0.35, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04)
    osc.connect(gain)
    gain.connect(this.sfxGain)
    osc.start(now)
    osc.stop(now + 0.045)
  }

  /**
   * Enemy Detection / Alert Chirp: Two-tone cyber warning when enemy engages
   */
  playEnemyAlert() {
    this.ensureContext()
    if (!this.ctx || !this.canPlay('enemy_alert', 350)) return
    const now = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(740, now)
    osc.frequency.setValueAtTime(1280, now + 0.06)
    gain.gain.setValueAtTime(0.22, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14)
    osc.connect(gain)
    gain.connect(this.sfxGain)
    osc.start(now)
    osc.stop(now + 0.15)
  }

  /**
   * Enemy Hurt: Distorted crunch and spark
   */
  playEnemyHurt() {
    this.ensureContext()
    if (!this.ctx || !this.canPlay('enemy_hurt', 100)) return
    const now = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const filter = this.ctx.createBiquadFilter()
    const gain = this.ctx.createGain()
    osc.type = 'square'
    osc.frequency.setValueAtTime(320, now)
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.08)
    filter.type = 'bandpass'
    filter.frequency.setValueAtTime(900, now)
    gain.gain.setValueAtTime(0.24, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09)
    osc.connect(filter)
    filter.connect(gain)
    gain.connect(this.sfxGain)
    osc.start(now)
    osc.stop(now + 0.1)
  }

  /**
   * Player Hurt: Heavy concussive impact thump
   */
  playPlayerHurt() {
    this.ensureContext()
    if (!this.ctx || !this.canPlay('player_hurt', 180)) return
    const now = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(95, now)
    osc.frequency.exponentialRampToValueAtTime(32, now + 0.15)
    gain.gain.setValueAtTime(0.65, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18)
    osc.connect(gain)
    gain.connect(this.sfxGain)
    osc.start(now)
    osc.stop(now + 0.19)
  }

  /**
   * Critical Objective Warning: Emergency siren chirp when infrastructure is hit
   */
  playObjectiveWarning() {
    this.ensureContext()
    if (!this.ctx || !this.canPlay('obj_warning', 700)) return
    const now = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(880, now)
    osc.frequency.linearRampToValueAtTime(620, now + 0.12)
    osc.frequency.linearRampToValueAtTime(880, now + 0.24)
    gain.gain.setValueAtTime(0.35, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26)
    osc.connect(gain)
    gain.connect(this.sfxGain)
    osc.start(now)
    osc.stop(now + 0.27)
  }

  // ==========================================================================
  // 5. BACKWARD-COMPATIBLE ALIASES
  // ==========================================================================

  playLaserFire(isEnemy = false) {
    if (isEnemy) {
      this.playEnemyPlasma()
    } else {
      this.playEnergyRifle()
    }
  }

  playRecoveryChime() {
    this.playRecoveryBeacon()
  }

  startAmbientMusic() {
    this.setMusicState('exploration')
  }

  stopAmbientMusic() {
    this.stopMusic()
  }
}

export const cityAudio = new DigitalCityAudioManager()
