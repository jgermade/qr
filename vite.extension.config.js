import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { defineConfig } from "vite"
import { extensionManifest } from "./extension/manifest.js"

const { version } = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"))

// where the web app lives: the popup links to it and Firefox looks for updates
// there. The build workflow passes it in
const siteUrl = process.env.SITE_URL || "https://jgermade.github.io/qr/"

const TARGETS = ["chrome", "firefox"]

// `vite build -c vite.extension.config.js --mode firefox` builds
// dist-extension/firefox; the mode is the browser
export default defineConfig(({ mode }) => {
  const target = TARGETS.includes(mode) ? mode : "chrome"

  return {
    root: fileURLToPath(new URL("./extension", import.meta.url)),
    base: "./",
    define: {
      __SITE_URL__: JSON.stringify(siteUrl),
    },
    plugins: [
      {
        name: "qr:extension-manifest",
        generateBundle() {
          this.emitFile({
            type: "asset",
            fileName: "manifest.json",
            source: JSON.stringify(extensionManifest({ target, version, siteUrl }), null, 2),
          })
        },
      },
    ],
    build: {
      outDir: fileURLToPath(new URL(`./dist-extension/${target}`, import.meta.url)),
      emptyOutDir: true,
      // readable code: AMO asks for the source of minified submissions, and
      // an extension doesn't gain much from a smaller download
      minify: false,
      // extension pages load modules from their own origin, no preload polyfill needed
      modulePreload: { polyfill: false },
      rollupOptions: {
        input: {
          popup: fileURLToPath(new URL("./extension/popup.html", import.meta.url)),
          // a classic script (Firefox) or service worker (Chrome): it imports
          // nothing, so it builds to a single self-contained file
          background: fileURLToPath(new URL("./extension/background.js", import.meta.url)),
        },
        output: {
          entryFileNames: chunk => (chunk.name === "background" ? "background.js" : "assets/[name]-[hash].js"),
        },
      },
    },
  }
})
