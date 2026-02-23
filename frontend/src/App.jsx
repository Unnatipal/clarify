import React, { useEffect, useRef, useState } from 'react'
import { BrowserRouter, Routes, Route, useNavigate, useParams, Link, Navigate, useLocation } from 'react-router-dom'
import { listDoubts, createDoubt, getDoubt, addReply, acceptReply, addBountyPoints, updateStatus, loadStoredAuth, getStoredAuth, clearAuth, getTrendingTopic, me } from './api'
import Home from './pages/Home'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Reset from './pages/Reset'

const TRENDING_TOPICS = ['Science', 'Space', 'Sports', 'Politics', 'Geography', 'History', 'Physics', 'Psychology']
const DIFFICULTY_LEVELS = ['EASY', 'MEDIUM', 'HARD']
const HELPFUL_VOTES_STORAGE_KEY = 'clarifyHelpfulVotes'
const DOUBT_ROOMS_STORAGE_KEY = 'clarifyDoubtRooms'

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
  if (Array.isArray(doubt.topics) && doubt.topics.length > 0) {
    return doubt.topics
      .map(topic => String(topic || '').trim())
      .filter(Boolean)
      .slice(0, 4)
  }
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

function normalizeDifficulty(value) {
  const raw = String(value || 'MEDIUM').trim().toUpperCase()
  if (raw === 'EASY' || raw === 'MEDIUM' || raw === 'HARD') return raw
  return 'MEDIUM'
}

function getDoubtTopics(doubt) {
  const fromModel = Array.isArray(doubt?.topics) ? doubt.topics : []
  if (fromModel.length > 0) {
    return fromModel.map(topic => String(topic || '').trim()).filter(Boolean).slice(0, 6)
  }
  return extractTags(doubt)
}

function matchesDifficultyFilter(doubt, difficultyFilter) {
  if (difficultyFilter === 'ALL') return true
  return normalizeDifficulty(doubt?.difficulty) === difficultyFilter
}

function matchesTopicFilter(doubt, topicFilter) {
  if (topicFilter === 'ALL') return true
  const topics = getDoubtTopics(doubt).map(topic => topic.toLowerCase())
  return topics.includes(String(topicFilter).toLowerCase())
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

function isDoubtOwner(doubt, credential) {
  const credentialValue = normalizeIdentity(credential)
  if (!credentialValue) return false
  const authorCredential = normalizeIdentity(doubt?.authorCredential)
  if (authorCredential) {
    if (authorCredential === credentialValue) return true
    const byAt = authorCredential.split('@')[0]
    const currentByAt = credentialValue.split('@')[0]
    return byAt && byAt === currentByAt
  }
  return isCurrentUserIdentity(doubt?.authorName, credential)
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

function readStorageJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    const parsed = JSON.parse(raw)
    return parsed ?? fallback
  } catch {
    return fallback
  }
}

function writeStorageJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {}
}

function buildGuidedHints({ title, description, difficulty, topics }) {
  const cleanTitle = String(title || '').trim()
  const cleanDescription = String(description || '').trim()
  const normalizedDifficulty = normalizeDifficulty(difficulty)
  const firstTopic = (Array.isArray(topics) ? topics : String(topics || '').split(','))
    .map(item => String(item || '').trim())
    .filter(Boolean)[0] || 'your topic'

  const hints = [
    `Define the exact goal in one line for "${cleanTitle || 'this doubt'}" so helpers know the final output you want.`,
    cleanDescription.length < 50
      ? 'Add what you already tried and the exact step where you are blocked.'
      : 'Split the problem into two smaller checkpoints and ask for the first checkpoint first.'
  ]

  if (normalizedDifficulty === 'HARD') {
    hints.push('Mention constraints and edge cases (input limits, special scenarios) before posting.')
  } else if (normalizedDifficulty === 'EASY') {
    hints.push(`Ask for a concept-first explanation in ${firstTopic} with one tiny example, not a full solution.`)
  } else {
    hints.push(`Mention one concept in ${firstTopic} that feels confusing to narrow down responses.`)
  }

  return hints.slice(0, 3)
}

