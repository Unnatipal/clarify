import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { forgotPassword, resetPassword } from '../api'
import { required, minLen } from '../validation'

export default function Reset() {
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [password, setPassword] = useState('')
  const [step, setStep] = useState(1)
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [info, setInfo] = useState('')
  const navigate = useNavigate()
  const requestOtp = async (e) => {
    e.preventDefault()
    const eMap = {}
    if (!required(email)) eMap.email = 'Enter your username or email'
    setErrors(eMap)
    if (Object.keys(eMap).length) return
    setLoading(true)
    try {
      const res = await forgotPassword(email)
      setInfo(`OTP sent. For testing, use code: ${res.otp}`)
      setStep(2)
    } catch {
      setErrors({ form: 'Failed to request OTP' })
    } finally {
      setLoading(false)
    }
  }
  const confirmReset = async (e) => {
    e.preventDefault()
    const eMap = {}
    if (!required(otp)) eMap.otp = 'Enter the 6-digit code'
    if (!minLen(password, 8)) eMap.password = 'Minimum 8 characters'
    setErrors(eMap)
    if (Object.keys(eMap).length) return
    setLoading(true)
    try {
      const res = await resetPassword(email, otp, password)
      if (res.ok) {
        navigate('/login')
      } else {
        setErrors({ form: 'Reset failed' })
      }
    } catch {
      setErrors({ form: 'Server not reachable' })
    } finally {
      setLoading(false)
    }
  }
  return (
    <div className="container" style={{ maxWidth: 520 }}>
      <Link to="/" className="muted">← Back to Home</Link>
      <div className="card" style={{ marginTop: 16 }}>
        <h2>{step === 1 ? 'Forgot Password' : 'Reset Password'}</h2>
        <form className="form" onSubmit={step === 1 ? requestOtp : confirmReset}>
          {step === 1 ? (
            <>
              <label>Username or Email</label>
              <input className="input" placeholder="user or you@example.com" value={email} onChange={e => setEmail(e.target.value)} />
              {errors.email && <div className="error">{errors.email}</div>}
            </>
          ) : (
            <>
              <label>OTP Code</label>
              <input className="input" placeholder="123456" value={otp} onChange={e => setOtp(e.target.value)} />
              {errors.otp && <div className="error">{errors.otp}</div>}
              <label>New Password</label>
              <input className="input" type="password" placeholder="********" value={password} onChange={e => setPassword(e.target.value)} />
              {errors.password && <div className="error">{errors.password}</div>}
            </>
          )}
          {info && <div className="muted">{info}</div>}
          {errors.form && <div className="error">{errors.form}</div>}
          <button className="btn primary" type="submit" disabled={loading}>{loading ? 'Processing...' : step === 1 ? 'Send OTP' : 'Reset Password'}</button>
        </form>
      </div>
    </div>
  )
}
