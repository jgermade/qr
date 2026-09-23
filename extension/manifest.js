// manifest.json of the extension. Chrome and Firefox take the same MV3
// manifest except for the background (Chrome runs a service worker, Firefox an
// event page) and the Gecko settings Chrome rejects as unknown keys
export const GECKO_ID = "qr@germade.dev"

export function extensionManifest({ target, version, siteUrl }) {
  const icons = { 16: "icons/icon-16.png", 32: "icons/icon-32.png", 48: "icons/icon-48.png", 128: "icons/icon-128.png" }

  const manifest = {
    manifest_version: 3,
    name: "QR · Lector y generador",
    short_name: "QR",
    version,
    description: "Genera el código QR de la página que estás viendo y lee los códigos QR que aparecen en pantalla.",
    homepage_url: siteUrl,
    icons,
    action: { default_title: "Código QR de esta página", default_popup: "popup.html", default_icon: icons },
    // no host permissions: activeTab grants the current tab (its URL and a
    // screenshot) only when the user clicks the button or a menu item
    permissions: ["activeTab", "contextMenus", "storage"],
    background: target === "firefox" ? { scripts: ["background.js"] } : { service_worker: "background.js" },
  }

  if (target === "firefox") {
    manifest.browser_specific_settings = {
      gecko: {
        id: GECKO_ID,
        strict_min_version: "140.0",
        // self-hosted: the release deploys the signed .xpi and this file to Pages
        update_url: new URL("extension/updates.json", siteUrl).href,
        data_collection_permissions: { required: ["none"] },
      },
    }
  }

  return manifest
}
