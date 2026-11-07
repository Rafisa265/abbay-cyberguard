import { describe, expect, it } from 'vitest'
import en from './locales/en.js'
import om from './locales/om.js'
import am from './locales/am.js'

describe('Academy certificate eligibility localization', () => {
  it('communicates server-verified assessment eligibility in all supported languages', () => {
    const eligibilityMessages = [en, om, am].map((locale) => ({
      ready: locale['academy.cert.ready_description'],
      pending: locale['academy.cert.requirements_description'],
      empty: locale['academy.cert.none_issued'],
      issued: locale['academy.cert.completed_coursework'],
      disclaimer: locale['academy.cert.disclaimer'],
      verification: locale['academy.cert.local_verification_note'],
    }))

    for (const messages of eligibilityMessages) {
      for (const message of Object.values(messages)) {
        expect(message).toBeTruthy()
      }
    }

    expect(eligibilityMessages[0].ready).toContain('server-verified assessment milestone')
    expect(eligibilityMessages[1].ready).toContain('sarvariin mirkanaa')
    expect(eligibilityMessages[2].ready).toContain('በአገልጋዩ ተረጋግጠዋል')

    expect(eligibilityMessages[0].pending).toContain('prerequisite server assessments')
    expect(eligibilityMessages[0].pending).toContain('Lesson reading is not verified')
    expect(eligibilityMessages[1].pending).toContain('madaalliiwwan sadarkaa duraa')
    expect(eligibilityMessages[1].pending).toContain('Dubbisuun qofti')
    expect(eligibilityMessages[2].pending).toContain('ቀዳሚ ግምገማዎችን')
    expect(eligibilityMessages[2].pending).toContain('ማንበብ ብቻውን')

    expect(eligibilityMessages[0].empty).toContain('pass the required server-verified assessments')
    expect(eligibilityMessages[0].empty).not.toContain('complete the required lessons')
    expect(eligibilityMessages[1].empty).toContain('darbuu qabda')
    expect(eligibilityMessages[1].empty).toContain('dubbisuun qofti')
    expect(eligibilityMessages[2].empty).toContain('ያልፉ')
    expect(eligibilityMessages[2].empty).toContain('ማንበብ ብቻውን')

    expect(eligibilityMessages[0].issued).toContain('server-verified assessment milestone')
    expect(eligibilityMessages[1].issued).toContain("sarvariin mirkanaa'e")
    expect(eligibilityMessages[2].issued).toContain('በአገልጋይ የተረጋገጠ')

    expect(eligibilityMessages[0].disclaimer).toContain('lesson reading is not verified')
    expect(eligibilityMessages[0].disclaimer).toContain('Does not confer professional')
    expect(eligibilityMessages[1].disclaimer).toContain('dubbisni barnootaa hin mirkanoofne')
    expect(eligibilityMessages[1].disclaimer).toContain('Eeyyama ogummaa')
    expect(eligibilityMessages[2].disclaimer).toContain('የትምህርት ንባብ አልተረጋገጠም')
    expect(eligibilityMessages[2].disclaimer).toContain('የሙያ ፈቃድ')

    expect(eligibilityMessages[0].verification).toContain('server-issued certificate record')
    expect(eligibilityMessages[1].verification).toContain('galmee waraqaa ragaa')
    expect(eligibilityMessages[2].verification).toContain('ሰርተፍኬት መዝገብ')
  })
})
