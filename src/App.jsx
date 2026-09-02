import { useState, useCallback, useEffect, useRef } from 'react'

const API_URL = '/api/access-events'

// ── Appearance Settings (localStorage) ───────────────────────────
const APPEARANCE_KEY = 'hik_appearance_settings'

const DEFAULT_APPEARANCE = {
  theme: 'dark', // 'light' | 'dark' | 'system'
  buttonStyle: 'fill', // 'fill' | 'outline'
  accentColor: '#0D9488', // Hex rang
  bgImage: 'https://images.unsplash.com/photo-1426604966848-d7adac402bff?auto=format&fit=crop&w=1920&q=80', // Default macOS Yosemite Tog'i
}

function loadAppearance() {
  try {
    const raw = localStorage.getItem(APPEARANCE_KEY)
    if (raw) return { ...DEFAULT_APPEARANCE, ...JSON.parse(raw) }
  } catch (_) {}
  return { ...DEFAULT_APPEARANCE }
}

function saveAppearance(app) {
  localStorage.setItem(APPEARANCE_KEY, JSON.stringify(app))
}
const SETTINGS_KEY = 'hik_device_settings'

const DEFAULT_SETTINGS = {
  ip:   '192.168.1.40',
  user: 'admin',
  pass: 'A112233a',
  workStartTime: '09:00',
  workEndTime: '18:00',
  breakStartTime: '13:00',
  breakEndTime: '14:00',
  gracePeriodMinutes: 5,
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch (_) {}
  return { ...DEFAULT_SETTINGS }
}

function saveSettings(s) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s))
}

function getDeviceHeaders() {
  const s = loadSettings()
  return {
    'x-device-ip':   s.ip,
    'x-device-user': s.user,
    'x-device-pass': s.pass,
  }
}

function checkIsLate(isoString) {
  if (!isoString) return { isLate: false, minutesLate: 0 }
  const s = loadSettings()
  if (!s.workStartTime) return { isLate: false, minutesLate: 0 }

  const dt = new Date(isoString)
  // Asia/Tashkent vaqtini olish
  const timeStr = dt.toLocaleTimeString('uz-UZ', {
    timeZone: 'Asia/Tashkent',
    hour: '2-digit', minute: '2-digit', hour12: false
  })

  const [h, m] = timeStr.split(':').map(Number)
  const actualMinutes = h * 60 + m

  const [sh, sm] = s.workStartTime.split(':').map(Number)
  const scheduledMinutes = sh * 60 + sm

  const grace = Number(s.gracePeriodMinutes || 0)
  const diff = actualMinutes - scheduledMinutes

  if (diff > grace) {
    return { isLate: true, minutesLate: diff }
  }
  return { isLate: false, minutesLate: 0 }
}

// ── Helpers ──────────────────────────────────────────────────────────
function formatTime(isoString) {
  if (!isoString) return '—'
  const d = new Date(isoString)
  return d.toLocaleString('uz-UZ', {
    timeZone: 'Asia/Tashkent',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  })
}

function getStatusClass(item) {
  if (item.attendanceStatus === 'checkIn') return 'checkin'
  if (item.attendanceStatus === 'checkOut') return 'checkout'
  if (item.attendanceStatus === 'breakOut') return 'breakout'
  if (item.attendanceStatus === 'breakIn') return 'breakin'
  return 'unknown'
}

function getStatusIcon(item) {
  if (item.attendanceStatus === 'checkIn') return <i className="bi bi-box-arrow-in-right" />
  if (item.attendanceStatus === 'checkOut') return <i className="bi bi-box-arrow-left" />
  if (item.attendanceStatus === 'breakOut') return <i className="bi bi-cup-hot" />
  if (item.attendanceStatus === 'breakIn') return <i className="bi bi-arrow-right-circle" />
  return <i className="bi bi-circle-fill" style={{ fontSize: 8 }} />
}

function getStatusLabel(item) {
  if (item.label) return item.label
  if (item.attendanceStatus === 'checkIn') return 'Kirish'
  if (item.attendanceStatus === 'checkOut') return 'Chiqish'
  if (item.attendanceStatus === 'breakOut') return 'Tushlikka chiqish'
  if (item.attendanceStatus === 'breakIn') return 'Tushlikdan kirish'
  return 'Tashrif'
}

// ── PhotoModal ─────────────────────────────────────────────────────
function PhotoModal({ url, name, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Yopish">
          <i className="bi bi-x-lg" />
        </button>
        <img src={url} alt={name} className="modal-img" />
      </div>
    </div>
  )
}

// ── FaceImageModal ─────────────────────────────────────────────────
function FaceImageModal({ user, onClose }) {
  const [status, setStatus] = useState('loading') // 'loading' | 'ok' | 'error'
  const [imgSrc, setImgSrc] = useState(null)

  useEffect(() => {
    setStatus('loading')
    let url = `/api/face/image/${user.employeeNo}`
    if (user.faceURL) {
      url += `?faceURL=${encodeURIComponent(user.faceURL)}`
    }
    
    let objectUrl = null
    fetch(url, {
      headers: getDeviceHeaders()
    })
      .then(res => {
        if (!res.ok) throw new Error('Rasm mavjud emas')
        return res.blob()
      })
      .then(blob => {
        objectUrl = URL.createObjectURL(blob)
        setImgSrc(objectUrl)
        setStatus('ok')
      })
      .catch(() => setStatus('error'))

    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [user.employeeNo, user.faceURL])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: 400, textAlign: 'center' }}
      >
        <button className="modal-close" onClick={onClose} aria-label="Yopish">
          <i className="bi bi-x-lg" />
        </button>

        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-teal)', marginBottom: 2 }}>
            <i className="bi bi-person-bounding-box" style={{ marginRight: 6 }} />
            {user.name || '(Ism yo\'q)'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>ID: #{user.employeeNo}</div>
        </div>

        {status === 'loading' && (
          <div style={{ padding: '40px 0', color: 'var(--text-secondary)', fontSize: 13 }}>
            <i className="bi bi-arrow-repeat" style={{ animation: 'spin 0.8s linear infinite', display: 'inline-block', fontSize: 22, marginBottom: 8 }} />
            <div>Rasm yuklanmoqda…</div>
          </div>
        )}

        {status === 'error' && (
          <div style={{ padding: '30px 0', color: '#f87171', fontSize: 13 }}>
            <i className="bi bi-person-x" style={{ fontSize: 36, marginBottom: 10, display: 'block', opacity: 0.5 }} />
            Bu foydalanuvchi uchun yuz rasmi topilmadi
          </div>
        )}

        {status === 'ok' && imgSrc && (
          <img
            src={imgSrc}
            alt={user.name}
            style={{
              width: '100%', maxHeight: 380,
              objectFit: 'contain', borderRadius: 10,
              border: '2px solid rgba(255,255,255,0.08)'
            }}
          />
        )}
      </div>
    </div>
  )
}

