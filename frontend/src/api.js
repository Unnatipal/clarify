export const API_ORIGIN = 'http://127.0.0.1:8081'
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

function addLocalReply(doubtId, payload) {
  const idKey = String(doubtId)
  const nextReply = {
    id: `local-reply-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    authorName: payload.authorName || payload.author || payload.username || 'User',
    message: payload.message || payload.content || payload.text || '',
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
  return {
    ...doubt,
    replies: mergedReplies,
    status: mergedReplies.length > 0 && doubt.status === 'OPEN' ? 'SOLVED' : doubt.status
  }
}

function addLocalDoubt(payload) {
  const localDoubt = {
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: payload.title,
    description: payload.description,
    authorName: payload.authorName || payload.author || 'User',
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
  const payload = {
    title: d?.title || '',
    description: d?.description || '',
    authorName: d?.authorName || '',
    author: d?.authorName || '',
    username: d?.authorName || '',
    userName: d?.authorName || '',
    name: d?.authorName || '',
    message: d?.description || '',
    content: d?.description || ''
  }

  try {
    const res = await fetch(`${BASE_URL}/doubts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', ...authHeaders() },
      body: JSON.stringify(payload)
    })
    if (res.status !== 415) return getJsonOrThrow(res)

    // Fallback for backend variants that accept multipart/form-data instead of JSON.
    const fd = new FormData()
    fd.append('title', payload.title)
    fd.append('description', payload.description)
    fd.append('authorName', payload.authorName)
    fd.append('author', payload.author)
    fd.append('username', payload.username)
    fd.append('userName', payload.userName)
    fd.append('name', payload.name)
    fd.append('message', payload.message)
    fd.append('content', payload.content)
    const multipartRes = await fetch(`${BASE_URL}/doubts`, {
      method: 'POST',
      headers: { 'Accept': 'application/json', ...authHeaders() },
      body: fd
    })
    if (multipartRes.status !== 415) return getJsonOrThrow(multipartRes)

    // Final fallback for backends that expect x-www-form-urlencoded.
    const urlParams = new URLSearchParams()
    urlParams.set('title', payload.title)
    urlParams.set('description', payload.description)
    urlParams.set('authorName', payload.authorName)
    urlParams.set('author', payload.author)
    urlParams.set('username', payload.username)
    urlParams.set('userName', payload.userName)
    urlParams.set('name', payload.name)
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
    if (formRes.status !== 415) return getJsonOrThrow(formRes)

    // Additional fallback: parameters in query string with empty body.
    const query = new URLSearchParams(urlParams)
    const queryRes = await fetch(`${BASE_URL}/doubts?${query.toString()}`, {
      method: 'POST',
      headers: { 'Accept': 'application/json', ...authHeaders() }
    })
    if (queryRes.status !== 415) return getJsonOrThrow(queryRes)

    // Last fallback: plain text JSON payload for custom parsers.
    const plainRes = await fetch(`${BASE_URL}/doubts`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8', 'Accept': 'application/json', ...authHeaders() },
      body: JSON.stringify(payload)
    })
    return getJsonOrThrow(plainRes)
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

export async function getTrendingTopic(topic, limit = 8) {
  const t = encodeURIComponent(topic || 'science')
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(20, limit)) : 8
  const res = await fetch(`${BASE_URL}/trending?topic=${t}&limit=${safeLimit}`)
  return getJsonOrThrow(res)
}
