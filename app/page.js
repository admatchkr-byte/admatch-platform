import Link from "next/link";

export default function Home() {
  return (
    <main className="landing-page">
      <header className="landing-header">
        <nav className="landing-nav">
          <Link href="/" className="brand-logo">
            광고<span>잇다</span>
          </Link>

          <div className="landing-menu">
            <Link href="/creators">크리에이터 찾기</Link>
            <Link href="/campaign">광고 의뢰</Link>
            <Link href="/login">로그인</Link>
            <Link href="/signup" className="header-signup">
              회원가입
            </Link>
          </div>
        </nav>
      </header>

      <section className="landing-hero">
        <div className="hero-glow hero-glow-one" />
        <div className="hero-glow hero-glow-two" />

        <div className="hero-container">
          <div className="hero-content">
            <div className="hero-badge">
              <span className="badge-dot" />
              광고주와 크리에이터의 새로운 연결
            </div>

            <h1>
              광고에 필요한
              <br />
              모든 것을 <strong>잇는 플랫폼</strong>
            </h1>

            <p className="hero-copy">
              광고주와 크리에이터를 안전하게 연결하고
              <br />
              함께 성장할 수 있는 광고 파트너를 만듭니다.
            </p>

            <div className="hero-actions">
              <Link href="/campaign" className="action-primary">
                광고 의뢰하기
                <span>→</span>
              </Link>

              <Link href="/creators" className="action-secondary">
                크리에이터 찾기
              </Link>
            </div>

            <div className="hero-points">
              <span>
                <i>✓</i>
                직접 선택하는 매칭
              </span>
              <span>
                <i>✓</i>
                제안부터 협업까지
              </span>
              <span>
                <i>✓</i>
                안전한 워크스페이스
              </span>
            </div>
          </div>

          <div className="hero-visual">
            <div className="visual-card main-card">
              <div className="card-header">
                <div>
                  <span className="card-label">광고잇다 워크스페이스</span>
                  <h2>협업 진행 현황</h2>
                </div>
                <span className="status-badge">진행 중</span>
              </div>

              <div className="partner-box">
                <div className="partner-avatar">A</div>
                <div>
                  <strong>브랜드와 크리에이터 매칭</strong>
                  <p>제안이 수락되어 협업이 시작되었습니다.</p>
                </div>
              </div>

              <div className="progress-area">
                <div className="progress-row">
                  <span>협업 진행률</span>
                  <strong>60%</strong>
                </div>

                <div className="progress-track">
                  <div className="progress-fill" />
                </div>
              </div>

              <div className="step-list">
                <div className="step-item complete">
                  <span>✓</span>
                  <div>
                    <strong>협업 제안</strong>
                    <p>제안 수락 완료</p>
                  </div>
                </div>

                <div className="step-item active">
                  <span>2</span>
                  <div>
                    <strong>계약 및 협의</strong>
                    <p>상세 조건을 조율하고 있습니다.</p>
                  </div>
                </div>

                <div className="step-item">
                  <span>3</span>
                  <div>
                    <strong>콘텐츠 진행</strong>
                    <p>콘텐츠 제출 및 검수</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="floating-card floating-top">
              <span className="floating-icon">✓</span>
              <div>
                <strong>제안 수락 완료</strong>
                <p>새로운 협업이 시작됐어요.</p>
              </div>
            </div>

            <div className="floating-card floating-bottom">
              <span className="floating-icon blue">↗</span>
              <div>
                <strong>한곳에서 간편하게</strong>
                <p>채팅부터 계약까지</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
