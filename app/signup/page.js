'use client'

import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function SignupPage() {
  const router = useRouter()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [userType, setUserType] = useState('advertiser')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSignup = async (e) => {
    e.preventDefault()

    if (!name.trim()) {
      setMessage('이름을 입력해 주세요.')
      return
    }

    setSubmitting(true)
    setMessage('회원가입 중입니다...')

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      })

      if (error) {
        throw error
      }

      if (!data.user) {
        setMessage('회원가입은 되었지만 사용자 정보를 가져오지 못했습니다.')
        return
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .insert([
          {
            id: data.user.id,
            name: name.trim(),
            email: email,
            user_type: userType,
          },
        ])

      if (profileError) {
        throw profileError
      }

      setMessage('회원가입 성공! 로그인 페이지로 이동합니다.')

      setTimeout(() => {
        router.push('/login')
      }, 1000)
    } catch (error) {
      console.error(error)
      setMessage('회원가입 실패: ' + (error?.message || '알 수 없는 오류'))
    } finally {
      setSubmitting(false)
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
      <h1>회원가입</h1>

      <form onSubmit={handleSignup}>
        <input
          type="text"
          placeholder="이름 또는 업체명"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          style={{
            width: '100%',
            padding: 12,
            marginBottom: 10,
            boxSizing: 'border-box',
          }}
        />

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
            boxSizing: 'border-box',
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
            boxSizing: 'border-box',
          }}
        />

        <select
          value={userType}
          onChange={(e) => setUserType(e.target.value)}
          style={{
            width: '100%',
            padding: 12,
            marginBottom: 10,
            boxSizing: 'border-box',
          }}
        >
          <option value="advertiser">광고주</option>
          <option value="creator">크리에이터</option>
        </select>

        <button
          type="submit"
          disabled={submitting}
          style={{
            width: '100%',
            padding: 12,
            cursor: submitting ? 'not-allowed' : 'pointer',
            opacity: submitting ? 0.6 : 1,
          }}
        >
          {submitting ? '회원가입 중...' : '회원가입'}
        </button>
      </form>

      {message && <p>{message}</p>}
    </main>
  )
}
