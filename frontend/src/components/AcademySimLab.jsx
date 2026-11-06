import { useState } from 'react'
import { recordSimulationChallenge } from '../lib/academyStorage.js'

export const SIMULATION_CHALLENGES = [
  {
    id: 'sim_phish_01',
    titleKey: 'academy.sim.c1_title',
    titleDefault: 'Challenge 1: Commercial Bank of Ethiopia (CBE) SMS Inspector',
    topic: 'phishing',
    difficulty: 'Beginner',
    contextText: 'You receive an urgent SMS on your phone: "CBE ALERT: Your mobile banking account has been temporarily restricted due to missing KYC verification. To prevent permanent suspension within 2 hours, verify your credentials immediately at: http://cbe-portal-update.com-et.online"',
    clues: [
      { id: 'c1', label: 'Sender ID', detail: 'Sent from standard 10-digit mobile number (+251911XXXXXX) instead of official CBE Shortcode.' },
      { id: 'c2', label: 'Domain Structure', detail: 'Domain is "com-et.online", NOT the verified official CBE domain "combanketh.et".' },
      { id: 'c3', label: 'Urgency Trap', detail: 'Threatens "permanent suspension within 2 hours" to induce panic and bypass logical thinking.' },
    ],
    question: 'What is the safest defensive action you should take?',
    options: [
      { text: 'Click the link quickly to check if your account is really restricted.', isCorrect: false, explanation: 'Never click links in unexpected text messages. Clicking exposes you to credential harvesting or malware.' },
      { text: 'Ignore the message, do NOT click the link, and verify independently by contacting CBE customer care or visiting your branch.', isCorrect: true, explanation: 'Correct! Banks never send external link prompts for KYC verification. Always verify through known official branch contacts.' },
      { text: 'Reply to the SMS asking the sender to confirm their employee ID.', isCorrect: false, explanation: 'Replying confirms your phone number is active and invites further targeted social engineering attacks.' },
    ],
  },
  {
    id: 'sim_social_01',
    titleKey: 'academy.sim.c2_title',
    titleDefault: 'Challenge 2: Telebirr Support Vishing & OTP Defense',
    topic: 'privacy',
    difficulty: 'Intermediate',
    contextText: 'You receive a phone call from an authoritative caller claiming: "Good afternoon, this is Ethio Telecom Telebirr Fraud Prevention Unit. We have intercepted an unauthorized 4,500 ETB withdrawal attempt on your wallet. To immediately cancel this transaction, we sent a 6-digit confirmation code to your phone. Read it to me now to protect your balance."',
    clues: [
      { id: 'c1', label: 'Pretexting Authority', detail: 'Caller claims to be "Fraud Prevention Unit" to exploit respect for authority.' },
      { id: 'c2', label: 'The OTP Trap', detail: 'The 6-digit SMS received is actually an authorization code to TRANSFER funds OUT of your account, not cancel a transfer.' },
      { id: 'c3', label: 'Official Policy', detail: 'Ethio Telecom explicitly states that 127 support staff will NEVER ask for your PIN or OTP.' },
    ],
    question: 'How should you respond to this call?',
    options: [
      { text: 'Read the code immediately to protect your 4,500 Birr balance.', isCorrect: false, explanation: 'Sharing this OTP gives the attacker direct authorization to drain your account balance.' },
      { text: 'Refuse to share the code, hang up immediately, and call official Telebirr support at 127 to report the attempt.', isCorrect: true, explanation: 'Correct! Never share your PIN or OTP with anyone under any circumstances. Ethio Telecom employees never need your OTP.' },
      { text: 'Tell the caller your secret PIN instead of the SMS code.', isCorrect: false, explanation: 'Your PIN is strictly confidential and must never be disclosed to anyone, including support staff.' },
    ],
  },
  {
    id: 'sim_password_01',
    titleKey: 'academy.sim.c3_title',
    titleDefault: 'Challenge 3: Passphrase Entropy & MFA Policy Station',
    topic: 'password',
    difficulty: 'Intermediate',
    contextText: 'An employee uses the password "Summer2026!" across their personal email, company portal, and mobile banking app. A breach occurs on an unrelated forum they registered with 2 years ago using the same credentials.',
    clues: [
      { id: 'c1', label: 'Password Reuse', detail: 'The same password is reused across multiple services, exposing critical accounts to credential stuffing.' },
      { id: 'c2', label: 'Predictable Pattern', detail: '"Summer2026!" follows a predictable Season + Year + Symbol pattern easily cracked by dictionary masks.' },
      { id: 'c3', label: 'Missing MFA', detail: 'Without Multi-Factor Authentication, compromised passwords grant immediate account access.' },
    ],
    question: 'Which hardening strategy provides the strongest defense against this attack vector?',
    options: [
      { text: 'Change the password to "Summer2027!" on the forum and leave other accounts as is.', isCorrect: false, explanation: 'Changing one character on one service leaves all other accounts vulnerable to automated credential stuffing.' },
      { text: 'Deploy unique, long passphrases (16+ chars) using a password manager and enable Multi-Factor Authentication (MFA) on all services.', isCorrect: true, explanation: 'Correct! Unique passphrases prevent credential reuse from cascading across accounts, and MFA stops attackers even if a password leaks.' },
      { text: 'Write down a 6-character password on a paper sticky note under the keyboard.', isCorrect: false, explanation: '6-character passwords can be cracked in seconds via brute-force, and physical notes introduce physical compromise risks.' },
    ],
  },
  {
    id: 'sim_incident_01',
    titleKey: 'academy.sim.c4_title',
    titleDefault: 'Challenge 4: Emergency Triage — Sudden Cellular Signal Loss',
    topic: 'response',
    difficulty: 'Advanced',
    contextText: 'At 10:00 AM on a workday, your smartphone suddenly loses all cellular network connectivity, displaying "No Service" or "Emergency Calls Only". Restarting the phone does not restore signal, while colleagues on the same network have normal reception. Thirty minutes earlier, you received an unrequested verification SMS.',
    clues: [
      { id: 'c1', label: 'Sudden SIM Inactivity', detail: 'A working SIM card suddenly losing signal while others have coverage is a critical indicator of an unauthorized SIM swap.' },
      { id: 'c2', label: 'Preceding SMS Code', detail: 'The unrequested SMS was an authentication attempt triggered by an attacker preparing the swap.' },
      { id: 'c3', label: 'Financial Exposure', detail: 'With control of your phone number, attackers can intercept SMS OTPs for your bank and Telebirr wallets.' },
    ],
    question: 'What is the immediate priority response workflow?',
    options: [
      { text: 'Wait 24 hours to see if the nearest cellular tower fixes itself.', isCorrect: false, explanation: 'Delaying allows attackers to drain bank accounts, intercept OTPs, and take over linked social media accounts.' },
      { text: 'Immediately use a colleague’s phone or landline to call Ethio Telecom at 994 to report a suspected SIM swap, then contact your bank to freeze mobile transactions.', isCorrect: true, explanation: 'Correct! Immediate reporting to Ethio Telecom (994) allows customer service to deactivate the cloned SIM, and alerting your bank prevents financial loss.' },
      { text: 'Post a message on public social media asking followers to send you money.', isCorrect: false, explanation: 'Public posting does not resolve the security compromise and exposes you to further secondary scams.' },
    ],
  },
]

