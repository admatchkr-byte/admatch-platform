'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase';

export default function CreatorDetailPage() {
  const params = useParams();
  const creatorId = params?.id;

  const [creator, setCreator] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!creatorId) return;

    async function loadCreator() {
      setLoading(true);
      setMessage('');

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', creatorId)
        .eq('user_type', 'creator')
        .maybeSingle();

      if (error) {
        console.error(error);
        setMessage(
          error.message || '크리에이터 정보를 불러오지 못했습니다.'
        );
        setCreator(null);
        setLoading(false);
        return;
      }

      if (!data) {
        setMessage('등록된 크리에이터를 찾을 수 없습니다.');
        setCreator(null);
        setLoading(false);
        return;
      }

      setCreator(data);
      setLoading(false);
    }

    loadCreator();
  }, [creatorId]);

  if (loading) {
    return (
      <main>
        <header>
          <nav>
            <Link className="logo" href="/">
              광고<span>잇다</span>
            </Link>
          </nav>
        </header>

        <section>
          <div className="container">
            <div className="notice">크리에이터 정보를 불러오는 중입니다.</div>
          </div>
        </section>
      </main>
    );
  }

  if (!creator) {
    return (
      <main>
        <header>
          <nav>
            <Link className="logo" href="/">
              광고<span>잇다</span>
            </Link>
          </nav>
        </header>

        <section>
          <div className="container">
            <div className="notice">
              {message || '크리에이터 정보를 찾을 수 없습니다.'}
            </div>

            <Link href="/creators" className="btn">
              목록으로 돌아가기
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main>
      <header>
        <nav>
          <Link className="logo" href="/">
            광고<span>잇다</span>
          </Link>
        </nav>
      </header>

      <section>
        <div className="container">
          <Link href="/creators" className="small">
            ← 인플루언서 목록
          </Link>

          <div className="creator-detail">
            <div className="card">
              <div className="creator-detail-header">
                <div>
                  <p className="small">크리에이터</p>
                  <h2>{creator.name}</h2>
                </div>

                <p className="price">
                  {Number(creator.price || 0).toLocaleString()}원
                </p>
              </div>

              <div className="creator-tags">
                {creator.region && (
                  <span className="tag">{creator.region}</span>
                )}

                {creator.category && (
                  <span className="tag">{creator.category}</span>
                )}

                {creator.channel && (
                  <span className="tag">{creator.channel}</span>
                )}
              </div>

              <div className="creator-section">
                <h3>소개</h3>
                <p>
                  {creator.intro || '등록된 소개가 없습니다.'}
                </p>
              </div>

              <div className="creator-stats">
                <div className="stat-box">
                  <p className="small">팔로워</p>
                  <strong>
                    {Number(creator.followers || 0).toLocaleString()}명
                  </strong>
                </div>

                <div className="stat-box">
                  <p className="small">평균 조회수</p>
                  <strong>
                    {Number(creator.avg_views || 0).toLocaleString()}회
                  </strong>
                </div>

                <div className="stat-box">
                  <p className="small">희망 광고비</p>
                  <strong>
                    {Number(creator.price || 0).toLocaleString()}원
                  </strong>
                </div>
              </div>

              {creator.portfolio_url && (
                <div className="creator-section">
                  <h3>포트폴리오</h3>

                  <a
                    href={creator.portfolio_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn"
                  >
                    포트폴리오 보기
                  </a>
                </div>
              )}

              <div className="creator-section">
                <h3>리뷰</h3>
                <p className="small">
                  아직 등록된 협업 리뷰가 없습니다.
                </p>
              </div>

              <div className="creator-actions">
                <Link
                  href={`/proposal/new?creatorId=${creator.id}`}
                  className="btn primary"
                >
                  협업 제안하기
                </Link>

                <Link href="/creators" className="btn">
                  다른 크리에이터 보기
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

