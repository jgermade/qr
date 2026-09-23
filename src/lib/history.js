const KEY = "qr:history"

export const HISTORY_LIMIT = 30

export function loadHistory(storage = globalThis.localStorage) {
  try {
    const list = JSON.parse(storage?.getItem(KEY) ?? "[]")
    return Array.isArray(list) ? list.filter(item => typeof item?.text === "string") : []
  } catch {
    return []
  }
}

export function saveHistory(list, storage = globalThis.localStorage) {
  try {
    storage?.setItem(KEY, JSON.stringify(list))
  } catch {
    // private mode or a full quota: the history is a convenience, not data
  }
}

// newest first; scanning the same text again moves it to the top instead of
// adding a duplicate
export function addToHistory(list, text, at = Date.now()) {
  return [{ text, at }, ...list.filter(item => item.text !== text)].slice(0, HISTORY_LIMIT)
}
