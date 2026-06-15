/* ══════════════════════════════════════════════════════
   app.js — Shared utilities for every page
   Estate Agent Helper · MD Works
══════════════════════════════════════════════════════ */

/* ─── SESSION ─────────────────────────────────────── */
const Session = {
  KEY_EMAIL:    'eah_email',
  KEY_AGENCY:   'eah_agency',
  KEY_ROLE:     'eah_role',
  KEY_SESSION:  'eah_session',

  get() {
    return {
      email:    localStorage.getItem(this.KEY_EMAIL),
      agency:   localStorage.getItem(this.KEY_AGENCY)   || 'default',
      role:     localStorage.getItem(this.KEY_ROLE)     || 'agent',
      session:  sessionStorage.getItem(this.KEY_SESSION),
    }
  },

  set({ email, agency = 'default', role = 'agent', session }) {
    localStorage.setItem(this.KEY_EMAIL,  email)
    localStorage.setItem(this.KEY_AGENCY, agency)
    localStorage.setItem(this.KEY_ROLE,   role)
    sessionStorage.setItem(this.KEY_SESSION, session)
  },

  clear() {
    localStorage.removeItem(this.KEY_EMAIL)
    localStorage.removeItem(this.KEY_AGENCY)
    localStorage.removeItem(this.KEY_ROLE)
    sessionStorage.removeItem(this.KEY_SESSION)
  },

  isValid() {
    const s = this.get()
    return !!(s.email && s.session)
  },

  /** Redirect to login if not authenticated */
  guard() {
    if (!this.isValid()) {
      window.location.href = 'index.html'
    }
  },
}

/* ─── TOAST NOTIFICATIONS ─────────────────────────── */
function showToast(message, type = 'info', duration = 3500) {
  let container = document.getElementById('toast-container')
  if (!container) {
    container = document.createElement('div')
    container.id = 'toast-container'
    document.body.appendChild(container)
  }

  const toast = document.createElement('div')
  toast.className = `toast ${type}`
  toast.textContent = message
  container.appendChild(toast)

  requestAnimationFrame(() => {
    requestAnimationFrame(() => toast.classList.add('show'))
  })

  setTimeout(() => {
    toast.classList.remove('show')
    setTimeout(() => toast.remove(), 400)
  }, duration)
}

/* ─── NAV HIGHLIGHT ──────────────────────────────── */
function setActiveNav() {
  const page = window.location.pathname.split('/').pop() || 'index.html'
  document.querySelectorAll('.nav-links a').forEach(a => {
    if (a.getAttribute('href') === page) a.classList.add('active')
  })
}

/* ─── MOBILE NAV TOGGLE ──────────────────────────── */
function initMobileNav() {
  const toggle = document.getElementById('nav-toggle')
  const links  = document.getElementById('nav-links')
  if (!toggle || !links) return

  toggle.addEventListener('click', () => {
    links.classList.toggle('open')
    toggle.textContent = links.classList.contains('open') ? '✕' : '☰'
  })
}

/* ─── RENDER NAV AGENT ───────────────────────────── */
function renderNavAgent() {
  const el = document.getElementById('nav-agent')
  if (!el) return
  const { email } = Session.get()
  if (email) el.textContent = email
}

/* ─── LOGOUT ─────────────────────────────────────── */
function logout() {
  Session.clear()
  showToast('Signed out', 'info')
  setTimeout(() => { window.location.href = 'index.html' }, 600)
}

/* ─── WHATSAPP HELPER ────────────────────────────── */
function waLink(phone, message) {
  const clean = phone.replace(/\D/g, '')
  const text  = encodeURIComponent(message)
  return `https://wa.me/${clean}?text=${text}`
}

function openWA(phone, message) {
  window.open(waLink(phone, message), '_blank')
}

/* ─── FORMAT DATE ────────────────────────────────── */
function formatDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' })
}

/* ─── FORMAT CURRENCY ────────────────────────────── */
function formatZAR(amount) {
  if (!amount) return '—'
  const n = parseFloat(String(amount).replace(/[^0-9.]/g, ''))
  if (isNaN(n)) return amount
  if (n >= 1_000_000) return `R ${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `R ${(n / 1_000).toFixed(0)}k`
  return `R ${n.toFixed(0)}`
}

/* ─── STATUS BADGE HTML ──────────────────────────── */
const STATUS_CLASS = {
  'New Lead':           'status-new',
  'Qualified':          'status-qualified',
  'Viewing Scheduled':  'status-viewing',
  'Offer Pending':      'status-offer',
  'Closed':             'status-closed',
  'Lost':               'status-lost',
}

function statusBadge(status) {
  const cls = STATUS_CLASS[status] || 'status-new'
  return `<span class="${cls}">${status || 'New Lead'}</span>`
}

/* ─── ON DOM READY ───────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  setActiveNav()
  initMobileNav()
  renderNavAgent()

  // Wire up logout button if present
  const logoutBtn = document.getElementById('btn-logout')
  if (logoutBtn) logoutBtn.addEventListener('click', logout)
})
