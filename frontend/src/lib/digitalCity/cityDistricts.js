/**
 * CyberShield Ethiopia — Digital City: Districts & Infrastructure Matrix
 *
 * Defines the 10 core districts of the futuristic Digital City,
 * their coordinates, bounds, visual identities, infrastructure targets,
 * and dynamic destruction/recovery states.
 *
 * Compliant with SR-09: 100% deterministic (zero Math.random).
 */

export const DISTRICT_IDS = [
  'central_command',
  'financial',
  'healthcare',
  'university',
  'government',
  'telecom',
  'industrial',
  'data_center',
  'residential',
  'underground',
]

/**
 * 8 Canonical Institutions & District Landmarks of Digital City:
 * A. Central Government District: Government administration HQ, central plaza, grand steps.
 * B. Security District: Police HQ, cybercrime investigation center, SOC, controlled security gates.
 * C. Healthcare District: Hospital building, emergency entrance, ambulance access, glowing medical cross signage (+).
 * D. Education District: University campus, academic blocks, research lab.
 * E. Financial District: Bank HQ, financial institution buildings, secure entrance, currency signage.
 * F. Telecommunications & Data District: Telecom HQ, communication spire tower 994 with antenna rings, sovereign cloud data center with server racks & cooling conduits.
 * G. Residential & Commercial District: Apartment buildings, shops, pedestrian spaces, streetlights.
 * H. Industrial & Energy District: Grand Renaissance power station, electrical substations, utility infrastructure.
 */
export const CANONICAL_CITY_LANDMARKS = [
  {
    id: 'landmark_central_gov',
    districtId: 'government',
    name: 'Central Government Administration HQ',
    category: 'A. Central Government District',
    icon: '🏛️',
    coords: { x: 0, z: -120 },
    features: ['Grand Steps', 'Neoclassical Cyber Colonnade', 'National Crest', 'Illuminated Dome'],
    importance: 'critical',
  },
  {
    id: 'landmark_security_soc',
    districtId: 'central_command',
    name: 'Federal Police HQ & Cybercrime SOC',
    category: 'B. Security District',
    icon: '🛡️',
    coords: { x: 0, z: 0 },
    features: ['Fortified Command Bastion', 'Rotating Defense Ring', 'Security Gatehouse', 'Emergency Strobes'],
    importance: 'critical',
  },
  {
    id: 'landmark_hospital',
    districtId: 'healthcare',
    name: 'Black Lion Digital Emergency Hospital',
    category: 'C. Healthcare District',
    icon: '🏥',
    coords: { x: -120, z: 0 },
    features: ['Glowing Medical Cross (+)', 'Ambulance Intake Ramp', 'Rooftop Helipad', 'Emergency Canopy'],
    importance: 'urgent',
  },
  {
    id: 'landmark_university',
    districtId: 'university',
    name: 'Addis Cyber Academy & University Campus',
    category: 'D. Education District',
    icon: '🎓',
    coords: { x: -120, z: 120 },
    features: ['Academic Portico', '6 Classical Cyber Pillars', 'Quantum Research Dome', 'Library Archive Rotunda'],
    importance: 'high',
  },
  {
    id: 'landmark_cbe_bank',
    districtId: 'financial',
    name: 'Commercial Bank of Ethiopia (CBE) Bank HQ',
    category: 'E. Financial District',
    icon: '🏦',
    coords: { x: 120, z: 0 },
    features: ['95m Banking Skyscraper', 'Currency Vault Doors', 'Stone-and-Glass Columns', 'Birr Signage (ETB ₿)'],
    importance: 'urgent',
  },
  {
    id: 'landmark_telecom_data',
    districtId: 'telecom',
    name: 'Ethio Telecom Tower 994 & Sovereign Data Center',
    category: 'F. Telecommunications & Data District',
    icon: '📶',
    coords: { x: 120, z: -120 },
    features: ['115m Cellular Spire 994', '3 Pulsating Antenna Rings', 'Sovereign Cloud Server Bunker', 'Cooling Conduit Fins'],
    importance: 'critical',
  },
  {
    id: 'landmark_residential',
    districtId: 'residential',
    name: 'Smart Residential & Commercial District',
    category: 'G. Residential & Commercial District',
    icon: '🏙️',
    coords: { x: -120, z: -120 },
    features: ['Smart Apartment High-Rises', 'Retail Shops & Cafes', 'Pedestrian Plaza', 'Cyber Streetlights'],
    importance: 'medium',
  },
  {
    id: 'landmark_power_grid',
    districtId: 'industrial',
    name: 'Grand Renaissance SCADA Power Station',
    category: 'H. Industrial & Energy District',
    icon: '⚡',
    coords: { x: 0, z: 120 },
    features: ['SCADA Power Station', 'Dual Cooling Towers', 'Step-up Transformers', 'High-Voltage Arc Conduits'],
    importance: 'urgent',
  },
]

