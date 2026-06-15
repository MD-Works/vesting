/**
 * Vesting — by MD Works
 * js/app.js — Shared utilities
 *
 * Provides:
 *   App.init()              — boot: DB open + auto-unlock from session + nav
 *   App.toast()             — gold/success/danger/warning notifications
 *   App.nav.highlight()     — active nav item
 *   App.whatsapp()          — open wa.me link
 *   App.whatsappLead()      — pre-filled WhatsApp message for a lead
 *   App.uuid()              — generate unique IDs
 *   App.formatDate()        — ISO → human readable (SA style)
 *   App.formatPhone()       — normalise +27 numbers
 *   App.formatCurrency()    — ZAR formatting
 *   App.timeGreeting()      — Good morning/afternoon/evening
 *   App.validate.*          — SA phone, email, required, future date
 *   App.form.*              — field error show/clear, banner
 *   App.confirm()           — custom confirm dialog
 *   App.truncate()          — shorten long strings
 *   App.debounce()          — debounce function calls
 *   App.relativeTime()      — "2 days ago", "in 3 days"
 *   App.pluralise()         — "1 lead" / "5 leads"
 *   App.requireUnlock()     — guard: redirect if not unlocked
 *   App.generateInspectionPDF() — proper PDF generation via jsPDF
 *
 * Depends on: db.js, crypto.js (loaded before app.js)
 */

