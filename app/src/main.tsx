import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/anton' // display (poster)
import '@fontsource-variable/inter' // UI / body
import App from './App'
import './styles/global.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Offline for car rides: register the service worker in production builds.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      /* offline support is progressive — the app works without it */
    })
  })
}
