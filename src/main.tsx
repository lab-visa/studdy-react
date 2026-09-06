import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Side-effect import — must run before any component creates a
// ScrollTrigger instance. See src/utils/gsapSetup.ts for why.
import './utils/gsapSetup'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
