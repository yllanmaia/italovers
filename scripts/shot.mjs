#!/usr/bin/env node
/**
 * Screenshot com viewport de celular de verdade, via CDP.
 *
 * O --window-size do Chrome headless tem largura minima no Windows, entao ele
 * nao consegue renderizar a 390px. Emulation.setDeviceMetricsOverride consegue.
 * Tambem mede overflow horizontal, que e o defeito que essa largura revela.
 *
 *   node scripts/shot.mjs <url> <arquivo.png> [largura] [altura]
 */
import { spawn } from 'node:child_process'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

const CHROME = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
const [url, outPath, w = '390', h = '844'] = process.argv.slice(2)
const width = Number(w)
const height = Number(h)
const PORT = 9333

if (!url || !outPath) {
  console.error('uso: node scripts/shot.mjs <url> <saida.png> [largura] [altura]')
  process.exit(1)
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    `--remote-debugging-port=${PORT}`,
    '--user-data-dir=' + process.env.TEMP + '\\italovers-shot-profile',
    'about:blank',
  ],
  { stdio: 'ignore' }
)

let ws
try {
  // Espera o endpoint do DevTools subir
  let target = null
  for (let i = 0; i < 40 && !target; i++) {
    await sleep(250)
    try {
      const list = await fetch(`http://127.0.0.1:${PORT}/json/list`).then((r) => r.json())
      target = list.find((t) => t.type === 'page')
    } catch {
      /* ainda subindo */
    }
  }
  if (!target) throw new Error('Chrome nao abriu o endpoint de debug')

  ws = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((res, rej) => {
    ws.onopen = res
    ws.onerror = rej
  })

  let id = 0
  const pending = new Map()
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data)
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id)
      pending.delete(msg.id)
      msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result)
    }
  }
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const myId = ++id
      pending.set(myId, { resolve, reject })
      ws.send(JSON.stringify({ id: myId, method, params }))
    })

  await send('Page.enable')
  await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 2,
    mobile: true,
  })
  await send('Emulation.setTouchEmulationEnabled', { enabled: true })

  // GPS simulado: --gps=lat,lng
  const gpsArg = process.argv.find((a) => a.startsWith('--gps='))
  if (gpsArg) {
    const [latitude, longitude] = gpsArg.slice(6).split(',').map(Number)
    await send('Browser.grantPermissions', { permissions: ['geolocation'] })
    await send('Emulation.setGeolocationOverride', {
      latitude,
      longitude,
      accuracy: 12,
    })
    console.log(`  GPS simulado em ${latitude}, ${longitude}`)
  }

  // Page.navigate devolve errorText quando o servidor nao responde. Sem essa
  // checagem o script salva a tela de erro do Chrome como se fosse o app —
  // ja aconteceu de sobrescrever print do README com "ERR_CONNECTION_REFUSED".
  const nav = await send('Page.navigate', { url })
  if (nav.errorText) {
    throw new Error(`nao carregou ${url}: ${nav.errorText}. O dev server esta rodando?`)
  }
  await sleep(3500)

  // --click=<seletor CSS>: pra fotografar estado que so existe depois de tocar
  // em algo (o popup do hotel, por exemplo)
  const clickArg = process.argv.find((a) => a.startsWith('--click='))
  if (clickArg) {
    const seletor = clickArg.slice(8)
    const r = await send('Runtime.evaluate', {
      expression: `(() => {
        const el = document.querySelector(${JSON.stringify(seletor)})
        if (!el) return 'nao achou: ' + ${JSON.stringify(seletor)}
        el.click()
        return 'clicou'
      })()`,
      returnByValue: true,
    })
    console.log(`  ${r.result.value}`)
    await sleep(800)
  }

  // --digitar=<seletor>::<texto>: preenche um campo e dispara o evento que o
  // React escuta. `el.value = x` sozinho nao atualiza o estado do React.
  const digitarArg = process.argv.find((a) => a.startsWith('--digitar='))
  if (digitarArg) {
    const [seletor, texto] = digitarArg.slice(10).split('::')
    const r = await send('Runtime.evaluate', {
      expression: `(() => {
        const el = document.querySelector(${JSON.stringify(seletor)})
        if (!el) return 'nao achou: ' + ${JSON.stringify(seletor)}
        const setter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype, 'value'
        ).set
        setter.call(el, ${JSON.stringify(texto)})
        el.dispatchEvent(new Event('input', { bubbles: true }))
        return 'digitou'
      })()`,
      returnByValue: true,
    })
    console.log(`  ${r.result.value}`)
    await sleep(700)
  }

  /**
   * --scroll=<px>: pra fotografar secao que fica abaixo da dobra.
   *
   * Quem rola nao e mais a pagina: o app virou uma coluna de altura fixa com um
   * <main> proprio pra rolagem, pra aba Viagem conseguir dar ao mapa a sobra
   * exata da tela. Entao procura o container que de fato rola e desiste do
   * document so se nao achar nenhum.
   */
  const scrollArg = process.argv.find((a) => a.startsWith('--scroll='))
  if (scrollArg) {
    const y = Number(scrollArg.slice(9))
    const r = await send('Runtime.evaluate', {
      expression: `(() => {
        const alvo = [...document.querySelectorAll('main, [class*=overflow-y-auto]')]
          .find((el) => el.scrollHeight > el.clientHeight + 4)
          ?? document.scrollingElement ?? document.documentElement
        alvo.scrollTo(0, ${y})
        return alvo.tagName + ':' + Math.round(alvo.scrollTop)
      })()`,
      returnByValue: true,
    })
    console.log(`  rolou pra ${y}px (${r.result?.result?.value ?? '?'})`)
    await sleep(600)
  }

  // Mede overflow horizontal: a checagem que so aparece em tela estreita
  const medida = await send('Runtime.evaluate', {
    expression: `JSON.stringify({
      scrollW: document.documentElement.scrollWidth,
      clientW: document.documentElement.clientWidth,
      culpados: [...document.querySelectorAll('*')]
        .filter(el => el.getBoundingClientRect().right > document.documentElement.clientWidth + 1)
        .slice(0, 5)
        .map(el => el.tagName + '.' + (el.className.baseVal ?? el.className ?? '').toString().slice(0, 60))
    })`,
    returnByValue: true,
  })
  const info = JSON.parse(medida.result.value)
  const overflow = info.scrollW - info.clientW
  console.log(
    `  viewport ${width}x${height} · scrollWidth ${info.scrollW} · clientWidth ${info.clientW}` +
      (overflow > 0 ? `  <-- OVERFLOW de ${overflow}px` : '  sem overflow horizontal')
  )
  if (overflow > 0 && info.culpados.length) {
    console.log('  culpados:')
    info.culpados.forEach((c) => console.log('    ' + c))
  }

  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  mkdirSync(dirname(outPath), { recursive: true })
  writeFileSync(outPath, Buffer.from(shot.data, 'base64'))
  console.log(`  gravado ${outPath}`)
} finally {
  ws?.close()
  chrome.kill()
}
