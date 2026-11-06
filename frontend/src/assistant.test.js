import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { renderToString } from 'react-dom/server'
import Assistant, {
  normalizeMarkdownEscapes,
  parseInlineMarkdown,
  FormattedMessage,
  resolveModuleShortcut,
  getContextConfig,
} from './components/Assistant.jsx'
import M1 from './components/M1.jsx'
import M2 from './components/M2.jsx'
import M3 from './components/M3.jsx'
import M4 from './components/M4.jsx'
import Learn from './components/Learn.jsx'
import Journey from './components/Journey.jsx'
import { getJourneyProgress } from './lib/journey.js'
import {
  generateLocalAssistantResponse,
  sanitizeInput,
  detectLanguage,
  findMatchingEntry,
  isStayOfflineIntent,
  isExploreLearnIntent,
  isEmergencyContactsIntent,
  STATUS_ANSWERED_OFFLINE,
  STATUS_OFFLINE_INSUFFICIENT,
  STATUS_NEEDS_CLARIFICATION,
  KNOWLEDGE_ENTRIES,
} from './lib/assistantKnowledge.js'
import en from './locales/en.js'
import om from './locales/om.js'
import am from './locales/am.js'

describe('CyberShield Conversational AI Assistant — Offline Logic & Trilingual Parity', () => {
  it('1. Knowledge Base Integrity: covers 11 required topics with trilingual content', () => {
    expect(KNOWLEDGE_ENTRIES.length).toBeGreaterThanOrEqual(11)
    for (const entry of KNOWLEDGE_ENTRIES) {
      expect(entry.id).toBeTruthy()
      expect(entry.title.en).toBeTruthy()
      expect(entry.title.om).toBeTruthy()
      expect(entry.title.am).toBeTruthy()
      expect(entry.summary.en).toBeTruthy()
      expect(entry.summary.om).toBeTruthy()
      expect(entry.summary.am).toBeTruthy()
      expect(entry.details.en).toBeTruthy()
      expect(entry.nextSteps.en).toBeTruthy()
    }
  })

  it('2. Fully Answerable Offline Question receives offline response without online recommendation', () => {
    const res = generateLocalAssistantResponse({ message: 'What is phishing?', language: 'en' })
    expect(res.status).toBe(STATUS_ANSWERED_OFFLINE)
    expect(res.onlineRecommended).toBe(false)
    expect(res.matchedTopic).toBe('phishing_basics')
    expect(res.reply.toLowerCase()).toContain('phishing')
  })

  it('3. Insufficient / External Real-time Query recommends online AI', () => {
    const res = generateLocalAssistantResponse({
      message: 'Compare current campaigns from today with recent evidence',
      language: 'en',
    })
    expect(res.status).toBe(STATUS_OFFLINE_INSUFFICIENT)
    expect(res.onlineRecommended).toBe(true)
    expect(res.reply.toLowerCase()).toContain('offline')
  })

  it('4. Sensitive Credential Sanitization: scrubs passwords and issues warning', () => {
    const raw = 'My password is SuperSecretPassword123! How can I make it safe?'
    const { cleaned, warning } = sanitizeInput(raw, 'en')
    expect(cleaned).not.toContain('SuperSecretPassword123!')
    expect(cleaned).toContain('[REDACTED_FOR_SECURITY]')
    expect(warning).toBeTruthy()
    expect(warning.toLowerCase()).toContain('never enter passwords')
  })

  it('5. Follow-up Question Uses Conversation Context', () => {
    const context = [
      { role: 'user', content: 'What is phishing?' },
      { role: 'assistant', content: 'Phishing is...', matchedTopic: 'phishing_basics' },
    ]

    const resExample = generateLocalAssistantResponse({
      message: 'Give me an example',
      language: 'en',
      context,
    })
    expect(resExample.status).toBe(STATUS_ANSWERED_OFFLINE)
    expect(resExample.matchedTopic).toBe('phishing_basics')
    expect(resExample.onlineRecommended).toBe(false)
    expect(resExample.reply.toLowerCase()).toContain('example')

    const resNext = generateLocalAssistantResponse({
      message: 'What should I do next?',
      language: 'en',
      context,
    })
    expect(resNext.status).toBe(STATUS_ANSWERED_OFFLINE)
    expect(resNext.matchedTopic).toBe('phishing_basics')
    expect(resNext.onlineRecommended).toBe(false)
  })

  it('6. Live URL Scan Request redirects safely to Module M1', () => {
    const res = generateLocalAssistantResponse({
      message: 'Scan this suspicious link for me: http://scam.example.invalid',
      language: 'en',
    })
    expect(res.status).toBe(STATUS_ANSWERED_OFFLINE)
    expect(res.onlineRecommended).toBe(false)
    expect(res.reply.toLowerCase()).toContain('module m1')
    expect(res.reply.toLowerCase()).toContain('does not perform live url scanning')
  })

  it('7. Language Detection for Amharic Ethiopic script and Oromo vocabulary', () => {
    expect(detectLanguage('ፊሺንግ ምንድን ነው?', 'en')).toBe('am')
    expect(detectLanguage('Akkam, nagaa koo', 'en')).toBe('om')
    expect(detectLanguage('What is password entropy?', 'en')).toBe('en')
  })

  it('8. Trilingual responses for Afaan Oromoo and Amharic', () => {
    const resOm = generateLocalAssistantResponse({ message: 'Fiishiingiin maali?', language: 'om' })
    expect(resOm.language).toBe('om')
    expect(resOm.reply.toLowerCase()).toContain('fiishiingii')

    const resAm = generateLocalAssistantResponse({ message: 'ፊሺንግ ምንድን ነው?', language: 'am' })
    expect(resAm.language).toBe('am')
    expect(resAm.reply).toContain('ፊሺንግ')
  })

  it('9. "What if I already clicked a suspicious link?" provides prioritized triage steps (Defect 1)', () => {
    const resEn = generateLocalAssistantResponse({ message: 'What if I already clicked a suspicious link?', language: 'en' })
    expect(resEn.status).toBe(STATUS_ANSWERED_OFFLINE)
    expect(resEn.matchedTopic).toBe('what_to_do_clicked_link')
    expect(resEn.onlineRecommended).toBe(false)
    // Contains prioritized steps
    expect(resEn.reply.toLowerCase()).toContain('stop interacting')
    expect(resEn.reply.toLowerCase()).toContain('change the affected password')
    expect(resEn.reply).toContain('951')
    expect(resEn.reply).toContain('994')
    expect(resEn.reply.toLowerCase()).toContain('apk')
    expect(resEn.reply.toLowerCase()).toContain('module m3')
    expect(resEn.reply.toLowerCase()).toContain('does not prove')

    // Trilingual
    const resOm = generateLocalAssistantResponse({ message: 'Yoon linkii shakkisiisaa baneera ta\'e hoo?', language: 'om' })
    expect(resOm.status).toBe(STATUS_ANSWERED_OFFLINE)
    expect(resOm.matchedTopic).toBe('what_to_do_clicked_link')

    const resAm = generateLocalAssistantResponse({ message: 'ሊንኩን አስቀድሜ ነክቼው ከሆነስ?', language: 'am' })
    expect(resAm.status).toBe(STATUS_ANSWERED_OFFLINE)
    expect(resAm.matchedTopic).toBe('what_to_do_clicked_link')
  })

  it('10. Action Chips resolution: "Stay offline", "Explore M5 Learn", "Emergency Contacts" (Defect 2 & 3)', () => {
    // Stay offline
    const resOffline = generateLocalAssistantResponse({ message: 'Stay offline', language: 'en' })
    expect(resOffline.status).toBe(STATUS_ANSWERED_OFFLINE)
    expect(resOffline.onlineRecommended).toBe(false)
    expect(resOffline.reply.toLowerCase()).toContain('offline')
    expect(resOffline.reply.toLowerCase()).not.toContain('offline information boundary')

    // Explore M5 Learn
    const resLearn = generateLocalAssistantResponse({ message: 'Explore M5 Learn', language: 'en' })
    expect(resLearn.status).toBe(STATUS_ANSWERED_OFFLINE)
    expect(resLearn.matchedTopic).toBe('m5_learn_quizzes')
    expect(resLearn.onlineRecommended).toBe(false)
    expect(resLearn.reply.toLowerCase()).toContain('m5')

    // Emergency Contacts
    const resContacts = generateLocalAssistantResponse({ message: 'Emergency Contacts', language: 'en' })
    expect(resContacts.status).toBe(STATUS_ANSWERED_OFFLINE)
    expect(resContacts.matchedTopic).toBe('reporting_contacts_ethiopia')
    expect(resContacts.onlineRecommended).toBe(false)
    expect(resContacts.reply).toContain('933')
    expect(resContacts.reply).toContain('994')
    expect(resContacts.reply).toContain('951')
    expect(resContacts.reply).toContain('991')

    // How does M1 Link Checker work?
    const resM1 = generateLocalAssistantResponse({ message: 'How does M1 Link Checker work?', language: 'en' })
    expect(resM1.status).toBe(STATUS_ANSWERED_OFFLINE)
    expect(resM1.matchedTopic).toBe('m1_link_checker')
  })

  it('11. Followup without context returns clarification instead of boundary warning', () => {
    const res = generateLocalAssistantResponse({ message: 'Give me an example', language: 'en', context: [] })
    expect(res.status).toBe(STATUS_NEEDS_CLARIFICATION)
    expect(res.matchedTopic).toBe(null)
    expect(res.suggestedFollowups.length).toBeGreaterThan(0)
  })

  it('12. Specific new topic query switches topic cleanly even with existing context', () => {
    const context = [
      { role: 'user', content: 'What is phishing?' },
      { role: 'assistant', content: 'Phishing is...', matchedTopic: 'phishing_basics' },
    ]
    const res = generateLocalAssistantResponse({ message: 'What is SIM swap?', language: 'en', context })
    expect(res.status).toBe(STATUS_ANSWERED_OFFLINE)
    expect(res.matchedTopic).toBe('sim_swap_fraud')
  })

  it('12b. Benchmark queries match topics offline with spelling normalization', () => {
    const queries = [
      { q: 'How phishing links work?', expected: ['suspicious_links_fake_websites', 'phishing_basics'] },
      { q: 'How does fishing link attack people?', expected: ['suspicious_links_fake_websites', 'phishing_basics'] },
      { q: 'What is the misconduct of phishing links?', expected: ['suspicious_links_fake_websites', 'phishing_basics'] },
      { q: 'What is cyber security?', expected: ['what_is_cybersecurity'] },
      { q: 'What are cybersecurity boundaries?', expected: ['cybersecurity_boundaries'] },
      { q: 'How can I learn cybersecurity?', expected: ['cybersecurity_learning_roadmap'] },
    ]
    for (const { q, expected } of queries) {
      const res = generateLocalAssistantResponse({ message: q, language: 'en' })
      expect(res.status).toBe(STATUS_ANSWERED_OFFLINE)
      expect(expected).toContain(res.matchedTopic)
      expect(res.onlineRecommended).toBe(false)
    }
  })
})

