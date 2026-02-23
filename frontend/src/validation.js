export function required(v) {
  return v && v.trim().length > 0
}
export function isEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
}
export function minLen(v, n) {
  return (v || '').length >= n
}
