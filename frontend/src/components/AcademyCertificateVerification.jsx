import { useEffect, useState } from 'react'
import { verifyPublicAcademyCertificate } from '../lib/api.js'

export default function AcademyCertificateVerification({ certificateId, t, language }) {
  const [record, setRecord] = useState(null)
  const [isLoading, setIsLoading] = useState(Boolean(certificateId))
  const [isNotFound, setIsNotFound] = useState(!certificateId)
  const [isUnavailable, setIsUnavailable] = useState(false)

  useEffect(() => {
    let active = true
    if (!certificateId) {
      setIsLoading(false)
      setIsNotFound(true)
      setIsUnavailable(false)
      return () => { active = false }
    }

    setIsLoading(true)
    setIsNotFound(false)
    setIsUnavailable(false)
    verifyPublicAcademyCertificate(certificateId)
      .then((result) => {
        if (active) setRecord(result)
      })
      .catch((error) => {
        if (active) {
          setIsNotFound(error?.code === 'CERTIFICATE_NOT_FOUND')
          setIsUnavailable(error?.code !== 'CERTIFICATE_NOT_FOUND')
        }
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })

    return () => { active = false }
  }, [certificateId])

  const text = (key, fallback) => t?.(key) || fallback

  return (
    <section className="module-container academy-verification-container">
      <div className="card academy-verification-card" aria-live="polite">
        <span aria-hidden="true" className="academy-verification-icon">🛡️</span>
        <h1>{text('academy.verify.title', 'Certificate verification')}</h1>
        {isLoading && <p>{text('academy.verify.loading', 'Checking certificate status…')}</p>}
        {!isLoading && isNotFound && (
          <div className="msg error" role="alert">
            {text('academy.verify.not_found', 'This certificate could not be verified. Check the certificate number and try again.')}
          </div>
        )}
        {!isLoading && isUnavailable && (
          <div className="msg error" role="alert">
            {text('academy.verify.unavailable', 'Certificate verification is temporarily unavailable. Please try again later.')}
          </div>
        )}
        {!isLoading && record && (
          <>
            <p className="academy-verification-status">
              <span aria-hidden="true">✓</span> {text('academy.verify.valid', 'Certificate record found')}
            </p>
            <dl className="academy-verification-details">
              <div><dt>{text('academy.cert.number', 'Certificate number')}</dt><dd>{record.certificate_id}</dd></div>
              <div><dt>{text('academy.verify.course', 'Course')}</dt><dd>{record.course_title}</dd></div>
              <div><dt>{text('academy.verify.level', 'Level')}</dt><dd>{record.level_num}</dd></div>
              <div>
                <dt>{text('academy.cert.issued', 'Issued')}</dt>
                <dd>{new Date(record.issued_at).toLocaleDateString(language)}</dd>
              </div>
              <div><dt>{text('academy.cert.status', 'Status')}</dt><dd>{record.status}</dd></div>
              <div><dt>{text('academy.cert.issuer', 'Issuer')}</dt><dd>{record.issuer}</dd></div>
            </dl>
            <p className="small">{text('academy.verify.privacy', 'This public record does not display the learner’s name or account details.')}</p>
          </>
        )}
        <a className="btn ghost" href="#/learn">{text('academy.verify.back', 'Back to Academy')}</a>
      </div>
    </section>
  )
}
