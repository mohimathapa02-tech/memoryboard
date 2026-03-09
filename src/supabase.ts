const FIREBASE_URL = 'https://memory-board-by-mohima-default-rtdb.asia-southeast1.firebasedatabase.app'

export async function loadBoard(id: string) {
  try {
    const res = await fetch(`${FIREBASE_URL}/boards/${id}.json`)
    if (!res.ok) return null
    const data = await res.json()
    if (!data || !Array.isArray(data.items)) return null
    return data as { items: unknown[] }
  } catch {
    return null
  }
}

export async function saveBoard(id: string, items: unknown[]) {
  try {
    const res = await fetch(`${FIREBASE_URL}/boards/${id}.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    })
    return res.ok
  } catch {
    return false
  }
}
