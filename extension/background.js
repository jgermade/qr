// context menu entries. They open the popup page in a small window, since an
// extension can't open its own toolbar popup from a menu click
const api = globalThis.browser ?? globalThis.chrome

const MENUS = [
  { id: "qr-page", title: "Generar el QR de esta página", contexts: ["page"] },
  { id: "qr-link", title: "Generar el QR del enlace", contexts: ["link"] },
  { id: "qr-selection", title: "Generar el QR del texto seleccionado", contexts: ["selection"] },
  { id: "scan-image", title: "Leer el QR de la imagen", contexts: ["image"] },
  { id: "scan-screen", title: "Leer el QR de la pantalla", contexts: ["page"] },
]

api.runtime.onInstalled.addListener(async () => {
  await api.contextMenus.removeAll()
  MENUS.forEach(menu => api.contextMenus.create(menu))
})

const openWindow = params =>
  api.windows.create({
    url: api.runtime.getURL(`popup.html?${new URLSearchParams(params)}`),
    type: "popup",
    width: 400,
    height: 680,
  })

// the screenshot is taken right away, while the menu click's activeTab grant
// holds, and handed to the window through session storage (too big for a URL)
async function scan(tab, image) {
  let capture = null
  try {
    capture = await api.tabs.captureVisibleTab(tab.windowId, { format: "png" })
  } catch {
    // restricted page (the browser's own pages, the web store...)
  }
  await api.storage.session.set({ capture })
  return openWindow(image ? { scan: "1", image } : { scan: "1" })
}

api.contextMenus.onClicked.addListener((info, tab) => {
  switch (info.menuItemId) {
    case "qr-page":
      return openWindow({ text: info.pageUrl ?? tab?.url ?? "" })
    case "qr-link":
      return openWindow({ text: info.linkUrl })
    case "qr-selection":
      return openWindow({ text: info.selectionText })
    case "scan-image":
      return scan(tab, info.srcUrl)
    case "scan-screen":
      return scan(tab)
  }
})
