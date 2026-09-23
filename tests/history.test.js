import { describe, expect, it } from "vitest"
import { HISTORY_LIMIT, addToHistory, loadHistory, saveHistory } from "../src/lib/history.js"

const memoryStorage = () => {
  const items = new Map()
  return {
    getItem: key => items.get(key) ?? null,
    setItem: (key, value) => items.set(key, String(value)),
  }
}

describe("history", () => {
  it("adds newest first and moves repeated scans to the top", () => {
    let list = addToHistory([], "a", 1)
    list = addToHistory(list, "b", 2)
    list = addToHistory(list, "a", 3)
    expect(list).toEqual([
      { text: "a", at: 3 },
      { text: "b", at: 2 },
    ])
  })

  it("keeps at most HISTORY_LIMIT entries", () => {
    let list = []
    for (let i = 0; i < HISTORY_LIMIT + 5; i++) list = addToHistory(list, `item ${i}`, i)
    expect(list).toHaveLength(HISTORY_LIMIT)
    expect(list[0].text).toBe(`item ${HISTORY_LIMIT + 4}`)
  })

  it("persists to storage", () => {
    const storage = memoryStorage()
    saveHistory([{ text: "x", at: 1 }], storage)
    expect(loadHistory(storage)).toEqual([{ text: "x", at: 1 }])
  })

  it("survives missing or corrupt storage", () => {
    const storage = memoryStorage()
    expect(loadHistory(storage)).toEqual([])
    storage.setItem("qr:history", "{nope")
    expect(loadHistory(storage)).toEqual([])
    storage.setItem("qr:history", JSON.stringify([{ text: 1 }, { text: "ok", at: 2 }]))
    expect(loadHistory(storage)).toEqual([{ text: "ok", at: 2 }])
    expect(loadHistory(null)).toEqual([])
  })
})
