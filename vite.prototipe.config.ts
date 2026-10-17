import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Prototipe desain T-0128. Build: npx vite build --config vite.prototipe.config.ts --base ./ --outDir dist-prototipe
// Sama seperti vite.config.ts: IIFE tanpa crossorigin supaya bisa dibuka sebagai file statis.
// Hasil: prototipe.html (Opsi A) + opsi-b.html (Opsi B, bundle sama dengan flag window.__OPSI__).
function fileProtocolFriendly(): Plugin {
  return {
    name: 'file-protocol-friendly',
    apply: 'build',
    enforce: 'post',
    transformIndexHtml(html) {
      return html.replace(/<script type="module" crossorigin /g, '<script defer ').replace(/ crossorigin(?==|\s|>)/g, '')
    },
    generateBundle(_, bundle) {
      const a = bundle['prototipe.html']
      if (a && a.type === 'asset') {
        const html = String(a.source).replace('<div id="root"></div>', '<div id="root"></div>\n    <script>window.__OPSI__ = "B"</script>')
        this.emitFile({ type: 'asset', fileName: 'opsi-b.html', source: html })
      }
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), fileProtocolFriendly()],
  build: {
    modulePreload: false,
    rollupOptions: { input: 'prototipe.html', output: { format: 'iife', inlineDynamicImports: true } },
  },
})
