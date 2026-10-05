import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { ensureDirectoryReady, handlePmApi, startMorningSync } from './pmApi.mjs'
import { loadDotEnv } from './directoryStore.mjs'

loadDotEnv()

const port = Number(process.env.PORT || 8080)
const dist = join(process.cwd(), 'dist')
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
}

await ensureDirectoryReady()
startMorningSync()

createServer(async (req, res) => {
  try {
    if (await handlePmApi(req, res)) return
    const url = new URL(req.url || '/', 'http://localhost')
    const requested = normalize(url.pathname).replace(/^(\.\.[/\\])+/, '')
    const relative = requested === '/' || requested === '\\' ? '/index.html' : requested
    let filePath = join(dist, relative)
    if (!filePath.startsWith(dist)) {
      res.statusCode = 403
      res.end('Forbidden')
      return
    }
    try {
      const body = await readFile(filePath)
      res.setHeader('Content-Type', types[extname(filePath)] || 'application/octet-stream')
      res.end(body)
    } catch {
      const index = await readFile(join(dist, 'index.html'))
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      res.end(index)
    }
  } catch (error) {
    res.statusCode = 500
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: error?.message || 'Server error' }))
  }
}).listen(port, '0.0.0.0', () => {
  console.info(`Project Management Tracker listening on ${port}`)
})
