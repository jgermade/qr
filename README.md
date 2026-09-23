# QR

PWA para **leer y generar códigos QR** desde el navegador, también sin conexión.
Hecha con [Vite](https://vite.dev) y [jq79](https://github.com/jgermade/jq79).

**https://jgermade.github.io/qr/**

## Qué hace

**Generar**

- Texto o enlaces, y redes WiFi (`WIFI:T:WPA;S:…;P:…;;`, con el escapado que pide el formato).
- Nivel de corrección de errores (L/M/Q/H) y colores.
- Descarga en PNG o SVG, copiar la imagen al portapapeles y compartir (donde el navegador lo permite).

**Leer**

- Con la cámara, abriendo una imagen, arrastrándola o pegándola (Ctrl+V).
- Reconoce enlaces, WiFi, email, teléfono, SMS, ubicaciones y contactos, y ofrece la acción que toca
  (abrir, llamar, copiar la contraseña…). Solo se enlazan esquemas seguros (`http`, `https`, `mailto`,
  `tel`, `sms`): un QR con `javascript:…` se muestra como texto.
- Historial de las últimas lecturas, guardado en el dispositivo.
- Usa el `BarcodeDetector` nativo cuando el navegador lo tiene y [jsQR](https://github.com/cozmo/jsQR)
  en el resto; jsQR va en un chunk aparte y solo se descarga si hace falta.

**PWA**

- Instalable, con service worker ([vite-plugin-pwa](https://vite-pwa-org.netlify.app/)) que precachea
  toda la app: funciona sin conexión y se actualiza sola.
- Accesos directos a «Leer» y «Generar» desde el icono.

## Desarrollo

```sh
npm install
npm run dev       # servidor de desarrollo con HMR
npm test          # tests (Vitest)
npm run build     # build de producción en dist/
npm run preview   # sirve dist/
```

La cámara necesita un contexto seguro: `localhost` vale, pero para probar desde el móvil hace falta HTTPS.

## Estructura

```
index.html                 entrada de Vite
src/main.js                monta App.html
src/App.html               cabecera y pestañas
src/components/
  Generator.html           generador
  Scanner.html             lector (cámara, imagen, historial)
  ScanResult.html          resultado de una lectura
src/lib/
  qr.js                    matriz QR (uqr), SVG y PNG
  scan.js                  decodificación (BarcodeDetector / jsQR) y cámara
  payload.js               formatos: WiFi, enlaces, email, teléfono…
  history.js               historial en localStorage
tests/                     tests de la lógica y de los componentes
public/                    iconos y favicon
```

Los componentes son ficheros `.html` de jq79 (`<script :setup>`, plantilla y `<style scoped>`), que el
plugin `jq79/vite` importa como módulos.

## Despliegue

Dos workflows de GitHub Actions:

- **`build.yml`**: instala, ejecuta los tests y hace la build. Se lanza en cada push a `main` y en cada
  pull request, y `release.yml` lo reutiliza (`workflow_call`).
- **`release.yml`**: se lanza a mano desde *Actions → Release → Run workflow* eligiendo `patch`,
  `minor` o `major`. Ejecuta `build.yml` con la nueva versión, hace commit y tag de la versión
  (`chore(release): x.y.z`), crea la release de GitHub con la build en un zip y despliega esa misma
  build en GitHub Pages.

Configuración necesaria en el repositorio:

1. *Settings → Pages → Build and deployment → Source*: **GitHub Actions**.
2. Si `main` está protegida, permitir que `github-actions[bot]` haga push (el commit de la versión).
3. La app se construye para servirse en `/<repo>/`. Con un dominio propio, crea la variable de
   repositorio `BASE_PATH` con valor `/` (*Settings → Secrets and variables → Actions → Variables*).
