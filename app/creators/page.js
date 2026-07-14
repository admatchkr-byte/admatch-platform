'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';

export default function CreatorsPage() {
  const [creators, setCreators] = useState([]);
  const [filters, setFilters] = useState({ region: '', category: '', channel: '', budget: '' });
  const [message, setMessage] = useState('');

  async function loadCreators() {
    setMessage('');
    let query = supabase.from('profiles').select('*').eq('user_type', 'creator').order('created_at', { ascending: false });
    if (filters.region) query = query.eq('region', filters.region);
    if (filters.category) query = query.eq('category', filters.category);
    if (filters.channel) query = query.eq('channel', filters.channel);
    if (filters.budget) query = query.lte('price', Number(filters.budget));

    const { data, error } = await query;
    if (error) {
      setMessage(error.message || '인플루언서 데이터를 불러오지 못했습니다.');
      setCreators([]);
      return;
    }
    setCreators(data || []);
  }

  useEffect(() => { loadCreators(); }, []);

  return (
    <main>
      <header><nav><Link className="logo" href="/">광고<span>잇다</span></Link></nav></header>
      <section>
        <div className="container">
          <h2>인플루언서 검색</h2>
          <p className="desc">광고주가 원하는 조건으로 검색합니다.</p>
          <div className="filters">
            <select onChange={e => setFilters({...filters, region:e.target.value})}><option value="">전체 지역</option><option>대구</option><option>서울</option><option>부산</option><option>전국</option></select>
            <select onChange={e => setFilters({...filters, category:e.target.value})}><option value="">전체 카테고리</option><option>맛집</option><option>뷰티</option><option>패션</option><option>여행</option><option>생활</option></select>
            <select onChange={e => setFilters({...filters, channel:e.target.value})}><option value="">전체 채널</option><option>인스타그램</option><option>블로그</option><option>유튜브</option><option>틱톡</option></select>
            <select onChange={e => setFilters({...filters, budget:e.target.value})}><option value="">예산 전체</option><option value="100000">10만원 이하</option><option value="300000">30만원 이하</option><option value="500000">50만원 이하</option></select>
            <button className="btn primary" onClick={loadCreators}>검색</button>
          </div>
          {message && <div className="notice">{message}</div>}
          <div className="profile-list">
            {creators.map(c => (
              <div className="card" key={c.id}>
                <h3>{c.name}</h3>
                <span className="tag">{c.region}</span><span className="tag">{c.category}</span><span className="tag">{c.channel}</span>
                <p>{c.intro}</p>
                <p className="small">팔로워 {Number(c.followers || 0).toLocaleString()} · 평균조회 {Number(c.avg_views || 0).toLocaleString()}</p>
                <p className="price">{Number(c.price || 0).toLocaleString()}원</p>
                <p className="small">연락처: {c.contact}</p>
                <Link
  href={`/creator/${c.id}`}
  className="btn primary"
>
  상세보기
</Link>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}


