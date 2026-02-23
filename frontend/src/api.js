export const API_ORIGIN = 'http://localhost:8081'
const BASE_URL = `${API_ORIGIN}/api`
export const ASSET_ORIGIN = API_ORIGIN
let auth = { username: null, password: null }
const LOCAL_DOUBTS_KEY = 'clarifyLocalDoubts'
const LOCAL_REPLIES_KEY = 'clarifyLocalReplies'

export function setAuthCredentials(username, password) {
  auth = { username, password }
  try {
    localStorage.setItem('clarifyAuth', JSON.stringify(auth))
  } catch {}
}
export function loadStoredAuth() {
  try {
    const s = localStorage.getItem('clarifyAuth')
    if (s) auth = JSON.parse(s)
  } catch {}
}
export function getStoredAuth() {
  return auth
}
export function clearAuth() {
  auth = { username: null, password: null }
  try {
    localStorage.removeItem('clarifyAuth')
  } catch {}
}
function authHeaders() {
  if (auth.username && auth.password) {
    const token = btoa(`${auth.username}:${auth.password}`)
    return { Authorization: `Basic ${token}` }
  }
  return {}
}

function readLocalDoubts() {
  try {
    const raw = localStorage.getItem(LOCAL_DOUBTS_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeLocalDoubts(items) {
  try {
    localStorage.setItem(LOCAL_DOUBTS_KEY, JSON.stringify(items))
  } catch {}
}

function readLocalReplyMap() {
  try {
    const raw = localStorage.getItem(LOCAL_REPLIES_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeLocalReplyMap(map) {
  try {
    localStorage.setItem(LOCAL_REPLIES_KEY, JSON.stringify(map))
  } catch {}
}

function getLocalRepliesForDoubt(id) {
  const map = readLocalReplyMap()
  const list = map[String(id)]
  return Array.isArray(list) ? list : []
}

function normalizeDifficulty(value) {
  const raw = String(value || 'MEDIUM').trim().toUpperCase()
  if (raw === 'EASY' || raw === 'MEDIUM' || raw === 'HARD') return raw
  return 'MEDIUM'
}

function normalizeTopics(value) {
  if (Array.isArray(value)) {
    return value.map(v => String(v || '').trim()).filter(Boolean).slice(0, 6)
  }
  const text = String(value || '').trim()
  if (!text) return []
  return text
    .split(',')
    .map(part => part.trim())
    .filter(Boolean)
    .slice(0, 6)
}

function normalizeBounty(value) {
  const parsed = Number.parseInt(String(value ?? '0'), 10)
  if (!Number.isFinite(parsed) || Number.isNaN(parsed)) return 0
  return Math.max(parsed, 0)
}

function addLocalReply(doubtId, payload) {
  const idKey = String(doubtId)
  const nextReply = {
    id: `local-reply-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    authorName: payload.authorName || payload.author || payload.username || 'User',
    message: payload.message || payload.content || payload.text || '',
    accepted: false,
    bountyAwardedPoints: 0,
    createdAt: new Date().toISOString()
  }
  const map = readLocalReplyMap()
  const current = Array.isArray(map[idKey]) ? map[idKey] : []
  map[idKey] = [...current, nextReply]
  writeLocalReplyMap(map)
  return nextReply
}

function withLocalReplies(doubt) {
  if (!doubt || typeof doubt !== 'object') return doubt
  const serverReplies = Array.isArray(doubt.replies) ? doubt.replies : []
  const localReplies = getLocalRepliesForDoubt(doubt.id)
  if (localReplies.length === 0) return { ...doubt, replies: serverReplies }
  const existingIds = new Set(serverReplies.map(r => String(r?.id || '')))
  const appended = localReplies.filter(r => !existingIds.has(String(r?.id || '')))
  const mergedReplies = [...serverReplies, ...appended]
  const hasAccepted = mergedReplies.some(reply => Boolean(reply?.accepted))
  return {
    ...doubt,
    replies: mergedReplies,
    status: (mergedReplies.length > 0 || hasAccepted) && doubt.status === 'OPEN' ? 'SOLVED' : doubt.status
  }
}

function addLocalDoubt(payload) {
  const topics = normalizeTopics(payload.topics)
  const localDoubt = {
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: payload.title,
    description: payload.description,
    authorName: payload.authorName || payload.author || 'User',
    authorCredential: auth.username || payload.authorName || payload.author || 'User',
    difficulty: normalizeDifficulty(payload.difficulty),
    topics,
    bountyPoints: normalizeBounty(payload.bountyPoints),
    status: 'OPEN',
    createdAt: new Date().toISOString(),
    replies: []
  }
  const current = readLocalDoubts()
  writeLocalDoubts([localDoubt, ...current])
  return localDoubt
}

function findLocalDoubt(id) {
  const local = readLocalDoubts()
  return local.find(d => String(d.id) === String(id)) || null
}

function replaceLocalDoubt(updated) {
  const local = readLocalDoubts()
  const next = local.map(d => (String(d.id) === String(updated.id) ? updated : d))
  writeLocalDoubts(next)
  return updated
}

function mergeServerAndLocal(server) {
  const local = readLocalDoubts()
  const serverList = Array.isArray(server) ? server : []
  return [...local, ...serverList].map(withLocalReplies)
}

async function parseBody(res) {
  const text = await res.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

async function getJsonOrThrow(res) {
  const body = await parseBody(res)
  if (!res.ok) {
    if (typeof body === 'string' && body.trim()) throw new Error(body)
    if (body && typeof body === 'object') {
      const msg = body.message || body.error || body.title || body.detail || ''
      if (typeof msg === 'string' && msg.trim()) throw new Error(msg)
    }
    throw new Error(`Request failed (${res.status})`)
  }
  if (body === null) return {}
  if (typeof body === 'string') throw new Error('Unexpected server response')
  return body
}

export async function listDoubts() {
  try {
    const res = await fetch(`${BASE_URL}/doubts`)
    const server = await getJsonOrThrow(res)
    return mergeServerAndLocal(server)
  } catch (err) {
    const local = mergeServerAndLocal([])
    if (local.length > 0) return local
    throw err
  }
}

export async function createDoubt(d) {
  const normalizedTopics = normalizeTopics(d?.topics)
  const normalizedDifficulty = normalizeDifficulty(d?.difficulty)
  const normalizedBounty = normalizeBounty(d?.bountyPoints)
  const payload = {
    title: d?.title || '',
    description: d?.description || '',
    authorName: d?.authorName || '',
    author: d?.authorName || '',
    username: d?.authorName || '',
    userName: d?.authorName || '',
    name: d?.authorName || '',
    difficulty: normalizedDifficulty,
    topics: normalizedTopics,
    topic: normalizedTopics.join(', '),
    tags: normalizedTopics.join(', '),
    labels: normalizedTopics.join(', '),
    bountyPoints: normalizedBounty,
    bounty: normalizedBounty,
    points: normalizedBounty,
    message: d?.description || '',
    content: d?.description || ''
  }

  try {
    const res = await fetch(`${BASE_URL}/doubts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', ...authHeaders() },
      body: JSON.stringify(payload)
    })
    if (res.status !== 415) return await getJsonOrThrow(res)

    // Fallback for backend variants that accept multipart/form-data instead of JSON.
    const fd = new FormData()
    fd.append('title', payload.title)
    fd.append('description', payload.description)
    fd.append('authorName', payload.authorName)
    fd.append('author', payload.author)
    fd.append('username', payload.username)
    fd.append('userName', payload.userName)
    fd.append('name', payload.name)
    fd.append('difficulty', payload.difficulty)
    fd.append('topics', payload.topic)
    fd.append('topic', payload.topic)
    fd.append('tags', payload.tags)
    fd.append('labels', payload.labels)
    fd.append('bountyPoints', String(payload.bountyPoints))
    fd.append('bounty', String(payload.bounty))
    fd.append('points', String(payload.points))
    fd.append('message', payload.message)
    fd.append('content', payload.content)
    const multipartRes = await fetch(`${BASE_URL}/doubts`, {
      method: 'POST',
      headers: { 'Accept': 'application/json', ...authHeaders() },
      body: fd
    })
    if (multipartRes.status !== 415) return await getJsonOrThrow(multipartRes)

    // Final fallback for backends that expect x-www-form-urlencoded.
    const urlParams = new URLSearchParams()
    urlParams.set('title', payload.title)
    urlParams.set('description', payload.description)
    urlParams.set('authorName', payload.authorName)
    urlParams.set('author', payload.author)
    urlParams.set('username', payload.username)
    urlParams.set('userName', payload.userName)
    urlParams.set('name', payload.name)
    urlParams.set('difficulty', payload.difficulty)
    urlParams.set('topics', payload.topic)
    urlParams.set('topic', payload.topic)
    urlParams.set('tags', payload.tags)
    urlParams.set('labels', payload.labels)
    urlParams.set('bountyPoints', String(payload.bountyPoints))
    urlParams.set('bounty', String(payload.bounty))
    urlParams.set('points', String(payload.points))
    urlParams.set('message', payload.message)
    urlParams.set('content', payload.content)
    const formRes = await fetch(`${BASE_URL}/doubts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        'Accept': 'application/json',
        ...authHeaders()
      },
      body: urlParams.toString()
    })
    if (formRes.status !== 415) return await getJsonOrThrow(formRes)

    // Additional fallback: parameters in query string with empty body.
    const query = new URLSearchParams(urlParams)
    const queryRes = await fetch(`${BASE_URL}/doubts?${query.toString()}`, {
      method: 'POST',
      headers: { 'Accept': 'application/json', ...authHeaders() }
    })
    if (queryRes.status !== 415) return await getJsonOrThrow(queryRes)

    // Last fallback: plain text JSON payload for custom parsers.
    const plainRes = await fetch(`${BASE_URL}/doubts`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8', 'Accept': 'application/json', ...authHeaders() },
      body: JSON.stringify(payload)
    })
    return await getJsonOrThrow(plainRes)
  } catch (err) {
    const msg = String(err?.message || '')
    if (/401|unauthorized/i.test(msg)) throw err
    return addLocalDoubt(payload)
  }
}

export async function getDoubt(id) {
  if (String(id).startsWith('local-')) {
    const local = findLocalDoubt(id)
    if (!local) throw new Error('Doubt not found')
    return withLocalReplies(local)
  }
  const res = await fetch(`${BASE_URL}/doubts/${id}`)
  const data = await getJsonOrThrow(res)
  return withLocalReplies(data)
}

export async function updateStatus(id, status) {
  if (String(id).startsWith('local-')) {
    const local = findLocalDoubt(id)
    if (!local) throw new Error('Doubt not found')
    return replaceLocalDoubt({ ...local, status })
  }
  const res = await fetch(`${BASE_URL}/doubts/${id}/status?status=${status}`, { method: 'PATCH', headers: authHeaders() })
  return getJsonOrThrow(res)
}

export async function addReply(id, r) {
  if (String(id).startsWith('local-')) {
    const local = findLocalDoubt(id)
    if (!local) throw new Error('Doubt not found')
    const nextReply = {
      id: `local-reply-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      authorName: r?.authorName || 'User',
      message: r?.message || '',
      accepted: false,
      bountyAwardedPoints: 0,
      createdAt: new Date().toISOString()
    }
    return replaceLocalDoubt({
      ...local,
      replies: [...(local.replies || []), nextReply],
      status: 'SOLVED'
    })
  }
  const payload = {
    authorName: r?.authorName || '',
    author: r?.authorName || '',
    username: r?.authorName || '',
    userName: r?.authorName || '',
    name: r?.authorName || '',
    message: r?.message || '',
    content: r?.message || '',
    text: r?.message || ''
  }

  try {
    const res = await fetch(`${BASE_URL}/doubts/${id}/replies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', ...authHeaders() },
      body: JSON.stringify(payload)
    })
    if (res.status !== 415) return withLocalReplies(await getJsonOrThrow(res))

    const fd = new FormData()
    fd.append('authorName', payload.authorName)
    fd.append('author', payload.author)
    fd.append('username', payload.username)
    fd.append('userName', payload.userName)
    fd.append('name', payload.name)
    fd.append('message', payload.message)
    fd.append('content', payload.content)
    fd.append('text', payload.text)
    const multipartRes = await fetch(`${BASE_URL}/doubts/${id}/replies`, {
      method: 'POST',
      headers: { 'Accept': 'application/json', ...authHeaders() },
      body: fd
    })
    if (multipartRes.status !== 415) return withLocalReplies(await getJsonOrThrow(multipartRes))

    const urlParams = new URLSearchParams()
    urlParams.set('authorName', payload.authorName)
    urlParams.set('author', payload.author)
    urlParams.set('username', payload.username)
    urlParams.set('userName', payload.userName)
    urlParams.set('name', payload.name)
    urlParams.set('message', payload.message)
    urlParams.set('content', payload.content)
    urlParams.set('text', payload.text)
    const formRes = await fetch(`${BASE_URL}/doubts/${id}/replies`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        'Accept': 'application/json',
        ...authHeaders()
      },
      body: urlParams.toString()
    })
    if (formRes.status !== 415) return withLocalReplies(await getJsonOrThrow(formRes))

    const query = new URLSearchParams(urlParams)
    const queryRes = await fetch(`${BASE_URL}/doubts/${id}/replies?${query.toString()}`, {
      method: 'POST',
      headers: { 'Accept': 'application/json', ...authHeaders() }
    })
    if (queryRes.status !== 415) return withLocalReplies(await getJsonOrThrow(queryRes))

    const plainRes = await fetch(`${BASE_URL}/doubts/${id}/replies`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8', 'Accept': 'application/json', ...authHeaders() },
      body: JSON.stringify(payload)
    })
    return withLocalReplies(await getJsonOrThrow(plainRes))
  } catch (err) {
    const msg = String(err?.message || '')
    if (/401|unauthorized/i.test(msg)) throw err
    const localReply = addLocalReply(id, payload)
    return {
      id,
      status: 'SOLVED',
      replies: [localReply]
    }
  }
}

export async function acceptReply(doubtId, replyId) {
  if (String(doubtId).startsWith('local-')) {
    const local = findLocalDoubt(doubtId)
    if (!local) throw new Error('Doubt not found')
    const bountyPoints = normalizeBounty(local.bountyPoints)
    const nextReplies = (local.replies || []).map(reply => {
      const accepted = String(reply.id) === String(replyId)
      return {
        ...reply,
        accepted,
        bountyAwardedPoints: accepted ? bountyPoints : 0
      }
    })
    return replaceLocalDoubt({
      ...local,
      status: 'SOLVED',
      replies: nextReplies
    })
  }
  const res = await fetch(`${BASE_URL}/doubts/${doubtId}/replies/${replyId}/accept`, {
    method: 'PATCH',
    headers: { 'Accept': 'application/json', ...authHeaders() }
  })
  return withLocalReplies(await getJsonOrThrow(res))
}

export async function addBountyPoints(doubtId, points) {
  const safePoints = Math.max(1, normalizeBounty(points))
  if (String(doubtId).startsWith('local-')) {
    const local = findLocalDoubt(doubtId)
    if (!local) throw new Error('Doubt not found')
    const nextBounty = normalizeBounty(local.bountyPoints) + safePoints
    const nextReplies = (local.replies || []).map(reply => ({
      ...reply,
      bountyAwardedPoints: reply.accepted ? nextBounty : 0
    }))
    return replaceLocalDoubt({
      ...local,
      bountyPoints: nextBounty,
      replies: nextReplies
    })
  }
  const res = await fetch(`${BASE_URL}/doubts/${doubtId}/bounty?points=${safePoints}`, {
    method: 'PATCH',
    headers: { 'Accept': 'application/json', ...authHeaders() }
  })
  return withLocalReplies(await getJsonOrThrow(res))
}

export async function signup(username, password) {
  return fetch(`${BASE_URL}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  })
}

export async function me() {
  return fetch(`${BASE_URL}/auth/me`, { headers: { ...authHeaders() } })
}

export async function forgotPassword(email) {
  const res = await fetch(`${BASE_URL}/auth/forgot`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  })
  return getJsonOrThrow(res)
}

export async function resetPassword(email, otp, password) {
  return fetch(`${BASE_URL}/auth/reset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, otp, password })
  })
}

export async function createPost({ content, file }) {
  const fd = new FormData()
  fd.append('content', content || '')
  if (file) fd.append('image', file)
  const res = await fetch(`${BASE_URL}/posts`, {
    method: 'POST',
    headers: { ...authHeaders() },
    body: fd
  })
  return getJsonOrThrow(res)
}

export async function getFeed({ following } = {}) {
  const res = await fetch(`${BASE_URL}/posts?following=${following ? 'true' : 'false'}`)
  return getJsonOrThrow(res)
}

export async function follow(username) {
  const res = await fetch(`${BASE_URL}/follow/${encodeURIComponent(username)}`, {
    method: 'POST',
    headers: { ...authHeaders() }
  })
  return res
}

export async function unfollow(username) {
  const res = await fetch(`${BASE_URL}/follow/${encodeURIComponent(username)}`, {
    method: 'DELETE',
    headers: { ...authHeaders() }
  })
  return res
}

export async function listFollowing() {
  const res = await fetch(`${BASE_URL}/follow/list`, { headers: { ...authHeaders() } })
  return getJsonOrThrow(res)
}

const TOPIC_TRENDING_FALLBACK = {
  science: [
    'Top research breakthroughs this week',
    'Major lab experiments shaping current science',
    'New climate and environment findings',
    'Health science updates from global journals',
    'AI and biotech cross-disciplinary discoveries'
  ],
  space: [
    'Latest mission updates from space agencies',
    'New telescope discoveries and deep-sky findings',
    'Rocket launches and satellite deployment highlights',
    'Moon and Mars program progress',
    'Astronomy observations drawing global attention'
  ],
  sports: [
    'Top match results and tournament updates',
    'Player transfer and team strategy headlines',
    'Injury reports and comeback stories',
    'Championship race analysis across leagues',
    'Emerging athletes and record performances'
  ],
  politics: [
    'Key policy moves and government decisions',
    'Election campaign developments and polling trends',
    'Legislative debate highlights',
    'Global diplomatic updates and summit outcomes',
    'Regulation and public policy stories to watch'
  ],
  geography: [
    'Natural events and regional impact reports',
    'Urban growth and population shift trends',
    'Climate, terrain, and ecosystem mapping updates',
    'Geospatial technology and remote sensing insights',
    'Country-level development and resource stories'
  ],
  history: [
    'Archaeology finds changing known timelines',
    'Museum and archive discoveries in focus',
    'Historical research papers trending now',
    'New analysis of major world events',
    'Restoration projects uncovering old records'
  ],
  physics: [
    'Quantum research updates and practical implications',
    'Particle physics results from major labs',
    'Astrophysics models under new review',
    'Materials physics breakthroughs for industry',
    'Experimental physics studies with notable findings'
  ],
  psychology: [
    'Behavior science studies making headlines',
    'Mental health research updates and evidence',
    'Cognition and learning experiments in focus',
    'Social psychology findings with real-world impact',
    'Neuroscience and psychology crossover stories'
  ]
}

function normalizeTopic(topic) {
  return String(topic || 'science').trim() || 'science'
}

function buildTrendingFallback(topic, limit) {
  const normalizedTopic = normalizeTopic(topic)
  const key = normalizedTopic.toLowerCase()
  const fallbackTitles = TOPIC_TRENDING_FALLBACK[key] || [
    'Trending updates for this topic',
    'Latest incidents and global coverage',
    'Top stories and analysis right now',
    'Most discussed developments this week',
    'Breaking updates across major outlets'
  ]
  const baseLink = `https://news.google.com/search?q=${encodeURIComponent(normalizedTopic)}&hl=en-US&gl=US&ceid=US:en`
  const maxItems = Number.isFinite(limit) ? Math.max(1, Math.min(20, limit)) : 8
  const items = []
  for (let i = 0; i < maxItems; i++) {
    const title = fallbackTitles[i % fallbackTitles.length]
    items.push({
      title,
      link: baseLink,
      source: 'Google News',
      publishedAt: new Date(Date.now() - i * 60 * 60 * 1000).toISOString(),
      summary: `Open to view latest ${normalizedTopic.toLowerCase()} coverage from global sources.`
    })
  }
  return items
}

export async function getTrendingTopic(topic, limit = 8) {
  const normalizedTopic = normalizeTopic(topic)
  const t = encodeURIComponent(normalizedTopic)
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(20, limit)) : 8
  try {
    const res = await fetch(`${BASE_URL}/trending?topic=${t}&limit=${safeLimit}`)
    const data = await getJsonOrThrow(res)
    if (!Array.isArray(data) || data.length === 0) {
      return buildTrendingFallback(normalizedTopic, safeLimit)
    }
    return data.slice(0, safeLimit).map(item => ({
      title: item?.title || `Latest ${normalizedTopic} update`,
      link: item?.link || `https://news.google.com/search?q=${t}&hl=en-US&gl=US&ceid=US:en`,
      source: item?.source || 'News',
      publishedAt: item?.publishedAt || new Date().toISOString(),
      summary: item?.summary || 'Open article for details.'
    }))
  } catch {
    return buildTrendingFallback(normalizedTopic, safeLimit)
  }
}
