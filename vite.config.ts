import { defineConfig, Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'

function dataSourceStaticPlugin(): Plugin {
  return {
    name: 'data-source-static-plugin',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url && req.url.startsWith('/data-source/')) {
          const filePath = path.join(process.cwd(), req.url)
          if (fs.existsSync(filePath)) {
            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            fs.createReadStream(filePath).pipe(res)
            return
          }
        }
        next()
      })
    },
    closeBundle() {
      const srcDir = path.join(process.cwd(), 'data-source')
      const outDir = path.join(process.cwd(), 'dist', 'data-source')
      if (fs.existsSync(srcDir)) {
        if (!fs.existsSync(outDir)) {
          fs.mkdirSync(outDir, { recursive: true })
        }
        const files = fs.readdirSync(srcDir)
        for (const file of files) {
          fs.copyFileSync(path.join(srcDir, file), path.join(outDir, file))
        }
      }
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), dataSourceStaticPlugin()],
})
