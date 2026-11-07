export default function AcademyDashboard({
  academyProgress,
  certificateStatus,
  mastery,
  recommendations,
  revisionQueue,
  onJumpToLesson,
  onOpenCertificate,
  onToggleAdaptiveOptOut,
  t,
}) {
  const completedLessonsCount = Object.values(academyProgress.completedLessons || {}).filter((l) => l.completed).length
  const completedLevelsCount = Object.values(academyProgress.completedLevels || {}).filter((l) => l.passed).length
  const masteredLevelsCount = Object.values(academyProgress.completedLevels || {}).filter(
    (l) => l.passed && (l.score === 100 || l.percentage === 100 || l.stars === 3)
  ).length
  const challengesCount = Object.keys(academyProgress.practicalChallenges || {}).length
  const certificates = certificateStatus?.certificates || []
  const certsCount = certificates.length

  // Calculate overall completion: 5 lessons + 6 levels + 4 challenges = 15 total units
  const totalUnits = 15
  const completedUnits = completedLessonsCount + completedLevelsCount + challengesCount
  const overallPercentage = Math.min(100, Math.round((completedUnits / totalUnits) * 100))

  return (
    <div className="academy-dashboard-container" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Overview Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
        {/* Card 1: Active Stage & Level */}
        <div className="card m4-card" style={{ background: '#14233B', border: '1px solid #1E293B', padding: '18px', color: '#F8FAFC' }}>
          <span style={{ fontSize: '0.8rem', color: '#94A3B8', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
            ACADEMY STATUS
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.8rem' }}>🛡️</span>
            <div>
              <strong style={{ fontSize: '1.15rem', color: '#00C2D7', display: 'block' }}>
                Level {academyProgress.activeLevel || 1} Active
              </strong>
              <span style={{ fontSize: '0.78rem', color: '#CBD5E1' }}>
                {completedLevelsCount} of 6 Levels Completed ({masteredLevelsCount} Mastered)
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Overall Academy Completion */}
        <div className="card m4-card" style={{ background: '#14233B', border: '1px solid #1E293B', padding: '18px', color: '#F8FAFC' }}>
          <span style={{ fontSize: '0.8rem', color: '#94A3B8', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
            TOTAL ACADEMY PROGRESS
          </span>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <strong style={{ fontSize: '1.5rem', color: '#10B981' }}>{overallPercentage}%</strong>
            <span style={{ fontSize: '0.78rem', color: '#94A3B8' }}>{completedUnits} / {totalUnits} Units Completed</span>
          </div>
          <div className="m4-progress-track" style={{ height: '6px' }}>
            <div className="m4-progress-fill" style={{ width: `${overallPercentage}%` }} />
          </div>
          <div style={{ marginTop: '8px', fontSize: '0.74rem', color: '#94A3B8', display: 'flex', justifyContent: 'space-between' }}>
            <span>{completedLessonsCount}/5 Lessons</span>
            <span>{completedLevelsCount}/6 Levels</span>
            <span>{challengesCount}/4 Challenges</span>
          </div>
        </div>

        {/* Card 3: Hands-On Simulation Challenges */}
        <div className="card m4-card" style={{ background: '#14233B', border: '1px solid #1E293B', padding: '18px', color: '#F8FAFC' }}>
          <span style={{ fontSize: '0.8rem', color: '#94A3B8', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
            SIMULATION LAB
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.8rem' }}>🧪</span>
            <div>
              <strong style={{ fontSize: '1.15rem', color: '#F59E0B', display: 'block' }}>
                {challengesCount} / 4 Challenges
              </strong>
              <span style={{ fontSize: '0.78rem', color: '#CBD5E1' }}>
                {challengesCount === 4 ? 'All Scenarios Completed' : 'Defensive Scenarios'}
              </span>
            </div>
          </div>
        </div>

        {/* Card 4: Earned Certificates */}
        <div className="card m4-card" style={{ background: '#14233B', border: '1px solid #1E293B', padding: '18px', color: '#F8FAFC' }}>
          <span style={{ fontSize: '0.8rem', color: '#94A3B8', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
            CREDENTIALS
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.8rem' }}>📜</span>
            <div>
              <strong style={{ fontSize: '1.15rem', color: '#00C2D7', display: 'block' }}>
                {certsCount} Certificates
              </strong>
              <span style={{ fontSize: '0.78rem', color: '#CBD5E1' }}>
                {certsCount > 0 ? 'Server-issued and verifiable' : 'Complete requirements to earn'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Topic Mastery Matrix */}
      <div className="card m4-card" style={{ background: '#14233B', border: '1px solid #1E293B', padding: '20px', color: '#F8FAFC' }}>
        <h4 style={{ margin: '0 0 14px', color: '#00C2D7', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>📈</span> {t('academy.dash.mastery_title') || 'Cybersecurity Topic Competency Matrix'}
        </h4>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
          {Object.entries(mastery).map(([topicKey, data]) => {
            const hasQuestions = data.totalQuestions > 0
            const hasAttempts = data.answeredCount > 0
            const isHigh = hasQuestions && hasAttempts && data.percentage >= 80
            const isMedium = hasQuestions && hasAttempts && data.percentage >= 60 && data.percentage < 80
            const pillColor = !hasQuestions
              ? '#64748B'
              : !hasAttempts
                ? '#94A3B8'
                : isHigh
                  ? '#10B981'
                  : isMedium
                    ? '#F59E0B'
                    : '#EF4444'
            const statusLabel = !hasQuestions
              ? 'Not Available'
              : !hasAttempts
                ? 'Not Attempted'
                : isHigh
                  ? 'Mastered (>= 80%)'
                  : isMedium
                    ? 'Review Suggested'
                    : 'Needs Practice'

            return (
              <div key={topicKey} style={{ background: '#0B1220', border: '1px solid #1E293B', borderRadius: '8px', padding: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <strong style={{ color: '#F8FAFC', fontSize: '0.92rem' }}>
                    {t('learn.t.' + topicKey)}
                  </strong>
                  <span style={{ fontSize: '0.95rem', fontWeight: 800, color: pillColor }}>
                    {hasQuestions && hasAttempts ? `${data.percentage}%` : '—'}
                  </span>
                </div>
                <span style={{ fontSize: '0.76rem', color: '#94A3B8', display: 'block', marginBottom: '8px' }}>
                  {hasQuestions ? (
                    hasAttempts
                      ? `${data.correctCount} / ${data.totalQuestions} answered correctly (${data.answeredCount} attempted)`
                      : `0 / ${data.totalQuestions} answered correctly (Not attempted yet)`
                  ) : (
                    'Questions not available for this topic'
                  )}
                </span>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '4px', background: 'rgba(255, 255, 255, 0.05)', color: pillColor, border: `1px solid ${pillColor}` }}>
                    {statusLabel}
                  </span>
                  <button
                    type="button"
                    onClick={() => onJumpToLesson(topicKey)}
                    className="btn ghost small"
                    style={{ fontSize: '0.75rem', padding: '2px 8px', color: '#00C2D7' }}
                  >
                    Study Lesson →
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Adaptive Learning Recommendations & Smart Revision Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
        {/* Adaptive Recommendations Box */}
        <div className="card m4-card" style={{ background: '#14233B', border: '1px solid #1E293B', padding: '20px', color: '#F8FAFC' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h4 style={{ margin: 0, color: '#00C2D7', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>🎯</span> Adaptive Learning Guidance
            </h4>
            <button
              type="button"
              onClick={onToggleAdaptiveOptOut}
              className="btn ghost small"
              style={{ fontSize: '0.74rem', padding: '2px 8px', color: '#94A3B8' }}
              title="Toggle adaptive recommendations"
            >
              {academyProgress.adaptiveOptOut ? 'Enable Adaptive' : 'Disable'}
            </button>
          </div>

          {!academyProgress.adaptiveOptOut ? (
            recommendations.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {recommendations.map((rec) => (
                  <div key={rec.id} style={{ background: '#0B1220', border: '1px solid #1E293B', borderLeft: `4px solid ${rec.priority === 'high' ? '#EF4444' : rec.priority === 'medium' ? '#F59E0B' : '#10B981'}`, borderRadius: '6px', padding: '12px 14px' }}>
                    <p style={{ margin: '0 0 8px', fontSize: '0.86rem', color: '#CBD5E1', lineHeight: 1.45 }}>
                      {t(rec.reasonKey) || rec.defaultReason}
                    </p>
                    {rec.topic !== 'general' && (
                      <button
                        type="button"
                        onClick={() => onJumpToLesson(rec.topic)}
                        className="btn ghost small"
                        style={{ fontSize: '0.78rem', padding: '4px 10px', color: '#00C2D7' }}
                      >
                        Targeted Revision for {t('learn.t.' + rec.topic)} →
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: '0.88rem', color: '#94A3B8', margin: 0 }}>
                Complete quiz questions and simulation challenges to generate customized adaptive learning recommendations.
              </p>
            )
          ) : (
            <p style={{ fontSize: '0.86rem', color: '#94A3B8', margin: 0, fontStyle: 'italic' }}>
              Adaptive recommendations are currently disabled. You can re-enable them anytime above.
            </p>
          )}
        </div>

        {/* Smart Spaced Revision Queue */}
        <div className="card m4-card" style={{ background: '#14233B', border: '1px solid #1E293B', padding: '20px', color: '#F8FAFC' }}>
          <h4 style={{ margin: '0 0 12px', color: '#00C2D7', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>🔄</span> Smart Spaced Revision Queue
          </h4>
          {revisionQueue.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {revisionQueue.map((item) => (
                <div key={item.topic} style={{ background: '#0B1220', border: '1px solid #1E293B', borderRadius: '6px', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong style={{ color: '#F8FAFC', fontSize: '0.88rem', display: 'block' }}>
                      {t('learn.t.' + item.topic)}
                    </strong>
                    <span style={{ fontSize: '0.78rem', color: item.urgency === 'urgent' ? '#EF4444' : '#F59E0B' }}>
                      {item.missedCount} missed questions ({item.percentage}% accuracy)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onJumpToLesson(item.topic)}
                    className="btn ghost small"
                    style={{ fontSize: '0.78rem', padding: '4px 10px', color: '#00C2D7' }}
                  >
                    Review Now →
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: '0.88rem', color: '#94A3B8', margin: 0 }}>
              No topics currently pending revision! Keep practicing levels to keep your defense reflexes sharp.
            </p>
          )}
        </div>
      </div>

      <section className="card m4-card academy-my-certificates" aria-labelledby="academy-certificate-list-title">
        <h3 id="academy-certificate-list-title">{t('academy.cert.my_certificates') || 'My Certificates'}</h3>
        {certificates.length ? (
          <div className="academy-my-certificates-list">
            {certificates.map((certificate) => (
              <div className="academy-my-certificate-row" key={certificate.certificate_id}>
                <div>
                  <strong>{certificate.course_title}</strong>
                  <span>{certificate.certificate_id}</span>
                  <small>{new Date(certificate.issued_at).toLocaleDateString()}</small>
                </div>
                <button
                  type="button"
                  className="btn ghost small"
                  onClick={() => onOpenCertificate({
                    levelNum: certificate.level_num,
                    title: certificate.course_title,
                  })}
                >
                  {t('academy.cert.view_btn') || 'View certificate'}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p>{t('academy.cert.none_issued') || 'No server-issued certificates yet. Sign in and complete the required lessons and verified levels to earn one.'}</p>
        )}
      </section>

      {/* Offline Library & Storage Status Notice */}
      <div style={{ background: '#0B1220', border: '1px solid #1E293B', borderRadius: '8px', padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '1.2rem' }}>💾</span>
          <div>
            <strong style={{ color: '#F8FAFC', fontSize: '0.88rem', display: 'block' }}>
              Offline-First Local Storage Active
            </strong>
            <span style={{ color: '#94A3B8', fontSize: '0.8rem' }}>
              All 5 courses, 32 questions, and simulation lab challenges are cached locally on your device. Progress survives browser restarts.
            </span>
          </div>
        </div>
        <span className="tag" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34D399', border: '1px solid #10B981', fontSize: '0.75rem' }}>
          OFFLINE READY
        </span>
      </div>
    </div>
  )
}
