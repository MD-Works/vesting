/* ══════════════════════════════════════════════════════
   lead-form.js — New / edit lead with clear validation
   Estate Agent Helper · MD Works
══════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
  Session.guard()

  const { email } = Session.get()
  const params    = new URLSearchParams(window.location.search)
  const editId    = params.get('id')

  // Defaults
  document.getElementById('dateAdded').value   = new Date().toISOString().split('T')[0]
  document.getElementById('lastContact').value = new Date().toISOString().split('T')[0]

  if (editId) {
    document.getElementById('form-title').textContent = 'Edit Lead'
    document.getElementById('btn-submit').textContent  = 'Save Changes'
    const lead = LocalDB.getLeads(email).find(l => l.id === editId)
    if (lead) fillForm(lead)
    else { showToast('Lead not found', 'error'); setTimeout(() => { window.location.href = 'leads.html' }, 1200) }
  }

  document.getElementById('lead-form').addEventListener('submit', handleSubmit)
  document.getElementById('btn-cancel').addEventListener('click', () => { window.location.href = 'leads.html' })

  document.getElementById('btn-wa-preview').addEventListener('click', () => {
    const phone = document.getElementById('phone').value.trim()
    const name  = document.getElementById('name').value.trim()
    if (!phone) { fieldError('phone', 'Enter a phone number first'); return }
    openWA(phone, `Hi ${name || 'there'}, I am following up on your property enquiry. When is a good time to chat?`)
  })

  // Live clear errors as user types
  document.querySelectorAll('input, select, textarea').forEach(el => {
    el.addEventListener('input',  () => clearFieldError(el.id))
    el.addEventListener('change', () => clearFieldError(el.id))
  })
})

/* ─── FILL FORM ──────────────────────────────────── */
function fillForm(lead) {
  const ids = ['name','phone','email','preferredContact','propertyType','areas',
    'budget','bedrooms','bathrooms','otherRequirements','creditScore','familySize',
    'employment','birthDate','anniversary','status','source','lastContact',
    'followUpDate','notes','dateAdded']
  ids.forEach(id => {
    const el = document.getElementById(id)
    if (el && lead[id] != null) el.value = lead[id]
  })
}

/* ─── VALIDATION ─────────────────────────────────── */
const RULES = [
  { id: 'name',  msg: 'Full name is required',    test: v => v.trim().length > 0 },
  { id: 'phone', msg: 'Phone number is required',  test: v => v.trim().length > 0 },
  { id: 'phone', msg: 'Enter a valid SA number (e.g. 082 555 1234)',
    test: v => /^[\d\s\+\-\(\)]{7,}$/.test(v.trim()) },
  { id: 'email', msg: 'Enter a valid email address',
    test: v => v.trim() === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) },
  { id: 'followUpDate', msg: 'Follow-up date cannot be in the past',
    test: v => { if (!v) return true; return v >= new Date().toISOString().split('T')[0] } },
]

function validate() {
  clearAllErrors()
  let valid  = true
  let first  = null

  RULES.forEach(rule => {
    const el  = document.getElementById(rule.id)
    if (!el) return
    if (!rule.test(el.value)) {
      fieldError(rule.id, rule.msg)
      if (!first) first = el
      valid = false
    }
  })

  if (!valid && first) {
    first.scrollIntoView({ behavior: 'smooth', block: 'center' })
    first.focus()
    showFormBanner('Please fix the errors highlighted below before saving.')
  }

  return valid
}

/* ─── FIELD ERROR HELPERS ────────────────────────── */
function fieldError(id, msg) {
  const el    = document.getElementById(id)
  const wrap  = el?.closest('.form-group')
  if (!el || !wrap) return

  el.classList.add('field-error')

  let errEl = wrap.querySelector('.field-error-msg')
  if (!errEl) {
    errEl = document.createElement('span')
    errEl.className = 'field-error-msg'
    wrap.appendChild(errEl)
  }
  errEl.textContent = '⚠ ' + msg
}

function clearFieldError(id) {
  const el   = document.getElementById(id)
  const wrap = el?.closest('.form-group')
  if (!wrap) return
  el.classList.remove('field-error')
  wrap.querySelector('.field-error-msg')?.remove()
  // Also hide form banner if no more errors
  if (!document.querySelector('.field-error')) hideFormBanner()
}

function clearAllErrors() {
  document.querySelectorAll('.field-error').forEach(el => el.classList.remove('field-error'))
  document.querySelectorAll('.field-error-msg').forEach(el => el.remove())
  hideFormBanner()
}

function showFormBanner(msg) {
  let banner = document.getElementById('form-error-banner')
  if (!banner) {
    banner = document.createElement('div')
    banner.id        = 'form-error-banner'
    banner.className = 'form-error-banner'
    document.getElementById('lead-form').prepend(banner)
  }
  banner.innerHTML = `<span class="banner-icon">✕</span><span>${msg}</span>`
  banner.style.display = 'flex'
  banner.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function hideFormBanner() {
  const b = document.getElementById('form-error-banner')
  if (b) b.style.display = 'none'
}

/* ─── SUBMIT ─────────────────────────────────────── */
function handleSubmit(e) {
  e.preventDefault()
  if (!validate()) return

  const { email } = Session.get()
  const params    = new URLSearchParams(window.location.search)
  const editId    = params.get('id')

  const lead = {
    dateAdded:         document.getElementById('dateAdded').value,
    name:              document.getElementById('name').value.trim(),
    phone:             document.getElementById('phone').value.trim(),
    email:             document.getElementById('email').value.trim(),
    preferredContact:  document.getElementById('preferredContact').value,
    propertyType:      document.getElementById('propertyType').value,
    areas:             document.getElementById('areas').value.trim(),
    budget:            document.getElementById('budget').value.trim(),
    bedrooms:          document.getElementById('bedrooms').value,
    bathrooms:         document.getElementById('bathrooms').value,
    otherRequirements: document.getElementById('otherRequirements').value.trim(),
    creditScore:       document.getElementById('creditScore').value,
    familySize:        document.getElementById('familySize').value,
    employment:        document.getElementById('employment').value,
    birthDate:         document.getElementById('birthDate').value,
    anniversary:       document.getElementById('anniversary').value,
    status:            document.getElementById('status').value,
    source:            document.getElementById('source').value,
    lastContact:       document.getElementById('lastContact').value,
    followUpDate:      document.getElementById('followUpDate').value,
    notes:             document.getElementById('notes').value.trim(),
  }

  const btn        = document.getElementById('btn-submit')
  btn.disabled     = true
  btn.innerHTML    = '<span class="spinner"></span> Saving…'

  try {
    if (editId) {
      LocalDB.updateLead(email, editId, lead)
      showToast('Lead updated ✓', 'success')
    } else {
      LocalDB.saveLead(email, lead)
      showToast('Lead added ✓', 'success')
    }
    setTimeout(() => { window.location.href = 'leads.html' }, 700)
  } catch (err) {
    btn.disabled  = false
    btn.innerHTML = editId ? 'Save Changes' : 'Add Lead'
    showFormBanner(err.message || 'Something went wrong — please try again.')
    showToast(err.message || 'Save failed', 'error')
  }
}
