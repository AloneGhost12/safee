// import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles/tailwind.css'

createRoot(document.getElementById('root')!).render(
  // NOTE: StrictMode is temporarily disabled to prevent double-mounting issues 
  // that can cause reload loops during development. Re-enable for production testing.
  // <React.StrictMode>
    <App />
  // </React.StrictMode>
)
