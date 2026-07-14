'use client'

import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function SignupPage() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [userType, setUserType] = useState('advertiser')
  const [message, setMessage] = useState('')

  const handleSignup = async (e) => {
    e.preventDefault()
    setMessage('회원가입 중입니다...')

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    })

    if (error) {
      setMessage('회원가입 실패: ' + error.message)
      return
    }

    if (!data.user) {
      setMessage('회원가입은 되었지만 사용자 정보를 가져오지 못했습니다.')
      return
    }

    const { error: profileError } = await supabase
      .from('member_profiles')
      .insert([
        {
          id: data.user.id,
          email: email,
          user_type: userType,
        },
      ])

    if (profileError) {
      setMessage('프로필 저장 실패: ' + profileError.message)
      return
    }

    setMessage('회원가입 성공! 로그인 페이지로 이동합니다.')

    setTimeout(() => {
      router.push('/login')
    }, 1000)
  }

  return (
    <main style={{ maxWidth: 400, margin: '80px auto', padding: 20 }}>
      <h1>회원가입</h1>

      <form onSubmit={handleSignup}>
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

        <select
          value={userType}
          onChange={(e) => setUserType(e.target.value)}
          style={{ width: '100%', padding: 12, marginBottom: 10 }}
        >
          <option value="advertiser">광고주</option>
          <option value="creator">인플루언서</option>
        </select>

        <button type="submit" style={{ width: '100%', padding: 12 }}>
          회원가입
        </button>
      </form>

      {message && <p>{message}</p>}
    </main>
  )
}