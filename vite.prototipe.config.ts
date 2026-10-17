import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Prototipe desain final (T-0128/T-0130/T-0133). Build: npx vite build --config vite.prototipe.config.ts --base ./ --outDir dist-prototipe
// Sama seperti vite.config.ts: IIFE tanpa crossorigin supaya bisa dibuka sebagai file statis.
// Hasil: prototipe.html (Opsi B final; Opsi A sudah dilepas).
function fileProtocolFriendly(): Plugin {
  return {
    name: 'file-protocol-friendly',
    apply: 'build',
    enforce: 'post',
    transformIndexHtml(html) {
      return html.replace(/<script type="module" crossorigin /g, '<script defer ').replace(/ crossorigin(?==|\s|>)/g, '')
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
