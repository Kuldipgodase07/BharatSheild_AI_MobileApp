import React, { useState, useEffect, useRef } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// ─── iOS Status Bar Clock ───────────────────────────────────────────────────
function IOSClock() {
  const [time, setTime] = useState('')
  useEffect(() => {
    const update = () => {
      const now = new Date()
      setTime(now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }))
    }
    update()
    const id = setInterval(update, 20000)
    return () => clearInterval(id)
  }, [])

  return <span className="iphone-status-time">{time}</span>
}

// ─── iOS Status Icons (Cellular, Wi-Fi, Battery) ────────────────────────────
function IOSStatusIcons() {
  return (
    <div className="iphone-status-icons">
      {/* iOS Cellular 4-bar staircase */}
      <svg width="17" height="12" viewBox="0 0 17 12" fill="none">
        <rect x="0.5" y="8.5" width="2.8" height="3.5" rx="0.7" fill="#F6ECE0"/>
        <rect x="4.8" y="6" width="2.8" height="6" rx="0.7" fill="#F6ECE0"/>
        <rect x="9.1" y="3.5" width="2.8" height="8.5" rx="0.7" fill="#F6ECE0"/>
        <rect x="13.4" y="0.5" width="2.8" height="11.5" rx="0.7" fill="#F6ECE0"/>
      </svg>

      {/* iOS Wi-Fi */}
      <svg width="15" height="12" viewBox="0 0 16 12" fill="none" stroke="#F6ECE0" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 3.5C5 0 11 0 15 3.5"/>
        <path d="M3.8 6.8C6.6 4.3 9.4 4.3 12.2 6.8"/>
        <circle cx="8" cy="10.2" r="1.1" fill="#F6ECE0" stroke="none"/>
      </svg>

      {/* iOS Battery */}
      <svg width="25" height="12" viewBox="0 0 25 12" fill="none">
        <rect x="0.5" y="0.5" width="21" height="11" rx="3.2" stroke="#F6ECE0" strokeWidth="1" opacity="0.9"/>
        <path d="M22.5 4C23.3 4.4 23.8 4.9 23.8 6C23.8 7.1 23.3 7.6 22.5 8" stroke="#F6ECE0" strokeWidth="1" strokeLinecap="round" opacity="0.5"/>
        <rect x="2" y="2" width="14" height="8" rx="2" fill="#57C48A"/>
      </svg>
    </div>
  )
}

// ─── iPhone Device Frame Component ──────────────────────────────────────────
function IPhoneFrame({ children }: { children: React.ReactNode }) {
  const [scale, setScale] = useState(1)
  const viewportRef = useRef<HTMLDivElement>(null)

  // Auto-scale to ensure the entire phone fits in any window height
  useEffect(() => {
    const handleResize = () => {
      const availH = window.innerHeight - 36
      const targetH = 854
      if (window.innerWidth > 500 && availH < targetH) {
        setScale(Math.max(0.6, availH / targetH))
      } else {
        setScale(1)
      }
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Mobile drag-to-scroll support for desktop testing
  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return

    let isDown = false
    let startY = 0
    let startScrollTop = 0
    let scrollTarget: HTMLElement | null = null

    const findScrollable = (el: HTMLElement | null): HTMLElement | null => {
      while (el && el !== viewport) {
        const style = window.getComputedStyle(el)
        if ((style.overflowY === 'auto' || style.overflowY === 'scroll') && el.scrollHeight > el.clientHeight) {
          return el
        }
        el = el.parentElement
      }
      return null
    }

    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (['INPUT', 'TEXTAREA', 'BUTTON', 'A'].includes(target.tagName) || target.closest('button, [role="button"], input, a')) {
        return
      }
      const scrollable = findScrollable(target)
      if (!scrollable) return
      isDown = true
      scrollTarget = scrollable
      startY = e.pageY
      startScrollTop = scrollable.scrollTop
    }

    const onMouseMove = (e: MouseEvent) => {
      if (!isDown || !scrollTarget) return
      const deltaY = e.pageY - startY
      scrollTarget.scrollTop = startScrollTop - deltaY
    }

    const onMouseUp = () => {
      isDown = false
      scrollTarget = null
    }

    viewport.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      viewport.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  return (
    <div className="iphone-browser-bg">
      <div className="iphone-device-scaler" style={{ transform: scale < 1 ? `scale(${scale})` : undefined }}>
        <div className="iphone-phone-frame">
          {/* Hardware Buttons */}
          <div className="iphone-btn-power" title="Side Button" />
          <div className="iphone-btn-action" title="Action Button" />
          <div className="iphone-btn-volup" title="Volume Up" />
          <div className="iphone-btn-voldown" title="Volume Down" />

          {/* Super Retina XDR OLED Screen */}
          <div className="iphone-screen">
            {/* Dynamic Island */}
            <div className="iphone-dynamic-island" />

            {/* iOS Status Bar */}
            <div className="iphone-status-bar">
              <IOSClock />
              <IOSStatusIcons />
            </div>

            {/* iOS Home Indicator Bar */}
            <div className="iphone-home-bar" />

            {/* Mobile App Viewport */}
            <div ref={viewportRef} className="iphone-app-viewport">
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

document.title = 'BharatSheild AI'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <IPhoneFrame>
      <App />
    </IPhoneFrame>
  </React.StrictMode>,
)
