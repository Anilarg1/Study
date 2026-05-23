import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { bootSettings } from './store/useSettingsStore'

// Apply stored theme/density/contrast before first paint (avoids flash)
bootSettings()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
