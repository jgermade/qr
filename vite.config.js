import { readFileSync } from "node:fs"
import { defineConfig } from "vite"
import { VitePWA } from "vite-plugin-pwa"
import { jq79 } from "jq79/vite"

const { version } = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"))

// GitHub Pages serves a project site under /<repo>/: the build workflow passes
// it in, locally it's the root
const base = process.env.BASE_PATH || "/"

// jq79/vite keeps each component across HMR updates in `import.meta.hot.data`,
// which Vitest's `import.meta.hot` stub doesn't have. Nothing hot-reloads in a
// test run, so the component modules drop their HMR branch there
const withoutHmrInTests = {
  name: "qr:without-hmr-in-tests",
  apply: () => Boolean(process.env.VITEST),
  transform(code, id) {
    if (id.endsWith("?jq79")) return code.replaceAll("import.meta.hot", "undefined")
  },
}

export default defineConfig({
  base,
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  plugins: [
    jq79(),
    withoutHmrInTests,
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "apple-touch-icon.png"],
      manifest: {
        id: base,
        name: "QR · Lector y generador",
        short_name: "QR",
        description: "Lee y genera códigos QR desde el navegador, también sin conexión.",
        lang: "es",
        display: "standalone",
        theme_color: "#f4f5f7",
        background_color: "#f4f5f7",
        categories: ["utilities", "productivity"],
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
        shortcuts: [
          { name: "Leer un QR", short_name: "Leer", url: "./#leer" },
          { name: "Generar un QR", short_name: "Generar", url: "./#generar" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,webmanifest}"],
      },
    }),
  ],
})
