import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { setAuthCredentials, me, API_ORIGIN } from '../api'
import { required, minLen } from '../validation'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [remember, setRemember] = useState(true)
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const validate = () => {
    const e = {}
    if (!required(username)) e.username = 'Enter your username or email'
    if (!minLen(password, 4)) e.password = 'Minimum 4 characters'
    setErrors(e)
    return Object.keys(e).length === 0
  }
  const submit = async (e) => {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      setAuthCredentials(username.trim(), password)
      const res = await me()
      if (res.ok) {
        if (!remember) localStorage.removeItem('clarifyAuth')
        navigate('/app')
      } else {
        setErrors({ form: 'Invalid username/email or password' })
      }
    } catch {
      setErrors({ form: 'Server not reachable' })
    } finally {
      setLoading(false)
    }
  }
  return (
    <div className="signup-page">
      <span className="signup-spark signup-spark-1" />
      <span className="signup-spark signup-spark-2" />
      <span className="signup-spark signup-spark-3" />
      <span className="signup-spark signup-spark-4" />
      <span className="signup-spark signup-spark-5" />
      <span className="signup-spark signup-spark-6" />

      <Link to="/" className="signup-back">← Back to Home</Link>

      <div className="signup-shell">
        <div className="signup-card login-card">
          <h2 className="signup-title login-title">Welcome to <span>Clarify</span></h2>
          <p className="signup-subtitle">Sign in to get your doubts resolved</p>

          <form className="signup-form" onSubmit={submit}>
            <label>Email Address</label>
            <input
              className="signup-input"
              placeholder="you@example.com"
              value={username}
              onChange={e => setUsername(e.target.value)}
            />
            {errors.username && <div className="error">{errors.username}</div>}

            <label>Password</label>
            <div className="signup-password-wrap">
              <input
                className="signup-input"
                type={showPass ? 'text' : 'password'}
                placeholder="********"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="signup-eye-btn"
                onClick={() => setShowPass(x => !x)}
              >
                {showPass ? 'Hide' : 'Show'}
              </button>
            </div>
            {errors.password && <div className="error">{errors.password}</div>}

            <div className="login-meta">
              <label className="signup-agree">
                <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} />
                <span>Remember me</span>
              </label>
              <Link to="/reset">Forgot password?</Link>
            </div>

            {errors.form && <div className="error">{errors.form}</div>}

            <button className="signup-submit" type="submit" disabled={loading}>
              {loading ? 'Signing In...' : 'Sign In'}
            </button>

            <div className="signup-alt muted">Or continue with</div>
            <div className="signup-socials">
              <button
                type="button"
                className="signup-social-btn"
                onClick={() => { window.location.href = `${API_ORIGIN}/oauth2/authorization/google` }}
              >
                Google
              </button>
              <button
                type="button"
                className="signup-social-btn"
                onClick={() => { window.location.href = `${API_ORIGIN}/oauth2/authorization/github` }}
              >
                GitHub
              </button>
            </div>

            <div className="muted signup-login-link">
              Don&apos;t have an account? <Link to="/signup">Sign up</Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
