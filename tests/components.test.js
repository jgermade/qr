// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest"
import { Component79 } from "jq79"
import Generator from "../src/components/Generator.html"
import ScanResult from "../src/components/ScanResult.html"
import { qrMatrix, qrPath } from "../src/lib/qr.js"
import { wifiPayload } from "../src/lib/payload.js"

const mounted = []

const mount = async (definition, data) => {
  const host = document.createElement("div")
  document.body.append(host)
  const component = new Component79(definition).mount(host, data)
  mounted.push(component)
  // setup scripts await their imports before the first render
  await vi.waitFor(() => expect(host.children.length).toBeGreaterThan(0))
  return { host, component }
}

const type = (element, value) => {
  element.value = value
  element.dispatchEvent(new Event("input", { bubbles: true }))
}

afterEach(() => {
  mounted.splice(0).forEach(component => component.destroy())
  document.body.innerHTML = ""
})

describe("Generator", () => {
  it("draws the code for the text as it is typed", async () => {
    const { host } = await mount(Generator)
    expect(host.querySelector("svg.qr")).toBeNull()
    expect(host.querySelector(".btn.primary").disabled).toBe(true)

    type(host.querySelector("textarea"), "hola")

    await vi.waitFor(() => expect(host.querySelector("svg.qr path")).not.toBeNull())
    expect(host.querySelector("svg.qr path").getAttribute("d")).toBe(qrPath(qrMatrix("hola", { ecc: "M" })))
    expect(host.querySelector(".btn.primary").disabled).toBe(false)
    expect(host.querySelector(".meta").textContent).toContain("21×21")
  })

  it("encodes a WiFi network", async () => {
    const { host } = await mount(Generator)
    ;[...host.querySelectorAll(".segmented button")].find(button => button.textContent === "WiFi").click()

    await vi.waitFor(() => expect(host.querySelector("input[name=ssid]")).not.toBeNull())
    type(host.querySelector("input[name=ssid]"), "casa")
    type(host.querySelector("input[name=password]"), "1234")

    const expected = qrPath(qrMatrix(wifiPayload({ ssid: "casa", password: "1234" }), { ecc: "M" }))
    await vi.waitFor(() => expect(host.querySelector("svg.qr path")?.getAttribute("d")).toBe(expected))
  })

  it("explains when the content doesn't fit", async () => {
    const { host } = await mount(Generator)
    type(host.querySelector("textarea"), "x".repeat(5000))

    await vi.waitFor(() => expect(host.querySelector(".message.error")).not.toBeNull())
    expect(host.querySelector("svg.qr")).toBeNull()
  })
})

describe("ScanResult", () => {
  it("offers to open links", async () => {
    const { host } = await mount(ScanResult, { payload: "https://example.com" })
    const link = host.querySelector("a.btn")
    expect(host.querySelector(".badge").textContent).toBe("Enlace")
    expect(link.getAttribute("href")).toBe("https://example.com/")
    expect(link.getAttribute("target")).toBe("_blank")
  })

  it("shows WiFi details", async () => {
    const { host } = await mount(ScanResult, { payload: "WIFI:T:WPA;S:casa;P:1234;;" })
    expect(host.querySelector(".badge").textContent).toBe("Red WiFi")
    expect(host.querySelector(".details").textContent).toContain("casa")
    expect(host.querySelector(".details").textContent).toContain("1234")
  })

  it("never links a script", async () => {
    const { host } = await mount(ScanResult, { payload: "javascript:alert(1)" })
    expect(host.querySelector("a")).toBeNull()
    expect(host.querySelector(".content").textContent).toBe("javascript:alert(1)")
  })
})