// ── Sidebar ────────────────────────────────────────────────────────
function Sidebar({ activeTab, setActiveTab }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-logo">
          <i className="bi bi-shield-lock-fill" style={{ fontSize: 16, color: '#fff' }} />
        </div>
        <div>
          <div className="sidebar-brand-text">Hikvision</div>
          <div className="sidebar-brand-sub">ACS Panel</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div
          className={`sidebar-item ${activeTab === 'events' ? 'active' : ''}`}
          onClick={() => setActiveTab('events')}
        >
          <span className="sidebar-icon">
            <i className="bi bi-activity" />
          </span>
          Kirish Hodisalari
        </div>

        <div
          className={`sidebar-item ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          <span className="sidebar-icon">
            <i className="bi bi-people-fill" />
          </span>
          Foydalanuvchilar
        </div>
      </nav>
    </aside>
  )
}

// ── SettingsModal ──────────────────────────────────────────────────
function SettingsModal({ onClose }) {
  const initial = loadSettings()
  const [activeTab, setActiveTab] = useState('device') // 'device' | 'schedule'
  
  // Device
  const [ip,   setIp]   = useState(initial.ip)
  const [user, setUser] = useState(initial.user)
  const [pass, setPass] = useState(initial.pass)
  const [showPass, setShowPass] = useState(false)

  // Schedule
  const [workStartTime, setWorkStartTime] = useState(initial.workStartTime || '09:00')
  const [workEndTime, setWorkEndTime] = useState(initial.workEndTime || '18:00')
  const [breakStartTime, setBreakStartTime] = useState(initial.breakStartTime || '13:00')
  const [breakEndTime, setBreakEndTime] = useState(initial.breakEndTime || '14:00')
  const [gracePeriodMinutes, setGracePeriodMinutes] = useState(initial.gracePeriodMinutes ?? 5)

  const [saved, setSaved] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [testMsg, setTestMsg] = useState('')

  const handleSave = (e) => {
    e.preventDefault()
    saveSettings({
      ip: ip.trim(),
      user: user.trim(),
      pass,
      workStartTime,
      workEndTime,
      breakStartTime,
      breakEndTime,
      gracePeriodMinutes: Number(gracePeriodMinutes),
    })
    setSaved(true)
    setTestResult(null)
    setTimeout(() => { setSaved(false); onClose() }, 800)
  }

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    setTestMsg('')
    try {
      const res = await fetch('/api/device/info', {
        headers: {
          'x-device-ip':   ip.trim(),
          'x-device-user': user.trim(),
          'x-device-pass': pass,
        },
      })
      const data = await res.json()
      if (res.ok && data.success) {
        const parts = [
          data.deviceName && `📷 ${data.deviceName}`,
          data.model      && `Model: ${data.model}`,
          data.serialNumber && `S/N: ${data.serialNumber}`,
        ].filter(Boolean)
        setTestResult('ok')
        setTestMsg(parts.length ? parts.join(' · ') : 'Qurilma bilan ulanish muvaffaqiyatli!')
      } else {
        setTestResult('error')
        setTestMsg(data.error || `Qurilma javobi: ${res.status}`)
      }
    } catch (err) {
      setTestResult('error')
      setTestMsg(`Ulanish xatosi: ${err.message}`)
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="form-modal-card settings-modal-card"
        onClick={e => e.stopPropagation()}
        style={{ width: 460 }}
      >
        <button className="modal-close" onClick={onClose} aria-label="Yopish">
          <i className="bi bi-x-lg" />
        </button>

        <div className="form-modal-title">
          <i className="bi bi-sliders" style={{ color: 'var(--accent-teal)' }} />
          Tizim va Ish Grafigi Sozlamalari
        </div>

        {/* Settings Navigation Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 10 }}>
          <button
            type="button"
            className={`btn ${activeTab === 'device' ? 'btn-teal' : 'btn-ghost'}`}
            onClick={() => setActiveTab('device')}
            style={{ padding: '6px 14px', fontSize: 12 }}
          >
            <i className="bi bi-hdd-network" /> Qurilma Ulanishi
          </button>
          <button
            type="button"
            className={`btn ${activeTab === 'schedule' ? 'btn-teal' : 'btn-ghost'}`}
            onClick={() => setActiveTab('schedule')}
            style={{ padding: '6px 14px', fontSize: 12 }}
          >
            <i className="bi bi-clock-history" /> Ish va Tushlik Grafigi
          </button>
        </div>

        <form onSubmit={handleSave} className="form-modal-body">
          {activeTab === 'device' ? (
            <>
              <div className="settings-subtitle">
                <i className="bi bi-hdd-network" style={{ marginRight: 5, opacity: 0.6 }} />
                Hikvision qurilmasi IP, foydalanuvchi va parolini kiriting.
              </div>

              {/* IP */}
              <div className="form-group">
                <label className="form-label" htmlFor="s-ip">
                  <i className="bi bi-router" style={{ marginRight: 5 }} />
                  Qurilma IP manzili
                </label>
                <input
                  id="s-ip"
                  type="text"
                  className="form-input"
                  placeholder="192.168.1.40"
                  value={ip}
                  onChange={e => setIp(e.target.value)}
                  required
                />
              </div>

              {/* Username */}
              <div className="form-group">
                <label className="form-label" htmlFor="s-user">
                  <i className="bi bi-person-badge" style={{ marginRight: 5 }} />
                  Foydalanuvchi nomi
                </label>
                <input
                  id="s-user"
                  type="text"
                  className="form-input"
                  placeholder="admin"
                  value={user}
                  onChange={e => setUser(e.target.value)}
                  required
                />
              </div>

              {/* Password */}
              <div className="form-group">
                <label className="form-label" htmlFor="s-pass">
                  <i className="bi bi-key" style={{ marginRight: 5 }} />
                  Parol
                </label>
                <div className="settings-pass-wrap">
                  <input
                    id="s-pass"
                    type={showPass ? 'text' : 'password'}
                    className="form-input"
                    placeholder="••••••••"
                    value={pass}
                    onChange={e => setPass(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="settings-pass-toggle"
                    onClick={() => setShowPass(v => !v)}
                    tabIndex={-1}
                    title={showPass ? 'Yashirish' : 'Ko\'rsatish'}
                  >
                    <i className={`bi bi-eye${showPass ? '-slash' : ''}`} />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="settings-subtitle">
                <i className="bi bi-clock-history" style={{ marginRight: 5, opacity: 0.6 }} />
                Ish kuni tartibi, tushlik oralig'i va kechikish qoidalarini belgilang.
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {/* Ish boshlanishi */}
                <div className="form-group">
                  <label className="form-label" htmlFor="s-work-start">
                    <i className="bi bi-box-arrow-in-right" style={{ marginRight: 4, color: 'var(--accent-green)' }} />
                    Ish boshlanishi
                  </label>
                  <input
                    id="s-work-start"
                    type="time"
                    className="form-input"
                    value={workStartTime}
                    onChange={e => setWorkStartTime(e.target.value)}
                    required
                  />
                </div>

                {/* Ish tugashi */}
                <div className="form-group">
                  <label className="form-label" htmlFor="s-work-end">
                    <i className="bi bi-box-arrow-left" style={{ marginRight: 4, color: 'var(--accent-red)' }} />
                    Ish tugashi
                  </label>
                  <input
                    id="s-work-end"
                    type="time"
                    className="form-input"
                    value={workEndTime}
                    onChange={e => setWorkEndTime(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Grace Period / Kechikish daqiqasi */}
              <div className="form-group" style={{ marginTop: 4 }}>
                <label className="form-label" htmlFor="s-grace">
                  <i className="bi bi-exclamation-triangle" style={{ marginRight: 5, color: 'var(--accent-orange)' }} />
                  Kechikish ruxsat daqiqasi (Ruxsat etilgan vaqt)
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    id="s-grace"
                    type="number"
                    min="0"
                    max="60"
                    className="form-input"
                    value={gracePeriodMinutes}
                    onChange={e => setGracePeriodMinutes(e.target.value)}
                    required
                    style={{ width: 100 }}
                  />
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    daqiqa (masalan {workStartTime} dan {gracePeriodMinutes || 0} daqiqa o'tsa kechikish hisoblanadi)
                  </span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 4 }}>
                {/* Tushlik boshlanishi */}
                <div className="form-group">
                  <label className="form-label" htmlFor="s-break-start">
                    <i className="bi bi-cup-hot" style={{ marginRight: 4, color: 'var(--accent-orange)' }} />
                    Tushlik boshlanishi
                  </label>
                  <input
                    id="s-break-start"
                    type="time"
                    className="form-input"
                    value={breakStartTime}
                    onChange={e => setBreakStartTime(e.target.value)}
                    required
                  />
                </div>

                {/* Tushlik tugashi */}
                <div className="form-group">
                  <label className="form-label" htmlFor="s-break-end">
                    <i className="bi bi-arrow-right-circle" style={{ marginRight: 4, color: 'var(--accent-cyan)' }} />
                    Tushlik tugashi
                  </label>
                  <input
                    id="s-break-end"
                    type="time"
                    className="form-input"
                    value={breakEndTime}
                    onChange={e => setBreakEndTime(e.target.value)}
                    required
                  />
                </div>
              </div>
            </>
          )}

          {/* Test result */}
          {testResult && activeTab === 'device' && (
            <div
              className="settings-test-result"
              style={{
                color: testResult === 'ok' ? 'var(--accent-green)' : '#f87171',
                background: testResult === 'ok' ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
                border: `1px solid ${testResult === 'ok' ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
              }}
            >
              <i className={`bi bi-${testResult === 'ok' ? 'check-circle-fill' : 'x-circle-fill'}`} style={{ marginRight: 6 }} />
              {testMsg}
            </div>
          )}

          <div className="settings-actions" style={{ marginTop: 16 }}>
            {activeTab === 'device' && (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={handleTest}
                disabled={testing || !ip.trim() || !user.trim()}
                style={{ flex: 1 }}
              >
                {testing ? (
                  <><i className="bi bi-arrow-repeat" style={{ animation: 'spin 0.8s linear infinite', display: 'inline-block', marginRight: 5 }} />Tekshirilmoqda…</>
                ) : (
                  <><i className="bi bi-wifi" style={{ marginRight: 5 }} />Ulanishni tekshirish</>
                )}
              </button>
            )}
            <button
              type="submit"
              className="btn btn-teal"
              disabled={activeTab === 'device' ? (!ip.trim() || !user.trim() || !pass) : false}
              style={{ flex: 1 }}
            >
              {saved ? (
                <><i className="bi bi-check-lg" style={{ marginRight: 4 }} />Saqlandi!</>
              ) : (
                <><i className="bi bi-floppy" style={{ marginRight: 4 }} />Saqlash</>  
              )}
            </button>
          </div>
        </form>

        {/* Current saved info */}
        <div className="settings-current">
          <i className="bi bi-info-circle" style={{ marginRight: 5, opacity: 0.5 }} />
          Grafik: <strong>{initial.workStartTime} - {initial.workEndTime}</strong> (Kechikish ruxsati: +<strong>{initial.gracePeriodMinutes ?? 5}m</strong>) • Tushlik: <strong>{initial.breakStartTime} - {initial.breakEndTime}</strong>
        </div>
      </div>
    </div>
  )
}