const App = (() => {

  // ── Constants ────────────────────────────────────────────────────────────
  const PAGES = [
    { path: 'index.html',       label: 'Dashboard',   icon: '⌂' },
    { path: 'leads.html',       label: 'Leads',       icon: '◈' },
    { path: 'contacts.html',    label: 'Contacts',    icon: '◉' },
    { path: 'properties.html',  label: 'Properties',  icon: '⬡' },
    { path: 'inspections.html', label: 'Inspections', icon: '✓' },
    { path: 'diary.html',       label: 'Diary',       icon: '◷' },
    { path: 'settings.html',    label: 'Settings',    icon: '⚙' }
  ]

  // ── Boot sequence ─────────────────────────────────────────────────────────
  /**
   * Call App.init() at the top of every page script.
   * Opens DB, attempts silent auto-unlock from sessionStorage, injects nav.
   * After init(), call App.requireUnlock() on pages that need data access.
   */
  async function init() {
    try {
      await DB.init()
    } catch (err) {
      console.error('[Vesting] DB init failed:', err)
      toast('Could not open database. Please reload.', 'danger', 8000)
    }

    // Silently re-derive the key from the sessionStorage passphrase.
    // This is what makes navigation work without re-entering the passphrase.
    if (!Crypto.isUnlocked()) {
      try { await Crypto.tryAutoUnlock() } catch { /* will be caught by requireUnlock */ }
    }

    // Cache agent name in sessionStorage for WhatsApp messages
    if (Crypto.isUnlocked()) {
      try {
        const name = await DB.getSetting('agentName')
        if (name) sessionStorage.setItem('vesting_agent_name', name)
      } catch { /* non-critical */ }
    }

    _injectNav()
    nav.highlight()
    _injectFooter()
  }

  // ── Navigation ────────────────────────────────────────────────────────────
  function _injectNav() {
    const container = document.getElementById('vesting-nav')
    if (!container) return
    const currentPage = window.location.pathname.split('/').pop() || 'index.html'
    container.innerHTML = `
      <div class="nav-brand">
        <span class="nav-ornament">✦</span>
        <span class="nav-title">Vesting</span>
        <span class="nav-by">by MD Works</span>
      </div>
      <ul class="nav-links">
        ${PAGES.map(p => `
          <li>
            <a href="${p.path}"
               class="nav-link ${currentPage === p.path ? 'nav-link--active' : ''}"
               data-page="${p.path}">
              <span class="nav-icon">${p.icon}</span>
              <span class="nav-label">${p.label}</span>
            </a>
          </li>`).join('')}
      </ul>`
  }

  function _injectFooter() {
    const footer = document.getElementById('vesting-footer')
    if (!footer) return
    footer.innerHTML = `<span class="footer-ornament">✦</span> Powered by <strong>MD Works</strong> <span class="footer-ornament">✦</span>`
  }

  const nav = {
    highlight() {
      const currentPage = window.location.pathname.split('/').pop() || 'index.html'
      document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.toggle('nav-link--active', link.getAttribute('data-page') === currentPage)
      })
    }
  }

  // ── Toast ─────────────────────────────────────────────────────────────────
  let _toastContainer = null

  function _getToastContainer() {
    if (_toastContainer) return _toastContainer
    _toastContainer = document.createElement('div')
    _toastContainer.id = 'toast-container'
    _toastContainer.setAttribute('aria-live', 'polite')
    document.body.appendChild(_toastContainer)
    return _toastContainer
  }

  function toast(message, type = 'gold', duration = 4000) {
    const container = _getToastContainer()
    const el        = document.createElement('div')
    el.className    = `toast toast--${type}`
    el.setAttribute('role', 'alert')
    el.innerHTML    = `<span class="toast-message">${message}</span><button class="toast-close" aria-label="Dismiss">&times;</button>`
    el.querySelector('.toast-close').addEventListener('click', () => _dismissToast(el))
    container.appendChild(el)
    requestAnimationFrame(() => el.classList.add('toast--visible'))
    if (duration > 0) setTimeout(() => _dismissToast(el), duration)
    return el
  }

  function _dismissToast(el) {
    el.classList.remove('toast--visible')
    el.classList.add('toast--hiding')
    el.addEventListener('transitionend', () => el.remove(), { once: true })
  }

  // ── WhatsApp ──────────────────────────────────────────────────────────────
  function whatsapp(phone, message = '') {
    const digits = formatPhone(phone).replace(/\D/g, '')
    const url    = `https://wa.me/${digits}${message ? '?text=' + encodeURIComponent(message) : ''}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  function whatsappLead(lead) {
    const agentName = sessionStorage.getItem('vesting_agent_name') || 'your agent'
    const message   = [
      `Hi ${lead.name || 'there'} 👋`,
      ``,
      `This is ${agentName} from Vesting.`,
      `I'm following up regarding your property enquiry`,
      lead.areas && lead.areas.length ? `in ${lead.areas.join(', ')}.` : '.',
      ``,
      `Are you still looking? I'd love to help you find the right property.`,
      ``,
      `Feel free to reply here on WhatsApp at any time. 🏡`
    ].join('\n')
    whatsapp(lead.phone, message)
  }

  function googleCalendarUrl({ title, date, startTime, endTime, location, notes }) {
    const fmt    = (d, t) => `${d.replace(/-/g,'')}T${t.replace(':','')}00`
    const params = new URLSearchParams({
      action: 'TEMPLATE', text: title,
      dates: `${fmt(date, startTime)}/${fmt(date, endTime)}`,
      location: location || '', details: notes || ''
    })
    return `https://calendar.google.com/calendar/render?${params}`
  }

  // ── Formatting ────────────────────────────────────────────────────────────
  function uuid() {
    if (crypto.randomUUID) return crypto.randomUUID()
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = (Math.random() * 16) | 0
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
    })
  }

  function formatDate(iso, includeTime = false) {
    if (!iso) return '—'
    try {
      const opts = { day: 'numeric', month: 'short', year: 'numeric' }
      if (includeTime) { opts.hour = '2-digit'; opts.minute = '2-digit' }
      return new Date(iso).toLocaleDateString('en-ZA', opts)
    } catch { return iso }
  }

  function formatPhone(phone) {
    if (!phone) return ''
    const digits = phone.replace(/\D/g, '')
    if (digits.startsWith('27') && digits.length === 11)
      return `+${digits.slice(0,2)} ${digits.slice(2,4)} ${digits.slice(4,7)} ${digits.slice(7)}`
    if (digits.startsWith('0') && digits.length === 10)
      return `+27 ${digits.slice(1,3)} ${digits.slice(3,6)} ${digits.slice(6)}`
    return phone
  }

  function formatCurrency(amount, showCents = false) {
    if (amount === null || amount === undefined || amount === '') return '—'
    const num = typeof amount === 'string' ? parseFloat(amount.replace(/[^0-9.-]/g,'')) : amount
    if (isNaN(num)) return amount
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency', currency: 'ZAR',
      minimumFractionDigits: showCents ? 2 : 0,
      maximumFractionDigits: showCents ? 2 : 0
    }).format(num)
  }

  function timeGreeting(name = '') {
    const h = new Date().getHours()
    const g = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
    return name ? `${g}, ${name}` : g
  }

  function relativeTime(iso) {
    if (!iso) return '—'
    const diffDays = Math.round((new Date(iso) - new Date()) / (1000 * 60 * 60 * 24))
    if (diffDays === 0)  return 'today'
    if (diffDays === 1)  return 'tomorrow'
    if (diffDays === -1) return 'yesterday'
    if (diffDays > 0)    return `in ${diffDays} days`
    return `${Math.abs(diffDays)} days ago`
  }

  function pluralise(count, singular, plural) {
    return `${count} ${count === 1 ? singular : (plural || singular + 's')}`
  }

  function truncate(str, max = 40) {
    if (!str) return ''
    return str.length > max ? str.slice(0, max).trimEnd() + '…' : str
  }

  function debounce(fn, delay = 300) {
    let timer
    return function(...args) {
      clearTimeout(timer)
      timer = setTimeout(() => fn.apply(this, args), delay)
    }
  }

  // ── Validation ────────────────────────────────────────────────────────────
  const validate = {
    required(value) {
      if (value === null || value === undefined) return false
      return String(value).trim().length > 0
    },
    phone(phone) {
      if (!phone) return false
      const digits = phone.replace(/\D/g, '')
      return (digits.length === 10 && digits.startsWith('0')) ||
             (digits.length === 11 && digits.startsWith('27'))
    },
    email(email) {
      if (!email) return true
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    },
    futureOrToday(dateStr) {
      if (!dateStr) return true
      const today = new Date(); today.setHours(0,0,0,0)
      return new Date(dateStr) >= today
    },
    passphrase(p) { return p && p.length >= 8 }
  }

  // ── Form errors ───────────────────────────────────────────────────────────
  const form = {
    error(fieldOrId, message) {
      const field = typeof fieldOrId === 'string' ? document.getElementById(fieldOrId) : fieldOrId
      if (!field) return
      field.classList.add('field--error')
      field.parentElement.querySelector('.field-error-msg')?.remove()
      const msg = document.createElement('p')
      msg.className   = 'field-error-msg'
      msg.textContent = message
      msg.setAttribute('role', 'alert')
      field.insertAdjacentElement('afterend', msg)
      field.classList.remove('field--shake')
      requestAnimationFrame(() => requestAnimationFrame(() => field.classList.add('field--shake')))
    },
    clearError(fieldOrId) {
      const field = typeof fieldOrId === 'string' ? document.getElementById(fieldOrId) : fieldOrId
      if (!field) return
      field.classList.remove('field--error', 'field--shake')
      field.parentElement.querySelector('.field-error-msg')?.remove()
    },
    clearAll(formOrId) {
      const c = typeof formOrId === 'string' ? document.getElementById(formOrId) : formOrId
      if (!c) return
      c.querySelectorAll('.field--error').forEach(el => el.classList.remove('field--error','field--shake'))
      c.querySelectorAll('.field-error-msg').forEach(el => el.remove())
      form.clearBanner(c)
    },
    showBanner(formOrId, errors) {
      const c = typeof formOrId === 'string' ? document.getElementById(formOrId) : formOrId
      if (!c || !errors.length) return
      form.clearBanner(c)
      const banner = document.createElement('div')
      banner.className = 'form-error-banner'
      banner.setAttribute('role', 'alert')
      banner.innerHTML = `<p class="form-error-banner__title">Please fix the following:</p><ul>${errors.map(e=>`<li>${e}</li>`).join('')}</ul>`
      c.insertAdjacentElement('afterbegin', banner)
      banner.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    },
    clearBanner(formOrId) {
      const c = typeof formOrId === 'string' ? document.getElementById(formOrId) : formOrId
      if (!c) return
      c.querySelectorAll('.form-error-banner').forEach(el => el.remove())
    },
    liveValidate(fieldOrId) {
      const field = typeof fieldOrId === 'string' ? document.getElementById(fieldOrId) : fieldOrId
      if (!field) return
      const events = field.tagName === 'SELECT' ? ['change'] : ['input','change']
      events.forEach(evt => field.addEventListener(evt, () => {
        if (field.classList.contains('field--error')) form.clearError(field)
      }, { passive: true }))
    }
  }

  // ── Confirm dialog ────────────────────────────────────────────────────────
  function confirm(message, confirmLabel = 'Confirm', type = 'danger') {
    return new Promise(resolve => {
      document.querySelector('.vesting-dialog-overlay')?.remove()
      const overlay = document.createElement('div')
      overlay.className = 'vesting-dialog-overlay'
      overlay.innerHTML = `
        <div class="vesting-dialog" role="dialog" aria-modal="true">
          <p class="vesting-dialog__message">${message}</p>
          <div class="vesting-dialog__actions">
            <button class="btn btn--ghost" id="dialog-cancel">Cancel</button>
            <button class="btn btn--${type}" id="dialog-confirm">${confirmLabel}</button>
          </div>
        </div>`
      document.body.appendChild(overlay)
      requestAnimationFrame(() => {
        overlay.querySelector('#dialog-confirm').focus()
        overlay.classList.add('vesting-dialog-overlay--visible')
      })
      const cleanup = result => {
        overlay.classList.remove('vesting-dialog-overlay--visible')
        overlay.addEventListener('transitionend', () => overlay.remove(), { once: true })
        resolve(result)
      }
      overlay.querySelector('#dialog-confirm').addEventListener('click', () => cleanup(true))
      overlay.querySelector('#dialog-cancel').addEventListener('click',  () => cleanup(false))
      overlay.addEventListener('click', e => { if (e.target === overlay) cleanup(false) })
      const onKey = e => { if (e.key === 'Escape') { cleanup(false); document.removeEventListener('keydown', onKey) } }
      document.addEventListener('keydown', onKey)
    })
  }

  // ── Unlock guard ──────────────────────────────────────────────────────────
  /**
   * Call after App.init() on any page that needs data access.
   * Returns true if unlocked, otherwise redirects to settings and returns false.
   * Because App.init() calls tryAutoUnlock(), this will only redirect if the
   * agent has never set up a passphrase or if the tab session has expired.
   */
  async function requireUnlock(redirectTo = 'settings.html') {
    if (Crypto.isUnlocked()) return true
    const isSetUp = await Crypto.isSetUp()
    window.location.href = isSetUp ? `${redirectTo}?unlock=1` : `${redirectTo}?setup=1`
    return false
  }

  // ── Status badge ──────────────────────────────────────────────────────────
  function statusBadge(status) {
    const map = {
      'New Lead':'info','Qualified':'gold','Viewing Scheduled':'warning',
      'Offer Pending':'warning','Closed':'success','Lost':'muted',
      'active':'success','pending':'warning','sold':'info','rented':'info','off-market':'muted',
      'draft':'warning','completed':'success','pdf-generated':'info'
    }
    return `<span class="badge badge--${map[status]||'muted'}">${status}</span>`
  }

  // ── Empty state ───────────────────────────────────────────────────────────
  function emptyState(message, ctaLabel = '', ctaHref = '') {
    return `
      <div class="empty-state">
        <span class="empty-state__ornament">✦</span>
        <p class="empty-state__message">${message}</p>
        ${ctaLabel && ctaHref ? `<a href="${ctaHref}" class="btn btn--gold">${ctaLabel}</a>` : ''}
      </div>`
  }

  // ── PDF generation ────────────────────────────────────────────────────────
  /**
   * Generate a proper downloadable PDF for an inspection record.
   * Uses jsPDF loaded from CDN (loaded lazily on first call).
   * @param {object} inspection  — decrypted inspection record
   * @param {object[]} photos    — array of { room, data, mimeType } for room photos
   */
  async function generateInspectionPDF(inspection, photos = []) {
    // Lazy-load jsPDF from CDN if not already loaded
    if (!window.jspdf) {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script')
        script.src   = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
        script.onload  = resolve
        script.onerror = reject
        document.head.appendChild(script)
      })
    }

    const { jsPDF } = window.jspdf
    const doc  = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pw   = doc.internal.pageSize.getWidth()   // 210
    const ph   = doc.internal.pageSize.getHeight()  // 297
    const ml   = 15   // margin left
    const mr   = 15   // margin right
    const tw   = pw - ml - mr   // text width
    let y      = 20

    const GOLD  = [201, 148, 60]
    const BLACK = [17,  14,  9]
    const GREY  = [100, 95, 85]
    const LIGHT = [240, 230, 206]

    // ── Helper: add page if needed ──────────────────────────────────────
    function checkPage(needed = 10) {
      if (y + needed > ph - 20) {
        doc.addPage()
        y = 20
        addPageHeader()
      }
    }

    function addPageHeader() {
      doc.setFillColor(...BLACK)
      doc.rect(0, 0, pw, 14, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(...GOLD)
      doc.text('VESTING — INSPECTION REPORT', ml, 9)
      doc.setTextColor(...GREY)
      doc.text(inspection.propertyAddress || '', pw - mr, 9, { align: 'right' })
    }

    // ── Cover header ────────────────────────────────────────────────────
    doc.setFillColor(...BLACK)
    doc.rect(0, 0, pw, 40, 'F')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(18)
    doc.setTextColor(...GOLD)
    doc.text('VESTING', ml, 18)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...LIGHT)
    doc.text('by MD Works · Durban, South Africa', ml, 25)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.setTextColor(255, 255, 255)
    doc.text('INSPECTION REPORT', ml, 35)

    y = 50

    // ── Inspection details ───────────────────────────────────────────────
    const typeLabel = { entry: 'Entry Inspection', exit: 'Exit Inspection', 'new-listing': 'New Listing Inspection' }
    const details   = [
      ['Property',        inspection.propertyAddress || '—'],
      ['Inspection Type', typeLabel[inspection.type] || inspection.type || '—'],
      ['Date',            inspection.date ? formatDate(inspection.date) : '—'],
      ['Agent',           inspection.agentName  || '—'],
      ['Tenant / Occupant', inspection.tenantName || '—'],
      ['Tenant Phone',    formatPhone(inspection.tenantPhone || '') || '—'],
      ['Witness 1',       (inspection.witnessNames && inspection.witnessNames[0]) || '—'],
      ['Witness 2',       (inspection.witnessNames && inspection.witnessNames[1]) || '—'],
    ]

    doc.setFillColor(245, 240, 230)
    doc.rect(ml, y, tw, details.length * 7 + 4, 'F')
    doc.setDrawColor(...GOLD)
    doc.setLineWidth(0.5)
    doc.rect(ml, y, tw, details.length * 7 + 4, 'S')

    y += 6
    details.forEach(([label, value]) => {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(...GREY)
      doc.text(label.toUpperCase(), ml + 3, y)

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(...BLACK)
      doc.text(String(value), ml + 55, y)
      y += 7
    })
    y += 6

    // ── Room checklist ───────────────────────────────────────────────────
    checkPage(15)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(...GOLD)
    doc.text('ROOM-BY-ROOM CHECKLIST', ml, y)
    doc.setDrawColor(...GOLD)
    doc.setLineWidth(0.3)
    doc.line(ml, y + 1, pw - mr, y + 1)
    y += 8

    const ROOM_LABELS = {
      lounge:'Lounge / Living Room', kitchen:'Kitchen', mainBed:'Main Bedroom',
      bed2:'Bedroom 2', bed3:'Bedroom 3', bathroom:'Bathroom / En-suite',
      garage:'Garage / Parking', garden:'Garden / Outdoor', exterior:'Exterior / Building'
    }

    const COND_COLOUR = { good: [76,175,122], fair: [212,160,23], poor: [201,76,76] }

    if (inspection.checklist) {
      Object.entries(inspection.checklist).forEach(([key, room]) => {
        const label = ROOM_LABELS[key] || key
        checkPage(22)

        doc.setFont('helvetica', 'bold')
        doc.setFontSize(9)
        doc.setTextColor(...BLACK)
        doc.text(label, ml, y)

        if (room.condition) {
          const col = COND_COLOUR[room.condition] || GREY
          doc.setFillColor(...col)
          doc.roundedRect(pw - mr - 22, y - 4, 22, 6, 1, 1, 'F')
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(7)
          doc.setTextColor(255, 255, 255)
          doc.text(room.condition.toUpperCase(), pw - mr - 11, y, { align: 'center' })
        }
        y += 5

        if (room.notes) {
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(8)
          doc.setTextColor(...GREY)
          const lines = doc.splitTextToSize(room.notes, tw - 5)
          lines.forEach(line => {
            checkPage(5)
            doc.text(line, ml + 3, y)
            y += 4.5
          })
        }

        doc.setDrawColor(200, 195, 185)
        doc.setLineWidth(0.2)
        doc.line(ml, y + 1, pw - mr, y + 1)
        y += 5
      })
    }

    // ── Meter readings ───────────────────────────────────────────────────
    if (inspection.meters) {
      checkPage(20)
      y += 4
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.setTextColor(...GOLD)
      doc.text('METER READINGS', ml, y)
      doc.line(ml, y + 1, pw - mr, y + 1)
      y += 8

      Object.entries(inspection.meters).forEach(([meter, data]) => {
        checkPage(8)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(9)
        doc.setTextColor(...BLACK)
        doc.text(meter.charAt(0).toUpperCase() + meter.slice(1) + ':', ml, y)
        doc.setFont('helvetica', 'normal')
        doc.text(data.reading || '—', ml + 30, y)
        y += 6
      })
    }

    // ── General notes ────────────────────────────────────────────────────
    if (inspection.generalNotes) {
      checkPage(20)
      y += 4
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.setTextColor(...GOLD)
      doc.text('GENERAL NOTES', ml, y)
      doc.line(ml, y + 1, pw - mr, y + 1)
      y += 8

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(...BLACK)
      const lines = doc.splitTextToSize(inspection.generalNotes, tw)
      lines.forEach(line => {
        checkPage(6)
        doc.text(line, ml, y)
        y += 5
      })
    }

    // ── Photos ───────────────────────────────────────────────────────────
    if (photos.length > 0) {
      checkPage(20)
      y += 4
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.setTextColor(...GOLD)
      doc.text('INSPECTION PHOTOS', ml, y)
      doc.line(ml, y + 1, pw - mr, y + 1)
      y += 8

      const imgW  = (tw - 5) / 2
      const imgH  = imgW * 0.75
      let   col   = 0

      for (const photo of photos) {
        checkPage(imgH + 10)
        const x = ml + col * (imgW + 5)
        try {
          const fmt = photo.mimeType === 'image/png' ? 'PNG' : 'JPEG'
          doc.addImage(`data:${photo.mimeType};base64,${photo.data}`, fmt, x, y, imgW, imgH)
          if (photo.room) {
            doc.setFont('helvetica', 'italic')
            doc.setFontSize(7)
            doc.setTextColor(...GREY)
            doc.text(photo.room, x, y + imgH + 3)
          }
        } catch { /* skip unreadable image */ }
        col++
        if (col >= 2) { col = 0; y += imgH + 8 }
      }
      if (col > 0) y += imgH + 8
    }

    // ── Signatures ───────────────────────────────────────────────────────
    if (inspection.signatures) {
      checkPage(60)
      y += 6
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.setTextColor(...GOLD)
      doc.text('SIGNATURES', ml, y)
      doc.line(ml, y + 1, pw - mr, y + 1)
      y += 8

      const sigLabels = { agent:'Agent', tenant:'Tenant / Occupant', witness1:'Witness 1', witness2:'Witness 2' }
      const sigW  = (tw - 5) / 2
      const sigH  = 25
      let   scol  = 0

      Object.entries(inspection.signatures).forEach(([key, dataUrl]) => {
        if (!dataUrl) return
        checkPage(sigH + 12)
        const x = ml + scol * (sigW + 5)
        doc.setDrawColor(...GOLD)
        doc.setLineWidth(0.3)
        doc.rect(x, y, sigW, sigH, 'S')
        try {
          doc.addImage(dataUrl, 'PNG', x + 2, y + 2, sigW - 4, sigH - 4)
        } catch { /* skip */ }
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(7)
        doc.setTextColor(...GREY)
        doc.text(sigLabels[key] || key, x, y + sigH + 4)
        scol++
        if (scol >= 2) { scol = 0; y += sigH + 10 }
      })
      if (scol > 0) y += sigH + 10
    }

    // ── Footer on all pages ──────────────────────────────────────────────
    const pageCount = doc.internal.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.setFillColor(...BLACK)
      doc.rect(0, ph - 12, pw, 12, 'F')
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)
      doc.setTextColor(...GOLD)
      doc.text('Powered by Vesting · MD Works · Durban, South Africa', ml, ph - 5)
      doc.setTextColor(...GREY)
      doc.text(`Page ${i} of ${pageCount}`, pw - mr, ph - 5, { align: 'right' })
    }

    // ── Save ─────────────────────────────────────────────────────────────
    const addr    = (inspection.propertyAddress || 'inspection').replace(/[^a-z0-9]/gi, '-').toLowerCase()
    const dateStr = inspection.date ? inspection.date.split('T')[0] : formatDate(new Date().toISOString())
    doc.save(`vesting-inspection-${addr}-${dateStr}.pdf`)
  }

  // ── Public API ────────────────────────────────────────────────────────────
  return {
    init, toast, nav,
    whatsapp, whatsappLead, googleCalendarUrl,
    uuid, formatDate, formatPhone, formatCurrency,
    timeGreeting, relativeTime, pluralise, truncate, debounce,
    validate, form, confirm,
    requireUnlock, statusBadge, emptyState,
    generateInspectionPDF
  }

})()