export const DISTRICTS = [
  {
    id: 'central_command',
    nameKey: 'digital_city.district.central_command',
    defaultName: 'Central Command District',
    icon: '🏛️',
    color: '#00bbff',
    accentColor: '#38bdf8',
    bounds: { minX: -60, maxX: 60, minZ: -60, maxZ: 60 },
    center: { x: 0, z: 0 },
    importance: 'critical',
    skylineHeight: 85,
    infrastructure: [
      { id: 'cc_hq', name: 'Cyber Guard Command Citadel', type: 'hq', health: 100, maxHealth: 100, x: 0, z: 0, status: 'normal' },
      { id: 'cc_core', name: 'City Defense Holographic Core', type: 'core', health: 100, maxHealth: 100, x: 25, z: -20, status: 'normal' },
      { id: 'cc_relay', name: 'Command Broadcast Array', type: 'relay', health: 100, maxHealth: 100, x: -25, z: 20, status: 'normal' },
    ],
  },
  {
    id: 'financial',
    nameKey: 'digital_city.district.financial',
    defaultName: 'Financial District',
    icon: '🏦',
    color: '#ffb800',
    accentColor: '#facc15',
    bounds: { minX: 60, maxX: 180, minZ: -60, maxZ: 60 },
    center: { x: 120, z: 0 },
    importance: 'urgent',
    skylineHeight: 95,
    infrastructure: [
      { id: 'fin_cbe_vault', name: 'CBE Digital Vault & Core Banking', type: 'bank_vault', health: 100, maxHealth: 100, x: 120, z: 0, status: 'normal' },
      { id: 'fin_atm_switch', name: 'Interbank ATM Clearing Switch', type: 'atm_hub', health: 100, maxHealth: 100, x: 90, z: 30, status: 'normal' },
      { id: 'fin_exchange', name: 'National Digital Stock Exchange', type: 'exchange', health: 100, maxHealth: 100, x: 150, z: -30, status: 'normal' },
    ],
  },
  {
    id: 'healthcare',
    nameKey: 'digital_city.district.healthcare',
    defaultName: 'Healthcare District',
    icon: '🏥',
    color: '#00ff88',
    accentColor: '#34d399',
    bounds: { minX: -180, maxX: -60, minZ: -60, maxZ: 60 },
    center: { x: -120, z: 0 },
    importance: 'urgent',
    skylineHeight: 65,
    infrastructure: [
      { id: 'hc_hospital', name: 'Black Lion Digital Emergency Hospital', type: 'hospital', health: 100, maxHealth: 100, x: -120, z: 0, status: 'normal' },
      { id: 'hc_telemetry', name: 'Intensive Care Life-Support Hub', type: 'life_support', health: 100, maxHealth: 100, x: -90, z: -30, status: 'normal' },
      { id: 'hc_pharma', name: 'Medical Cold-Chain & Records Server', type: 'pharma_db', health: 100, maxHealth: 100, x: -150, z: 30, status: 'normal' },
    ],
  },
  {
    id: 'university',
    nameKey: 'digital_city.district.university',
    defaultName: 'University & Education District',
    icon: '🎓',
    color: '#a855f7',
    accentColor: '#c084fc',
    bounds: { minX: -180, maxX: -60, minZ: 60, maxZ: 180 },
    center: { x: -120, z: 120 },
    importance: 'high',
    skylineHeight: 55,
    infrastructure: [
      { id: 'uni_research', name: 'Addis Cyber Academy Research Node', type: 'research_lab', health: 100, maxHealth: 100, x: -120, z: 120, status: 'normal' },
      { id: 'uni_portal', name: 'Campus Student Digital Portal', type: 'edu_portal', health: 100, maxHealth: 100, x: -90, z: 150, status: 'normal' },
      { id: 'uni_library', name: 'National Digital Archive Library', type: 'library', health: 100, maxHealth: 100, x: -150, z: 90, status: 'normal' },
    ],
  },
  {
    id: 'government',
    nameKey: 'digital_city.district.government',
    defaultName: 'Government Systems District',
    icon: '⚖️',
    color: '#eab308',
    accentColor: '#fde047',
    bounds: { minX: -60, maxX: 60, minZ: -180, maxZ: -60 },
    center: { x: 0, z: -120 },
    importance: 'critical',
    skylineHeight: 80,
    infrastructure: [
      { id: 'gov_portal', name: 'National Citizen Identity Portal (Fayda)', type: 'identity_gateway', health: 100, maxHealth: 100, x: 0, z: -120, status: 'normal' },
      { id: 'gov_records', name: 'Federal Document Registry & Cloud', type: 'records_cloud', health: 100, maxHealth: 100, x: -30, z: -150, status: 'normal' },
      { id: 'gov_justice', name: 'Cyber Court & Justice Directorate', type: 'court_db', health: 100, maxHealth: 100, x: 30, z: -90, status: 'normal' },
    ],
  },
  {
    id: 'telecom',
    nameKey: 'digital_city.district.telecom',
    defaultName: 'Telecommunications District',
    icon: '📶',
    color: '#06b6d4',
    accentColor: '#22d3ee',
    bounds: { minX: 60, maxX: 180, minZ: -180, maxZ: -60 },
    center: { x: 120, z: -120 },
    importance: 'critical',
    skylineHeight: 110,
    infrastructure: [
      { id: 'tel_tower_994', name: 'Tower 994 Emergency Cellular Spire', type: 'spire_tower', health: 100, maxHealth: 100, x: 120, z: -120, status: 'normal' },
      { id: 'tel_fiber_hub', name: 'Cross-City Fiber Core Routing Switch', type: 'fiber_hub', health: 100, maxHealth: 100, x: 90, z: -90, status: 'normal' },
      { id: 'tel_sat_uplink', name: 'National Geosynchronous Uplink Station', type: 'satellite_uplink', health: 100, maxHealth: 100, x: 150, z: -150, status: 'normal' },
    ],
  },
  {
    id: 'industrial',
    nameKey: 'digital_city.district.industrial',
    defaultName: 'Industrial & Energy District',
    icon: '⚡',
    color: '#f97316',
    accentColor: '#fb923c',
    bounds: { minX: -60, maxX: 60, minZ: 60, maxZ: 180 },
    center: { x: 0, z: 120 },
    importance: 'urgent',
    skylineHeight: 60,
    infrastructure: [
      { id: 'ind_grid_substation', name: 'Grand Renaissance Grid Substation (SCADA)', type: 'scada_grid', health: 100, maxHealth: 100, x: 0, z: 120, status: 'normal' },
      { id: 'ind_water_plant', name: 'Municipal Clean Water PLC Facility', type: 'water_plc', health: 100, maxHealth: 100, x: -30, z: 150, status: 'normal' },
      { id: 'ind_solar_array', name: 'City Solar & Battery Storage Array', type: 'solar_storage', health: 100, maxHealth: 100, x: 30, z: 90, status: 'normal' },
    ],
  },
  {
    id: 'data_center',
    nameKey: 'digital_city.district.data_center',
    defaultName: 'Data Center District',
    icon: '🗄️',
    color: '#10b981',
    accentColor: '#6ee7b7',
    bounds: { minX: 60, maxX: 180, minZ: 60, maxZ: 180 },
    center: { x: 120, z: 120 },
    importance: 'critical',
    skylineHeight: 75,
    infrastructure: [
      { id: 'dc_sovereign_core', name: 'Ethiopian Sovereign Cloud Core (INSA)', type: 'cloud_core', health: 100, maxHealth: 100, x: 120, z: 120, status: 'normal' },
      { id: 'dc_backup_bunker', name: 'Immutable Air-Gapped Backup Vault', type: 'backup_vault', health: 100, maxHealth: 100, x: 150, z: 150, status: 'normal' },
      { id: 'dc_coolant_loop', name: 'Cryogenic Server Coolant Facility', type: 'cooling_station', health: 100, maxHealth: 100, x: 90, z: 90, status: 'normal' },
    ],
  },
  {
    id: 'residential',
    nameKey: 'digital_city.district.residential',
    defaultName: 'Residential Smart District',
    icon: '🏙️',
    color: '#ec4899',
    accentColor: '#f472b6',
    bounds: { minX: -180, maxX: -60, minZ: -180, maxZ: -60 },
    center: { x: -120, z: -120 },
    importance: 'medium',
    skylineHeight: 70,
    infrastructure: [
      { id: 'res_iot_mesh', name: 'Citizen Smart Home IoT Mesh Router', type: 'iot_mesh', health: 100, maxHealth: 100, x: -120, z: -120, status: 'normal' },
      { id: 'res_public_wifi', name: 'Public Free Cyber-Safe Wi-Fi Hub', type: 'public_wifi', health: 100, maxHealth: 100, x: -150, z: -90, status: 'normal' },
      { id: 'res_substation', name: 'Community Smart Metering Station', type: 'smart_meter', health: 100, maxHealth: 100, x: -90, z: -150, status: 'normal' },
    ],
  },
  {
    id: 'underground',
    nameKey: 'digital_city.district.underground',
    defaultName: 'Underground Network District',
    icon: '🚇',
    color: '#8b5cf6',
    accentColor: '#a78bfa',
    bounds: { minX: -40, maxX: 40, minZ: -40, maxZ: 40, underground: true },
    center: { x: 0, z: 0, y: -15 },
    importance: 'high',
    skylineHeight: 20,
    infrastructure: [
      { id: 'ug_dark_fiber', name: 'Sub-City Dark Fiber Trunk Line', type: 'dark_fiber', health: 100, maxHealth: 100, x: 0, z: 0, y: -15, status: 'normal' },
      { id: 'ug_repeater_alpha', name: 'Optical Repeater Terminal Alpha', type: 'repeater', health: 100, maxHealth: 100, x: -20, z: 15, y: -15, status: 'normal' },
      { id: 'ug_quantum_node', name: 'Quantum Key Distribution Node (QKD)', type: 'qkd_node', health: 100, maxHealth: 100, x: 20, z: -15, y: -15, status: 'normal' },
    ],
  },
]

