// The browser's own BarcodeDetector when it can read QR codes (Chrome on
// Android, macOS, ChromeOS), jsQR everywhere else. jsQR is loaded on demand,
// so browsers with a native detector never download it
let nativeDetector
let jsQR

async function getNativeDetector() {
  nativeDetector ??= (async () => {
    if (typeof globalThis.BarcodeDetector !== "function") return null
    try {
      const formats = await globalThis.BarcodeDetector.getSupportedFormats()
      return formats.includes("qr_code") ? new globalThis.BarcodeDetector({ formats: ["qr_code"] }) : null
    } catch {
      return null
    }
  })()
  return nativeDetector
}

// decodes RGBA pixels ({ data, width, height }, the shape of an ImageData)
export async function decodePixels({ data, width, height }) {
  jsQR ??= (await import("jsqr")).default
  return jsQR(data, width, height, { inversionAttempts: "attemptBoth" })?.data ?? null
}

async function decodeCanvas(canvas) {
  const detector = await getNativeDetector()
  if (detector) {
    try {
      const [code] = await detector.detect(canvas)
      return code?.rawValue ?? null
    } catch {
      // fall through to jsQR
    }
  }
  return decodePixels(canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height))
}

// draws `source` scaled down so its longest side is at most `maxSize`
function snapshot(source, width, height, maxSize, canvas = document.createElement("canvas")) {
  const ratio = Math.min(1, maxSize / Math.max(width, height))
  canvas.width = Math.round(width * ratio)
  canvas.height = Math.round(height * ratio)
  canvas.getContext("2d", { willReadFrequently: true }).drawImage(source, 0, 0, canvas.width, canvas.height)
  return canvas
}

export function scanVideoFrame(video, canvas) {
  if (!video.videoWidth) return Promise.resolve(null)
  return decodeCanvas(snapshot(video, video.videoWidth, video.videoHeight, 720, canvas))
}

// `source` is a File/Blob or a URL the page can read (a data: URL, say)
const loadImage = source =>
  new Promise((resolve, reject) => {
    const url = typeof source === "string" ? source : URL.createObjectURL(source)
    const done = () => {
      if (url !== source) URL.revokeObjectURL(url)
    }
    const img = new Image()
    img.onload = () => {
      done()
      resolve(img)
    }
    img.onerror = () => {
      done()
      reject(new Error("No se pudo abrir la imagen"))
    }
    img.src = url
  })

export async function scanImage(source, { maxSize = 1600 } = {}) {
  const img = await loadImage(source)
  return decodeCanvas(snapshot(img, img.naturalWidth, img.naturalHeight, maxSize))
}

export const scanImageFile = file => scanImage(file)

export function openCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    const error = new Error("getUserMedia is not available")
    error.name = "NotSupportedError"
    return Promise.reject(error)
  }
  return navigator.mediaDevices.getUserMedia({
    audio: false,
    video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
  })
}

const CAMERA_ERRORS = {
  NotAllowedError: "No hay permiso para usar la cámara. Revisa los permisos del navegador.",
  SecurityError: "No hay permiso para usar la cámara. Revisa los permisos del navegador.",
  NotFoundError: "No se ha encontrado ninguna cámara.",
  OverconstrainedError: "No se ha encontrado ninguna cámara compatible.",
  NotReadableError: "La cámara está siendo usada por otra aplicación.",
  NotSupportedError: "Este navegador no permite usar la cámara (hace falta HTTPS).",
}

export const cameraErrorMessage = error => CAMERA_ERRORS[error?.name] ?? "No se pudo abrir la cámara."
