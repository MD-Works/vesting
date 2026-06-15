/* ══════════════════════════════════════════════════════
   property-form.js — New / edit property listing
   Estate Agent Helper · MD Works
══════════════════════════════════════════════════════ */

const FEATURES = [
  'Swimming Pool','Garden','Security Estate','Electric Fence','Alarm System',
  'CCTV','Pet Friendly','Fibre Internet','Solar Power','Solar Geyser',
  'Borehole','Backup Water','Generator','Gas Hob','Underfloor Heating',
  'Air Conditioning','Balcony','Patio / Braai','Sea View','Mountain View',
  'Flatlet','Staff Quarters','Wheelchair Access','Laundry Room','Storeroom',
]

document.addEventListener('DOMContentLoaded', () => {
  Session.guard()

  const { email } = Session.get()
  const params    = new URLSearchParams(window.location.search)
  const editId    = params.get('id')

  // Default date
  document.getElementById('dateAdded').value = new Date().toISOString().split('T')[0]

  // Pre-fill assigned agent from session
  document.getElementById('assignedAgent').value = email

  // Render features checkboxes
  renderFeatures([])

  if (editId) {
    document.getElementById('form-title').textContent   = 'Edit Property'
    document.getElementById('btn-submit').textContent   = 'Save Changes'
    const prop = LocalDB.getProperties().find(p => p.id === editId)
    if (prop) {
      fillForm(prop)
      // Show inspect button for existing properties
      const inspBtn = document.getElementById('btn-inspect')
      inspBtn.href  = `inspection-form.html?property=${editId}`
      inspBtn.style.display = 'inline-flex'
    } else {
      showToast('Property not found', 'error')
      setTimeout(() => { window.location.href = 'properties.html' }, 1200)
    }
  }

  document.getElementById('property-form').addEventListener('submit', handleSubmit)
  document.getElementById('btn-cancel').addEventListener('click', () => { window.location.href = 'properties.html' })

  // Live address preview in subtitle
  const addrEls = ['address','suburb','city']
  addrEls.forEach(id => {
    document.getElementById(id).addEventListener('input', updateAddressPreview)
  })

  // Live clear errors
  document.querySelectorAll('input, select, textarea').forEach(el => {
    el.addEventListener('input',  () => clearFieldError(el.id))
    el.addEventListener('change', () => clearFieldError(el.id))
  })
})

/* ─── FEATURES CHECKBOXES ────────────────────────── */
function renderFeatures(selected = []) {
  const grid = document.getElementById('features-grid')
  grid.innerHTML = FEATURES.map(f => `
    <label style="
      display:flex; align-items:center; gap:.5rem;
      padding:.5rem .75rem;
      background:var(--md-panel);
      border:1px solid var(--md-border);
      border-radius:var(--md-radius);
      cursor:pointer;
      font-family:'Syne',sans-serif;
      font-size:.82rem;
      color:var(--md-muted);
      transition:border-color .2s, color .2s;
      letter-spacing:0;
      text-transform:none;
    " onmouseover="this.style.borderColor='var(--md-gold-dk)'"
       onmouseout="this.style.borderColor=this.querySelector('input').checked?'var(--md-gold)':'var(--md-border)'"
    >
      <input type="checkbox" value="${f}" ${selected.includes(f)?'checked':''}
        style="width:14px;height:14px;accent-color:var(--md-gold);flex-shrink:0"
        onchange="
          this.closest('label').style.borderColor=this.checked?'var(--md-gold)':'var(--md-border)';
          this.closest('label').style.color=this.checked?'var(--md-gold-lt)':'var(--md-muted)';
        "
      />
      ${f}
    </label>
  `).join('')

  // Apply initial checked styles
  grid.querySelectorAll('input[type=checkbox]:checked').forEach(cb => {
    cb.closest('label').style.borderColor = 'var(--md-gold)'
    cb.closest('label').style.color       = 'var(--md-gold-lt)'
  })
}

function getSelectedFeatures() {
  return [...document.querySelectorAll('#features-grid input:checked')].map(cb => cb.value)
}

/* ─── ADDRESS PREVIEW ────────────────────────────── */
function updateAddressPreview() {
  const parts = ['address','suburb','city'].map(id => document.getElementById(id).value.trim()).filter(Boolean)
  const preview = document.getElementById('form-address-preview')
  preview.textContent = parts.length ? parts.join(', ') : 'Complete listing details below'
}

/* ─── FILL FORM (edit mode) ──────────────────────── */
function fillForm(prop) {
  const ids = ['address','suburb','city','province','erfNumber','type','status',
    'mandateType','mandateExpiry','dateAdded','assignedAgent','price','levies',
    'rates','deposit','propertyType','bedrooms','bathrooms','garages','size',
    'erfSize','yearBuilt','otherFeatures','description','internalNotes',
    'ownerName','ownerPhone','ownerEmail','ownerPreferred','showingInstructions']
  ids.forEach(id => {
    const el = document.getElementById(id)
    if (el && prop[id] != null) el.value = prop[id]
  })

  const features = prop.features ? prop.features.split(',').map(f => f.trim()) : []
  renderFeatures(features)
  updateAddressPreview()
}

