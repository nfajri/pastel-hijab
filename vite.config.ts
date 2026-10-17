import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Prototipe dibuka sebagai file statis (file://). Chrome memblokir <script type="module" crossorigin>
// dan CSS crossorigin dari file://, jadi build dibuat IIFE (script klasik) tanpa atribut crossorigin.
function fileProtocolFriendly(): Plugin {
  return {
    name: 'file-protocol-friendly',
    apply: 'build',
    enforce: 'post',
    transformIndexHtml(html) {
      return html
        .replace(/<script type="module" crossorigin /g, '<script defer ')
        .replace(/ crossorigin(?==|\s|>)/g, '')
    },
  }
}

// `npm run build` memakai `--base ./`.
export default defineConfig({
  plugins: [react(), tailwindcss(), fileProtocolFriendly()],
  build: {
    modulePreload: false,
    rollupOptions: { output: { format: 'iife', inlineDynamicImports: true } },
  },
})
