// calls `set(message)` now and `set("")` after `ms`, restarting the clock on
// every call - for short "copied!" style notices
export function flasher(set, ms = 2500) {
  let timer = null
  return message => {
    set(message)
    clearTimeout(timer)
    timer = setTimeout(() => set(""), ms)
  }
}

export function downloadBlob(blob, filename) {
  const link = document.createElement("a")
  link.href = URL.createObjectURL(blob)
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(link.href), 1000)
}
