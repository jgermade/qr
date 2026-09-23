import { describe, expect, it, vi } from "vitest"
import { extensionManifest } from "../extension/manifest.js"
import { extensionBrowser, extensionLink } from "../src/lib/extension.js"

const siteUrl = "https://example.github.io/qr/"
const GECKO_ID = "qr@example.com"

describe("extensionManifest", () => {
  it("runs a service worker in Chrome, with no Gecko settings", () => {
    const manifest = extensionManifest({ target: "chrome", version: "1.2.3", siteUrl })
    expect(manifest.manifest_version).toBe(3)
    expect(manifest.version).toBe("1.2.3")
    expect(manifest.background).toEqual({ service_worker: "background.js" })
    expect(manifest.browser_specific_settings).toBeUndefined()
  })

  it("runs an event page in Firefox and looks for updates next to the app", () => {
    const manifest = extensionManifest({ target: "firefox", version: "1.2.3", siteUrl, geckoId: GECKO_ID })
    expect(manifest.background).toEqual({ scripts: ["background.js"] })
    expect(manifest.browser_specific_settings.gecko).toMatchObject({
      id: GECKO_ID,
      update_url: "https://example.github.io/qr/extension/updates.json",
    })
  })

  it("asks for no host permissions", () => {
    for (const target of ["chrome", "firefox"]) {
      const manifest = extensionManifest({ target, version: "1.0.0", siteUrl })
      expect(manifest.permissions).toEqual(["activeTab", "contextMenus", "storage"])
      expect(manifest.host_permissions).toBeUndefined()
    }
  })
})

const FIREFOX = { userAgent: "Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0" }
const FIREFOX_ANDROID = { userAgent: "Mozilla/5.0 (Android 14; Mobile; rv:143.0) Gecko/143.0 Firefox/143.0" }
const CHROME = {
  userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  userAgentData: { mobile: false, brands: [{ brand: "Chromium" }, { brand: "Google Chrome" }] },
}
const SAFARI = {
  userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
}

const updatesJson = href => ({
  ok: true,
  json: async () => ({ addons: { [GECKO_ID]: { updates: [{ version: "1.0.0", update_link: href }] } } }),
})

describe("extensionBrowser", () => {
  it("tells desktop Firefox and Chromium browsers apart", () => {
    expect(extensionBrowser(FIREFOX)).toBe("firefox")
    expect(extensionBrowser(CHROME)).toBe("chromium")
    expect(extensionBrowser(SAFARI)).toBeNull()
    expect(extensionBrowser(FIREFOX_ANDROID)).toBeNull()
    expect(extensionBrowser({ ...CHROME, userAgentData: { ...CHROME.userAgentData, mobile: true } })).toBeNull()
  })
})

describe("extensionLink", () => {
  it("links Firefox to the signed .xpi its updates.json names", async () => {
    const fetch = vi.fn(async () => updatesJson("https://example.github.io/qr/extension/qr-1.0.0.xpi"))
    expect(await extensionLink({ nav: FIREFOX, firefoxExtensionId: GECKO_ID, fetch })).toEqual({
      href: "https://example.github.io/qr/extension/qr-1.0.0.xpi",
      label: "Instalar la extensión para Firefox",
      external: false,
    })
    expect(fetch).toHaveBeenCalledWith("extension/updates.json")
  })

  it("shows nothing in Firefox when the release has no signed .xpi", async () => {
    const firefoxExtensionId = GECKO_ID
    expect(await extensionLink({ nav: FIREFOX, firefoxExtensionId, fetch: async () => ({ ok: false }) })).toBeNull()
    expect(await extensionLink({ nav: FIREFOX, firefoxExtensionId, fetch: async () => { throw new TypeError("offline") } })).toBeNull()
  })

  it("shows nothing in Firefox without the add-on id, or with another one", async () => {
    const fetch = vi.fn(async () => updatesJson("https://example.github.io/qr/extension/qr-1.0.0.xpi"))
    expect(await extensionLink({ nav: FIREFOX, firefoxExtensionId: "", fetch })).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
    expect(await extensionLink({ nav: FIREFOX, firefoxExtensionId: "other@example.com", fetch })).toBeNull()
  })

  it("links Chromium browsers to the Web Store, or to the install notes until it's there", async () => {
    expect((await extensionLink({ nav: CHROME, chromeWebStoreId: "abc" })).href).toBe(
      "https://chromewebstore.google.com/detail/abc",
    )
    expect((await extensionLink({ nav: CHROME, chromeWebStoreId: "" })).href).toMatch(/^https:\/\/github\.com\/jgermade\/qr#/)
  })

  it("shows nothing in other browsers", async () => {
    expect(await extensionLink({ nav: SAFARI })).toBeNull()
  })
})
