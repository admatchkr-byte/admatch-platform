'use client'

import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')

  const handleLogin = async (e) => {
    e.preventDefault()

    setMessage('로그인 중입니다...')

    try {
      // 1. 로그인
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        setMessage('로그인 실패: ' + error.message)
        return
      }

      if (!data?.user?.id) {
        setMessage('로그인 사용자 정보를 확인할 수 없습니다.')
        return
      }

      const userId = data.user.id

      // 2. 회원 유형 조회
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('user_type')
        .eq('id', userId)
        .maybeSingle()

      if (profileError) {
        console.error('프로필 조회 오류:', profileError)

        setMessage(
          '회원 유형 조회 실패: ' + profileError.message
        )

        return
      }

      if (!profile) {
        setMessage('회원 프로필 정보를 찾을 수 없습니다.')
        return
      }

      // 3. 회원 유형에 따라 이동
      if (profile.user_type === 'advertiser') {
        router.replace('/advertiser')
        return
      }

      if (profile.user_type === 'creator') {
        router.replace('/creator')
        return
      }

      setMessage('회원 유형을 확인할 수 없습니다.')
    } catch (error) {
      console.error('로그인 처리 오류:', error)

      setMessage(
        '로그인 처리 중 오류가 발생했습니다: ' +
          (error?.message || '알 수 없는 오류')
      )
    }
  }

  return (
    <main
      style={{
        maxWidth: 400,
        margin: '80px auto',
        padding: 20,
      }}
    >
      <h1>로그인</h1>

      <form onSubmit={handleLogin}>
        <input
          type="email"
          placeholder="이메일"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{
            width: '100%',
            padding: 12,
            marginBottom: 10,
          }}
        />

        <input
          type="password"
          placeholder="비밀번호"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{
            width: '100%',
            padding: 12,
            marginBottom: 10,
          }}
        />

        <button
          type="submit"
          style={{
            width: '100%',
            padding: 12,
          }}
        >
          로그인
        </button>
      </form>

      {message && <p>{message}</p>}
    </main>
  )
}