function hashText(value) {
  const text = String(value || '')
  let hash = 0
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

function pickChallengeOfTheDay(doubts, dayKey) {
  const list = Array.isArray(doubts) ? doubts : []
  if (list.length === 0) return null
  const open = list.filter(doubt => !hasAnswer(doubt))
  const pool = open.length > 0 ? open : list
  const index = hashText(dayKey) % pool.length
  return pool[index]
}

function formatCountdownLabel(ms) {
  const safe = Math.max(0, Number(ms) || 0)
  if (safe <= 0) return '0m'
  const totalMinutes = Math.floor(safe / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours <= 0) return `${minutes}m`
  return `${hours}h ${minutes}m`
}

function buildSeedRooms(doubts) {
  const now = Date.now()
  const openDoubts = (Array.isArray(doubts) ? doubts : [])
    .filter(doubt => !hasAnswer(doubt))
    .slice(0, 3)

  if (openDoubts.length > 0) {
    return openDoubts.map((doubt, idx) => {
      const topic = getDoubtTopics(doubt)[0] || 'General'
      return {
        id: `room-${String(doubt.id)}`,
        title: `${topic} Rapid Room`,
        topic,
        participants: 4 + idx * 3,
        expiresAt: new Date(now + (idx + 1) * 90 * 60 * 1000).toISOString(),
        messages: [{
          id: `system-${String(doubt.id)}`,
          authorName: 'System',
          message: `Live exam-time thread started for: ${doubt.title}`,
          createdAt: new Date(now).toISOString()
        }]
      }
    })
  }

  return [
    {
      id: 'room-general-1',
      title: 'Math Sprint Room',
      topic: 'Mathematics',
      participants: 7,
      expiresAt: new Date(now + (2 * 60 * 60 * 1000)).toISOString(),
      messages: [{
        id: 'system-room-general-1',
        authorName: 'System',
        message: 'Drop short exam-time doubts for quick peer help.',
        createdAt: new Date(now).toISOString()
      }]
    },
    {
      id: 'room-general-2',
      title: 'Coding Debug Room',
      topic: 'Programming',
      participants: 5,
      expiresAt: new Date(now + (3 * 60 * 60 * 1000)).toISOString(),
      messages: [{
        id: 'system-room-general-2',
        authorName: 'System',
        message: 'Post minimal code snippets and error lines for faster responses.',
        createdAt: new Date(now).toISOString()
      }]
    }
  ]
}

function normalizeRooms(items) {
  if (!Array.isArray(items)) return []
  return items
    .filter(room => room && typeof room === 'object')
    .map(room => ({
      id: String(room.id || `room-${Math.random().toString(36).slice(2, 8)}`),
      title: String(room.title || 'Doubt Room'),
      topic: String(room.topic || 'General'),
      participants: Math.max(1, Number.parseInt(String(room.participants || 1), 10) || 1),
      expiresAt: room.expiresAt || new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      messages: Array.isArray(room.messages) ? room.messages : []
    }))
}

function buildWeeklyMentorLeaderboard(doubts, helpfulVotes) {
  const weekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000)
  const board = new Map()

  for (const doubt of Array.isArray(doubts) ? doubts : []) {
    for (const reply of Array.isArray(doubt.replies) ? doubt.replies : []) {
      if (toEpoch(reply.createdAt) < weekAgo) continue
      const name = String(reply.authorName || 'Anonymous').trim() || 'Anonymous'
      const identity = normalizeIdentity(name) || name.toLowerCase()
      const voteKey = `${doubt.id}:${reply.id}`
      const helpful = Math.max(Number.parseInt(String(helpfulVotes?.[voteKey] || 0), 10) || 0, 0)
      const current = board.get(identity) || { name, accepted: 0, helpful: 0, replies: 0, score: 0 }
      current.replies += 1
      current.helpful += helpful
      if (reply.accepted) current.accepted += 1
      current.score = (current.accepted * 12) + (current.helpful * 2) + current.replies
      board.set(identity, current)
    }
  }

  return Array.from(board.values())
    .sort((a, b) => b.score - a.score || b.accepted - a.accepted || b.helpful - a.helpful || b.replies - a.replies)
    .slice(0, 8)
}

function buildProfileCredibility(doubts, credential, helpfulVotes, profile) {
  let asked = 0
  let answers = 0
  let accepted = 0
  let helpfulReceived = 0
  const topicScore = new Map()

  for (const doubt of Array.isArray(doubts) ? doubts : []) {
    if (isDoubtOwner(doubt, credential)) asked += 1
    const topics = getDoubtTopics(doubt)
    for (const reply of Array.isArray(doubt.replies) ? doubt.replies : []) {
      if (!isCurrentUserIdentity(reply.authorName, credential)) continue
      answers += 1
      if (reply.accepted) accepted += 1
      const voteKey = `${doubt.id}:${reply.id}`
      const helpful = Math.max(Number.parseInt(String(helpfulVotes?.[voteKey] || 0), 10) || 0, 0)
      helpfulReceived += helpful
      const replyScore = 1 + (reply.accepted ? 2 : 0) + (Math.min(helpful, 8) * 0.25)
      for (const topic of topics) {
        const clean = String(topic || '').trim()
        if (!clean) continue
        topicScore.set(clean, (topicScore.get(clean) || 0) + replyScore)
      }
    }
  }

  if (topicScore.size === 0) {
    for (const doubt of Array.isArray(doubts) ? doubts : []) {
      if (!isDoubtOwner(doubt, credential)) continue
      for (const topic of getDoubtTopics(doubt)) {
        const clean = String(topic || '').trim()
        if (!clean) continue
        topicScore.set(clean, (topicScore.get(clean) || 0) + 1)
      }
    }
  }

  const expertiseTags = Array.from(topicScore.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 6)
    .map(([topic]) => topic)

  const accuracyPercent = answers > 0 ? Math.round((accepted / answers) * 100) : 0
  const helpfulPerAnswer = answers > 0 ? Number((helpfulReceived / answers).toFixed(1)) : 0
  const checks = [
    { id: 'avatar', label: 'Profile photo added', done: Boolean(profile?.avatarDataUrl) },
    { id: 'ask', label: 'Posted first doubt', done: asked > 0 },
    { id: 'answer', label: 'Posted first answer', done: answers > 0 },
    { id: 'accepted', label: 'Earned accepted answer', done: accepted > 0 },
    { id: 'tags', label: 'Built 3+ expertise tags', done: expertiseTags.length >= 3 }
  ]
  const completion = Math.round((checks.filter(check => check.done).length / checks.length) * 100)

  return {
    completion,
    checks,
    expertiseTags,
    asked,
    answers,
    accepted,
    helpfulReceived,
    accuracyPercent,
    helpfulPerAnswer
  }
}

