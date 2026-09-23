import { encode } from "uqr"

// modules of blank space around the code; 4 is what the spec asks for
export const QUIET_ZONE = 4

export const ECC_LEVELS = ["L", "M", "Q", "H"]

const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i

// colors end up inside SVG markup, so anything that isn't a plain hex color is
// replaced by the fallback instead of being written verbatim
export const safeColor = (color, fallback) => (HEX_COLOR.test(color) ? color : fallback)

// square matrix of booleans (true = dark module), without the quiet zone.
// Throws a RangeError when the content doesn't fit in a version 40 code
export function qrMatrix(text, { ecc = "M" } = {}) {
  return encode(text, { ecc, border: 0 }).data
}

// one SVG path for every dark module, merging horizontal runs so even a
// version 40 code stays a few KB instead of one <rect> per module
export function qrPath(matrix, margin = QUIET_ZONE) {
  let d = ""
  matrix.forEach((row, y) => {
    let x = 0
    while (x < row.length) {
      if (!row[x]) {
        x++
        continue
      }
      const start = x
      while (x < row.length && row[x]) x++
      d += `M${start + margin} ${y + margin}h${x - start}v1h${start - x}z`
    }
  })
  return d
}

export function qrSvg(matrix, { fg = "#000000", bg = "#ffffff", margin = QUIET_ZONE } = {}) {
  const size = matrix.length + margin * 2
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges">` +
    `<rect width="${size}" height="${size}" fill="${safeColor(bg, "#ffffff")}"/>` +
    `<path d="${qrPath(matrix, margin)}" fill="${safeColor(fg, "#000000")}"/>` +
    `</svg>`
  )
}

const hexToRgb = hex => {
  const value = hex.length === 4 ? hex.replace(/[0-9a-f]/gi, c => c + c) : hex
  const n = parseInt(value.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

// RGBA pixels of the code, `scale` pixels per module - the shape of an
// ImageData, without needing a canvas to build one
export function qrPixels(matrix, { fg = "#000000", bg = "#ffffff", margin = QUIET_ZONE, scale = 8 } = {}) {
  const modules = matrix.length + margin * 2
  const width = modules * scale
  const data = new Uint8ClampedArray(width * width * 4)
  const dark = hexToRgb(safeColor(fg, "#000000"))
  const light = hexToRgb(safeColor(bg, "#ffffff"))

  for (let py = 0; py < width; py++) {
    const row = matrix[Math.floor(py / scale) - margin]
    for (let px = 0; px < width; px++) {
      const on = row?.[Math.floor(px / scale) - margin] === true
      const [r, g, b] = on ? dark : light
      const i = (py * width + px) * 4
      data[i] = r
      data[i + 1] = g
      data[i + 2] = b
      data[i + 3] = 255
    }
  }

  return { data, width, height: width }
}

// PNG of roughly `size` pixels per side, snapped to whole pixels per module
export function qrPngBlob(matrix, { size = 1024, ...colors } = {}) {
  const margin = colors.margin ?? QUIET_ZONE
  const scale = Math.max(1, Math.ceil(size / (matrix.length + margin * 2)))
  const { data, width, height } = qrPixels(matrix, { ...colors, margin, scale })

  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  canvas.getContext("2d").putImageData(new ImageData(data, width, height), 0, 0)

  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error("No se pudo generar el PNG"))), "image/png")
  })
}