export default function AcademySimLab({ t, onChallengeCompleted }) {
  const [activeChallengeIdx, setActiveChallengeIdx] = useState(0)
  const [selectedOption, setSelectedOption] = useState(null)
  const [submitted, setSubmitted] = useState(false)
  const [completedChallenges, setCompletedChallenges] = useState({})

  const challenge = SIMULATION_CHALLENGES[activeChallengeIdx]
  const isAnswered = selectedOption !== null
  const isCorrect = isAnswered && challenge.options[selectedOption]?.isCorrect

  const handleSelectOption = (idx) => {
    if (submitted) return
    setSelectedOption(idx)
  }

  const handleSubmit = () => {
    if (selectedOption === null || submitted) return
    setSubmitted(true)

    if (challenge.options[selectedOption]?.isCorrect) {
      recordSimulationChallenge(challenge.id, 100)
      setCompletedChallenges((prev) => ({ ...prev, [challenge.id]: true }))
      if (onChallengeCompleted) {
        onChallengeCompleted(challenge.id)
      }
    }
  }

  const handleNextChallenge = () => {
    if (activeChallengeIdx < SIMULATION_CHALLENGES.length - 1) {
      setActiveChallengeIdx((prev) => prev + 1)
      setSelectedOption(null)
      setSubmitted(false)
    }
  }

  const handlePrevChallenge = () => {
    if (activeChallengeIdx > 0) {
      setActiveChallengeIdx((prev) => prev - 1)
      setSelectedOption(null)
      setSubmitted(false)
    }
  }

  const handleResetChallenge = () => {
    setSelectedOption(null)
    setSubmitted(false)
  }

  return (
    <div className="card m4-card academy-sim-lab-card" style={{ background: '#14233B', border: '1px solid #1E293B', color: '#F8FAFC', padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', borderBottom: '1px solid #1E293B', paddingBottom: '14px', marginBottom: '18px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.4rem' }}>🧪</span>
            <h3 style={{ margin: 0, color: '#00C2D7', fontSize: '1.25rem' }}>
              {t('academy.sim.title') || 'Cybersecurity Simulation Lab'}
            </h3>
            <span className="tag" style={{ background: 'rgba(0, 194, 215, 0.15)', color: '#00C2D7', border: '1px solid #00C2D7', fontSize: '0.75rem' }}>
              SAFE SIMULATION
            </span>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: '0.88rem', color: '#CBD5E1' }}>
            {t('academy.sim.desc') || 'Hands-on defensive scenario challenges based on realistic Ethiopian threat vectors. Test your response skills safely.'}
          </p>
        </div>

        {/* Challenge Selector Tabs */}
        <div style={{ display: 'flex', gap: '6px' }}>
          {SIMULATION_CHALLENGES.map((c, idx) => {
            const isDone = completedChallenges[c.id]
            const isCurrent = activeChallengeIdx === idx
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setActiveChallengeIdx(idx)
                  setSelectedOption(null)
                  setSubmitted(false)
                }}
                className={`btn ghost ${isCurrent ? 'active-pill' : ''}`}
                style={{
                  padding: '5px 12px',
                  fontSize: '0.82rem',
                  borderRadius: '6px',
                  border: isCurrent ? '1px solid #00C2D7' : '1px solid #334155',
                  background: isCurrent ? 'rgba(0, 194, 215, 0.15)' : '#0F172A',
                  color: isCurrent ? '#00C2D7' : '#94A3B8',
                  cursor: 'pointer',
                }}
              >
                C{idx + 1} {isDone ? '✓' : ''}
              </button>
            )
          })}
        </div>
      </div>

      {/* Active Challenge Box */}
      <div style={{ background: '#0B1220', border: '1px solid #1E293B', borderRadius: '10px', padding: '20px', marginBottom: '18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
          <h4 style={{ margin: 0, fontSize: '1.1rem', color: '#F8FAFC' }}>
            {t(challenge.titleKey) || challenge.titleDefault}
          </h4>
          <span className="tag" style={{ background: '#1E293B', color: '#94A3B8', border: '1px solid #334155', fontSize: '0.72rem' }}>
            {challenge.difficulty}
          </span>
        </div>

        {/* Scenario Context Display */}
        <div style={{ background: '#070D18', border: '1px solid #1E293B', borderLeft: '4px solid #F59E0B', borderRadius: '6px', padding: '14px 18px', marginBottom: '16px', color: '#FCD34D', fontSize: '0.92rem', lineHeight: 1.55 }}>
          <strong>Scenario:</strong> {challenge.contextText}
        </div>

        {/* Technical Clues Grid */}
        <div style={{ marginBottom: '18px' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#00C2D7', display: 'block', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            🔍 Technical Indicators & Clues:
          </span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px' }}>
            {challenge.clues.map((clue) => (
              <div key={clue.id} style={{ background: '#14233B', border: '1px solid #1E293B', borderRadius: '6px', padding: '10px 14px' }}>
                <strong style={{ color: '#F8FAFC', fontSize: '0.84rem', display: 'block', marginBottom: '2px' }}>{clue.label}</strong>
                <span style={{ color: '#CBD5E1', fontSize: '0.82rem', lineHeight: 1.45 }}>{clue.detail}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Challenge Question */}
        <p style={{ fontWeight: 700, fontSize: '1rem', color: '#F8FAFC', margin: '0 0 12px' }}>
          {challenge.question}
        </p>

        {/* Options */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
          {challenge.options.map((opt, idx) => {
            const isPicked = selectedOption === idx
            let btnBorder = '#334155'
            let btnBg = '#14233B'
            let btnColor = '#CBD5E1'

            if (submitted) {
              if (opt.isCorrect) {
                btnBorder = '#10B981'
                btnBg = 'rgba(16, 185, 129, 0.15)'
                btnColor = '#34D399'
              } else if (isPicked) {
                btnBorder = '#EF4444'
                btnBg = 'rgba(239, 68, 68, 0.15)'
                btnColor = '#FCA5A5'
              }
            } else if (isPicked) {
              btnBorder = '#00C2D7'
              btnBg = 'rgba(0, 194, 215, 0.15)'
              btnColor = '#00C2D7'
            }

            return (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelectOption(idx)}
                disabled={submitted}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  border: `1px solid ${btnBorder}`,
                  background: btnBg,
                  color: btnColor,
                  textAlign: 'left',
                  fontSize: '0.92rem',
                  lineHeight: 1.5,
                  cursor: submitted ? 'default' : 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <span style={{ fontWeight: 800, minWidth: '22px', color: isPicked ? '#00C2D7' : '#94A3B8' }}>
                  {String.fromCharCode(65 + idx)}.
                </span>
                <span style={{ flex: 1 }}>{opt.text}</span>
              </button>
            )
          })}
        </div>

        {/* Feedback Display */}
        {submitted && (
          <div
            style={{
              padding: '14px 18px',
              borderRadius: '8px',
              background: isCorrect ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
              border: isCorrect ? '1px solid #10B981' : '1px solid #EF4444',
              color: '#F8FAFC',
              fontSize: '0.9rem',
              lineHeight: 1.55,
              marginBottom: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800, marginBottom: '6px', color: isCorrect ? '#34D399' : '#FCA5A5' }}>
              <span>{isCorrect ? '✓ Correct Defensive Action!' : '✗ Vulnerable Response!'}</span>
            </div>
            <p style={{ margin: 0, color: '#E2E8F0' }}>
              {challenge.options[selectedOption]?.explanation}
            </p>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="btn ghost small"
              disabled={activeChallengeIdx === 0}
              onClick={handlePrevChallenge}
              style={{ fontSize: '0.84rem' }}
            >
              ← Previous Challenge
            </button>
            <button
              type="button"
              className="btn ghost small"
              disabled={activeChallengeIdx === SIMULATION_CHALLENGES.length - 1}
              onClick={handleNextChallenge}
              style={{ fontSize: '0.84rem' }}
            >
              Next Challenge →
            </button>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            {submitted && !isCorrect && (
              <button
                type="button"
                className="btn ghost small"
                onClick={handleResetChallenge}
                style={{ fontSize: '0.84rem' }}
              >
                🔄 Try Again
              </button>
            )}
            {!submitted && (
              <button
                type="button"
                className="btn primary"
                disabled={selectedOption === null}
                onClick={handleSubmit}
                style={{ fontSize: '0.88rem', padding: '8px 20px', fontWeight: 700 }}
              >
                Submit Response
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

