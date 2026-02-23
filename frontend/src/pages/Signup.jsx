
import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { API_ORIGIN, signup } from '../api'
import { required, isEmail, minLen } from '../validation'

export default function Signup() {
  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [agree, setAgree] = useState(false)
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const validate = () => {
    const e = {}
    if (!required(fullName)) e.fullName = 'Full name is required'
    if (!required(username)) e.username = 'Username is required'
    else if (!/^[a-zA-Z0-9._-]{3,50}$/.test(username.trim())) e.username = 'Use 3-50 chars: letters, numbers, . _ -'
    if (!required(email) || !isEmail(email)) e.email = 'Enter a valid email'
    if (!minLen(password, 8)) e.password = 'Minimum 8 characters'
    if (confirm !== password) e.confirm = 'Passwords do not match'
    if (!agree) e.agree = 'You must agree to Terms and Privacy Policy'
    setErrors(e)
    return Object.keys(e).length === 0
  }
  const submit = async (e) => {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      const res = await signup(username.trim(), password)
      if (res.ok) {
        navigate('/login')
      } else {
        const t = (await res.text()).trim() || 'Signup failed'
        if (/username/i.test(t)) setErrors({ username: t })
        else setErrors({ form: t })
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
        <div className="signup-card">
          <h2 className="signup-title">Join <span>Clarify</span></h2>
          <p className="signup-subtitle">Create your account and start learning</p>

          <form className="signup-form" onSubmit={submit}>
            <label>Full Name</label>
            <input
              className="signup-input"
              placeholder="John Doe"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
            />
            {errors.fullName && <div className="error">{errors.fullName}</div>}

            <label>Username</label>
            <input
              className="signup-input"
              placeholder="john_doe"
              value={username}
              onChange={e => setUsername(e.target.value)}
            />
            {errors.username && <div className="error">{errors.username}</div>}

            <label>Email Address</label>
            <input
              className="signup-input"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
            {errors.email && <div className="error">{errors.email}</div>}

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

            <label>Confirm Password</label>
            <div className="signup-password-wrap">
              <input
                className="signup-input"
                type={showConfirm ? 'text' : 'password'}
                placeholder="********"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
              />
              <button
                type="button"
                className="signup-eye-btn"
                onClick={() => setShowConfirm(x => !x)}
              >
                {showConfirm ? 'Hide' : 'Show'}
              </button>
            </div>
            {errors.confirm && <div className="error">{errors.confirm}</div>}

            <label className="signup-agree">
              <input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} />
              <span>
                I agree to the <Link to="/terms">Terms of Service</Link> and <Link to="/privacy">Privacy Policy</Link>
              </span>
            </label>
            {errors.agree && <div className="error">{errors.agree}</div>}
            {errors.form && <div className="error">{errors.form}</div>}

            <button className="signup-submit" type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Account'}
            </button>

            <div className="signup-alt muted">Or continue with</div>
            <div className="signup-socials">
              <button type="button" className="signup-social-btn" onClick={() => { window.location.href = `${API_ORIGIN}/oauth2/authorization/google` }}>
                Google
              </button>
              <button type="button" className="signup-social-btn" onClick={() => { window.location.href = `${API_ORIGIN}/oauth2/authorization/github` }}>
                GitHub
              </button>
            </div>

            <div className="muted signup-login-link">
              Already have an account? <Link to="/login">Log In</Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
