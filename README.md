# 광고잇다 V2 MVP

Vercel 배포용으로 정리한 Next.js + Supabase MVP입니다.

## 포함 기능
- 메인 페이지
- 인플루언서 검색
- 인플루언서 등록
- 광고주 캠페인 의뢰
- 관리자 페이지
- Supabase DB 연결 준비

## 업로드
압축을 풀고 안에 있는 모든 파일과 폴더를 GitHub 저장소에 업로드하세요.

## Supabase 연결
1. Supabase 프로젝트 생성
2. SQL Editor에서 `supabase-schema.sql` 실행
3. Vercel 환경변수에 아래 2개 등록
   - NEXT_PUBLIC_SUPABASE_URL
   - NEXT_PUBLIC_SUPABASE_ANON_KEY
