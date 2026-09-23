const RELEASES_URL = "https://github.com/jgermade/qr#extensión-para-el-navegador"

// "firefox", "chromium" or null: desktop browsers only, extensions for mobile
// browsers can't be installed from a link
export function extensionBrowser(nav = globalThis.navigator) {
  const ua = nav?.userAgent ?? ""
  if (nav?.userAgentData?.mobile ?? /Android|iPhone|iPad|Mobile/i.test(ua)) return null
  if (/Firefox\//.test(ua)) return "firefox"
  if (nav?.userAgentData?.brands?.some(({ brand }) => brand === "Chromium")) return "chromium"
  return null
}

// The link to the extension for this browser, or null. Firefox installs the
// signed .xpi deployed next to the app straight from the link; it's only there
// when the release could sign it, which its updates.json tells under the
// add-on id. Chromium browsers only install from the Chrome Web Store. The ids
// come from the build (vite.config.js): here, not in the component, since jq79
// compiles components at runtime and Vite never replaces them there
export async function extensionLink({
  chromeWebStoreId = __CHROME_WEBSTORE_ID__,
  firefoxExtensionId = __FIREFOX_EXTENSION_ID__,
  nav,
  fetch = globalThis.fetch,
} = {}) {
  const browser = extensionBrowser(nav)

  if (browser === "firefox") {
    if (!firefoxExtensionId) return null
    try {
      const response = await fetch("extension/updates.json")
      const updates = response.ok ? (await response.json())?.addons?.[firefoxExtensionId]?.updates : null
      const href = updates?.at(-1)?.update_link
      return href ? { href, label: "Instalar la extensión para Firefox", external: false } : null
    } catch {
      return null
    }
  }

  if (browser === "chromium") {
    return chromeWebStoreId
      ? { href: `https://chromewebstore.google.com/detail/${chromeWebStoreId}`, label: "Extensión para Chrome", external: true }
      : { href: RELEASES_URL, label: "Extensión para Chrome", external: true }
  }

  return null
}
