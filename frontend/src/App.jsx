import React, { useEffect, useRef, useState } from 'react'
import { BrowserRouter, Routes, Route, useNavigate, useParams, Link, Navigate, useLocation } from 'react-router-dom'
import { listDoubts, createDoubt, getDoubt, addReply, updateStatus, loadStoredAuth, getStoredAuth, clearAuth, getTrendingTopic, me } from './api'
import Home from './pages/Home'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Reset from './pages/Reset'

const TRENDING_TOPICS = ['Science', 'Space', 'Sports', 'Politics', 'Geography', 'History', 'Physics', 'Psychology']

function formatTimeAgo(value) {
  if (!value) return 'just now'
  const ts = new Date(value).getTime()
  if (Number.isNaN(ts)) return 'just now'
  const diff = Date.now() - ts
  const mins = Math.floor(diff / (1000 * 60))
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.floor(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

function extractTags(doubt) {
  const words = `${doubt.title || ''} ${doubt.description || ''}`
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3)
  const unique = Array.from(new Set(words))
  return unique.slice(0, 4)
}

function estimatedViews(doubt) {
  const replies = (doubt.replies || []).length
  const id = Number(doubt.id || 0)
  return 80 + id * 11 + replies * 13
}

function hasAnswer(doubt) {
  return (doubt.replies || []).length > 0 || doubt.status === 'SOLVED'
}

function matchesRecentFilter(doubt, filter) {
  if (filter === 'OPEN') return !hasAnswer(doubt)
  if (filter === 'ANSWERED') return hasAnswer(doubt)
  return true
}

function normalizeIdentity(value) {
  return String(value || '').trim().toLowerCase()
}

function currentIdentityCandidates(credential) {
  const normalized = normalizeIdentity(credential)
  if (!normalized) return []
  const parts = normalized.split('@')
  const candidates = [normalized]
  if (parts.length > 1 && parts[0]) candidates.push(parts[0])
  return Array.from(new Set(candidates))
}

function isCurrentUserIdentity(name, credential) {
  const normalizedName = normalizeIdentity(name)
  if (!normalizedName) return false
  const identities = currentIdentityCandidates(credential)
  return identities.includes(normalizedName)
}

function toEpoch(value) {
  const ts = new Date(value || '').getTime()
  return Number.isNaN(ts) ? 0 : ts
}

function buildAnswerNotifications(doubts, credential) {
  return doubts
    .map(doubt => {
      if (!isCurrentUserIdentity(doubt.authorName, credential)) return null
      const latestReply = (doubt.replies || [])
        .filter(reply => !isCurrentUserIdentity(reply.authorName, credential))
        .sort((a, b) => toEpoch(b.createdAt) - toEpoch(a.createdAt))[0]
      if (!latestReply) return null
      return {
        doubtId: doubt.id,
        title: doubt.title,
        from: latestReply.authorName || 'Someone',
        reply: latestReply.message || '',
        createdAt: latestReply.createdAt
      }
    })
    .filter(Boolean)
    .sort((a, b) => toEpoch(b.createdAt) - toEpoch(a.createdAt))
}

function dayKeyLocal(value) {
  const date = new Date(value || '')
  if (Number.isNaN(date.getTime())) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function calculateDayStreak(timestamps) {
  const daySet = new Set(timestamps.map(dayKeyLocal).filter(Boolean))
  if (daySet.size === 0) return 0
  const cursor = new Date()
  cursor.setHours(0, 0, 0, 0)
  let streak = 0
  while (daySet.has(dayKeyLocal(cursor))) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

function addDays(date, delta) {
  const next = new Date(date)
  next.setDate(next.getDate() + delta)
  return next
}

function heatLevel(count, future) {
  if (future) return 'level-future'
  if (count <= 0) return 'level-0'
  if (count === 1) return 'level-1'
  if (count <= 3) return 'level-2'
  if (count <= 5) return 'level-3'
  return 'level-4'
}

function buildMonthlyUsageCalendar(timestamps, monthOffset = 0) {
  const counts = new Map()
  for (const ts of timestamps) {
    const key = dayKeyLocal(ts)
    if (!key) continue
    counts.set(key, (counts.get(key) || 0) + 1)
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const monthDate = new Date(today.getFullYear(), today.getMonth() - monthOffset, 1)
  monthDate.setHours(0, 0, 0, 0)

  const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1)
  monthStart.setHours(0, 0, 0, 0)
  const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0)
  monthEnd.setHours(0, 0, 0, 0)

  const gridStart = addDays(monthStart, -monthStart.getDay())
  const gridEnd = addDays(monthEnd, 6 - monthEnd.getDay())

  const dayCells = []
  for (let cursor = new Date(gridStart); cursor <= gridEnd; cursor = addDays(cursor, 1)) {
    const key = dayKeyLocal(cursor)
    dayCells.push({
      key,
      date: new Date(cursor),
      count: counts.get(key) || 0,
      inMonth: cursor.getMonth() === monthStart.getMonth() && cursor.getFullYear() === monthStart.getFullYear(),
      future: cursor > today
    })
  }

  const monthLabel = monthStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const totalActions = dayCells.reduce((sum, day) => (day.inMonth && !day.future ? sum + day.count : sum), 0)
  const activeDays = dayCells.reduce((sum, day) => (day.inMonth && day.count > 0 ? sum + 1 : sum), 0)
  return { dayCells, monthLabel, totalActions, activeDays }
}

function DoubtScrollList({
  doubts,
  onSelect,
  currentUser,
  expandedDoubtId,
  onToggleAnswer,
  answerDrafts,
  answerErrors,
  onAnswerDraftChange,
  onAnswerSubmit,
  answerSubmittingId
}) {
  return (
    <div className="question-scroll">
      {doubts.length === 0 && <div className="muted">No doubts available.</div>}
      {doubts.map(d => {
        const tags = extractTags(d)
        const replies = (d.replies || []).length
        const answered = hasAnswer(d)
        const statusText = answered ? 'Answered' : 'Open'
        const statusClass = answered ? 'answered' : 'open'
        const isExpanded = expandedDoubtId === d.id
        const replyDraft = answerDrafts[d.id] || ''
        const replyError = answerErrors[d.id] || ''
        const isSubmitting = answerSubmittingId === d.id
        return (
          <article key={d.id} className={`question-item ${statusClass}`}>
            <div className="question-head">
              <div className="question-author">
                <div className="question-avatar">{(d.authorName || 'U').slice(0, 2).toUpperCase()}</div>
                <div>
                  <div className="question-name">{d.authorName || 'Unknown user'}</div>
                  <div className="question-time">{formatTimeAgo(d.createdAt)}</div>
                </div>
              </div>
              <span className={`question-status ${statusClass}`}>{statusText}</span>
            </div>
            <button className="question-title-btn" onClick={() => onSelect(d.id)}>
              {d.title}
            </button>
            <p className="question-desc">{d.description}</p>
            {tags.length > 0 && (
              <div className="question-tags">
                {tags.map(tag => <span key={`${d.id}-${tag}`} className="question-tag">{tag}</span>)}
              </div>
            )}
            <div className="question-actions">
              <div className="question-meta">
                <span>💬 {replies} answer{replies === 1 ? '' : 's'}</span>
                <span>👁 {estimatedViews(d)} views</span>
              </div>
              <div className="question-action-buttons">
                <button type="button" className="question-inline-btn" onClick={() => onSelect(d.id)}>View</button>
                <button type="button" className="question-inline-btn primary" onClick={() => onToggleAnswer(d.id)}>
                  {isExpanded ? 'Close' : 'Answer'}
                </button>
              </div>
            </div>
            {isExpanded && (
              <div className="question-answer-panel">
                <div className="question-answer-title">Answers</div>
                <div className="question-reply-list">
                  {(d.replies || []).length === 0 && <div className="muted">No answers yet. Be the first to answer.</div>}
                  {(d.replies || []).map(reply => (
                    <div key={reply.id} className="question-reply-item">
                      <div className="question-reply-author">{reply.authorName || 'User'}</div>
                      <div className="question-reply-message">{reply.message}</div>
                      <div className="question-reply-time">{formatTimeAgo(reply.createdAt)}</div>
                    </div>
                  ))}
                </div>
                <form
                  onSubmit={e => {
                    e.preventDefault()
                    onAnswerSubmit(d.id)
                  }}
                >
                  <textarea
                    className="question-reply-input"
                    placeholder="Write your answer..."
                    value={replyDraft}
                    onChange={e => onAnswerDraftChange(d.id, e.target.value)}
                  />
                  {replyError && <div className="error" style={{ marginBottom: 8 }}>{replyError}</div>}
                  <div className="question-reply-footer">
                    <span className="muted">Replying as: {currentUser || 'User'}</span>
                    <button type="submit" className="question-inline-btn primary" disabled={isSubmitting}>
                      {isSubmitting ? 'Posting...' : 'Post Answer'}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </article>
        )
      })}
    </div>
  )
}

function DoubtForm({ onCreate, currentUser }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const submit = async (e) => {
    e.preventDefault()
    const cleanTitle = title.trim()
    const cleanDescription = description.trim()
    if (!cleanTitle || !cleanDescription) {
      setFormError('Title and description are required.')
      return
    }
    setFormError('')
    setSubmitting(true)
    try {
      await onCreate({ title: cleanTitle, description: cleanDescription, authorName: currentUser || 'User' })
      setTitle('')
      setDescription('')
    } catch (err) {
      setFormError(err?.message || 'Failed to submit doubt')
    } finally {
      setSubmitting(false)
    }
  }
  return (
    <form onSubmit={submit}>
      <h2>Ask Doubt</h2>
      <input placeholder="Title" value={title} onChange={e => setTitle(e.target.value)} />
      <br />
      <textarea placeholder="Description" value={description} onChange={e => setDescription(e.target.value)} />
      <br />
      <div className="muted" style={{ marginBottom: 10 }}>Posting as: <strong>{currentUser || 'User'}</strong></div>
      {formError && <div className="error" style={{ marginBottom: 8 }}>{formError}</div>}
      <button type="submit" disabled={submitting}>{submitting ? 'Submitting...' : 'Submit'}</button>
    </form>
  )
}

function ReplyForm({ onReply, currentUser }) {
  const [message, setMessage] = useState('')
  return (
    <div>
      <h3>Add Reply</h3>
      <textarea placeholder="Message" value={message} onChange={e => setMessage(e.target.value)} />
      <br />
      <div className="muted" style={{ marginBottom: 10 }}>Replying as: <strong>{currentUser || 'User'}</strong></div>
      <button onClick={() => onReply({ authorName: currentUser || 'User', message })}>Reply</button>
    </div>
  )
}

function DoubtDetail({ onRefresh }) {
  const { id } = useParams()
  const auth = getStoredAuth()
  const currentCredential = auth.username || ''
  const currentUserDisplay = currentCredential.includes('@') ? currentCredential.split('@')[0] : (currentCredential || 'User')
  const [doubt, setDoubt] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    setError('')
    getDoubt(id)
      .then(setDoubt)
      .catch(err => setError(err.message || 'Failed to load doubt'))
  }, [id])
  if (error) return <div className="container"><div className="error">{error}</div></div>
  if (!doubt) return <div>Loading...</div>
  return (
    <div>
      <Link to="/">Back</Link>
      <h2>{doubt.title}</h2>
      <div>by {doubt.authorName}</div>
      <div>{doubt.description}</div>
      <div>Status: {doubt.status}</div>
      <button onClick={async () => {
        try {
          setError('')
          await updateStatus(id, doubt.status === 'OPEN' ? 'SOLVED' : 'OPEN')
          const d = await getDoubt(id)
          setDoubt(d)
          onRefresh()
        } catch (err) {
          setError(err.message || 'Failed to update status')
        }
      }}>Toggle Status</button>
      <h3>Replies</h3>
      <ul>
        {(doubt.replies || []).map(r => (
          <li key={r.id}>
            <div>{r.message}</div>
            <div>by {r.authorName}</div>
          </li>
        ))}
      </ul>
      <ReplyForm onReply={async r => {
        try {
          setError('')
          await addReply(id, r)
          const d = await getDoubt(id)
          setDoubt(d)
          onRefresh()
        } catch (err) {
          setError(err.message || 'Failed to add reply')
        }
      }} currentUser={currentUserDisplay} />
    </div>
  )
}

function Nav() {
  const location = useLocation()
  const navigate = useNavigate()
  const auth = getStoredAuth()
  const isLoggedIn = Boolean(auth.username && auth.password)
  const isFirstPage = location.pathname === '/'
  const [open, setOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const accountWrapRef = useRef(null)
  const notifWrapRef = useRef(null)
  const [profile, setProfile] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('clarifyProfile') || '{}')
    } catch {
      return {}
    }
  })

  const credential = auth.username || 'User'
  const username = credential.includes('@') ? credential.split('@')[0] : credential
  const avatarDataUrl = profile.avatarDataUrl || ''
  const avatarInitial = (username || 'U').slice(0, 1).toUpperCase()
  const seenStorageKey = `clarifyNotifSeen:${normalizeIdentity(credential) || 'guest'}`
  const [lastSeenAt, setLastSeenAt] = useState(() => {
    try {
      return Number(localStorage.getItem(seenStorageKey) || '0')
    } catch {
      return 0
    }
  })

  useEffect(() => {
    if (!isLoggedIn) {
      setOpen(false)
      setNotifOpen(false)
      setNotifications([])
    }
  }, [isLoggedIn])

  useEffect(() => {
    try {
      setLastSeenAt(Number(localStorage.getItem(seenStorageKey) || '0'))
    } catch {
      setLastSeenAt(0)
    }
  }, [seenStorageKey])

  useEffect(() => {
    if (!isLoggedIn || isFirstPage) {
      setNotifications([])
      return
    }

    let cancelled = false
    const refreshNotifications = () => {
      listDoubts()
        .then(list => {
          if (cancelled) return
          setNotifications(buildAnswerNotifications(Array.isArray(list) ? list : [], credential))
        })
        .catch(() => {})
    }

    refreshNotifications()
    const intervalId = window.setInterval(refreshNotifications, 20000)
    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [isLoggedIn, isFirstPage, credential])

  useEffect(() => {
    if (!open && !notifOpen) return
    const handleOutsideClick = (event) => {
      if (accountWrapRef.current && !accountWrapRef.current.contains(event.target)) {
        setOpen(false)
      }
      if (notifWrapRef.current && !notifWrapRef.current.contains(event.target)) {
        setNotifOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    document.addEventListener('touchstart', handleOutsideClick)
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
      document.removeEventListener('touchstart', handleOutsideClick)
    }
  }, [open, notifOpen])

  const saveProfile = (next) => {
    setProfile(next)
    try {
      localStorage.setItem('clarifyProfile', JSON.stringify(next))
    } catch {}
  }

  const onAvatarChange = (e) => {
    const file = e.target.files && e.target.files[0]
    if (!file || !file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = () => {
      saveProfile({ ...profile, avatarDataUrl: String(reader.result || '') })
    }
    reader.readAsDataURL(file)
  }

  const onLogout = () => {
    clearAuth()
    setOpen(false)
    setNotifOpen(false)
    window.location.href = '/'
  }

  const unreadCount = notifications.filter(item => toEpoch(item.createdAt) > lastSeenAt).length

  const markNotificationsSeen = () => {
    const now = Date.now()
    setLastSeenAt(now)
    try {
      localStorage.setItem(seenStorageKey, String(now))
    } catch {}
  }

  const toggleNotifications = () => {
    setNotifOpen(prev => {
      const next = !prev
      if (next) markNotificationsSeen()
      return next
    })
  }

  const openDoubtFromNotification = (doubtId) => {
    setNotifOpen(false)
    navigate(`/doubt/${doubtId}`)
  }

  return (
    <nav className="nav">
      <div className="nav-left">
        <Link to="/" className="brand"><div className="badge">C</div> Clarify</Link>
      </div>
      <div className="nav-right">
        {isLoggedIn && !isFirstPage ? (
          <>
            <div className="notif-wrap" ref={notifWrapRef}>
              <button className="icon-btn notif-btn" aria-label="Notifications" onClick={toggleNotifications}>
                <span aria-hidden>🔔</span>
                {unreadCount > 0 && <span className="notif-dot" />}
              </button>
              {notifOpen && (
                <div className="notif-menu">
                  <div className="notif-title">Notifications</div>
                  {notifications.length === 0 && (
                    <div className="muted notif-empty">No answers on your doubts yet.</div>
                  )}
                  {notifications.map(item => (
                    <button
                      key={`${item.doubtId}-${item.createdAt}`}
                      type="button"
                      className="notif-item"
                      onClick={() => openDoubtFromNotification(item.doubtId)}
                    >
                      <div className="notif-item-title">{item.from} answered your doubt</div>
                      <div className="notif-item-sub">{item.title}</div>
                      {item.reply && <div className="notif-item-reply">{item.reply}</div>}
                      <div className="notif-item-time">{formatTimeAgo(item.createdAt)}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="account-wrap" ref={accountWrapRef}>
              <button className="avatar-sm avatar-trigger" onClick={() => setOpen(x => !x)} aria-label="Account menu">
                {avatarDataUrl ? <img src={avatarDataUrl} alt="Profile" className="avatar-image" /> : avatarInitial}
              </button>
              {open && (
                <div className="account-menu">
                  <div className="account-header">
                    <div className="avatar-lg">
                      {avatarDataUrl ? <img src={avatarDataUrl} alt="Profile" className="avatar-image" /> : avatarInitial}
                    </div>
                    <div>
                      <div className="account-name">{username}</div>
                      <div className="account-email">{credential}</div>
                    </div>
                  </div>
                  <label className="account-label">
                    Username
                    <input className="account-input account-input-readonly" value={username} readOnly />
                  </label>
                  <label className="account-label">
                    Login Credential
                    <input className="account-input account-input-readonly" value={credential} readOnly />
                  </label>
                  <div className="account-section-title">Edit Profile</div>
                  <label className="account-upload">
                    Upload / Update Profile Picture
                    <input type="file" accept="image/*" onChange={onAvatarChange} />
                  </label>
                  <button className="btn account-logout" onClick={onLogout}>Logout</button>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <Link to="/login" className="btn">Log In</Link>
            <Link to="/signup" className="btn primary">Sign Up</Link>
          </>
        )}
      </div>
    </nav>
  )
}

function DoubtApp() {
  const PAGE_SIZE = 5
  const [doubts, setDoubts] = useState([])
  const [filter, setFilter] = useState('ALL')
  const [error, setError] = useState('')
  const [expandedDoubtId, setExpandedDoubtId] = useState(null)
  const [answerDrafts, setAnswerDrafts] = useState({})
  const [answerErrors, setAnswerErrors] = useState({})
  const [answerSubmittingId, setAnswerSubmittingId] = useState(null)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [selectedTopic, setSelectedTopic] = useState(TRENDING_TOPICS[0])
  const [topicItems, setTopicItems] = useState([])
  const [topicLoading, setTopicLoading] = useState(false)
  const [topicError, setTopicError] = useState('')
  const [streakMonthOffset, setStreakMonthOffset] = useState(0)
  const canLoadMoreRef = useRef(true)
  const navigate = useNavigate()
  const auth = getStoredAuth()
  const currentCredential = auth.username || ''
  const currentUserDisplay = currentCredential.includes('@') ? currentCredential.split('@')[0] : (currentCredential || 'User')
  const refreshDoubts = () => listDoubts()
    .then(setDoubts)
    .catch(err => setError(err.message || 'Failed to load doubts'))
  useEffect(() => { refreshDoubts() }, [])
  const filteredDoubts = doubts.filter(d => matchesRecentFilter(d, filter))
  const askedByUser = doubts.filter(d => isCurrentUserIdentity(d.authorName, currentCredential))
  const solvedByYou = doubts.filter(d =>
    !isCurrentUserIdentity(d.authorName, currentCredential) &&
    (d.replies || []).some(reply => isCurrentUserIdentity(reply.authorName, currentCredential))
  )
  const repliedByUserAt = doubts.flatMap(d =>
    (d.replies || [])
      .filter(reply => isCurrentUserIdentity(reply.authorName, currentCredential))
      .map(reply => reply.createdAt)
  )
  const usageTimestamps = [
    ...askedByUser.map(d => d.createdAt),
    ...repliedByUserAt
  ]
  const clarifyStreak = calculateDayStreak([
    ...usageTimestamps
  ])
  const usageCalendar = buildMonthlyUsageCalendar(usageTimestamps, streakMonthOffset)
  const visibleDoubts = filteredDoubts.slice(0, visibleCount)
  const hasMoreDoubts = visibleCount < filteredDoubts.length

  useEffect(() => {
    if (!expandedDoubtId) return
    const exists = filteredDoubts.some(d => d.id === expandedDoubtId)
    if (!exists) setExpandedDoubtId(null)
  }, [filteredDoubts, expandedDoubtId])

  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
    canLoadMoreRef.current = true
  }, [filter, doubts.length])

  useEffect(() => {
    if (!hasMoreDoubts) return
    let ticking = false
    const onScroll = () => {
      if (ticking) return
      ticking = true
      window.requestAnimationFrame(() => {
        const doc = document.documentElement
        const nearBottom = window.innerHeight + window.scrollY >= doc.scrollHeight - 120
        if (nearBottom && canLoadMoreRef.current) {
          setVisibleCount(prev => Math.min(prev + PAGE_SIZE, filteredDoubts.length))
          canLoadMoreRef.current = false
        } else if (!nearBottom) {
          canLoadMoreRef.current = true
        }
        ticking = false
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [hasMoreDoubts, filteredDoubts.length])

  useEffect(() => {
    let cancelled = false
    setTopicLoading(true)
    setTopicError('')
    getTrendingTopic(selectedTopic, 8)
      .then(items => {
        if (cancelled) return
        setTopicItems(Array.isArray(items) ? items : [])
      })
      .catch(err => {
        if (cancelled) return
        setTopicItems([])
        setTopicError(err.message || 'Failed to load trending updates')
      })
      .finally(() => {
        if (!cancelled) setTopicLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [selectedTopic])

  const handleCreateDoubt = async (d) => {
    try {
      setError('')
      await createDoubt(d)
      await refreshDoubts()
    } catch (err) {
      const message = err?.message || 'Failed to create doubt'
      if (message.includes('401')) {
        clearAuth()
        navigate('/login')
        throw new Error('Session expired. Please log in again.')
      }
      throw new Error(message)
    }
  }

  const toggleAnswerPanel = (doubtId) => {
    setExpandedDoubtId(prev => (prev === doubtId ? null : doubtId))
    setAnswerErrors(prev => ({ ...prev, [doubtId]: '' }))
  }

  const handleAnswerDraftChange = (doubtId, value) => {
    setAnswerDrafts(prev => ({ ...prev, [doubtId]: value }))
    if (answerErrors[doubtId]) setAnswerErrors(prev => ({ ...prev, [doubtId]: '' }))
  }

  const handleInlineAnswerSubmit = async (doubtId) => {
    const message = (answerDrafts[doubtId] || '').trim()
    if (!message) {
      setAnswerErrors(prev => ({ ...prev, [doubtId]: 'Answer cannot be empty.' }))
      return
    }
    setAnswerSubmittingId(doubtId)
    try {
      setError('')
      await addReply(doubtId, { authorName: currentUserDisplay || 'User', message })
      setAnswerDrafts(prev => ({ ...prev, [doubtId]: '' }))
      setAnswerErrors(prev => ({ ...prev, [doubtId]: '' }))
      await refreshDoubts()
      setExpandedDoubtId(doubtId)
    } catch (err) {
      const messageText = err?.message || 'Failed to post answer'
      if (messageText.includes('401')) {
        clearAuth()
        navigate('/login')
        return
      }
      setAnswerErrors(prev => ({ ...prev, [doubtId]: messageText }))
    } finally {
      setAnswerSubmittingId(null)
    }
  }

  return (
    <div className="container">
      {error && <div className="error" style={{ marginBottom: 12 }}>{error}</div>}
      <div className="stats">
        <div className="stat-card"><div style={{fontSize:28,fontWeight:700}}>Clarify</div><div className="muted">Experience collaborative learning</div></div>
        <div className="stat-card"><div style={{fontSize:28,fontWeight:700}}>{askedByUser.length}</div><div className="muted">Doubts Asked</div></div>
        <div className="stat-card"><div style={{fontSize:28,fontWeight:700}}>{solvedByYou.length}</div><div className="muted">Solved by You</div></div>
      </div>
      <div className="feed">
        <div>
          <div className="card">
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <strong>Recent Doubts</strong>
              <div style={{display:'flex',gap:8}}>
                <button className="btn" onClick={()=>setFilter('ALL')}>All</button>
                <button className="btn" onClick={()=>setFilter('OPEN')}>Open</button>
                <button className="btn" onClick={()=>setFilter('ANSWERED')}>Answered</button>
              </div>
            </div>
            <DoubtScrollList
              doubts={visibleDoubts}
              onSelect={id => navigate(`/doubt/${id}`)}
              currentUser={currentUserDisplay}
              expandedDoubtId={expandedDoubtId}
              onToggleAnswer={toggleAnswerPanel}
              answerDrafts={answerDrafts}
              answerErrors={answerErrors}
              onAnswerDraftChange={handleAnswerDraftChange}
              onAnswerSubmit={handleInlineAnswerSubmit}
              answerSubmittingId={answerSubmittingId}
            />
            <div className="load-more-sentinel">
              {hasMoreDoubts ? 'Scroll down to load more doubts...' : `Showing ${filteredDoubts.length} doubt${filteredDoubts.length === 1 ? '' : 's'}`}
            </div>
          </div>
          <div className="card">
            <strong>Trending Topics</strong>
            <div className="topic-chip-row">
              {TRENDING_TOPICS.map(topic => (
                <button
                  key={topic}
                  type="button"
                  className={`badge-pill topic-chip ${selectedTopic === topic ? 'active' : ''}`}
                  onClick={() => setSelectedTopic(topic)}
                >
                  {topic}
                </button>
              ))}
            </div>
            <div className="topic-feed-scroll">
              {topicLoading && <div className="muted">Loading latest {selectedTopic.toLowerCase()} updates...</div>}
              {topicError && <div className="error">{topicError}</div>}
              {!topicLoading && !topicError && topicItems.length === 0 && (
                <div className="muted">No updates found for {selectedTopic} right now.</div>
              )}
              {!topicLoading && !topicError && topicItems.map((item, idx) => (
                <a
                  key={`${item.link || item.title}-${idx}`}
                  className="topic-news-item"
                  href={item.link || '#'}
                  target="_blank"
                  rel="noreferrer"
                >
                  <div className="topic-news-title">{item.title}</div>
                  <div className="topic-news-meta">
                    {(item.source || 'News')} | {formatTimeAgo(item.publishedAt)}
                  </div>
                  <div className="topic-news-summary">{item.summary || 'Open article for details.'}</div>
                </a>
              ))}
            </div>
          </div>
        </div>
        <div>
          <div className="card">
            <strong>Ask Your Doubt</strong>
            <DoubtForm onCreate={handleCreateDoubt} currentUser={currentUserDisplay} />
          </div>
          <div className="card">
            <strong>Solved by You</strong>
            <div className="muted" style={{ marginTop: 8, marginBottom: 10 }}>
              {solvedByYou.length} doubt{solvedByYou.length === 1 ? '' : 's'} answered
            </div>
            <div className="solved-scroll">
              {solvedByYou.length === 0 && <div className="muted">No solved doubts yet.</div>}
              {solvedByYou.map(d => (
                <button
                  key={d.id}
                  type="button"
                  className="solved-item"
                  onClick={() => navigate(`/doubt/${d.id}`)}
                >
                  <div className="solved-item-title">{d.title}</div>
                  <div className="solved-item-meta">
                    Asked by {d.authorName || 'Unknown'} | {(d.replies || []).length} answers
                  </div>
                </button>
              ))}
            </div>
          </div>
          <div className="card">
            <strong>Streak</strong>
            <div className="muted" style={{ marginTop: 8, marginBottom: 10 }}>
              Your continuous usage streak in this app.
            </div>
            <div className="streak-list">
              <div className="streak-item streak-item-primary">
                <div>
                  <div className="streak-name">Clarify</div>
                  <div className="streak-note">Auto from doubts and replies</div>
                </div>
                <div className="streak-value">{clarifyStreak}d</div>
              </div>
              <div className="calendar-scroll">
                <div className="calendar-header">
                  <button
                    type="button"
                    className="month-nav-btn"
                    onClick={() => setStreakMonthOffset(prev => prev + 1)}
                    aria-label="Previous month"
                  >
                    &lt;
                  </button>
                  <div className="calendar-month-title">{usageCalendar.monthLabel}</div>
                  <button
                    type="button"
                    className="month-nav-btn"
                    onClick={() => setStreakMonthOffset(prev => Math.max(0, prev - 1))}
                    aria-label="Next month"
                    disabled={streakMonthOffset === 0}
                  >
                    &gt;
                  </button>
                </div>
                <div className="calendar-weekdays">
                  {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(day => (
                    <span key={day} className="calendar-weekday">{day}</span>
                  ))}
                </div>
                <div className="calendar-grid-month">
                  {usageCalendar.dayCells.map(day => (
                    <span
                      key={day.key}
                      className={`calendar-day ${heatLevel(day.count, day.future)} ${day.inMonth ? '' : 'out-month'}`}
                      title={`${day.date.toDateString()} | ${day.count} action${day.count === 1 ? '' : 's'}`}
                    />
                  ))}
                </div>
              </div>
              <div className="calendar-legend">
                <span>Less</span>
                <span className="calendar-day level-0" />
                <span className="calendar-day level-1" />
                <span className="calendar-day level-2" />
                <span className="calendar-day level-3" />
                <span className="calendar-day level-4" />
                <span>More</span>
              </div>
              <div className="streak-summary">
                <span>{usageCalendar.totalActions} actions in {usageCalendar.monthLabel}</span>
                <span>{usageCalendar.activeDays} active days</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function RequireAuth({ children }) {
  const [status, setStatus] = useState('checking')
  useEffect(() => {
    let cancelled = false
    const auth = getStoredAuth()
    if (!auth.username || !auth.password) {
      setStatus('unauthorized')
      return
    }
    me()
      .then(res => {
        if (cancelled) return
        setStatus(res.ok ? 'ok' : 'unauthorized')
      })
      .catch(() => {
        if (cancelled) return
        setStatus('unauthorized')
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (status === 'checking') {
    return (
      <div className="container">
        <div className="card">Checking login...</div>
      </div>
    )
  }

  if (status !== 'ok') {
    clearAuth()
    return <Navigate to="/login" replace />
  }

  return children
}

function NotFound() {
  return (
    <div className="container">
      <div className="card">
        <h2>Page not found</h2>
        <p className="muted">The page you requested does not exist.</p>
        <Link className="btn primary" to="/">Back to home</Link>
      </div>
    </div>
  )
}

function AppContent() {
  const location = useLocation()
  const hideNav = location.pathname === '/signup' || location.pathname === '/login'
  return (
    <>
      {!hideNav && <Nav />}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/reset" element={<Reset />} />
        <Route path="/app" element={<RequireAuth><DoubtApp /></RequireAuth>} />
        <Route path="/doubt/:id" element={<RequireAuth><DoubtDetail onRefresh={() => {}} /></RequireAuth>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  )
}

export default function App() {
  loadStoredAuth()
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  )
}
