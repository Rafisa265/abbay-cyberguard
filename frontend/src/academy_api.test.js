import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getAcademyCertificate,
  getAcademyCertificateStatus,
  issueAcademyCertificate,
  recordAcademyLessonSection,
  startAcademyLevelAttempt,
  submitAcademyLevelAttempt,
  verifyPublicAcademyCertificate,
} from './lib/api.js'

describe('M5 server-verified certificate API client', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('starts and submits server-generated assessment attempts without client answer keys', async () => {
    globalThis.window = globalThis.window || globalThis
    globalThis.window.fetch = vi.fn()
      .mockResolvedValueOnce(Response.json({ completed: false }))
      .mockResolvedValueOnce(Response.json({ attempt_id: 'server-attempt-id', questions: [] }))
      .mockResolvedValueOnce(Response.json({ passed: true, score: 100 }))

    await recordAcademyLessonSection({ topic: 'phishing', section: 'overview' })
    const attempt = await startAcademyLevelAttempt({ levelNum: 1 })
    await submitAcademyLevelAttempt({
      attemptId: '00000000-0000-4000-8000-000000000001',
      answers: { serverQuestionId: 'serverOptionId' },
    })

    expect(globalThis.window.fetch).toHaveBeenNthCalledWith(
      1,
      '/api/v1/academy/lessons/section',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ topic: 'phishing', section: 'overview' }),
      }),
    )
    expect(globalThis.window.fetch).toHaveBeenNthCalledWith(
      2,
      '/api/v1/academy/levels/attempts',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ level_num: 1 }),
      }),
    )
    expect(globalThis.window.fetch).toHaveBeenNthCalledWith(
      3,
      `/api/v1/academy/levels/attempts/00000000-0000-4000-8000-000000000001/submit`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ answers: { serverQuestionId: 'serverOptionId' } }),
      }),
    )
    expect(attempt.passed).toBeUndefined()
  })

  it('lists certificates, issues one with a user-confirmed name, and supports private and public retrieval', async () => {
    globalThis.window = globalThis.window || globalThis
    globalThis.window.fetch = vi.fn().mockResolvedValue(Response.json({ certificates: [] }))
    const id = 'ACYBER-2026-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'

    await getAcademyCertificateStatus()
    await issueAcademyCertificate({ levelNum: 1, recipientName: 'Learner Name', language: 'om' })
    await getAcademyCertificate(id)
    await verifyPublicAcademyCertificate(id)

    expect(globalThis.window.fetch.mock.calls.map(([url]) => url)).toEqual([
      '/api/v1/academy/certificates',
      '/api/v1/academy/certificates',
      `/api/v1/academy/certificates/${id}`,
      `/api/v1/academy/certificates/verify/${id}`,
    ])
    expect(JSON.parse(globalThis.window.fetch.mock.calls[1][1].body)).toEqual({
      level_num: 1,
      recipient_name: 'Learner Name',
      language: 'om',
    })
    expect(globalThis.window.fetch.mock.calls.every(([, options]) => options.credentials === 'include')).toBe(true)
  })

  it('preserves server error codes for clear eligibility feedback', async () => {
    globalThis.window = globalThis.window || globalThis
    globalThis.window.fetch = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ error: { code: 'CERTIFICATE_REQUIREMENTS_INCOMPLETE' } }),
      { status: 409, headers: { 'Content-Type': 'application/json' } },
    ))

    await expect(issueAcademyCertificate({
      levelNum: 1,
      recipientName: 'Learner Name',
      language: 'en',
    })).rejects.toMatchObject({
      code: 'CERTIFICATE_REQUIREMENTS_INCOMPLETE',
      status: 409,
    })
  })
})
