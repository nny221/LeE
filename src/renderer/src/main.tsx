import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './styles.css'

const view = new URLSearchParams(window.location.search).get('view') ?? 'pet'
document.body.dataset.window = view

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App view={view} />
  </StrictMode>
)