// Deterministic seed PRNG (Mulberry32) - zero Math.random (SR-09)
export function createDeterministicPrng(seed = 1337) {
  let s = Math.abs(seed | 0) + 1
  return function () {
    s |= 0
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Procedural Building Layout Generator for Digital City
 * Generates an array of buildings with positions, dimensions, and district assignments.
 */
export function generateCityBuildingLayout(seed = 20261030) {
  const prng = createDeterministicPrng(seed)
  const buildings = []

  // Create grid of blocks across -180 to +180 on X and Z
  const blockSize = 32
  const streetWidth = 10
  const stride = blockSize + streetWidth // 42m

  for (let x = -160; x <= 160; x += stride) {
    for (let z = -160; z <= 160; z += stride) {
      // Keep central plaza open for Central Command Citadel
      if (Math.abs(x) < 25 && Math.abs(z) < 25) {
        continue
      }

      // Determine district by location
      const district = getDistrictByCoordinates(x, z)
      const baseHeight = district ? district.skylineHeight : 50

      // Subdivide each block into 2-4 varied buildings
      const numVariants = 1 + Math.floor(prng() * 3)
      for (let v = 0; v < numVariants; v++) {
        const width = 10 + prng() * 12
        const depth = 10 + prng() * 12
        const offsetX = (prng() - 0.5) * (blockSize - width)
        const offsetZ = (prng() - 0.5) * (blockSize - depth)
        const height = 20 + prng() * baseHeight

        const buildingId = `bld_${x}_${z}_${v}`
        buildings.push({
          id: buildingId,
          districtId: district ? district.id : 'central_command',
          x: x + offsetX,
          z: z + offsetZ,
          width,
          depth,
          height,
          color: district ? district.color : '#00bbff',
          accentColor: district ? district.accentColor : '#38bdf8',
          hasRooftopAntenna: prng() > 0.6,
          neonSign: prng() > 0.45 ? getBuildingNeonSign(district ? district.id : '', prng) : null,
          hasHoloBillboard: prng() > 0.7,
        })
      }
    }
  }

  return buildings
}

function getBuildingNeonSign(districtId, prng) {
  const signs = {
    financial: ['CBE CYBER VAULT', 'BIRR EXCHANGE', 'TELEBIRR PAY', 'FINANCE SECURE'],
    healthcare: ['DIGITAL ER 24/7', 'BIO-DEFENSE', 'MED-CLOUD', 'LIFE PULSE'],
    telecom: ['ETHIO TELECOM 994', '5G FIBER CORE', 'SATELLITE NET', 'TELECOM SEC'],
    university: ['CYBER ACADEMY', 'ETHIOPIA AI LAB', 'QUANTUM DEPT', 'RESEARCH NODE'],
    data_center: ['SOVEREIGN CLOUD', 'INSA DATA DOME', 'TERABIT BACKBONE', 'SECURE HOST'],
    industrial: ['SCADA POWER', 'HYDRO TURBINE', 'GRID CONTROLLER', 'SOLAR ARRAY'],
    government: ['FAYDA ID CLOUD', 'JUSTICE NETWORK', 'PUBLIC RECORDS', 'ETHIO GOV'],
    central_command: ['DEFENSE CITADEL', 'CYBER GUARD HQ', 'SHIELD MATRIX', 'SECTOR 01'],
    residential: ['SMART APTS', 'NEON PLAZA', 'CYBER BISTRO', 'CITIZEN MESH'],
    underground: ['DARK FIBER', 'OPTICAL TRUNK', 'TUNNEL RELAY', 'SUB-NET'],
  }
  const list = signs[districtId] || ['CYBERSHIELD', 'DEFENSE NODE', 'FIREWALL ACTIVE']
  const index = Math.floor(prng() * list.length)
  return list[index]
}

export function getDistrictByCoordinates(x, z) {
  for (const dist of DISTRICTS) {
    if (x >= dist.bounds.minX && x <= dist.bounds.maxX && z >= dist.bounds.minZ && z <= dist.bounds.maxZ) {
      return dist
    }
  }
  return DISTRICTS[0] // fallback to Central Command
}

/**
 * Returns solid AABB collision obstacles for the entire city
 */
export function getCityCollisionBoxes(buildings) {
  return buildings.map((b) => ({
    id: b.id,
    minX: b.x - b.width / 2,
    maxX: b.x + b.width / 2,
    minZ: b.z - b.depth / 2,
    maxZ: b.z + b.depth / 2,
    height: b.height,
  }))
}

/**
 * 16 Canonical Environmental Tactical Cover Barricades & Fortifications
 * Concrete Jersey barriers, sandbag revetments, and cyber shield barriers.
 */
export const CANONICAL_CITY_COVER_POINTS = [
  // Grand Avenue (North-South, X = 0)
  { id: 'cover_grand_n1', x: -4, z: -30, width: 3.5, depth: 0.8, height: 1.2, type: 'jersey_barrier', protectionRating: 0.85 },
  { id: 'cover_grand_n2', x: 4, z: -45, width: 3.5, depth: 0.8, height: 1.2, type: 'jersey_barrier', protectionRating: 0.85 },
  { id: 'cover_grand_s1', x: -4, z: 30, width: 3.5, depth: 0.8, height: 1.2, type: 'jersey_barrier', protectionRating: 0.85 },
  { id: 'cover_grand_s2', x: 4, z: 45, width: 3.5, depth: 0.8, height: 1.2, type: 'jersey_barrier', protectionRating: 0.85 },

  // Federal Boulevard (East-West, Z = 0)
  { id: 'cover_fed_w1', x: -30, z: -4, width: 0.8, depth: 3.5, height: 1.2, type: 'jersey_barrier', protectionRating: 0.85 },
  { id: 'cover_fed_w2', x: -50, z: 4, width: 0.8, depth: 3.5, height: 1.2, type: 'jersey_barrier', protectionRating: 0.85 },
  { id: 'cover_fed_e1', x: 30, z: -4, width: 0.8, depth: 3.5, height: 1.2, type: 'jersey_barrier', protectionRating: 0.85 },
  { id: 'cover_fed_e2', x: 50, z: 4, width: 0.8, depth: 3.5, height: 1.2, type: 'jersey_barrier', protectionRating: 0.85 },

  // Federal Police SOC Security Perimeter
  { id: 'cover_soc_l', x: -7, z: -10, width: 4.0, depth: 1.0, height: 1.3, type: 'sandbag_bunker', protectionRating: 0.90 },
  { id: 'cover_soc_r', x: 7, z: -10, width: 4.0, depth: 1.0, height: 1.3, type: 'sandbag_bunker', protectionRating: 0.90 },

  // Black Lion Hospital Emergency Bay
  { id: 'cover_hosp_l', x: -112, z: 10, width: 3.5, depth: 0.8, height: 1.2, type: 'jersey_barrier', protectionRating: 0.85 },
  { id: 'cover_hosp_r', x: -128, z: 10, width: 3.5, depth: 0.8, height: 1.2, type: 'jersey_barrier', protectionRating: 0.85 },

  // CBE Bank HQ Vault Entrance
  { id: 'cover_bank_1', x: 112, z: 10, width: 3.5, depth: 0.8, height: 1.2, type: 'jersey_barrier', protectionRating: 0.85 },
  { id: 'cover_bank_2', x: 128, z: 10, width: 3.5, depth: 0.8, height: 1.2, type: 'jersey_barrier', protectionRating: 0.85 },

  // Sovereign Data Center & GERD Power Station Gates
  { id: 'cover_dc_gate', x: 120, z: 105, width: 5.0, depth: 1.0, height: 1.3, type: 'cyber_shield_barrier', protectionRating: 0.95 },
  { id: 'cover_power_gate', x: 0, z: 105, width: 5.0, depth: 1.0, height: 1.3, type: 'sandbag_bunker', protectionRating: 0.90 },
]

/**
 * Finds the nearest tactical cover point to a world position
 */
export function findNearestCoverPoint(x, z, maxDistance = 35) {
  let nearest = null
  let minD = maxDistance
  for (const c of CANONICAL_CITY_COVER_POINTS) {
    const d = Math.hypot(c.x - x, c.z - z)
    if (d < minD) {
      minD = d
      nearest = c
    }
  }
  return nearest
}

/**
 * Checks line of sight between two 2D points against city obstacle AABBs.
 * Returns true if direct unobstructed vision exists, false if blocked by a building.
 */
export function hasLineOfSight(x1, z1, x2, z2, obstacles = []) {
  if (!obstacles || obstacles.length === 0) return true
  const dx = x2 - x1
  const dz = z2 - z1
  const dist = Math.hypot(dx, dz)
  if (dist < 0.05) return true

  for (const box of obstacles) {
    if (box.minX === undefined || box.maxX === undefined || box.minZ === undefined || box.maxZ === undefined) continue

    // Slab intersection test along segment t in [0, 1]
    let tmin = 0.0
    let tmax = 1.0

    if (Math.abs(dx) > 1e-6) {
      let t1 = (box.minX - x1) / dx
      let t2 = (box.maxX - x1) / dx
      if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp }
      tmin = Math.max(tmin, t1)
      tmax = Math.min(tmax, t2)
      if (tmin > tmax) continue
    } else if (x1 < box.minX || x1 > box.maxX) {
      continue
    }

    if (Math.abs(dz) > 1e-6) {
      let t1 = (box.minZ - z1) / dz
      let t2 = (box.maxZ - z1) / dz
      if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp }
      tmin = Math.max(tmin, t1)
      tmax = Math.min(tmax, t2)
      if (tmin > tmax) continue
    } else if (z1 < box.minZ || z1 > box.maxZ) {
      continue
    }

    // Ray intersects box within [0.05, 0.95] of the segment -> blocked
    if (tmin <= tmax && tmax > 0.05 && tmin < 0.95) {
      return false
    }
  }

  return true
}