/* ─── VALIDATION ─────────────────────────────────── */
const RULES = [
  { id:'address', msg:'Street address is required',       test: v => v.trim().length > 0 },
  { id:'suburb',  msg:'Suburb is required',               test: v => v.trim().length > 0 },
  { id:'type',    msg:'Please select a listing type',     test: v => v !== '' },
  { id:'price',   msg:'Asking price or rent is required', test: v => v.trim().length > 0 },
  { id:'ownerPhone', msg:'Enter a valid phone number if provided',
    test: v => v.trim() === '' || /^[\d\s\+\-\(\)]{7,}$/.test(v.trim()) },
  { id:'ownerEmail', msg:'Enter a valid email if provided',
    test: v => v.trim() === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) },
]

function validate() {
  clearAllErrors()
  let valid = true
  let first = null

  RULES.forEach(rule => {
    const el = document.getElementById(rule.id)
    if (!el) return
    if (!rule.test(el.value)) {
      fieldError(rule.id, rule.msg)
      if (!first) first = el
      valid = false
    }
  })

  if (!valid && first) {
    first.scrollIntoView({ behavior:'smooth', block:'center' })
    first.focus()
    showFormBanner('Please fix the errors highlighted below before saving.')
  }
  return valid
}

/* ─── ERROR HELPERS ──────────────────────────────── */
function fieldError(id, msg) {
  const el   = document.getElementById(id)
  const wrap = el?.closest('.form-group')
  if (!el || !wrap) return
  el.classList.add('field-error')
  let errEl = wrap.querySelector('.field-error-msg')
  if (!errEl) { errEl = document.createElement('span'); errEl.className = 'field-error-msg'; wrap.appendChild(errEl) }
  errEl.textContent = '⚠ ' + msg
}

function clearFieldError(id) {
  const el   = document.getElementById(id)
  const wrap = el?.closest('.form-group')
  if (!wrap) return
  el.classList.remove('field-error')
  wrap.querySelector('.field-error-msg')?.remove()
  if (!document.querySelector('.field-error')) hideFormBanner()
}

function clearAllErrors() {
  document.querySelectorAll('.field-error').forEach(el => el.classList.remove('field-error'))
  document.querySelectorAll('.field-error-msg').forEach(el => el.remove())
  hideFormBanner()
}

function showFormBanner(msg) {
  let b = document.getElementById('form-error-banner')
  if (!b) {
    b = document.createElement('div'); b.id = 'form-error-banner'; b.className = 'form-error-banner'
    document.getElementById('property-form').prepend(b)
  }
  b.innerHTML = `<span class="banner-icon">✕</span><span>${msg}</span>`
  b.style.display = 'flex'
  b.scrollIntoView({ behavior:'smooth', block:'start' })
}

function hideFormBanner() {
  const b = document.getElementById('form-error-banner')
  if (b) b.style.display = 'none'
}

/* ─── SUBMIT ─────────────────────────────────────── */
function handleSubmit(e) {
  e.preventDefault()
  if (!validate()) return

  const params = new URLSearchParams(window.location.search)
  const editId = params.get('id')

  const property = {
    dateAdded:           document.getElementById('dateAdded').value,
    address:             document.getElementById('address').value.trim(),
    suburb:              document.getElementById('suburb').value.trim(),
    city:                document.getElementById('city').value.trim(),
    province:            document.getElementById('province').value,
    erfNumber:           document.getElementById('erfNumber').value.trim(),
    type:                document.getElementById('type').value,
    status:              document.getElementById('status').value,
    mandateType:         document.getElementById('mandateType').value,
    mandateExpiry:       document.getElementById('mandateExpiry').value,
    assignedAgent:       document.getElementById('assignedAgent').value.trim(),
    price:               document.getElementById('price').value.trim(),
    levies:              document.getElementById('levies').value.trim(),
    rates:               document.getElementById('rates').value.trim(),
    deposit:             document.getElementById('deposit').value.trim(),
    propertyType:        document.getElementById('propertyType').value,
    bedrooms:            document.getElementById('bedrooms').value,
    bathrooms:           document.getElementById('bathrooms').value,
    garages:             document.getElementById('garages').value,
    size:                document.getElementById('size').value,
    erfSize:             document.getElementById('erfSize').value,
    yearBuilt:           document.getElementById('yearBuilt').value,
    features:            getSelectedFeatures().join(', '),
    otherFeatures:       document.getElementById('otherFeatures').value.trim(),
    description:         document.getElementById('description').value.trim(),
    internalNotes:       document.getElementById('internalNotes').value.trim(),
    ownerName:           document.getElementById('ownerName').value.trim(),
    ownerPhone:          document.getElementById('ownerPhone').value.trim(),
    ownerEmail:          document.getElementById('ownerEmail').value.trim(),
    ownerPreferred:      document.getElementById('ownerPreferred').value,
    showingInstructions: document.getElementById('showingInstructions').value.trim(),
  }

  const btn     = document.getElementById('btn-submit')
  btn.disabled  = true
  btn.innerHTML = '<span class="spinner"></span> Saving…'

  try {
    if (editId) {
      // Update existing
      const props = LocalDB.getProperties()
      const idx   = props.findIndex(p => p.id === editId)
      if (idx === -1) throw new Error('Property not found')
      props[idx]  = { ...props[idx], ...property }
      localStorage.setItem('eah_properties', JSON.stringify(props))
      showToast('Property updated ✓', 'success')
    } else {
      LocalDB.saveProperty(property)
      showToast('Property added ✓', 'success')
    }
    setTimeout(() => { window.location.href = 'properties.html' }, 700)
  } catch (err) {
    btn.disabled  = false
    btn.innerHTML = editId ? 'Save Changes' : 'Add Property'
    showFormBanner(err.message || 'Something went wrong — please try again.')
    showToast(err.message || 'Save failed', 'error')
  }
}