function DoubtScrollList({
  doubts,
  onSelect,
  currentUser,
  currentCredential,
  expandedDoubtId,
  onToggleAnswer,
  answerDrafts,
  answerErrors,
  onAnswerDraftChange,
  onAnswerSubmit,
  answerSubmittingId,
  onAcceptAnswer,
  acceptingReplyKey,
  onAddBounty,
  bountyUpdatingDoubtId,
  helpfulVotes,
  helpfulVoted,
  onHelpfulVote
}) {
  return (
    <div className="question-scroll">
      {doubts.length === 0 && <div className="muted">No doubts available.</div>}
      {doubts.map(d => {
        const tags = getDoubtTopics(d)
        const difficulty = normalizeDifficulty(d.difficulty)
        const bountyPoints = Math.max(Number.parseInt(String(d.bountyPoints ?? 0), 10) || 0, 0)
        const replies = (d.replies || []).length
        const acceptedReply = (d.replies || []).find(reply => Boolean(reply?.accepted))
        const answered = hasAnswer(d)
        const statusText = acceptedReply ? 'Resolved' : (answered ? 'Answered' : 'Open')
        const statusClass = answered ? 'answered' : 'open'
        const isOwner = isDoubtOwner(d, currentCredential)
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
            <div className="question-tags">
              <span className={`question-tag difficulty-${difficulty.toLowerCase()}`}>{difficulty}</span>
              {bountyPoints > 0 && <span className="question-tag bounty-tag">Bounty {bountyPoints} pts</span>}
            </div>
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
                <div className="question-answer-header">
                  <div className="question-answer-title">Answers</div>
                  {isOwner && (
                    <button
                      type="button"
                      className="question-inline-btn"
                      disabled={bountyUpdatingDoubtId === d.id}
                      onClick={() => onAddBounty(d.id, 25)}
                    >
                      {bountyUpdatingDoubtId === d.id ? 'Updating...' : 'Add +25 Bounty'}
                    </button>
                  )}
                </div>
                <div className="question-reply-list">
                  {(d.replies || []).length === 0 && <div className="muted">No answers yet. Be the first to answer.</div>}
                  {(d.replies || []).map(reply => {
                    const voteKey = `${d.id}:${reply.id}`
                    const helpfulCount = Math.max(Number.parseInt(String(helpfulVotes?.[voteKey] || 0), 10) || 0, 0)
                    const hasVotedHelpful = Boolean(helpfulVoted?.[voteKey])
                    return (
                      <div key={reply.id} className={`question-reply-item ${reply.accepted ? 'accepted' : ''}`}>
                        <div className="question-reply-head">
                          <div className="question-reply-author">{reply.authorName || 'User'}</div>
                          {reply.accepted && <span className="accepted-badge">Accepted</span>}
                        </div>
                        <div className="question-reply-message">{reply.message}</div>
                        {reply.accepted && bountyPoints > 0 && (
                          <div className="question-reply-bounty">
                            +{Math.max(Number.parseInt(String(reply.bountyAwardedPoints ?? bountyPoints), 10) || bountyPoints, 0)} bounty points
                          </div>
                        )}
                        <div className="question-reply-time">{formatTimeAgo(reply.createdAt)}</div>
                        <div className="question-reply-helpful-row">
                          <button
                            type="button"
                            className={`question-inline-btn question-inline-btn-small ${hasVotedHelpful ? 'question-inline-btn-voted' : ''}`}
                            disabled={hasVotedHelpful}
                            onClick={() => onHelpfulVote(d.id, reply.id)}
                          >
                            {hasVotedHelpful ? 'Helpful ✓' : 'Helpful'}
                          </button>
                          <span className="question-helpful-count">{helpfulCount} helpful vote{helpfulCount === 1 ? '' : 's'}</span>
                        </div>
                        {isOwner && (
                          <div className="question-reply-actions">
                            <button
                              type="button"
                              className={`question-inline-btn ${reply.accepted ? 'accepted-btn' : ''}`}
                              onClick={() => onAcceptAnswer(d.id, reply.id)}
                              disabled={acceptingReplyKey === `${d.id}:${reply.id}` || reply.accepted}
                            >
                              {reply.accepted ? 'Accepted' : (acceptingReplyKey === `${d.id}:${reply.id}` ? 'Accepting...' : 'Accept Answer')}
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
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
  const [difficulty, setDifficulty] = useState('MEDIUM')
  const [topics, setTopics] = useState('')
  const [bountyPoints, setBountyPoints] = useState('0')
  const [hintMode, setHintMode] = useState(true)
  const [hintSuggestions, setHintSuggestions] = useState([])
  const [hintPreviewReady, setHintPreviewReady] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  const regenerateHints = () => {
    const hints = buildGuidedHints({ title, description, difficulty, topics })
    setHintSuggestions(hints)
    setHintPreviewReady(true)
  }

  useEffect(() => {
    setHintPreviewReady(false)
  }, [title, description, difficulty, topics, hintMode])

  const submit = async (e) => {
    e.preventDefault()
    const cleanTitle = title.trim()
    const cleanDescription = description.trim()
    const cleanTopics = topics
      .split(',')
      .map(topic => topic.trim())
      .filter(Boolean)
      .slice(0, 6)
    const safeBounty = Math.max(Number.parseInt(String(bountyPoints || 0), 10) || 0, 0)
    if (!cleanTitle || !cleanDescription) {
      setFormError('Title and description are required.')
      return
    }

    if (hintMode && !hintPreviewReady) {
      const hints = buildGuidedHints({
        title: cleanTitle,
        description: cleanDescription,
        difficulty,
        topics: cleanTopics
      })
      setHintSuggestions(hints)
      setHintPreviewReady(true)
      setFormError('AI hints are ready. Review them, then click Submit again.')
      return
    }

    setFormError('')
    setSubmitting(true)
    try {
      await onCreate({
        title: cleanTitle,
        description: cleanDescription,
        authorName: currentUser || 'User',
        difficulty,
        topics: cleanTopics,
        bountyPoints: safeBounty
      })
      setTitle('')
      setDescription('')
      setDifficulty('MEDIUM')
      setTopics('')
      setBountyPoints('0')
      setHintSuggestions([])
      setHintPreviewReady(false)
    } catch (err) {
      setFormError(err?.message || 'Failed to submit doubt')
    } finally {
      setSubmitting(false)
    }
  }
  return (
    <form onSubmit={submit}>
      <h2>Ask Doubt</h2>
      <input className="input" placeholder="Title" value={title} onChange={e => setTitle(e.target.value)} />
      <br />
      <textarea className="input" placeholder="Description" value={description} onChange={e => setDescription(e.target.value)} />
      <br />
      <label className="hint-mode-toggle">
        <input
          type="checkbox"
          checked={hintMode}
          onChange={e => {
            setHintMode(e.target.checked)
            setFormError('')
          }}
        />
        AI hint mode (show guided hints before posting)
      </label>
      {hintMode && (
        <div className="hint-panel">
          <div className="hint-panel-header">
            <strong>Guided Hints</strong>
            <button type="button" className="question-inline-btn question-inline-btn-small" onClick={regenerateHints}>
              Refresh hints
            </button>
          </div>
          {hintSuggestions.length === 0 ? (
            <div className="muted">Hints will appear before submit.</div>
          ) : (
            <ul className="hint-list">
              {hintSuggestions.map((hint, idx) => <li key={`hint-${idx}`}>{hint}</li>)}
            </ul>
          )}
        </div>
      )}
      <br />
      <select className="input" value={difficulty} onChange={e => setDifficulty(e.target.value)}>
        {DIFFICULTY_LEVELS.map(level => (
          <option key={level} value={level}>{level}</option>
        ))}
      </select>
      <br />
      <input
        className="input"
        placeholder="Topic labels (comma-separated): React, JavaScript, API"
        value={topics}
        onChange={e => setTopics(e.target.value)}
      />
      <br />
      <input
        className="input"
        type="number"
        min="0"
        placeholder="Bounty points"
        value={bountyPoints}
        onChange={e => setBountyPoints(e.target.value)}
      />
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
  const canManage = isDoubtOwner(doubt, currentCredential)
  const difficulty = normalizeDifficulty(doubt.difficulty)
  const topics = getDoubtTopics(doubt)
  const bountyPoints = Math.max(Number.parseInt(String(doubt.bountyPoints ?? 0), 10) || 0, 0)
  return (
    <div>
      <Link to="/">Back</Link>
      <h2>{doubt.title}</h2>
      <div>by {doubt.authorName}</div>
      <div>{doubt.description}</div>
      <div style={{ marginTop: 8 }}>
        <strong>Difficulty:</strong> {difficulty}
      </div>
      <div style={{ marginTop: 6 }}>
        <strong>Bounty:</strong> {bountyPoints} points
      </div>
      <div style={{ marginTop: 6 }}>
        <strong>Topics:</strong> {topics.length > 0 ? topics.join(', ') : 'General'}
      </div>
      <div>Status: {doubt.status}</div>
      {canManage && (
        <button onClick={async () => {
          try {
            setError('')
            await addBountyPoints(id, 25)
            const d = await getDoubt(id)
            setDoubt(d)
          } catch (err) {
            setError(err.message || 'Failed to add bounty')
          }
        }}>Add +25 Bounty</button>
      )}
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
            {r.accepted && <div><strong>Accepted answer</strong></div>}
            {r.accepted && bountyPoints > 0 && <div>+{Math.max(Number.parseInt(String(r.bountyAwardedPoints ?? bountyPoints), 10) || bountyPoints, 0)} bounty points</div>}
            {canManage && !r.accepted && (
              <button onClick={async () => {
                try {
                  setError('')
                  await acceptReply(id, r.id)
                  const d = await getDoubt(id)
                  setDoubt(d)
                } catch (err) {
                  setError(err.message || 'Failed to accept answer')
                }
              }}>Accept answer</button>
            )}
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
  const [difficultyFilter, setDifficultyFilter] = useState('ALL')
  const [topicFilter, setTopicFilter] = useState('ALL')
  const [error, setError] = useState('')
  const [expandedDoubtId, setExpandedDoubtId] = useState(null)
  const [answerDrafts, setAnswerDrafts] = useState({})
  const [answerErrors, setAnswerErrors] = useState({})
  const [answerSubmittingId, setAnswerSubmittingId] = useState(null)
  const [acceptingReplyKey, setAcceptingReplyKey] = useState('')
  const [bountyUpdatingDoubtId, setBountyUpdatingDoubtId] = useState(null)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [selectedTopic, setSelectedTopic] = useState(TRENDING_TOPICS[0])
  const [topicItems, setTopicItems] = useState([])
  const [topicLoading, setTopicLoading] = useState(false)
  const [topicError, setTopicError] = useState('')
  const [streakMonthOffset, setStreakMonthOffset] = useState(0)
  const [clockTick, setClockTick] = useState(Date.now())
  const canLoadMoreRef = useRef(true)
  const recentScrollRef = useRef(null)
  const navigate = useNavigate()
  const auth = getStoredAuth()
  const currentCredential = auth.username || ''
  const credentialKey = normalizeIdentity(currentCredential) || 'guest'
  const helpfulVotedStorageKey = `clarifyHelpfulVoted:${credentialKey}`
  const joinedRoomsStorageKey = `clarifyJoinedRooms:${credentialKey}`
  const currentUserDisplay = currentCredential.includes('@') ? currentCredential.split('@')[0] : (currentCredential || 'User')
  const [helpfulVotes, setHelpfulVotes] = useState(() => readStorageJson(HELPFUL_VOTES_STORAGE_KEY, {}))
  const [helpfulVoted, setHelpfulVoted] = useState(() => readStorageJson(helpfulVotedStorageKey, {}))
  const [rooms, setRooms] = useState(() => normalizeRooms(readStorageJson(DOUBT_ROOMS_STORAGE_KEY, [])))
  const [joinedRooms, setJoinedRooms] = useState(() => readStorageJson(joinedRoomsStorageKey, {}))
  const [activeRoomId, setActiveRoomId] = useState('')
  const [roomMessageDraft, setRoomMessageDraft] = useState('')
  const refreshDoubts = () => listDoubts()
    .then(setDoubts)
    .catch(err => setError(err.message || 'Failed to load doubts'))
  useEffect(() => { refreshDoubts() }, [])

  useEffect(() => {
    const timerId = window.setInterval(() => setClockTick(Date.now()), 30000)
    return () => window.clearInterval(timerId)
  }, [])

  useEffect(() => {
    setHelpfulVoted(readStorageJson(helpfulVotedStorageKey, {}))
  }, [helpfulVotedStorageKey])

  useEffect(() => {
    setJoinedRooms(readStorageJson(joinedRoomsStorageKey, {}))
  }, [joinedRoomsStorageKey])

  useEffect(() => {
    writeStorageJson(HELPFUL_VOTES_STORAGE_KEY, helpfulVotes)
  }, [helpfulVotes])

  useEffect(() => {
    writeStorageJson(helpfulVotedStorageKey, helpfulVoted)
  }, [helpfulVotedStorageKey, helpfulVoted])

  useEffect(() => {
    writeStorageJson(joinedRoomsStorageKey, joinedRooms)
  }, [joinedRoomsStorageKey, joinedRooms])

  useEffect(() => {
    writeStorageJson(DOUBT_ROOMS_STORAGE_KEY, rooms)
  }, [rooms])

  useEffect(() => {
    setRooms(prev => {
      const activeRooms = normalizeRooms(prev).filter(room => toEpoch(room.expiresAt) > Date.now())
      if (activeRooms.length > 0) return activeRooms
      return buildSeedRooms(doubts)
    })
  }, [doubts.length])

  useEffect(() => {
    setRooms(prev => {
      const normalized = normalizeRooms(prev)
      const activeOnly = normalized.filter(room => toEpoch(room.expiresAt) > clockTick)
      if (activeOnly.length === normalized.length) return prev
      return activeOnly
    })
  }, [clockTick])
  const topicLookup = new Map()
  doubts.forEach(d => {
    getDoubtTopics(d).forEach(topic => {
      const display = String(topic || '').trim()
      if (!display) return
      const key = display.toLowerCase()
      if (!topicLookup.has(key)) topicLookup.set(key, display)
    })
  })
  const availableTopicFilters = Array.from(topicLookup.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(entry => ({ key: entry[0], label: entry[1] }))

  const filteredDoubts = doubts
    .filter(d => matchesRecentFilter(d, filter))
    .filter(d => matchesDifficultyFilter(d, difficultyFilter))
    .filter(d => matchesTopicFilter(d, topicFilter))
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
  const profileSnapshot = readStorageJson('clarifyProfile', {})
  const credibility = buildProfileCredibility(doubts, currentCredential, helpfulVotes, profileSnapshot)
  const streakRewards = [
    {
      id: 'reward-3',
      title: '3-Day Consistency',
      note: 'Use Clarify for 3 days in a row',
      unlocked: clarifyStreak >= 3
    },
    {
      id: 'reward-7',
      title: '7-Day Discipline',
      note: 'Keep your streak for 7 days',
      unlocked: clarifyStreak >= 7
    },
    {
      id: 'reward-30',
      title: '30-Day Mastery',
      note: 'Maintain a 30-day streak',
      unlocked: clarifyStreak >= 30
    },
    {
      id: 'reward-doubts',
      title: '10 Doubts Milestone',
      note: 'Ask 10 doubts on Clarify',
      unlocked: askedByUser.length >= 10
    },
    {
      id: 'reward-answers',
      title: '15 Answers Milestone',
      note: 'Answer 15 doubts from others',
      unlocked: solvedByYou.length >= 15
    }
  ]
  const leaderboard = buildWeeklyMentorLeaderboard(doubts, helpfulVotes)
  const challengeDayKey = dayKeyLocal(new Date()) || new Date().toISOString().slice(0, 10)
  const challengeDoubt = pickChallengeOfTheDay(doubts, challengeDayKey)
  const challengeBonusPoints = 75
  const challengeSolvedByUser = challengeDoubt
    ? (challengeDoubt.replies || []).some(reply => isCurrentUserIdentity(reply.authorName, currentCredential))
    : false
  const msUntilTomorrow = (() => {
    const now = new Date()
    const tomorrow = new Date(now)
    tomorrow.setHours(24, 0, 0, 0)
    return tomorrow.getTime() - now.getTime()
  })()
  const activeRoom = rooms.find(room => room.id === activeRoomId) || null
  const visibleDoubts = filteredDoubts.slice(0, visibleCount)
  const hasMoreDoubts = visibleCount < filteredDoubts.length

  useEffect(() => {
    if (!expandedDoubtId) return
    const exists = filteredDoubts.some(d => d.id === expandedDoubtId)
    if (!exists) setExpandedDoubtId(null)
  }, [filteredDoubts, expandedDoubtId])

  useEffect(() => {
    if (activeRoomId && !activeRoom) {
      setActiveRoomId('')
    }
  }, [activeRoomId, activeRoom])

  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
    canLoadMoreRef.current = true
  }, [filter, difficultyFilter, topicFilter, doubts.length])

  useEffect(() => {
    const scrollEl = recentScrollRef.current
    if (!scrollEl || !hasMoreDoubts) return
    let ticking = false
    const onScroll = () => {
      if (ticking) return
      ticking = true
      window.requestAnimationFrame(() => {
        const nearBottom = scrollEl.scrollTop + scrollEl.clientHeight >= scrollEl.scrollHeight - 80
        if (nearBottom && canLoadMoreRef.current) {
          setVisibleCount(prev => Math.min(prev + PAGE_SIZE, filteredDoubts.length))
          canLoadMoreRef.current = false
        } else if (!nearBottom) {
          canLoadMoreRef.current = true
        }
        ticking = false
      })
    }
    scrollEl.addEventListener('scroll', onScroll, { passive: true })
    return () => scrollEl.removeEventListener('scroll', onScroll)
  }, [hasMoreDoubts, filteredDoubts.length, visibleCount])

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
      const created = await createDoubt(d)
      try {
        await refreshDoubts()
      } catch {
        if (created && created.id) {
          setDoubts(prev => {
            const exists = prev.some(item => String(item.id) === String(created.id))
            if (exists) return prev
            return [created, ...prev]
          })
          setError('')
        }
      }
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

  const handleAcceptAnswer = async (doubtId, replyId) => {
    setAcceptingReplyKey(`${doubtId}:${replyId}`)
    try {
      setError('')
      await acceptReply(doubtId, replyId)
      await refreshDoubts()
      setExpandedDoubtId(doubtId)
    } catch (err) {
      const messageText = err?.message || 'Failed to accept answer'
      if (messageText.includes('401')) {
        clearAuth()
        navigate('/login')
        return
      }
      setError(messageText)
    } finally {
      setAcceptingReplyKey('')
    }
  }

  const handleAddBounty = async (doubtId, points = 25) => {
    setBountyUpdatingDoubtId(doubtId)
    try {
      setError('')
      await addBountyPoints(doubtId, points)
      await refreshDoubts()
      setExpandedDoubtId(doubtId)
    } catch (err) {
      const messageText = err?.message || 'Failed to add bounty points'
      if (messageText.includes('401')) {
        clearAuth()
        navigate('/login')
        return
      }
      setError(messageText)
    } finally {
      setBountyUpdatingDoubtId(null)
    }
  }

  const handleHelpfulVote = (doubtId, replyId) => {
    const voteKey = `${doubtId}:${replyId}`
    if (helpfulVoted[voteKey]) return
    setHelpfulVoted(prev => ({ ...prev, [voteKey]: true }))
    setHelpfulVotes(prev => ({ ...prev, [voteKey]: (Number.parseInt(String(prev?.[voteKey] || 0), 10) || 0) + 1 }))
  }

  const handleJoinRoom = (roomId) => {
    setJoinedRooms(prev => {
      const alreadyJoined = Boolean(prev[roomId])
      if (!alreadyJoined) {
        setRooms(prevRooms => normalizeRooms(prevRooms).map(room => (
          room.id === roomId
            ? { ...room, participants: Math.max(1, Number.parseInt(String(room.participants || 1), 10) || 1) + 1 }
            : room
        )))
      }
      return alreadyJoined ? prev : { ...prev, [roomId]: true }
    })
    setActiveRoomId(roomId)
  }

  const handleSendRoomMessage = () => {
    const message = roomMessageDraft.trim()
    if (!activeRoomId || !message) return
    const roomMessage = {
      id: `room-msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      authorName: currentUserDisplay || 'User',
      message,
      createdAt: new Date().toISOString()
    }
    setRooms(prevRooms => normalizeRooms(prevRooms).map(room => (
      room.id === activeRoomId
        ? { ...room, messages: [...room.messages, roomMessage].slice(-50) }
        : room
    )))
    setRoomMessageDraft('')
  }

  return (
    <div className="container app-container">
      {error && <div className="error" style={{ marginBottom: 12 }}>{error}</div>}
      <div className="stats">
        <div className="stat-card brand-stat-card">
          <div className="brand-stat-aura brand-stat-aura-one" aria-hidden="true" />
          <div className="brand-stat-aura brand-stat-aura-two" aria-hidden="true" />
          <div className="brand-stat-title">Clarify</div>
          <div className="brand-stat-subtitle">Experience collaborative learning</div>
          <div className="brand-stat-progress" aria-hidden="true">
            <span />
          </div>
        </div>
        <div className="stat-card"><div style={{fontSize:28,fontWeight:700}}>{askedByUser.length}</div><div className="muted">Doubts Asked</div></div>
        <div className="stat-card"><div style={{fontSize:28,fontWeight:700}}>{solvedByYou.length}</div><div className="muted">Solved by You</div></div>
      </div>
      <div className="feed">
        <div className="feed-main">
          <div className="card">
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:10}}>
              <strong>Recent Doubts</strong>
              <div style={{display:'flex',gap:8}}>
                <button className="btn" onClick={()=>setFilter('ALL')}>All</button>
                <button className="btn" onClick={()=>setFilter('OPEN')}>Open</button>
                <button className="btn" onClick={()=>setFilter('ANSWERED')}>Answered</button>
              </div>
            </div>
            <div className="doubt-filter-row">
              <label className="doubt-filter-label">
                Difficulty
                <select value={difficultyFilter} onChange={e => setDifficultyFilter(e.target.value)}>
                  <option value="ALL">All</option>
                  {DIFFICULTY_LEVELS.map(level => (
                    <option key={level} value={level}>{level}</option>
                  ))}
                </select>
              </label>
              <label className="doubt-filter-label">
                Topic
                <select value={topicFilter} onChange={e => setTopicFilter(e.target.value)}>
                  <option value="ALL">All</option>
                  {availableTopicFilters.map(topic => (
                    <option key={topic.key} value={topic.key}>{topic.label}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="recent-doubts-scroll" ref={recentScrollRef}>
              <DoubtScrollList
                doubts={visibleDoubts}
                onSelect={id => navigate(`/doubt/${id}`)}
                currentUser={currentUserDisplay}
                currentCredential={currentCredential}
                expandedDoubtId={expandedDoubtId}
                onToggleAnswer={toggleAnswerPanel}
                answerDrafts={answerDrafts}
                answerErrors={answerErrors}
                onAnswerDraftChange={handleAnswerDraftChange}
                onAnswerSubmit={handleInlineAnswerSubmit}
                answerSubmittingId={answerSubmittingId}
                onAcceptAnswer={handleAcceptAnswer}
                acceptingReplyKey={acceptingReplyKey}
                onAddBounty={handleAddBounty}
                bountyUpdatingDoubtId={bountyUpdatingDoubtId}
                helpfulVotes={helpfulVotes}
                helpfulVoted={helpfulVoted}
                onHelpfulVote={handleHelpfulVote}
              />
              <div className="load-more-sentinel">
                {hasMoreDoubts ? 'Scroll down to load more doubts...' : `Showing ${filteredDoubts.length} doubt${filteredDoubts.length === 1 ? '' : 's'}`}
              </div>
            </div>
          </div>
        </div>
        <div className="feed-side">
          <div className="card">
            <strong>Ask Your Doubt</strong>
            <DoubtForm onCreate={handleCreateDoubt} currentUser={currentUserDisplay} />
          </div>
          <div className="card">
            <strong>Doubt Rooms</strong>
            <div className="muted" style={{ marginTop: 8, marginBottom: 10 }}>
              Temporary live threads for exam-time rapid solving.
            </div>
            <div className="room-list">
              {rooms.length === 0 && <div className="muted">No active rooms right now.</div>}
              {rooms.map(room => {
                const isJoined = Boolean(joinedRooms[room.id])
                const timeLeft = formatCountdownLabel(toEpoch(room.expiresAt) - clockTick)
                return (
                  <button
                    key={room.id}
                    type="button"
                    className={`room-item ${activeRoomId === room.id ? 'active' : ''}`}
                    onClick={() => handleJoinRoom(room.id)}
                  >
                    <div className="room-item-head">
                      <span className="room-item-title">{room.title}</span>
                      <span className="room-item-time">{timeLeft}</span>
                    </div>
                    <div className="room-item-meta">
                      <span>{room.topic}</span>
                      <span>{room.participants} live</span>
                      <span>{isJoined ? 'Joined' : 'Tap to join'}</span>
                    </div>
                  </button>
                )
              })}
            </div>
            {activeRoom && (
              <div className="room-live-panel">
                <div className="room-live-header">
                  <span>{activeRoom.title}</span>
                  <button type="button" className="question-inline-btn question-inline-btn-small" onClick={() => setActiveRoomId('')}>Close</button>
                </div>
                <div className="room-live-messages">
                  {(activeRoom.messages || []).map(message => (
                    <div key={message.id} className="room-live-message">
                      <strong>{message.authorName}:</strong> {message.message}
                    </div>
                  ))}
                </div>
                <div className="room-live-compose">
                  <input
                    className="input"
                    placeholder="Post quick help..."
                    value={roomMessageDraft}
                    onChange={e => setRoomMessageDraft(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleSendRoomMessage()
                      }
                    }}
                  />
                  <button type="button" className="question-inline-btn primary" onClick={handleSendRoomMessage}>Send</button>
                </div>
              </div>
            )}
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
              <div className="streak-rewards">
                {streakRewards.map(reward => (
                  <div key={reward.id} className={`streak-reward-chip ${reward.unlocked ? 'unlocked' : 'locked'}`}>
                    <span className="streak-reward-title">{reward.unlocked ? '🏅' : '🔒'} {reward.title}</span>
                    <span className="streak-reward-note">{reward.note}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="card">
            <strong>Mentor Leaderboard</strong>
            <div className="muted" style={{ marginTop: 8, marginBottom: 10 }}>
              Weekly ranking by accepted answers and helpful votes.
            </div>
            <div className="leaderboard-list">
              {leaderboard.length === 0 && <div className="muted">No mentor activity this week yet.</div>}
              {leaderboard.map((mentor, idx) => (
                <div key={`${mentor.name}-${idx}`} className="leaderboard-item">
                  <div className="leaderboard-rank">#{idx + 1}</div>
                  <div className="leaderboard-body">
                    <div className="leaderboard-name">{mentor.name}</div>
                    <div className="leaderboard-meta">
                      {mentor.accepted} accepted | {mentor.helpful} helpful | {mentor.replies} replies
                    </div>
                  </div>
                  <div className="leaderboard-score">{mentor.score} pts</div>
                </div>
              ))}
            </div>
          </div>
          <div className="card">
            <strong>Profile Credibility</strong>
            <div className="credibility-progress-row">
              <span className="muted">Completion</span>
              <strong>{credibility.completion}%</strong>
            </div>
            <div className="credibility-progress-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={credibility.completion}>
              <span style={{ width: `${credibility.completion}%` }} />
            </div>
            <div className="credibility-checks">
              {credibility.checks.map(check => (
                <div key={check.id} className={`credibility-check ${check.done ? 'done' : ''}`}>
                  {check.done ? '✓' : '○'} {check.label}
                </div>
              ))}
            </div>
            <div className="credibility-section-title">Expertise Tags</div>
            <div className="credibility-tags">
              {credibility.expertiseTags.length === 0 && <span className="muted">Answer doubts to build expertise tags.</span>}
              {credibility.expertiseTags.map(tag => (
                <span key={tag} className="credibility-tag">{tag}</span>
              ))}
            </div>
            <div className="credibility-stat-grid">
              <div className="credibility-stat">
                <div className="credibility-stat-value">{credibility.answers}</div>
                <div className="credibility-stat-label">Answers</div>
              </div>
              <div className="credibility-stat">
                <div className="credibility-stat-value">{credibility.accepted}</div>
                <div className="credibility-stat-label">Accepted</div>
              </div>
              <div className="credibility-stat">
                <div className="credibility-stat-value">{credibility.accuracyPercent}%</div>
                <div className="credibility-stat-label">Accuracy</div>
              </div>
            </div>
            <div className="credibility-footnote">
              Helpful votes: {credibility.helpfulReceived} | Helpful/answer: {credibility.helpfulPerAnswer}
            </div>
          </div>
        </div>
        <aside className="feed-rightbar">
          <div className="card challenge-card">
            <strong>Challenge of the Day</strong>
            {challengeDoubt ? (
              <>
                <div className="challenge-title">{challengeDoubt.title}</div>
                <div className="challenge-meta">
                  Bonus: +{challengeBonusPoints} points | resets in {formatCountdownLabel(msUntilTomorrow)}
                </div>
                <div className="challenge-note">
                  {challengeSolvedByUser ? 'You already attempted today\'s challenge.' : 'Solve this featured doubt for bonus points.'}
                </div>
                <button
                  type="button"
                  className="btn primary"
                  style={{ marginTop: 10 }}
                  onClick={() => navigate(`/doubt/${challengeDoubt.id}`)}
                >
                  {challengeSolvedByUser ? 'View Challenge' : 'Solve Challenge'}
                </button>
              </>
            ) : (
              <div className="muted" style={{ marginTop: 8 }}>No challenge available yet.</div>
            )}
          </div>
          <div className="card trending-sidebar-card">
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
        </aside>
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
