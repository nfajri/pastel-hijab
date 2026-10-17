import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import { StoreProvider, type Opsi } from './lib/store'
import '../index.css'

// prototipe.html = Opsi A, opsi-b.html = Opsi B (bundle sama, beda flag).
const opsi: Opsi = (window as unknown as { __OPSI__?: Opsi }).__OPSI__ === 'B' ? 'B' : 'A'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <StoreProvider opsi={opsi}>
        <App />
      </StoreProvider>
    </HashRouter>
  </StrictMode>,
)
