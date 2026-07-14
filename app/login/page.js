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

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setMessage('로그인 실패: ' + error.message)
      return
    }

    const userId = data.user.id

    const { data: profile, error: profileError } = await supabase
      .from('member_profiles')
      .select('user_type')
      .eq('id', userId)
      .single()

    if (profileError) {
      setMessage('회원 유형 조회 실패: ' + profileError.message)
      return
    }

    if (profile.user_type === 'advertiser') {
      router.push('/advertiser')
    } else if (profile.user_type === 'creator') {
      router.push('/creator')
    } else {
      router.push('/')
    }
  }

  return (
    <main style={{ maxWidth: 400, margin: '80px auto', padding: 20 }}>
      <h1>로그인</h1>

      <form onSubmit={handleLogin}>
        <input
          type="email"
          placeholder="이메일"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{ width: '100%', padding: 12, marginBottom: 10 }}
        />

        <input
          type="password"
          placeholder="비밀번호"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{ width: '100%', padding: 12, marginBottom: 10 }}
        />

        <button type="submit" style={{ width: '100%', padding: 12 }}>
          로그인
        </button>
      </form>

      {message && <p>{message}</p>}
    </main>
  )
}



