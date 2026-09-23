import { describe, expect, it } from "vitest"
import { QUIET_ZONE, qrMatrix, qrPath, qrPixels, qrSvg, safeColor } from "../src/lib/qr.js"
import { decodePixels } from "../src/lib/scan.js"

describe("qrMatrix", () => {
  it("builds a square matrix of booleans", () => {
    const matrix = qrMatrix("hola")
    expect(matrix.length).toBe(21) // version 1
    expect(matrix.every(row => row.length === 21 && row.every(cell => typeof cell === "boolean"))).toBe(true)
  })

  it("grows with the error correction level", () => {
    const text = "https://github.com/jgermade/qr"
    expect(qrMatrix(text, { ecc: "H" }).length).toBeGreaterThan(qrMatrix(text, { ecc: "L" }).length)
  })

  it("throws when the content doesn't fit", () => {
    expect(() => qrMatrix("x".repeat(3000), { ecc: "H" })).toThrow(RangeError)
  })
})

describe("qrPath", () => {
  it("merges horizontal runs of dark modules", () => {
    const matrix = [
      [true, true, false],
      [false, true, false],
    ]
    expect(qrPath(matrix, 0)).toBe("M0 0h2v1h-2zM1 1h1v1h-1z")
  })

  it("offsets everything by the quiet zone", () => {
    expect(qrPath([[true]], 4)).toBe("M4 4h1v1h-1z")
  })
})

describe("qrSvg", () => {
  it("includes the quiet zone in the viewBox", () => {
    const matrix = qrMatrix("hola")
    const size = matrix.length + QUIET_ZONE * 2
    expect(qrSvg(matrix)).toContain(`viewBox="0 0 ${size} ${size}"`)
  })

  it("never writes anything but a hex color", () => {
    const svg = qrSvg([[true]], { fg: '"/><script>alert(1)</script>', bg: "#abc" })
    expect(svg).not.toContain("<script>")
    expect(svg).toContain('fill="#000000"')
    expect(svg).toContain('fill="#abc"')
  })
})

describe("safeColor", () => {
  it("accepts 3 and 6 digit hex colors only", () => {
    expect(safeColor("#fff", "x")).toBe("#fff")
    expect(safeColor("#12AB9f", "x")).toBe("#12AB9f")
    expect(safeColor("red", "x")).toBe("x")
    expect(safeColor("#12345", "x")).toBe("x")
  })
})

describe("round trip", () => {
  it.each([
    "hola",
    "https://github.com/jgermade/qr",
    "WIFI:T:WPA;S:Mi casa;P:secreto\\;123;;",
    "Ñandú, pingüino y 🐧",
  ])("reads back %s", async text => {
    const pixels = qrPixels(qrMatrix(text), { scale: 4 })
    expect(await decodePixels(pixels)).toBe(text)
  })

  it("reads light-on-dark codes too", async () => {
    const pixels = qrPixels(qrMatrix("invertido"), { fg: "#ffffff", bg: "#000000", scale: 4 })
    expect(await decodePixels(pixels)).toBe("invertido")
  })

  it("returns null when there is no code", async () => {
    const width = 64
    const data = new Uint8ClampedArray(width * width * 4).fill(255)
    expect(await decodePixels({ data, width, height: width })).toBeNull()
  })
})
