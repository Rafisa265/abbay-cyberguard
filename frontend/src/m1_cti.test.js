import { describe, it, expect, vi, beforeEach } from 'vitest'
import { checkM1Cti, getM1CtiStatus } from './lib/api.js'
import { analyze } from './lib/m1.js'

describe('M1 CTI & Heuristics Integration Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    if (typeof globalThis.window === 'undefined') {
      globalThis.window = globalThis
    }
  })

  it('runs local heuristics strictly offline for valid and invalid inputs', () => {
    const resClean = analyze('https://example.com/')
    expect(resClean.level).toBe('none')
    expect(resClean.indicators).toEqual([])

    const resSuspicious = analyze('http://192.168.1.1/login')
    expect(resSuspicious.level).toBe('high')
    expect(resSuspicious.indicators).toContain('IND-01')
    expect(resSuspicious.indicators).toContain('IND-05')
    expect(resSuspicious.indicators).toContain('IND-07')

    const resInvalid = analyze('javascript:alert(1)')
    expect(resInvalid.error).toBe('scheme')
  })

  it('checkM1Cti returns known_malicious response when provider detects matching threat', async () => {
    globalThis.window.fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({
        url: 'http://malware.testing.cybershield.et/',
        canonical_url: 'http://malware.testing.cybershield.et/',
        cti: {
          provider: 'google_safe_browsing_v5',
          status: 'known_malicious',
          threat_types: ['MALWARE', 'SOCIAL_ENGINEERING'],
          details: 'Threat intelligence match found: MALWARE, SOCIAL_ENGINEERING',
          unavailable_reason: null,
          source: 'cti_provider',
        },
      }),
    })

    const result = await checkM1Cti('http://malware.testing.cybershield.et/')
    expect(result.cti.status).toBe('known_malicious')
    expect(result.cti.threat_types).toEqual(['MALWARE', 'SOCIAL_ENGINEERING'])
    expect(result.cti.source).toBe('cti_provider')
  })

  it('checkM1Cti returns no_threat_found for clean URLs', async () => {
    globalThis.window.fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({
        url: 'https://clean.example.com/',
        canonical_url: 'https://clean.example.com/',
        cti: {
          provider: 'google_safe_browsing_v5',
          status: 'no_threat_found',
          threat_types: [],
          details: 'No matching threat found in provider database.',
          unavailable_reason: null,
          source: 'cti_provider',
        },
      }),
    })

    const result = await checkM1Cti('https://clean.example.com/')
    expect(result.cti.status).toBe('no_threat_found')
    expect(result.cti.threat_types).toEqual([])
    expect(result.cti.unavailable_reason).toBeNull()
  })

  it('checkM1Cti handles server error gracefully without throwing', async () => {
    globalThis.window.fetch = vi.fn().mockResolvedValue({
      status: 500,
      ok: false,
      json: async () => ({ error: { code: 'INTERNAL_ERROR' } }),
    })

    const result = await checkM1Cti('https://example.com/')
    expect(result.cti.status).toBe('unavailable')
    expect(result.cti.unavailable_reason).toBe('PROVIDER_ERROR')
  })

  it('checkM1Cti handles network exceptions gracefully without throwing', async () => {
    globalThis.window.fetch = vi.fn().mockRejectedValue(new Error('Network offline'))

    const result = await checkM1Cti('https://example.com/')
    expect(result.cti.status).toBe('unavailable')
    expect(result.cti.unavailable_reason).toBe('NETWORK_ERROR')
  })

  it('getM1CtiStatus retrieves provider metadata without leaking secret keys', async () => {
    globalThis.window.fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({
        provider: 'google_safe_browsing_v5',
        configured: false,
        educational_prototype: true,
        commercial_alternative: 'google_web_risk',
      }),
    })

    const status = await getM1CtiStatus()
    expect(status.provider).toBe('google_safe_browsing_v5')
    expect(status.educational_prototype).toBe(true)
    expect(status.commercial_alternative).toBe('google_web_risk')
    expect(status.api_key).toBeUndefined()
  })

  it('handles local_feed response with local_database source and timestamps', async () => {
    globalThis.window.fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({
        url: 'https://threat.test/login',
        canonical_url: 'https://threat.test/login',
        cti: {
          provider: 'local_feed',
          status: 'known_malicious',
          threat_types: ['SOCIAL_ENGINEERING'],
          details: 'Threat intelligence match found in local feed: SOCIAL_ENGINEERING',
          unavailable_reason: null,
          source: 'local_database',
          checked_at: '2026-10-23T07:15:00Z',
          feed_updated_at: '2026-10-23T06:00:00Z',
        },
      }),
    })

    const result = await checkM1Cti('https://threat.test/login')
    expect(result.cti.provider).toBe('local_feed')
    expect(result.cti.source).toBe('local_database')
    expect(result.cti.status).toBe('known_malicious')
    expect(result.cti.threat_types).toEqual(['SOCIAL_ENGINEERING'])
    expect(result.cti.checked_at).toBe('2026-10-23T07:15:00Z')
    expect(result.cti.feed_updated_at).toBe('2026-10-23T06:00:00Z')
  })

  it('preserves local heuristic evaluation even if CTI check fails or is unavailable', async () => {
    // 1. Local heuristic analysis computes suspicious score
    const heuristicRes = analyze('http://192.168.1.1/login')
    expect(heuristicRes.level).toBe('high')
    expect(heuristicRes.score).toBeGreaterThanOrEqual(40)

    // 2. CTI lookup fails with network exception
    globalThis.window.fetch = vi.fn().mockRejectedValue(new Error('Network disconnected'))
    const ctiRes = await checkM1Cti('http://192.168.1.1/login')
    expect(ctiRes.cti.status).toBe('unavailable')

    // 3. Heuristic result remains completely valid and un-degraded
    expect(heuristicRes.level).toBe('high')
  })

  it('verifies trilingual parity for all CTI keys in English, Afaan Oromoo, and Amharic', async () => {
    const en = (await import('./locales/en.js')).default
    const om = (await import('./locales/om.js')).default
    const am = (await import('./locales/am.js')).default

    const requiredKeys = [
      'm1.cti_privacy_notice',
      'm1.cti_toggle_label',
      'm1.cti_source_local',
      'm1.cti_source_provider',
      'm1.cti_source_local_feed',
      'm1.cti_status_malicious',
      'm1.cti_status_clean',
      'm1.cti_status_unavailable',
      'm1.cti_reason_config',
      'm1.cti_reason_timeout',
      'm1.cti_reason_rate_limit',
      'm1.cti_reason_network',
      'm1.cti_reason_feed_missing',
      'm1.cti_reason_feed_empty',
      'm1.cti_reason_feed_malformed',
      'm1.cti_reason_feed_unreadable',
      'm1.cti_checked_at',
      'm1.cti_feed_updated',
      'm1.cti_status_not_requested',
      'm1.score_rule_note',
      'm1.heur_offline',
      'm1.heur_online',
      'm1.verdict_title',
      'm1.verdict_doc_ip',
      'm1.verdict_doc_ip_desc',
      'm1.verdict_cti_threat',
      'm1.verdict_cti_threat_desc',
      'm1.verdict_cti_clean_flagged',
      'm1.verdict_cti_clean_flagged_desc',
      'm1.verdict_cti_clean',
      'm1.verdict_cti_clean_desc',
      'm1.verdict_cti_unavail_flagged',
      'm1.verdict_cti_unavail_flagged_desc',
      'm1.verdict_cti_unavail_clean',
      'm1.verdict_cti_unavail_clean_desc',
      'm1.verdict_offline_high',
      'm1.verdict_offline_caution',
      'm1.verdict_offline_none',
      'm1.rec_malicious',
      'm1.rec_doc',
      'm1.scope_title',
      'm1.scope_heur',
      'm1.scope_cti_queried',
      'm1.scope_cti_off_item',
      'm1.scope_cti_unavail_item',
      'm1.scope_no_fetch',
      'm1.doc_fixture_tag',
      'm1.doc_fixture_status',
      'm1.doc_found',
    ]

    for (const key of requiredKeys) {
      expect(en[key], `Missing EN key: ${key}`).toBeTruthy()
      expect(om[key], `Missing OM key: ${key}`).toBeTruthy()
      expect(am[key], `Missing AM key: ${key}`).toBeTruthy()
      expect(en[key].trim().length).toBeGreaterThan(0)
      expect(om[key].trim().length).toBeGreaterThan(0)
      expect(am[key].trim().length).toBeGreaterThan(0)
    }
  })

  it('guarantees online CTI clean does not erase local heuristic findings', async () => {
    // URL with IP host and HTTP scheme
    const url = 'http://192.168.1.1/login'
    const heur = analyze(url)
    expect(heur.level).toBe('high')
    expect(heur.indicators.length).toBeGreaterThanOrEqual(2)

    // CTI returns clean (no known threat in database)
    globalThis.window.fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({
        url,
        canonical_url: url,
        cti: {
          provider: 'google_safe_browsing_v5',
          status: 'no_threat_found',
          threat_types: [],
          details: 'No matching threat found in provider database.',
          unavailable_reason: null,
          source: 'cti_provider',
        },
      }),
    })

    const ctiRes = await checkM1Cti(url)
    expect(ctiRes.cti.status).toBe('no_threat_found')

    // Local indicators remain present and intact
    expect(heur.indicators).toContain('IND-01')
    expect(heur.indicators).toContain('IND-05')
    expect(heur.level).toBe('high')
  })

  it('treats heuristic score as additive rule points rather than a probability of malice', () => {
    const res = analyze('http://192.0.2.10:8080/account/update')
    expect(res.score).toBeGreaterThanOrEqual(40)
    expect(typeof res.score).toBe('number')
    // Score is not a percentage probability: it is rule-weight based up to 100
    expect(res.score).toBeLessThanOrEqual(100)
    expect(res.isDocAddress).toBe(true)
  })

  it('accurately distinguishes all 5 CTI states without false claims', async () => {
    // 1. Online CTI completed and a known threat was returned
    globalThis.window.fetch = vi.fn().mockResolvedValueOnce({
      status: 200,
      ok: true,
      json: async () => ({
        url: 'http://evil.example/',
        cti: { provider: 'google_safe_browsing_v5', status: 'known_malicious', threat_types: ['MALWARE'] },
      }),
    })
    const state1 = await checkM1Cti('http://evil.example/')
    expect(state1.cti.status).toBe('known_malicious')

    // 2. Online CTI completed and no known threat was returned
    globalThis.window.fetch = vi.fn().mockResolvedValueOnce({
      status: 200,
      ok: true,
      json: async () => ({
        url: 'https://clean.example/',
        cti: { provider: 'google_safe_browsing_v5', status: 'no_threat_found', threat_types: [] },
      }),
    })
    const state2 = await checkM1Cti('https://clean.example/')
    expect(state2.cti.status).toBe('no_threat_found')

    // 3. Online CTI disabled / not requested
    // (In component, onlineCtiEnabled === false => no fetch initiated)
    const fetchSpy = vi.fn()
    globalThis.window.fetch = fetchSpy
    const offlineScan = analyze('https://ethiopia.gov.et/')
    expect(offlineScan.error).toBeUndefined()
    expect(fetchSpy).not.toHaveBeenCalled()

    // 4. Online CTI failed or unavailable (provider timeout/network error)
    globalThis.window.fetch = vi.fn().mockRejectedValueOnce(new Error('Gateway timeout'))
    const state4 = await checkM1Cti('https://timeout.example/')
    expect(state4.cti.status).toBe('unavailable')
    expect(state4.cti.unavailable_reason).toBe('NETWORK_ERROR')

    // 5. Offline analysis completed independently
    expect(offlineScan.level).toBe('none')
    expect(offlineScan.score).toBe(0)
  })

  it('verifies refined, natural Afaan Oromoo terminology without awkward machine translations', async () => {
    const om = (await import('./locales/om.js')).default

    // Awkward machine-translated phrases must be completely eliminated
    expect(om['m1.cti_source_local']).not.toContain('Isteeshinii')
    expect(om['m1.cti_source_provider']).not.toBe('Dhiyeessaa Odeeffannoo Balaa (Aalaa)')

    // Refined, natural terminology must be present
    expect(om['m1.cti_source_local']).toBe("Sakatta'iinsa Hewuristiksii Naannoo (Toora-Alaa)")
    expect(om['m1.cti_source_provider']).toBe('Beekumsa Balaa Toora Interneetii (Google Safe Browsing)')
    expect(om['m1.score_label']).toBe('Qabxii Balaa Hewuristiksii')
    expect(om['m1.doc_fixture_tag']).toBe('Fakkeenya Barnootaa')
    expect(om['m1.doc_fixture_status']).toBe("Teessoo Qorannoo Kan Qophaa'e (Interneetiitti Hin Geessu)")
    expect(om['m1.doc_found']).toBe("Mallattoolee Hewuristiksii Barnootaaf Mul'atan")
  })

  it('communicates practical cybersecurity assistance rather than discouraging disclaimers (User Review)', async () => {
    const en = (await import('./locales/en.js')).default
    const om = (await import('./locales/om.js')).default
    const am = (await import('./locales/am.js')).default

    // Old discouraging banner text is replaced
    expect(om['app.notice']).not.toBe("CyberShield meeshaa gargaarsaa fi barnootaati. Nageenya hin mirkaneessu; qorannoo ogeessaa bakka hin bu’u.")
    
    // New practical cybersecurity assistance copy
    expect(om['app.notice']).toBe("ABBAY CYBERGUARD balaa dijitaalaa adda baasuuf, geessituuwwan shakkisiisoo qorachuuf, nageenya jecha icciitii cimsachuuf, fi tarkaanfii of-eeggannoo sirrii fudhachuuf si gargaara.")
    expect(en['app.notice']).toContain("assists you in identifying digital threats")
    expect(am['app.notice']).toContain("የዲጂታል አደጋዎችን ለመለየት")

    // Relocated secondary calm accuracy limitations
    expect(en['app.safety_note']).toBeTruthy()
    expect(om['app.safety_note']).toBeTruthy()
    expect(am['app.safety_note']).toBeTruthy()

    // Google Safe Browsing does not claim "for education only"
    expect(en['m1.cti_commercial_notice']).not.toContain("for non-commercial educational use")
    expect(om['m1.cti_commercial_notice']).not.toContain("tajaajila barnootaa qofaaf")

    // Recommendations advise navigating to verified official sites directly
    expect(en['m1.rec_high']).toContain("verified official website directly")
    expect(om['m1.rec_high']).toContain("marsariitii seera-qabeessaa beekamaatti deemaa")

    // Documentation fixture copy is non-alarmist and precise
    expect(en['m1.rec_doc']).toContain("cautionary warning indicators rather than proof of malice")
    expect(om['m1.rec_doc']).toContain("akeekkachiisa of-eeggannoo ta'u malee ragaa guutuu miti")
  })
})
