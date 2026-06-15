/* ══════════════════════════════════════════════════════
   auth.js — QR Code authentication + session management
   Estate Agent Helper · MD Works
══════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
  // If already authenticated, go straight to dashboard
  if (Session.isValid()) {
    window.location.href = 'dashboard.html'
    return
  }

  // Check if arriving from a QR scan (URL has ?session=...)
  const params    = new URLSearchParams(window.location.search)
  const qrSession = params.get('session')

  if (qrSession) {
    showConfirmMode(qrSession)
  } else {
    showLoginMode()
  }
})

/* ─── SHOW LOGIN MODE ────────────────────────────── */
function showLoginMode() {
  document.getElementById('view-login').style.display   = 'block'
  document.getElementById('view-qr').style.display      = 'none'
  document.getElementById('view-confirm').style.display = 'none'

  // Quick login form
  document.getElementById('form-login').addEventListener('submit', handleDirectLogin)

  // QR button
  document.getElementById('btn-generate-qr').addEventListener('click', handleGenerateQR)
}

/* ─── DIRECT LOGIN ───────────────────────────────── */
function handleDirectLogin(e) {
  e.preventDefault()
  const email    = document.getElementById('login-email').value.trim()
  const agencyId = document.getElementById('login-agency').value.trim() || 'default'
  const errEl    = document.getElementById('login-error')

  errEl.style.display = 'none'

  if (!email) {
    errEl.textContent   = 'Please enter your email address'
    errEl.style.display = 'block'
    return
  }

  const session = crypto.randomUUID()

  Session.set({ email, agency: agencyId, session })

  showToast('Welcome back!', 'success')
  setTimeout(() => { window.location.href = 'dashboard.html' }, 600)
}

/* ─── GENERATE QR CODE ───────────────────────────── */
function handleGenerateQR() {
  const session = crypto.randomUUID()
  const qrUrl   = `${window.location.origin}${window.location.pathname}?session=${session}`

  document.getElementById('view-login').style.display = 'none'
  document.getElementById('view-qr').style.display    = 'block'

  // Render QR using qrcode.js library (CDN)
  const qrContainer = document.getElementById('qr-code')
  qrContainer.innerHTML = ''

  new QRCode(qrContainer, {
    text:         qrUrl,
    width:        240,
    height:       240,
    colorDark:    '#c9943c',
    colorLight:   '#1a1610',
    correctLevel: QRCode.CorrectLevel.H,
  })

  // Show the link
  document.getElementById('qr-link').textContent = qrUrl

  // Copy button
  document.getElementById('btn-copy-qr').onclick = () => {
    navigator.clipboard.writeText(qrUrl)
    showToast('Link copied!', 'success')
  }

  // Back button
  document.getElementById('btn-qr-back').onclick = () => {
    document.getElementById('view-login').style.display = 'block'
    document.getElementById('view-qr').style.display    = 'none'
  }
}

/* ─── CONFIRM MODE (after QR scan) ──────────────── */
function showConfirmMode(qrSession) {
  document.getElementById('view-login').style.display   = 'none'
  document.getElementById('view-qr').style.display      = 'none'
  document.getElementById('view-confirm').style.display = 'block'

  document.getElementById('form-confirm').addEventListener('submit', (e) => {
    e.preventDefault()
    const email    = document.getElementById('confirm-email').value.trim()
    const agencyId = document.getElementById('confirm-agency').value.trim() || 'default'
    const errEl    = document.getElementById('confirm-error')

    errEl.style.display = 'none'

    if (!email) {
      errEl.textContent   = 'Please enter your email address'
      errEl.style.display = 'block'
      return
    }

    Session.set({ email, agency: agencyId, session: qrSession })

    // Clean URL
    window.history.replaceState({}, '', window.location.pathname)

    showToast('Authenticated!', 'success')
    setTimeout(() => { window.location.href = 'dashboard.html' }, 600)
  })
}
