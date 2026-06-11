const KEY = 'moneyball.guestId'

export function getGuestId(): string {
  const existing = localStorage.getItem(KEY)
  if (existing) return existing
  const id = crypto.randomUUID()
  localStorage.setItem(KEY, id)
  return id
}
