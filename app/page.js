import Link from 'next/link';

export default function Home() {
  return (
    <>
      <header>
        <nav>
          <div className="logo">광고<span>잇다</span></div>
          <div className="menu">
            <Link href="/creators">인플루언서 검색</Link>
            <Link href="/creator-register">인플루언서 등록</Link>
            <Link href="/campaign">광고 의뢰</Link>
            <Link href="/admin">관리자</Link>
          </div>
        </nav>
      </header>

      <section className="hero">
        <div className="container hero-grid">
          <div>
            <div className="badge">실제 플랫폼 MVP</div>
            <h1>광고주가 직접 찾고<br /><span>인플루언서가 직접 등록하는 플랫폼</span></h1>
            <p className="lead">광고잇다는 지역, 카테고리, 채널, 단가 기준으로 광고주와 인플루언서를 연결합니다.</p>
            <Link className="btn primary" href="/creators">인플루언서 찾기</Link>{' '}
            <Link className="btn secondary" href="/creator-register">인플루언서 등록</Link>
          </div>
          <div className="panel">
            <h3>V2 MVP 기능</h3>
            <br />
            <p>✅ 인플루언서 검색</p>
            <p>✅ 인플루언서 등록</p>
            <p>✅ 광고주 캠페인 의뢰</p>
            <p>✅ 관리자 페이지</p>
          </div>
        </div>
      </section>

      <section>
        <div className="container grid">
          <div className="card"><h3>광고주</h3><p>조건에 맞는 인플루언서를 직접 검색하고 캠페인을 의뢰합니다.</p></div>
          <div className="card"><h3>인플루언서</h3><p>활동 지역, 채널, 단가, 포트폴리오를 등록합니다.</p></div>
          <div className="card"><h3>관리자</h3><p>초기에는 수동 매칭으로 시장 반응을 빠르게 확인합니다.</p></div>
        </div>
      </section>

      <footer>© 2026 광고잇다</footer>
    </>
  );
}
