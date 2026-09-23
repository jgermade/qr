// the extension's popup, also opened as a window from the context menu. Plain
// DOM instead of jq79 components: those compile their templates with
// new Function, which an extension page's CSP (no unsafe-eval) doesn't allow
import "../src/styles.css"
import "./popup.css"
import { QUIET_ZONE, qrMatrix, qrPath, qrPngBlob, qrSvg } from "../src/lib/qr.js"
import { parsePayload } from "../src/lib/payload.js"
import { scanImage } from "../src/lib/scan.js"
import { downloadBlob, flasher } from "../src/lib/ui.js"

const api = globalThis.browser ?? globalThis.chrome
const $ = id => document.getElementById(id)
const params = new URLSearchParams(location.search)
// opened from the context menu rather than the toolbar button
const inWindow = params.has("text") || params.has("scan")

const flash = flasher(message => {
  $("notice").textContent = message
})

$("app-link").href = __SITE_URL__

// generate

const ECC = "M"
let matrix = null

const SVG_NS = "http://www.w3.org/2000/svg"

// built node by node: AMO's review flags any innerHTML assignment
function svgElement(name, attrs) {
  const element = document.createElementNS(SVG_NS, name)
  for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, value)
  return element
}

function qrPreview(matrix) {
  const size = matrix.length + QUIET_ZONE * 2
  const svg = svgElement("svg", {
    viewBox: `0 0 ${size} ${size}`,
    "shape-rendering": "crispEdges",
    role: "img",
    "aria-label": "Código QR generado",
  })
  svg.append(
    svgElement("rect", { width: size, height: size, fill: "#ffffff" }),
    svgElement("path", { d: qrPath(matrix), fill: "#000000" }),
  )
  return svg
}

function render() {
  const text = $("text").value
  matrix = null
  $("error").hidden = true
  try {
    if (text) matrix = qrMatrix(text, { ecc: ECC })
  } catch {
    $("error").textContent = "Hay demasiado contenido para un código QR."
    $("error").hidden = false
  }
  $("preview").replaceChildren(...(matrix ? [qrPreview(matrix)] : []))
  $("preview").hidden = !matrix
  for (const id of ["png", "svg", "copy"]) $(id).disabled = !matrix
}

function setText(text) {
  $("text").value = text
  render()
}

$("text").addEventListener("input", render)

$("png").addEventListener("click", async () => downloadBlob(await qrPngBlob(matrix), "qr.png"))

$("svg").addEventListener("click", () =>
  downloadBlob(new Blob([qrSvg(matrix)], { type: "image/svg+xml" }), "qr.svg"),
)

if (typeof ClipboardItem === "function" && typeof navigator.clipboard?.write === "function") {
  $("copy").hidden = false
  $("copy").addEventListener("click", async () => {
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": qrPngBlob(matrix) })])
      flash("Imagen copiada")
    } catch {
      flash("No se pudo copiar la imagen")
    }
  })
}

// scan

let scanned = ""

function showResult(text) {
  scanned = text ?? ""
  $("result").hidden = false
  if (!text) {
    $("result-label").textContent = "No se ha encontrado ningún código QR"
    $("result-text").textContent = "Asegúrate de que el código se ve entero en la pantalla."
    $("result-open").hidden = true
    $("result-copy").hidden = true
    $("result-generate").hidden = true
    return
  }
  const info = parsePayload(text)
  $("result-label").textContent = info.label
  $("result-text").textContent = text
  // parsePayload only returns hrefs with safe schemes (http, https, mailto, tel, sms)
  $("result-open").hidden = !info.href
  if (info.href) {
    $("result-open").href = info.href
    $("result-open").textContent = info.action
  }
  $("result-copy").hidden = false
  $("result-generate").hidden = false
}

async function scanCapture(capture) {
  try {
    return capture ? await scanImage(capture, { maxSize: 2400 }) : null
  } catch {
    return null
  }
}

// an image's own pixels are read when the page lets us (same origin, data:
// URLs); otherwise the screenshot taken when the menu was clicked
async function scanImageUrl(url) {
  try {
    const response = await fetch(url)
    return response.ok ? await scanImage(await response.blob()) : null
  } catch {
    return null
  }
}

$("scan").addEventListener("click", async () => {
  $("scan").disabled = true
  try {
    const capture = await api.tabs.captureVisibleTab({ format: "png" })
    showResult(await scanCapture(capture))
  } catch {
    flash("No se puede leer esta pestaña")
  } finally {
    $("scan").disabled = false
  }
})

$("result-copy").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(scanned)
    flash("Copiado")
  } catch {
    flash("No se pudo copiar")
  }
})

$("result-generate").addEventListener("click", () => setText(scanned))

// start

async function start() {
  if (params.has("scan")) {
    // the button would capture this window, not the page
    $("scan").hidden = true
    const { capture = null } = await api.storage.session.get("capture")
    await api.storage.session.remove("capture")
    const image = params.get("image")
    showResult((image && (await scanImageUrl(image))) || (await scanCapture(capture)))
    render()
    return
  }

  if (inWindow) {
    $("scan-card").hidden = true
    setText(params.get("text") ?? "")
    return
  }

  // clicking the toolbar button grants activeTab, which includes the tab's URL
  const [tab] = await api.tabs.query({ active: true, currentWindow: true })
  setText(/^https?:/i.test(tab?.url ?? "") ? tab.url : "")
  $("text").select()
}

start()