describe('CyberShield Conversational AI Assistant — Markdown Formatting & Rendering (Defect 4)', () => {
  it('13. normalizeMarkdownEscapes unescapes escaped markdown characters cleanly', () => {
    expect(normalizeMarkdownEscapes('\\*\\*heading\\*\\*')).toBe('**heading**')
    expect(normalizeMarkdownEscapes('1\\. Step one')).toBe('1. Step one')
    expect(normalizeMarkdownEscapes('\\[link\\]\\(https://example.com\\)')).toBe('[link](https://example.com)')
  })

  it('14. parseInlineMarkdown converts bold, code, and links into React elements', () => {
    const nodes = parseInlineMarkdown('Check **bold text** and `code token` and [INSA](https://cert.gov.et)')
    const html = renderToString(React.createElement('div', null, ...nodes))
    expect(html).toContain('<strong class="assistant-strong">bold text</strong>')
    expect(html).toContain('<code class="assistant-inline-code">code token</code>')
    expect(html).toContain('<a href="https://cert.gov.et"')
    expect(html).toContain('INSA</a>')
  })

  it('15. FormattedMessage renders headings, numbered lists, bullet lists and neutralizes XSS scripts', () => {
    const rawContent = `### Containment Steps
1. First step
2. Second step

• Bullet item 1
• Bullet item 2

Check **safe text** <script>alert('xss')</script>`

    const html = renderToString(React.createElement(FormattedMessage, { content: rawContent }))
    expect(html).toContain('<h4 class="assistant-heading-h4">')
    expect(html).toContain('Containment Steps')
    expect(html).toContain('<ol class="assistant-ordered-list">')
    expect(html).toContain('<li class="assistant-list-item">')
    expect(html).toContain('First step')
    expect(html).toContain('<ul class="assistant-bullet-list">')
    expect(html).toContain('Bullet item 1')
    expect(html).toContain('<strong class="assistant-strong">safe text</strong>')
    // Must neutralize script tag - React escapes text nodes
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;alert(&#x27;xss&#x27;)&lt;/script&gt;')
  })

  it('16. resolveModuleShortcut routes correctly for M5, Journey, M1, M2, M3, M4', () => {
    const tMock = (k) => k
    expect(resolveModuleShortcut('m5_learn_quizzes', tMock)?.route).toBe('learn')
    expect(resolveModuleShortcut('journey_hero_missions', tMock)?.route).toBe('journey')
    expect(resolveModuleShortcut('reporting_contacts_ethiopia', tMock)?.route).toBe('m3')
    expect(resolveModuleShortcut('what_to_do_clicked_link', tMock)?.route).toBe('m3')
    expect(resolveModuleShortcut('m1_link_checker', tMock)?.route).toBe('m1')
    expect(resolveModuleShortcut('m2_password_safety', tMock)?.route).toBe('m2')
    expect(resolveModuleShortcut('m4_website_simulation', tMock)?.route).toBe('m4')
  })
})

describe('CyberShield Conversational AI Assistant — React UI Component Rendering', () => {
  const tEn = (k) => en[k] || k
  const tOm = (k) => om[k] || k
  const tAm = (k) => am[k] || k

  it('17. Renders Assistant Header and Clear Identity in English', () => {
    const html = renderToString(React.createElement(Assistant, { t: tEn, lang: 'en' }))
    expect(html).toContain('ABBAY CYBERGUARD AI Assistant')
    expect(html).toContain('Offline-First Engine')
    expect(html).toContain('New Chat')
    expect(html).toContain('What is phishing?')
  })

  it('18. Renders Assistant Header and Clear Identity in Afaan Oromoo', () => {
    const html = renderToString(React.createElement(Assistant, { t: tOm, lang: 'om' }))
    expect(html).toContain('Gargaaraa AI ABBAY CYBERGUARD')
    expect(html).toContain('Toora Alaa Dura')
    expect(html).toContain('Haasawa Haaraa')
  })

  it('19. Renders Assistant Header and Clear Identity in Amharic', () => {
    const html = renderToString(React.createElement(Assistant, { t: tAm, lang: 'am' }))
    expect(html).toContain('የABBAY CYBERGUARD AI ረዳት')
    expect(html).toContain('ከመስመር ውጭ ቅድሚያ')
    expect(html).toContain('አዲስ ጭውውት')
  })

  it('20. getContextConfig resolves allowlisted module contexts and rejects unknown', () => {
    const tMock = (k) => en[k] || k
    expect(getContextConfig('m1', tMock)?.moduleKey).toBe('m1')
    expect(getContextConfig('m1', tMock)?.route).toBe('#/m1')
    expect(getContextConfig('m1', tMock)?.matchedTopic).toBe('m1_link_checker')

    expect(getContextConfig('m2', tMock)?.moduleKey).toBe('m2')
    expect(getContextConfig('m2', tMock)?.route).toBe('#/m2')
    expect(getContextConfig('m2', tMock)?.matchedTopic).toBe('m2_password_vault')

    expect(getContextConfig('m3', tMock)?.moduleKey).toBe('m3')
    expect(getContextConfig('m3', tMock)?.route).toBe('#/m3')
    expect(getContextConfig('m3', tMock)?.matchedTopic).toBe('m3_incident_report')

    expect(getContextConfig('m4', tMock)?.moduleKey).toBe('m4')
    expect(getContextConfig('m4', tMock)?.route).toBe('#/m4')
    expect(getContextConfig('m4', tMock)?.matchedTopic).toBe('m4_website_simulation')

    expect(getContextConfig('learn', tMock)?.moduleKey).toBe('learn')
    expect(getContextConfig('m5', tMock)?.moduleKey).toBe('learn')
    expect(getContextConfig('learn', tMock)?.route).toBe('#/learn')
    expect(getContextConfig('learn', tMock)?.matchedTopic).toBe('m5_learn_quizzes')

    expect(getContextConfig('journey', tMock)?.moduleKey).toBe('journey')
    expect(getContextConfig('journey', tMock)?.route).toBe('#/journey')
    expect(getContextConfig('journey', tMock)?.matchedTopic).toBe('journey_hero_missions')

    expect(getContextConfig('unknown_context', tMock)).toBe(null)
    expect(getContextConfig(null, tMock)).toBe(null)
  })

  it('21. Context-Aware Assistant UI: renders module banner and tailored welcome for M1', () => {
    const html = renderToString(React.createElement(Assistant, {
      t: tEn,
      lang: 'en',
      assistantContext: 'm1',
    }))
    expect(html).toContain('assistant-context-banner')
    expect(html).toContain('M1 Link')
    expect(html).toContain('Back to M1 Link')
    expect(html).toContain('Module M1 Suspicious Link')
    expect(html).toContain('How does M1 Link Checker work?')
  })

  it('22. Context-Aware Assistant UI: renders in Afaan Oromoo and Amharic with back button', () => {
    const htmlOm = renderToString(React.createElement(Assistant, {
      t: tOm,
      lang: 'om',
      assistantContext: 'm2',
    }))
    expect(htmlOm).toContain('assistant-context-banner')
    expect(htmlOm).toContain('Moojulii M2 Eegumsa Jecha Icciitii')
    expect(htmlOm).toContain('Gara')

    const htmlAm = renderToString(React.createElement(Assistant, {
      t: tAm,
      lang: 'am',
      assistantContext: 'journey',
    }))
    expect(htmlAm).toContain('assistant-context-banner')
    expect(htmlAm).toContain('ሰላም ጠባቂ! በሳይበር ጀግና ጉዞዎ ውስጥ')
    expect(htmlAm).toContain('ወደ')
  })

  it('23. Contextual Help Buttons present in M1, M2, M3, M4, Learn, and Journey headers', () => {
    const m1Html = renderToString(React.createElement(M1, { t: tEn }))
    expect(m1Html).toContain('btn-assistant-help')
    expect(m1Html).toContain('Ask ABBAY CYBERGUARD AI')

    const m2Html = renderToString(React.createElement(M2, { t: tEn }))
    expect(m2Html).toContain('btn-assistant-help')
    expect(m2Html).toContain('Ask ABBAY CYBERGUARD AI')

    const m3Html = renderToString(React.createElement(M3, { t: tEn, lang: 'en' }))
    expect(m3Html).toContain('btn-assistant-help')
    expect(m3Html).toContain('Ask ABBAY CYBERGUARD AI')

    const m4Html = renderToString(React.createElement(M4, { t: tEn }))
    expect(m4Html).toContain('btn-assistant-help')
    expect(m4Html).toContain('Ask ABBAY CYBERGUARD AI')

    const learnHtml = renderToString(React.createElement(Learn, { t: tEn, user: null }))
    expect(learnHtml).toContain('btn-assistant-help')
    expect(learnHtml).toContain('Ask ABBAY CYBERGUARD AI')

    const journeyHtml = renderToString(React.createElement(Journey, { t: tEn, lang: 'en', user: null }))
    expect(journeyHtml).toContain('btn-assistant-help')
    expect(journeyHtml).toContain('Ask ABBAY CYBERGUARD AI')
  })

  it('24. Privacy & State Isolation: contextual help does NOT mutate Journey XP or progress', () => {
    const progressBefore = getJourneyProgress()
    const xpBefore = progressBefore.totalXp
    const badgesBefore = [...progressBefore.badges]

    // Simulate opening assistant with context
    renderToString(React.createElement(Assistant, {
      t: tEn,
      lang: 'en',
      assistantContext: 'journey',
    }))

    const progressAfter = getJourneyProgress()
    expect(progressAfter.totalXp).toBe(xpBefore)
    expect(progressAfter.badges).toEqual(badgesBefore)
  })

  it('25. Strict 100% Trilingual Key Parity across EN, OM, AM', () => {
    const enKeys = Object.keys(en).sort()
    const omKeys = Object.keys(om).sort()
    const amKeys = Object.keys(am).sort()

    expect(enKeys.length).toBe(omKeys.length)
    expect(enKeys.length).toBe(amKeys.length)

    const missingInOm = enKeys.filter((k) => !(k in om))
    const missingInAm = enKeys.filter((k) => !(k in am))

    expect(missingInOm).toEqual([])
    expect(missingInAm).toEqual([])
  })

  it('26. M3 context query "How can I prepare this report?" returns structured 7-point guide with safety warning', () => {
    // Test 1: Direct query without prior turns
    const directRes = generateLocalAssistantResponse({ message: 'How can I prepare this report?', language: 'en' })
    expect(directRes.status).toBe(STATUS_ANSWERED_OFFLINE)
    expect(directRes.matchedTopic).toBe('m3_incident_report')
    expect(directRes.reply).toContain('Incident Report')
    expect(directRes.reply).toContain('Short Incident Summary')
    expect(directRes.reply).toContain('CRITICAL PRIVACY SAFEGUARD')
    expect(directRes.reply).not.toContain('Outside Cybersecurity Scope')

    // Test 2: In M3 context (following welcome message)
    const context = [
      { role: 'assistant', content: 'Hello! I am ready to help you with Module M3...', matchedTopic: 'm3_incident_report' }
    ]
    const contextualRes = generateLocalAssistantResponse({ message: 'How can I prepare this report?', language: 'en', context })
    expect(contextualRes.status).toBe(STATUS_ANSWERED_OFFLINE)
    expect(contextualRes.matchedTopic).toBe('m3_incident_report')
    expect(contextualRes.reply).toContain('Short Incident Summary')
    expect(contextualRes.reply).not.toContain('Outside Cybersecurity Scope')

    // Test 3: In Afaan Oromoo
    const omRes = generateLocalAssistantResponse({ message: 'Gabaasa akkamitti qopheessa?', language: 'om', context })
    expect(omRes.status).toBe(STATUS_ANSWERED_OFFLINE)
    expect(omRes.matchedTopic).toBe('m3_incident_report')
    expect(omRes.reply).toContain('Cuunfaa Gabaasaa Gabaabaa')
    expect(omRes.reply).not.toContain('Mata-duree Saayibariitiin Alatti')

    // Test 4: In Amharic
    const amRes = generateLocalAssistantResponse({ message: 'ሪፖርቱን እንዴት ላዘጋጅ?', language: 'am', context })
    expect(amRes.status).toBe(STATUS_ANSWERED_OFFLINE)
    expect(amRes.matchedTopic).toBe('m3_incident_report')
    expect(amRes.reply).toContain('አጭር የጥቃቱ ማጠቃለያ')
    expect(amRes.reply).not.toContain('ከሳይበር ደህንነት ወሰን ውጭ የሆነ ጥያቄ')
  })
})
