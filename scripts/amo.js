#!/usr/bin/env node
// The Firefox extension's versions on addons.mozilla.org (AMO), for the release
// workflows. AMO may approve an unlisted version in a minute or send it to a
// human review that takes days, so the workflows don't wait on web-ext: they ask
// here and download the signed .xpi once it's there.
//
//   node scripts/amo.js status <version>
//     prints the version's file status: "none" if it was never uploaded,
//     "public" once signed, "unreviewed" while waiting, "disabled" if rejected
//
//   node scripts/amo.js download <version> <file.xpi> [wait seconds]
//     saves the signed .xpi if the version is approved, waiting up to the given
//     seconds for it. Not approved yet is not an error: <file.xpi> is just not
//     written. Fails if the version is missing or was rejected
//
// Needs AMO_JWT_ISSUER, AMO_JWT_SECRET and FIREFOX_EXTENSION_ID in the environment

import { createHmac, randomUUID } from "node:crypto"
import { writeFile } from "node:fs/promises"

const API = "https://addons.mozilla.org/api/v5/"
const POLL_INTERVAL = 15_000

const { AMO_JWT_ISSUER, AMO_JWT_SECRET, FIREFOX_EXTENSION_ID } = process.env

const base64url = data => Buffer.from(data).toString("base64url")

// https://mozilla.github.io/addons-server/topics/api/auth.html
function authHeader() {
  const iat = Math.floor(Date.now() / 1000)
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }))
  const payload = base64url(JSON.stringify({ iss: AMO_JWT_ISSUER, jti: randomUUID(), iat, exp: iat + 60 }))
  const signature = createHmac("sha256", AMO_JWT_SECRET).update(`${header}.${payload}`).digest("base64url")
  return `JWT ${header}.${payload}.${signature}`
}

const get = url => fetch(url, { headers: { Authorization: authHeader(), Accept: "application/json" } })

const DEVELOPER_HUB = "https://addons.mozilla.org/developers/addons"

// the version as AMO has it, or null if it was never uploaded (or the add-on doesn't exist yet)
async function findVersion(version) {
  let url = new URL(`addons/addon/${encodeURIComponent(FIREFOX_EXTENSION_ID)}/versions/?filter=all_with_unlisted&page_size=50`, API)
  while (url) {
    const response = await get(url)
    if (response.status === 404) return null
    if (!response.ok) throw new Error(`AMO: ${response.status} ${await response.text()}`)
    const { results, next } = await response.json()
    const found = results.find(result => result.version === version)
    if (found) return found
    url = next && new URL(next)
  }
  return null
}

const statusOf = found => (found ? found.file?.status ?? "unknown" : "none")

async function download(version, dest, waitSeconds) {
  const deadline = Date.now() + waitSeconds * 1000
  for (;;) {
    const found = await findVersion(version)
    const status = statusOf(found)
    if (status === "none") throw new Error(`Version ${version} is not on AMO`)
    if (status === "disabled") throw new Error(`AMO rejected version ${version}: see ${DEVELOPER_HUB}`)
    if (status === "public") {
      const response = await get(found.file.url)
      if (!response.ok) throw new Error(`Downloading ${found.file.url}: ${response.status}`)
      await writeFile(dest, Buffer.from(await response.arrayBuffer()))
      console.log(`Version ${version} is signed: saved ${dest}`)
      return
    }
    if (Date.now() >= deadline) {
      console.log(`Version ${version} is not approved yet (${status}): see ${DEVELOPER_HUB}`)
      return
    }
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL))
  }
}

const [command, version, dest, waitSeconds = "0"] = process.argv.slice(2)

if (!AMO_JWT_ISSUER || !AMO_JWT_SECRET || !FIREFOX_EXTENSION_ID) {
  console.error("AMO_JWT_ISSUER, AMO_JWT_SECRET and FIREFOX_EXTENSION_ID are required")
  process.exit(1)
}

if (command === "status" && version) {
  console.log(statusOf(await findVersion(version)))
} else if (command === "download" && version && dest) {
  await download(version, dest, Number(waitSeconds))
} else {
  console.error("Usage: amo.js status <version> | amo.js download <version> <file.xpi> [wait seconds]")
  process.exit(1)
}