// ── AppearanceModal ────────────────────────────────────────────────
// ── AppearanceModal ────────────────────────────────────────────────
function AppearanceModal({ onClose, appearance, setAppearance }) {
  const [theme, setTheme] = useState(appearance.theme || 'dark')
  const [buttonStyle, setButtonStyle] = useState(appearance.buttonStyle || 'fill')
  const [accentColor, setAccentColor] = useState(appearance.accentColor || '#0D9488')
  const [bgImage, setBgImage] = useState(appearance.bgImage || '')

  const colorOptions = [
    '#0D9488', // Teal (default)
    '#00C2A8', // Bright Cyan/Teal
    '#10B981', // Emerald Green
    '#0284C7', // Sky Blue
    '#2563EB', // Royal Blue
    '#EA580C', // Burnt Orange
    '#EF4444', // Red
    '#7C3AED', // Purple
  ]

  const bgOptions = [
    { id: 'forest', name: "O'rmon", url: 'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=1200&q=80' },
    { id: 'mountain', name: "Tog'", url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=80' },
    { id: 'lake', name: "Ko'l", url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80' },
    { id: 'meadow', name: "Yaylov", url: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1200&q=80' },
    { id: 'mojave', name: "macOS Mojave (Sahro)", url: 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&w=1920&q=80' },
    { id: 'catalina', name: "macOS Catalina (Orol)", url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1920&q=80' },
    { id: 'bigsur', name: "macOS Big Sur (Qirg'oq)", url: 'https://images.unsplash.com/photo-1510784722466-f2aa9c52fff6?auto=format&fit=crop&w=1920&q=80' },
    { id: 'yosemite', name: "macOS Yosemite (Tog')", url: 'https://images.unsplash.com/photo-1426604966848-d7adac402bff?auto=format&fit=crop&w=1920&q=80' },
  ]

  const handleSelectColor = (color) => {
    setAccentColor(color)
    const newApp = { theme, buttonStyle, accentColor: color, bgImage }
    saveAppearance(newApp)
    setAppearance(newApp)
  }

  const handleSelectTheme = (t) => {
    setTheme(t)
    const newApp = { theme: t, buttonStyle, accentColor, bgImage }
    saveAppearance(newApp)
    setAppearance(newApp)
  }

  const handleSelectButtonStyle = (bs) => {
    setButtonStyle(bs)
    const newApp = { theme, buttonStyle: bs, accentColor, bgImage }
    saveAppearance(newApp)
    setAppearance(newApp)
  }

  const handleSelectBg = (url) => {
    setBgImage(url)
    const newApp = { theme, buttonStyle, accentColor, bgImage: url }
    saveAppearance(newApp)
    setAppearance(newApp)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="form-modal-card appearance-modal-card"
        onClick={e => e.stopPropagation()}
      >
        <button className="modal-close" onClick={onClose} aria-label="Yopish">
          <i className="bi bi-x-lg" />
        </button>

        <div className="appearance-modal-header">
          <h2>Ko'rinish sozlamalari</h2>
          <p>Ish maydonini shaxsiylashtiring</p>
        </div>

        <div className="appearance-modal-body">
          {/* REJIM */}
          <div className="appearance-section">
            <div className="appearance-section-title">REJIM</div>
            <div className="theme-options-grid">
              <button
                type="button"
                className={`theme-btn ${theme === 'light' ? 'active' : ''}`}
                onClick={() => handleSelectTheme('light')}
              >
                <i className="bi bi-sun" />
                <span>Light</span>
              </button>
              <button
                type="button"
                className={`theme-btn ${theme === 'dark' ? 'active' : ''}`}
                onClick={() => handleSelectTheme('dark')}
              >
                <i className="bi bi-moon-stars" />
                <span>Dark</span>
              </button>
              <button
                type="button"
                className={`theme-btn ${theme === 'system' ? 'active' : ''}`}
                onClick={() => handleSelectTheme('system')}
              >
                <i className="bi bi-display" />
                <span>System</span>
              </button>
            </div>
          </div>

          {/* BUTTON STYLE */}
          <div className="appearance-section">
            <div className="appearance-section-title">TUGMA USLUBI (BUTTON)</div>
            <div className="button-style-options" style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                className={`btn ${buttonStyle === 'fill' ? 'btn-teal' : 'btn-ghost'}`}
                style={buttonStyle === 'fill' ? {} : { border: '1px solid var(--accent-teal)', color: 'var(--accent-teal)' }}
                onClick={() => handleSelectButtonStyle('fill')}
              >
                Primary Button
              </button>
              <button
                type="button"
                className={`btn ${buttonStyle === 'outline' ? 'btn-teal' : 'btn-ghost'}`}
                style={buttonStyle === 'outline' ? {} : { border: '1px solid var(--border-hover)', color: 'var(--text-secondary)' }}
                onClick={() => handleSelectButtonStyle('outline')}
              >
                Outline
              </button>
            </div>
          </div>

          {/* ASOSIY RANG */}
          <div className="appearance-section">
            <div className="appearance-section-title">ASOSIY RANG</div>
            
            <div className="selected-color-box">
              <div className="color-preview" style={{ background: accentColor }} />
              <div className="color-info">
                <div className="color-title">Tanlangan rang</div>
                <div className="color-hex">{accentColor.toUpperCase()}</div>
              </div>
              <div className="color-badge" style={{ background: accentColor }} />
            </div>

            <div className="color-palette-grid">
              {colorOptions.map((c, idx) => (
                <button
                  key={idx}
                  type="button"
                  className={`color-swatch ${accentColor === c ? 'active' : ''}`}
                  style={{ background: c }}
                  onClick={() => handleSelectColor(c)}
                >
                  {accentColor === c && <i className="bi bi-check-lg" />}
                </button>
              ))}
            </div>
          </div>

          {/* ORQA FON */}
          <div className="appearance-section">
            <div className="appearance-section-title">ORQA FON</div>
            <p className="appearance-section-sub">Tabiat rasmini tanlang yoki standart qoldiring</p>

            <button
              type="button"
              className={`bg-default-btn ${!bgImage ? 'active' : ''}`}
              onClick={() => handleSelectBg('')}
            >
              <i className="bi bi-slash-circle" />
              <span>Standart fon</span>
            </button>

            <div className="bg-presets-grid">
              {bgOptions.map((bg) => (
                <div
                  key={bg.id}
                  className={`bg-preset-card ${bgImage === bg.url ? 'active' : ''}`}
                  onClick={() => handleSelectBg(bg.url)}
                  style={{ backgroundImage: `url(${bg.url})` }}
                >
                  <div className="bg-preset-overlay">
                    <span className="bg-preset-name">{bg.name}</span>
                    {bgImage === bg.url && (
                      <span className="bg-preset-check">
                        <i className="bi bi-check" />
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Topbar ─────────────────────────────────────────────────────────
function Topbar({ onSettingsClick, onAppearanceClick }) {
  return (
    <header className="topbar">
      <div className="topbar-left">
        <div className="topbar-title">
          Kirish Nazorat Tizimi
          <span className="topbar-live">
            <span className="topbar-live-dot" />
            Jonli
          </span>
        </div>
      </div>

      <div className="topbar-right">
        <div
          className="topbar-icon-btn settings-gear-btn"
          title="Ko'rinish sozlamalari (Mavzu va Fon)"
          onClick={onAppearanceClick}
        >
          <i className="bi bi-palette-fill" />
        </div>
        <div
          className="topbar-icon-btn settings-gear-btn"
          title="Qurilma va Ish Grafigi Sozlamalari"
          onClick={onSettingsClick}
        >
          <i className="bi bi-gear" />
        </div>
      </div>
    </header>
  )
}

// ── StatCard ───────────────────────────────────────────────────────
function StatCard({ icon, value, label, colorClass, delay }) {
  return (
    <div className="stat-card" style={{ animationDelay: `${delay}ms` }}>
      <div className={`stat-icon ${colorClass}`}>
        <i className={`bi ${icon}`} />
      </div>
      <div>
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
      </div>
    </div>
  )
}

// ── Group Events Helper ──────────────────────────────────────────────
function groupEventsByUserAndDate(infoList) {
  if (!Array.isArray(infoList)) return []

  // Tartiblash: eskiroq hodisalar oldin kelishi uchun (xronologik)
  const sorted = [...infoList].sort((a, b) => new Date(a.time) - new Date(b.time))
  const groups = {}

  for (const item of sorted) {
    const key = item.employeeNoString || item.name || 'unknown'
    const dateStr = item.time ? item.time.split('T')[0] : 'nodate'
    const groupKey = `${key}_${dateStr}`

    if (!groups[groupKey]) {
      groups[groupKey] = {
        key: groupKey,
        employeeNoString: item.employeeNoString,
        name: item.name,
        date: dateStr,
        pictureURL: item.pictureURL,
        firstCheckIn: null,
        lastCheckOut: null,
        breakEvents: [],
        events: [],
      }
    }

    const g = groups[groupKey]
    if (item.pictureURL && !g.pictureURL) {
      g.pictureURL = item.pictureURL
    }

    g.events.push(item)

    if (item.attendanceStatus === 'checkIn') {
      if (!g.firstCheckIn) g.firstCheckIn = item.time
    } else if (item.attendanceStatus === 'checkOut') {
      g.lastCheckOut = item.time
    } else if (item.attendanceStatus === 'breakOut' || item.attendanceStatus === 'breakIn') {
      g.breakEvents.push(item)
    }
  }

  // Natijani oxirgi faollik/vaqt bo'yicha kamayish tartibida saralash (eng yangi kun/hodisa tepada)
  return Object.values(groups).sort((a, b) => {
    const timeA = a.lastCheckOut || a.firstCheckIn || a.events[a.events.length - 1]?.time || ''
    const timeB = b.lastCheckOut || b.firstCheckIn || b.events[b.events.length - 1]?.time || ''
    return new Date(timeB) - new Date(timeA)
  })
}

function formatOnlyTime(isoString) {
  if (!isoString) return '—'
  const d = new Date(isoString)
  return d.toLocaleTimeString('uz-UZ', {
    timeZone: 'Asia/Tashkent',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  })
}

function formatDateHeader(dateStr) {
  if (!dateStr || dateStr === 'nodate') return '—'
  const d = new Date(dateStr.length === 10 ? `${dateStr}T00:00:00` : dateStr)
  return d.toLocaleDateString('uz-UZ', { timeZone: 'Asia/Tashkent', year: 'numeric', month: '2-digit', day: '2-digit' })
}

// ── EventRow (table row) ───────────────────────────────────────────
function EventRow({ group, index, onPhotoClick }) {
  // Kun davomidagi boshqa harakatlar (tushlik alohida ustunda ko'rsatilgani uchun chiqarilmaydi)
  const otherEvents = group.events.filter(ev => ev.attendanceStatus !== 'breakOut' && ev.attendanceStatus !== 'breakIn')
  const { isLate: isUserLate, minutesLate } = checkIsLate(group.firstCheckIn)

  return (
    <div
      className="table-row"
      style={{
        '--table-cols': '2.2fr 1fr 1fr 1.6fr 1fr 2fr',
        animationDelay: `${index * 40}ms`,
      }}
    >
      {/* Xodim */}
      <div className="td">
        <div className="person-cell">
          {group.pictureURL ? (
            <img
              src={group.pictureURL}
              alt={group.name}
              className="person-avatar"
              style={isUserLate ? { border: '1px solid #ef4444' } : {}}
              onClick={() => onPhotoClick(group.pictureURL, group.name)}
              onError={e => { e.target.style.display = 'none' }}
            />
          ) : (
            <div className="person-avatar" style={isUserLate ? { border: '1px solid #ef4444', background: 'rgba(239,68,68,0.1)' } : {}}>
              <i className="bi bi-person-fill" style={{ fontSize: 15, color: isUserLate ? '#f87171' : 'var(--accent-teal)' }} />
            </div>
          )}
          <div>
            <div
              className="person-name"
              style={isUserLate ? { color: '#f87171', fontWeight: 700 } : {}}
              title={isUserLate ? `Ishga ${minutesLate} daqiqa kechikib kelgan` : ''}
            >
              {group.name || '(Ism yo\'q)'}
              {isUserLate && (
                <span style={{ fontSize: 10, marginLeft: 6, padding: '1px 5px', borderRadius: 4, background: 'rgba(239,68,68,0.2)', color: '#f87171', fontWeight: 600 }}>
                  Kechikdi
                </span>
              )}
            </div>
            <div className="person-id">#{group.employeeNoString || '—'}</div>
          </div>
        </div>
      </div>

      {/* Sana */}
      <div className="td">
        <span className="time-cell" style={{ fontSize: 12 }}>
          <i className="bi bi-calendar3" style={{ marginRight: 5, opacity: 0.6 }} />
          {formatDateHeader(group.date)}
        </span>
      </div>

      {/* Kirish */}
      <div className="td">
        {(() => {
          if (!group.firstCheckIn) return <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
          const { isLate, minutesLate } = checkIsLate(group.firstCheckIn)

          if (isLate) {
            return (
              <span
                className="badge checkout"
                style={{ padding: '3px 8px', fontSize: 12, background: 'rgba(239, 68, 68, 0.18)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)' }}
                title={`Ishga ${minutesLate} daqiqa kechikib keldi`}
              >
                <i className="bi bi-exclamation-circle-fill" /> {formatOnlyTime(group.firstCheckIn)}
                <span style={{ fontSize: 10, marginLeft: 4, fontWeight: 700 }}>+{minutesLate}m</span>
              </span>
            )
          }

          return (
            <span className="badge checkin" style={{ padding: '3px 8px', fontSize: 12 }}>
              <i className="bi bi-box-arrow-in-right" /> {formatOnlyTime(group.firstCheckIn)}
            </span>
          )
        })()}
      </div>

      {/* Tushlik (Chiqish / Kirish) */}
      <div className="td">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
          {(() => {
            const outs = group.breakEvents.filter(e => e.attendanceStatus === 'breakOut')
            const ins = group.breakEvents.filter(e => e.attendanceStatus === 'breakIn')
            const maxLen = Math.max(outs.length, ins.length)
            
            if (maxLen === 0) {
              return <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
            }

            const pairs = []
            for (let i = 0; i < maxLen; i++) {
              pairs.push({ out: outs[i], inEv: ins[i] })
            }

            return pairs.map((p, idx) => (
              <div
                key={idx}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 11,
                  background: 'rgba(245, 158, 11, 0.08)',
                  border: '1px solid rgba(245, 158, 11, 0.2)',
                  padding: '3px 8px',
                  borderRadius: 6,
                  width: 'fit-content'
                }}
              >
                {/* Tushlikka chiqish (chapda): Coffee + O'ngga strelka (chiqib ketish) */}
                <span
                  style={{ color: 'var(--accent-orange)', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 3 }}
                  title={p.out ? `Tushlikka chiqdi: ${formatTime(p.out.time)}` : ''}
                >
                  <i className="bi bi-cup-hot" style={{ fontSize: 11 }} />
                  <i className="bi bi-arrow-right-short" style={{ fontSize: 13 }} />
                  {p.out ? formatOnlyTime(p.out.time) : '—'}
                </span>

                <span style={{ color: 'var(--text-muted)', opacity: 0.4 }}>|</span>

                {/* Tushlikdan kirish (o'ngda): Chapga strelka (qaytib kirish) + Coffee */}
                <span
                  style={{ color: 'var(--accent-cyan)', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 3 }}
                  title={p.inEv ? `Tushlikdan qaytdi: ${formatTime(p.inEv.time)}` : ''}
                >
                  <i className="bi bi-arrow-left-short" style={{ fontSize: 13 }} />
                  <i className="bi bi-cup-hot" style={{ fontSize: 11 }} />
                  {p.inEv ? formatOnlyTime(p.inEv.time) : '—'}
                </span>
              </div>
            ))
          })()}
        </div>
      </div>

      {/* Chiqish */}
      <div className="td">
        {group.lastCheckOut ? (
          <span className="badge checkout" style={{ padding: '3px 8px', fontSize: 12 }}>
            <i className="bi bi-box-arrow-left" /> {formatOnlyTime(group.lastCheckOut)}
          </span>
        ) : (
          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
        )}
      </div>

      {/* Kun davomidagi boshqa harakatlar (tushliksiz) */}
      <div className="td">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
          {(() => {
            if (otherEvents.length === 0) {
              return <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
            }

            const checkIns = otherEvents.filter(e => e.attendanceStatus === 'checkIn')
            const checkOuts = otherEvents.filter(e => e.attendanceStatus === 'checkOut')
            const maxLen = Math.max(checkIns.length, checkOuts.length)

            if (maxLen === 0) {
              return <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
            }

            const pairs = []
            for (let i = 0; i < maxLen; i++) {
              pairs.push({ inEv: checkIns[i], outEv: checkOuts[i] })
            }

            return pairs.map((p, idx) => (
              <div
                key={idx}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 11,
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  padding: '3px 8px',
                  borderRadius: 6,
                  width: 'fit-content'
                }}
              >
                <i className="bi bi-arrow-left-right" style={{ color: 'var(--accent-teal)', fontSize: 11 }} />
                
                {/* Kirish (chapda) */}
                <span style={{ color: 'var(--accent-green)', fontWeight: 500 }} title={p.inEv ? `Kirish: ${formatTime(p.inEv.time)}` : ''}>
                  {p.inEv ? formatOnlyTime(p.inEv.time) : '—'}
                </span>

                <i className="bi bi-arrow-right" style={{ color: 'var(--text-muted)', fontSize: 10, opacity: 0.6 }} />

                {/* Chiqish (o'ngda) */}
                <span style={{ color: 'var(--accent-red)', fontWeight: 500 }} title={p.outEv ? `Chiqish: ${formatTime(p.outEv.time)}` : ''}>
                  {p.outEv ? formatOnlyTime(p.outEv.time) : '—'}
                </span>
              </div>
            ))
          })()}
        </div>
      </div>
    </div>
  )
}

// Bugungi sana va vaqtni datetime-local formatida olish uchun yordamchi funksiyalar
function getTodayStartISO() {
  const d = new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}T00:00`
}

function getTodayEndISO() {
  const d = new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}T23:59`
}

// ── AddUserModal ───────────────────────────────────────────────────
function AddUserModal({ onClose, onSuccess }) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [gender, setGender] = useState('male')
  const [submitting, setSubmitting] = useState(false)
  const [modalError, setModalError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    const fullName = [lastName.trim(), firstName.trim()].filter(Boolean).join(' ')
    if (!fullName) return

    setSubmitting(true)
    setModalError(null)

    try {
      const res = await fetch('/api/users/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getDeviceHeaders() },
        body: JSON.stringify({ name: fullName, gender }),
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.error || data.message || 'Foydalanuvchi qo\'shishda xatolik')
      }

      onSuccess()
      onClose()
    } catch (err) {
      setModalError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="form-modal-card" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Yopish">
          <i className="bi bi-x-lg" />
        </button>

        <div className="form-modal-title">
          <i className="bi bi-person-plus-fill" style={{ color: 'var(--accent-teal)' }} />
          Yangi Foydalanuvchi Qo'shish
        </div>

        {modalError && (
          <div className="error-banner" style={{ marginBottom: 14 }}>
            <span className="error-icon"><i className="bi bi-exclamation-triangle-fill" /></span>
            <div className="error-msg">{modalError}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="form-modal-body">
          <div className="form-group">
            <label className="form-label" htmlFor="new-user-lastname">
              Familiya *
            </label>
            <input
              id="new-user-lastname"
              type="text"
              className="form-input"
              placeholder="Masalan: Karimov"
              value={lastName}
              onChange={e => setLastName(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="new-user-firstname">
              Ism *
            </label>
            <input
              id="new-user-firstname"
              type="text"
              className="form-input"
              placeholder="Masalan: Aziz"
              value={firstName}
              onChange={e => setFirstName(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="new-user-gender">
              Jinsi
            </label>
            <select
              id="new-user-gender"
              className="form-select"
              value={gender}
              onChange={e => setGender(e.target.value)}
            >
              <option value="male">Erkak (Male)</option>
              <option value="female">Ayol (Female)</option>
            </select>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onClose}
              disabled={submitting}
            >
              Bekor qilish
            </button>
            <button
              type="submit"
              className="btn btn-teal"
              disabled={submitting || !firstName.trim()}
            >
              {submitting ? (
                <>
                  <i className="bi bi-arrow-repeat" style={{ animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />
                  Saqlanmoqda…
                </>
              ) : (
                <>
                  <i className="bi bi-check-lg" />
                  Saqlash
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── EditUserModal ──────────────────────────────────────────────────
function EditUserModal({ user, onClose, onSuccess }) {
  const fullParts = (user?.name || '').trim().split(/\s+/)
  const initialLastName = fullParts.length > 1 ? fullParts[0] : ''
  const initialFirstName = fullParts.length > 1 ? fullParts.slice(1).join(' ') : (fullParts[0] || '')

  const [firstName, setFirstName] = useState(initialFirstName)
  const [lastName, setLastName] = useState(initialLastName)
  const [gender, setGender] = useState(user?.gender || 'male')

  // Ma'lumot yangilash holatlari
  const [submitting, setSubmitting] = useState(false)
  const [modalError, setModalError] = useState(null)
  const [updateSuccess, setUpdateSuccess] = useState(false)

  // Yuz rasm yuklash holatlari (alohida)
  const [faceFile, setFaceFile] = useState(null)
  const [faceUploading, setFaceUploading] = useState(false)
  const [faceError, setFaceError] = useState(null)
  const [faceSuccess, setFaceSuccess] = useState(false)

  // ── 1. Foydalanuvchi ma'lumotlarini yangilash ────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault()
    const fullName = [lastName.trim(), firstName.trim()].filter(Boolean).join(' ')
    if (!fullName) return

    setSubmitting(true)
    setModalError(null)
    setUpdateSuccess(false)

    try {
      const res = await fetch('/api/users/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getDeviceHeaders() },
        body: JSON.stringify({
          employeeNo: String(user.employeeNo),
          name: fullName,
          gender,
        }),
      })

      const text = await res.text()
      let data = {}
      try { data = JSON.parse(text) } catch (_) {
        throw new Error(`Serverdan noto'g'ri javob (${res.status}): ${text.slice(0, 100)}`)
      }

      if (!res.ok || data.success === false) {
        throw new Error(data.error || data.message || 'Tahrirlashda xatolik')
      }

      setUpdateSuccess(true)
      onSuccess()
      setTimeout(() => onClose(), 800)
    } catch (err) {
      setModalError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // ── 2. Yuz rasmini yuklash (alohida) ────────────────────────────
  const handleFaceUpload = async () => {
    if (!faceFile) return
    setFaceUploading(true)
    setFaceError(null)
    setFaceSuccess(false)

    try {
      const formData = new FormData()
      formData.append('faceLibType', JSON.stringify({
        faceLibType: 'blackFD',
        FDID: '1',
        FPID: String(user.employeeNo),
      }))
      formData.append('img', faceFile)

      const faceRes = await fetch('/api/face/setup', {
        method: 'PUT',
        headers: { ...getDeviceHeaders() },
        body: formData,
      })

      const faceText = await faceRes.text()
      let faceData = {}
      try { faceData = JSON.parse(faceText) } catch (_) {
        throw new Error(`Rasm yuklashda noto'g'ri javob (${faceRes.status}): ${faceText.slice(0, 100)}`)
      }

      if (!faceRes.ok || faceData.success === false) {
        throw new Error(faceData.error || faceData.message || 'Rasm yuklashda xatolik')
      }

      setFaceSuccess(true)
      setFaceFile(null)
    } catch (err) {
      setFaceError(err.message)
    } finally {
      setFaceUploading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="form-modal-card" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Yopish">
          <i className="bi bi-x-lg" />
        </button>

        <div className="form-modal-title">
          <i className="bi bi-pencil-square" style={{ color: 'var(--accent-teal)' }} />
          Foydalanuvchini Tahrirlash (#{user?.employeeNo})
        </div>

        {modalError && (
          <div className="error-banner" style={{ marginBottom: 14 }}>
            <span className="error-icon"><i className="bi bi-exclamation-triangle-fill" /></span>
            <div className="error-msg">{modalError}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="form-modal-body">
          <div className="form-group">
            <label className="form-label" htmlFor="edit-user-lastname">
              Familiya
            </label>
            <input
              id="edit-user-lastname"
              type="text"
              className="form-input"
              placeholder="Masalan: Karimov"
              value={lastName}
              onChange={e => setLastName(e.target.value)}
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="edit-user-firstname">
              Ism *
            </label>
            <input
              id="edit-user-firstname"
              type="text"
              className="form-input"
              placeholder="Masalan: Aziz"
              value={firstName}
              onChange={e => setFirstName(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="edit-user-gender">
              Jinsi
            </label>
            <select
              id="edit-user-gender"
              className="form-select"
              value={gender}
              onChange={e => setGender(e.target.value)}
            >
              <option value="male">Erkak (Male)</option>
              <option value="female">Ayol (Female)</option>
            </select>
          </div>

          {/* ── Yuz rasm bo'limi (alohida) ── */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 14, marginTop: 4 }}>
            <label className="form-label" style={{ marginBottom: 8, display: 'block' }}>
              <i className="bi bi-person-bounding-box" style={{ marginRight: 5, color: 'var(--accent-teal)' }} />
              Yuz rasmini yuklash (alohida)
            </label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                id="edit-user-face"
                type="file"
                accept="image/*"
                className="form-input"
                onChange={e => { setFaceFile(e.target.files[0] || null); setFaceSuccess(false); setFaceError(null) }}
                style={{ padding: '6px 10px', flex: 1 }}
              />
              <button
                type="button"
                className="btn btn-teal"
                onClick={handleFaceUpload}
                disabled={!faceFile || faceUploading}
                style={{ whiteSpace: 'nowrap', minWidth: 110 }}
              >
                {faceUploading ? (
                  <><i className="bi bi-arrow-repeat" style={{ animation: 'spin 0.8s linear infinite', display: 'inline-block' }} /> Yuklanmoqda…</>
                ) : (
                  <><i className="bi bi-upload" /> Yuklash</>
                )}
              </button>
            </div>
            {/* Talab eslatmasi */}
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 5,
              marginTop: 6, padding: '6px 8px',
              background: 'rgba(56,189,248,0.07)',
              borderRadius: 6, border: '1px solid rgba(56,189,248,0.15)'
            }}>
              <i className="bi bi-info-circle" style={{ color: '#38bdf8', fontSize: 11, marginTop: 1, flexShrink: 0 }} />
              <span style={{ fontSize: 10.5, color: '#94a3b8', lineHeight: 1.5 }}>
                <b style={{ color: '#7dd3fc' }}>Format:</b> JPG, JPEG &nbsp;·&nbsp;
                <b style={{ color: '#7dd3fc' }}>Tavsiya:</b> 640×480 px &nbsp;·&nbsp;
                <b style={{ color: '#7dd3fc' }}>Maks:</b> ~1MB (≤100KB tavsiya qilinadi)<br />
                Yuzni to'g'ridan-to'g'ri qaratilgan, yorqin fonli rasm yaxshi ishlaydi
              </span>
            </div>

            {faceFile && !faceSuccess && (
              <span style={{ fontSize: 11, color: 'var(--accent-teal)', marginTop: 4, display: 'block' }}>
                Tanlandi: {faceFile.name}
              </span>
            )}
            {faceSuccess && (
              <span style={{ fontSize: 11, color: '#4ade80', marginTop: 4, display: 'block' }}>
                <i className="bi bi-check-circle-fill" style={{ marginRight: 4 }} />
                Yuz rasmi muvaffaqiyatli yuklandi!
              </span>
            )}
            {faceError && (
              <span style={{ fontSize: 11, color: '#f87171', marginTop: 4, display: 'block' }}>
                <i className="bi bi-exclamation-triangle-fill" style={{ marginRight: 4 }} />
                {faceError}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onClose}
              disabled={submitting || faceUploading}
            >
              Bekor qilish
            </button>
            <button
              type="submit"
              className="btn btn-teal"
              disabled={submitting || !firstName.trim()}
            >
              {submitting ? (
                <><i className="bi bi-arrow-repeat" style={{ animation: 'spin 0.8s linear infinite', display: 'inline-block' }} /> Saqlanmoqda…</>
              ) : updateSuccess ? (
                <><i className="bi bi-check-circle-fill" /> Saqlandi!</>
              ) : (
                <><i className="bi bi-check-lg" /> Saqlash</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── ConfirmDeleteModal ─────────────────────────────────────────────
function ConfirmDeleteModal({ user, onClose, onSuccess }) {
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState(null)

  const handleDelete = async () => {
    setDeleting(true)
    setDeleteError(null)

    try {
      const res = await fetch('/api/users/delete', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getDeviceHeaders() },
        body: JSON.stringify({
          employeeNo: String(user.employeeNo),
        }),
      })

      const data = await res.json()

      if (!res.ok || (data.success === false)) {
        throw new Error(data.error || data.message || 'Foydalanuvchini o\'chirishda xatolik')
      }

      onSuccess()
      onClose()
    } catch (err) {
      setDeleteError(err.message)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="form-modal-card" onClick={e => e.stopPropagation()} style={{ width: 380 }}>
        <button className="modal-close" onClick={onClose} aria-label="Yopish">
          <i className="bi bi-x-lg" />
        </button>

        <div className="form-modal-title" style={{ color: 'var(--accent-red)' }}>
          <i className="bi bi-exclamation-triangle-fill" />
          Foydalanuvchini o'chirish
        </div>

        {deleteError && (
          <div className="error-banner" style={{ marginBottom: 14 }}>
            <span className="error-icon"><i className="bi bi-exclamation-triangle-fill" /></span>
            <div className="error-msg">{deleteError}</div>
          </div>
        )}

        <div style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 20, lineHeight: 1.5 }}>
          Haqiqatan ham <strong>{user?.name || `ID #${user?.employeeNo}`}</strong> foydalanuvchisini qurilmadan o'chirmoqchimisiz?
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onClose}
            disabled={deleting}
          >
            Yo'q, bekor qilish
          </button>
          <button
            type="button"
            className="btn"
            onClick={handleDelete}
            disabled={deleting}
            style={{ background: 'var(--accent-red)', color: '#fff', border: 'none' }}
          >
            {deleting ? (
              <>
                <i className="bi bi-arrow-repeat" style={{ animation: 'spin 0.8s linear infinite', display: 'inline-block', marginRight: 5 }} />
                O'chirilmoqda…
              </>
            ) : (
              <>
                <i className="bi bi-trash-fill" style={{ marginRight: 5 }} />
                Ha, o'chirish
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── UsersView ──────────────────────────────────────────────────────
function UsersView({ onPhotoClick }) {
  const [usersData, setUsersData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [maxResults, setMaxResults] = useState(50)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [deletingUser, setDeletingUser] = useState(null)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/users/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getDeviceHeaders() },
        body: JSON.stringify({ maxResults: Number(maxResults) }),
      })

      if (!res.ok) {
        let detail = ''
        try {
          const errJson = await res.json()
          detail = errJson?.error || JSON.stringify(errJson)
        } catch (_) { }
        throw new Error(`Server xatosi ${res.status}: ${detail || res.statusText}`)
      }

      const json = await res.json()
      setUsersData(json)
    } catch (err) {
      setError(err.message || 'Noma\'lum xato')
    } finally {
      setLoading(false)
    }
  }, [maxResults])

  // Initial load
  useState(() => {
    fetchUsers()
  })

  const [faceImageUser, setFaceImageUser] = useState(null)

  const userList = usersData?.UserInfoSearch?.UserInfo ?? []
  const totalMatches = usersData?.UserInfoSearch?.totalMatches ?? 0

  const filteredUsers = userList.filter(u => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      (u.name || '').toLowerCase().includes(q) ||
      (u.employeeNo || '').includes(q)
    )
  })

  const TABLE_COLS = '2fr 1fr 1fr 0.8fr'

  return (
    <div>
      {/* Filter panel */}
      <div className="filter-panel">
        <div className="filter-panel-title">
          <i className="bi bi-people" style={{ marginRight: 6 }} />
          Foydalanuvchilar Ro'yxati
        </div>
        <div className="filter-grid" style={{ gridTemplateColumns: '1fr auto auto' }}>
          <div className="form-group">
            <label className="form-label" htmlFor="user-max-results">
              <i className="bi bi-list-ol" style={{ marginRight: 5 }} />
              Max Natija
            </label>
            <input
              id="user-max-results"
              type="number"
              className="form-input"
              value={maxResults}
              min={1}
              max={1000}
              onChange={e => setMaxResults(e.target.value)}
              style={{ width: 120 }}
            />
          </div>
          <div className="form-group">
            <label className="form-label">&nbsp;</label>
            <button
              className="btn btn-teal"
              onClick={fetchUsers}
              disabled={loading}
            >
              {loading ? (
                <>
                  <i className="bi bi-arrow-repeat" style={{ animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />
                  Yuklanmoqda…
                </>
              ) : (
                <>
                  <i className="bi bi-arrow-clockwise" />
                  Yangilash
                </>
              )}
            </button>
          </div>
          <div className="form-group">
            <label className="form-label">&nbsp;</label>
            <button
              className="btn btn-teal"
              onClick={() => setShowAddModal(true)}
            >
              <i className="bi bi-person-plus-fill" />
              Foydalanuvchi Qo'shish
            </button>
          </div>
        </div>
      </div>

      {showAddModal && (
        <AddUserModal
          onClose={() => setShowAddModal(false)}
          onSuccess={fetchUsers}
        />
      )}

      {/* Error */}
      {error && (
        <div className="error-banner">
          <span className="error-icon">
            <i className="bi bi-exclamation-triangle-fill" />
          </span>
          <div>
            <div className="error-title">Xato yuz berdi</div>
            <div className="error-msg">{error}</div>
          </div>
        </div>
      )}

      {/* Stats */}
      {usersData && !loading && (
        <div className="stats-row">
          <StatCard icon="bi-people-fill" value={totalMatches} label="Jami Foydalanuvchilar" colorClass="teal" delay={0} />
          <StatCard icon="bi-person-badge" value={userList.filter(u => u.numOfFace > 0).length} label="Yuz kiritilgan" colorClass="green" delay={60} />
          <StatCard icon="bi-shield-check" value={userList.filter(u => u.Valid?.enable).length} label="Faol foydalanuvchi" colorClass="purple" delay={120} />
        </div>
      )}

      {/* Spinner */}
      {loading && (
        <div className="spinner-wrapper">
          <div className="spinner" />
          <div className="spinner-text">Foydalanuvchilar yuklanmoqda…</div>
        </div>
      )}

      {/* Table */}
      {!loading && usersData && (
        <>
          <div className="toolbar">
            <div className="section-heading" style={{ margin: 0 }}>
              <h1>
                <i className="bi bi-people" style={{ marginRight: 8, color: 'var(--accent-teal)' }} />
                Foydalanuvchilar
              </h1>
              <span className="section-count">{filteredUsers.length} ta</span>
            </div>

            <div className="toolbar-actions">
              <div className="search-box">
                <span className="search-box-icon">
                  <i className="bi bi-search" />
                </span>
                <input
                  type="text"
                  placeholder="Ism yoki ID bo'yicha qidirish…"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="table-wrapper">
            <div className="table-header-row" style={{ '--table-cols': TABLE_COLS }}>
              <div className="th"><i className="bi bi-person" style={{ marginRight: 5 }} />Foydalanuvchi</div>
              <div className="th"><i className="bi bi-gender-ambiguous" style={{ marginRight: 5 }} />Jinsi / Turi</div>
              <div className="th"><i className="bi bi-person-bounding-box" style={{ marginRight: 5 }} />Yuzi / Kartasi</div>
              <div className="th" style={{ justifyContent: 'flex-end' }}><i className="bi bi-gear" style={{ marginRight: 5 }} />Amallar</div>
            </div>

            <div className="table-body">
              {filteredUsers.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon"><i className="bi bi-people" /></div>
                  <div className="empty-title">Foydalanuvchilar topilmadi</div>
                </div>
              ) : (
                filteredUsers.map((user, idx) => (
                  <div
                    key={user.employeeNo ?? idx}
                    className="table-row"
                    style={{ '--table-cols': TABLE_COLS, animationDelay: `${idx * 40}ms` }}
                  >
                    {/* Person */}
                    <div className="td">
                      <div className="person-cell">
                        <div
                          className="person-avatar"
                          onClick={() => setFaceImageUser(user)}
                          title="Yuz rasmini ko'rish"
                          style={{ cursor: 'pointer', position: 'relative', transition: 'transform 0.15s', ':hover': { transform: 'scale(1.1)' } }}
                        >
                          <i className="bi bi-person-fill" style={{ fontSize: 15, color: 'var(--accent-teal)' }} />
                          {user.numOfFace > 0 && (
                            <span style={{
                              position: 'absolute', bottom: -2, right: -2,
                              width: 10, height: 10, borderRadius: '50%',
                              background: '#4ade80',
                              border: '1.5px solid var(--card-bg)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }} title="Yuz kiritilgan" />
                          )}
                        </div>
                        <div>
                          <div className="person-name">{user.name || '(Ism yo\'q)'}</div>
                          <div className="person-id">ID: #{user.employeeNo}</div>
                        </div>
                      </div>
                    </div>

                    {/* Gender / UserType */}
                    <div className="td">
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        {user.gender === 'male' ? 'Erkak' : user.gender === 'female' ? 'Ayol' : '—'} ({user.userType || 'normal'})
                      </span>
                    </div>

                    {/* Biometrics */}
                    <div className="td">
                      <div style={{ display: 'flex', gap: 6 }}>
                        <span className={`badge ${user.numOfFace > 0 ? 'checkin' : 'unknown'}`}>
                          <i className="bi bi-person-bounding-box" /> {user.numOfFace > 0 ? 'Yuz bor' : 'Yuz yo\'q'}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="td" style={{ justifyContent: 'flex-end', gap: 6 }}>
                      <button
                        className="btn btn-ghost"
                        onClick={() => setEditingUser(user)}
                        title="Tahrirlash"
                        style={{ padding: '4px 10px', fontSize: 12 }}
                      >
                        <i className="bi bi-pencil" style={{ marginRight: 4 }} />
                        Tahrirlash
                      </button>
                      <button
                        className="btn btn-ghost"
                        onClick={() => setDeletingUser(user)}
                        title="O'chirish"
                        style={{ padding: '4px 10px', fontSize: 12, color: 'var(--accent-red)', borderColor: 'rgba(239, 68, 68, 0.2)' }}
                      >
                        <i className="bi bi-trash" style={{ marginRight: 4 }} />
                        O'chirish
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}

      {faceImageUser && (
        <FaceImageModal
          user={faceImageUser}
          onClose={() => setFaceImageUser(null)}
        />
      )}

      {editingUser && (
        <EditUserModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSuccess={fetchUsers}
        />
      )}

      {deletingUser && (
        <ConfirmDeleteModal
          user={deletingUser}
          onClose={() => setDeletingUser(null)}
          onSuccess={fetchUsers}
        />
      )}
    </div>
  )
}

// ── Main App ───────────────────────────────────────────────────────
export default function App() {
  const [activeTab, setActiveTab] = useState('events') // 'events' | 'users'
  const [startTime, setStartTime] = useState(getTodayStartISO)
  const [endTime, setEndTime] = useState(getTodayEndISO)
  const [maxResults, setMaxResults] = useState(30)
  const [searchPos, setSearchPos] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [showAppearance, setShowAppearance] = useState(false)
  const [appearance, setAppearance] = useState(loadAppearance)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [data, setData] = useState(null)
  const [modalUrl, setModalUrl] = useState(null)
  const [modalName, setModalName] = useState('')

  const fetchEvents = useCallback(async () => {
    setLoading(true)
    setError(null)

    const toTZ = (dt) => {
      const withSeconds = dt.length === 16 ? dt + ':00' : dt
      return withSeconds + '+05:00'
    }

    const body = {
      startTime: toTZ(startTime),
      endTime: toTZ(endTime),
      maxResults: Number(maxResults),
      searchResultPosition: Number(searchPos),
    }

    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getDeviceHeaders() },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        let detail = ''
        try {
          const errJson = await res.json()
          detail = errJson?.errorMsg || errJson?.subStatusCode || JSON.stringify(errJson)
        } catch (_) { }
        throw new Error(`Server xatosi ${res.status}: ${detail || res.statusText}`)
      }

      const json = await res.json()
      setData(json)
    } catch (err) {
      setError(err.message || 'Noma\'lum xato')
    } finally {
      setLoading(false)
    }
  }, [startTime, endTime, maxResults, searchPos])

  // Birinchi marta kirganda avtomatik yuklash
  useEffect(() => {
    fetchEvents()
  }, [])

  // Derived data
  const infoList = data?.AcsEvent?.InfoList ?? []
  const totalMatches = data?.AcsEvent?.totalMatches ?? 0
  const checkIns = infoList.filter(i => i.attendanceStatus === 'checkIn').length
  const checkOuts = infoList.filter(i => i.attendanceStatus === 'checkOut').length
  const others = infoList.length - checkIns - checkOuts

  const groupedList = groupEventsByUserAndDate(infoList)

  // Kechikkanlar sonini hisoblash
  const lateCount = groupedList.filter(g => checkIsLate(g.firstCheckIn).isLate).length

  const filteredGrouped = groupedList.filter(group => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      (group.name || '').toLowerCase().includes(q) ||
      (group.employeeNoString || '').includes(q)
    )
  })

  const TABLE_COLS = '2.2fr 1fr 1fr 1.6fr 1fr 2fr'

  const appStyle = {
    '--accent-teal': appearance.accentColor || '#0D9488',
    '--accent-cyan': appearance.accentColor || '#0D9488',
    '--gradient-teal': `linear-gradient(135deg, ${appearance.accentColor || '#0D9488'}, #4ecdc4)`,
    ...(appearance.bgImage ? {
      backgroundImage: `url(${appearance.bgImage})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundAttachment: 'fixed',
    } : {})
  }

  return (
    <div className={`app-shell theme-${appearance.theme || 'dark'} button-style-${appearance.buttonStyle || 'fill'} ${appearance.bgImage ? 'has-bg-wallpaper' : ''}`} style={appStyle}>
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      <div className="main-area">
        <Topbar
          onSettingsClick={() => setShowSettings(true)}
          onAppearanceClick={() => setShowAppearance(true)}
        />

        <main className="page-content">

          {activeTab === 'users' ? (
            <UsersView onPhotoClick={(url, name) => { setModalUrl(url); setModalName(name) }} />
          ) : (
            <>
              {/* ── Filter Panel ── */}
              <div className="filter-panel">
                <div className="filter-panel-title">
                  <i className="bi bi-funnel" style={{ marginRight: 6 }} />
                  Hodisalarni Qidirish
                </div>
                <div className="filter-grid">
                  <div className="form-group">
                    <label className="form-label" htmlFor="start-time">
                      <i className="bi bi-calendar-event" style={{ marginRight: 5 }} />
                      Boshlanish vaqti
                    </label>
                    <input
                      id="start-time"
                      type="datetime-local"
                      className="form-input"
                      value={startTime}
                      onChange={e => setStartTime(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="end-time">
                      <i className="bi bi-calendar-check" style={{ marginRight: 5 }} />
                      Tugash vaqti
                    </label>
                    <input
                      id="end-time"
                      type="datetime-local"
                      className="form-input"
                      value={endTime}
                      onChange={e => setEndTime(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="max-results">
                      <i className="bi bi-list-ol" style={{ marginRight: 5 }} />
                      Max natija
                    </label>
                    <input
                      id="max-results"
                      type="number"
                      className="form-input"
                      value={maxResults}
                      min={1}
                      max={1000}
                      onChange={e => setMaxResults(e.target.value)}
                      style={{ width: 100 }}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">&nbsp;</label>
                    <button
                      id="fetch-btn"
                      className="btn btn-teal"
                      onClick={fetchEvents}
                      disabled={loading}
                    >
                      {loading ? (
                        <>
                          <i className="bi bi-arrow-repeat" style={{ animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />
                          Yuklanmoqda…
                        </>
                      ) : (
                        <>
                          <i className="bi bi-search" />
                          Qidirish
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* ── Error ── */}
              {error && (
                <div className="error-banner">
                  <span className="error-icon">
                    <i className="bi bi-exclamation-triangle-fill" />
                  </span>
                  <div>
                    <div className="error-title">Xato yuz berdi</div>
                    <div className="error-msg">{error}</div>
                  </div>
                </div>
              )}

              {/* ── Single Stat Card (Kechikkanlar) ── */}
              {data && !loading && (
                <div className="stats-row" style={{ gridTemplateColumns: '1fr', maxWidth: 320 }}>
                  <StatCard
                    icon="bi-exclamation-triangle-fill"
                    value={lateCount}
                    label="Kechikkanlar soni"
                    colorClass="red"
                    delay={0}
                  />
                </div>
              )}

              {/* ── Spinner ── */}
              {loading && (
                <div className="spinner-wrapper">
                  <div className="spinner" />
                  <div className="spinner-text">Ma'lumotlar yuklanmoqda…</div>
                </div>
              )}

              {/* ── Table ── */}
              {!loading && data && (
                <>
                  {/* Toolbar */}
                  <div className="toolbar">
                    <div className="section-heading" style={{ margin: 0 }}>
                      <h1>
                        <i className="bi bi-table" style={{ marginRight: 8, color: 'var(--accent-teal)' }} />
                        Kirish Hodisalari
                      </h1>
                      <span className="section-count">{filteredGrouped.length} xodim/kun</span>
                    </div>

                    <div className="toolbar-actions">
                      <div className="search-box">
                        <span className="search-box-icon">
                          <i className="bi bi-search" />
                        </span>
                        <input
                          id="search-input"
                          type="text"
                          placeholder="Ism yoki ID bo'yicha qidirish…"
                          value={searchQuery}
                          onChange={e => setSearchQuery(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="table-wrapper">
                    {/* Table head */}
                    <div
                      className="table-header-row"
                      style={{ '--table-cols': TABLE_COLS }}
                    >
                      <div className="th">
                        <i className="bi bi-person" style={{ marginRight: 5 }} />
                        Xodim
                      </div>
                      <div className="th">
                        <i className="bi bi-calendar3" style={{ marginRight: 5 }} />
                        Sana
                      </div>
                      <div className="th">
                        <i className="bi bi-box-arrow-in-right" style={{ marginRight: 5 }} />
                        Kirish
                      </div>
                      <div className="th">
                        <i className="bi bi-cup-hot" style={{ marginRight: 5 }} />
                        Tushlik (Chiqish/Kirish)
                      </div>
                      <div className="th">
                        <i className="bi bi-box-arrow-left" style={{ marginRight: 5 }} />
                        Chiqish
                      </div>
                      <div className="th">
                        <i className="bi bi-clock-history" style={{ marginRight: 5 }} />
                        Boshqa harakatlar
                      </div>
                    </div>

                    {/* Table body */}
                    <div className="table-body">
                      {filteredGrouped.length === 0 ? (
                        <div className="empty-state">
                          <div className="empty-icon">
                            <i className="bi bi-folder2-open" />
                          </div>
                          <div className="empty-title">Hodisa topilmadi</div>
                          <div className="empty-desc">
                            {searchQuery
                              ? 'Qidiruv natijasida hech narsa topilmadi'
                              : 'Tanlangan vaqt oralig\'ida hodisa mavjud emas'}
                          </div>
                        </div>
                      ) : (
                        filteredGrouped.map((group, idx) => (
                          <EventRow
                            key={group.key ?? idx}
                            group={group}
                            index={idx}
                            onPhotoClick={(url, name) => { setModalUrl(url); setModalName(name) }}
                          />
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* ── Initial empty state ── */}
              {!loading && !data && !error && (
                <div className="empty-state">
                  <div className="empty-icon">
                    <i className="bi bi-shield-lock" />
                  </div>
                  <div className="empty-title">Ma'lumotlarni yuklash uchun «Qidirish» tugmasini bosing</div>
                  <div className="empty-desc">Sana oralig'ini tanlang va hodisalarni ko'ring</div>
                </div>
              )}
            </>
          )}

        </main>
      </div>

      {/* ── Photo modal ── */}
      {modalUrl && (
        <PhotoModal
          url={modalUrl}
          name={modalName}
          onClose={() => { setModalUrl(null); setModalName('') }}
        />
      )}

      {/* ── Settings modal ── */}
      {showSettings && (
        <SettingsModal onClose={() => setShowSettings(false)} />
      )}

      {/* ── Appearance modal ── */}
      {showAppearance && (
        <AppearanceModal
          onClose={() => setShowAppearance(false)}
          appearance={appearance}
          setAppearance={setAppearance}
        />
      )}
    </div>
  )
}
