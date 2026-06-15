/* ══════════════════════════════════════════════════════
   leads.js — Leads list logic
   Estate Agent Helper · MD Works
══════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
  Session.guard()

  const { email } = Session.get()
  let leads       = LocalDB.getLeads(email)
  let filtered    = [...leads]

  renderLeads(filtered)

  /* ── FILTER & SEARCH ─────────────────────────────── */
  const searchEl  = document.getElementById('search')
  const statusEl  = document.getElementById('filter-status')
  const typeEl    = document.getElementById('filter-type')

  function applyFilters() {
    const q      = searchEl.value.toLowerCase()
    const status = statusEl.value
    const type   = typeEl.value

    filtered = leads.filter(l => {
      const matchQ      = !q      || l.name.toLowerCase().includes(q) || l.phone.includes(q) || (l.email || '').toLowerCase().includes(q)
      const matchStatus = !status || l.status === status
      const matchType   = !type   || l.propertyType === type
      return matchQ && matchStatus && matchType
    })

    renderLeads(filtered)
  }

  searchEl.addEventListener('input', applyFilters)
  statusEl.addEventListener('change', applyFilters)
  typeEl.addEventListener('change', applyFilters)

  /* ── DELETE ──────────────────────────────────────── */
  document.getElementById('leads-table-body').addEventListener('click', (e) => {
    const { email: agentEmail } = Session.get()

    if (e.target.closest('.btn-delete')) {
      const id = e.target.closest('.btn-delete').dataset.id
      if (!confirm('Delete this lead?')) return
      LocalDB.deleteLead(agentEmail, id)
      leads    = LocalDB.getLeads(agentEmail)
      filtered = [...leads]
      applyFilters()
      showToast('Lead deleted', 'info')
    }

    if (e.target.closest('.btn-wa-lead')) {
      const btn     = e.target.closest('.btn-wa-lead')
      const phone   = btn.dataset.phone
      const name    = btn.dataset.name
      const message = `Hi ${name}, this is ${agentEmail} from Estate Agent Helper. I wanted to follow up regarding your property enquiry. How can I assist you?`
      openWA(phone, message)
    }
  })
})

/* ─── RENDER TABLE ───────────────────────────────── */
function renderLeads(leads) {
  const tbody   = document.getElementById('leads-table-body')
  const countEl = document.getElementById('leads-count')

  countEl.textContent = `${leads.length} lead${leads.length !== 1 ? 's' : ''}`

  if (leads.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align:center; padding:3rem;">
          <div class="empty-state">
            <div class="empty-icon">👤</div>
            <p class="muted">No leads found. Add your first lead!</p>
            <a href="lead-form.html" class="btn btn-primary">+ New Lead</a>
          </div>
        </td>
      </tr>`
    return
  }

  tbody.innerHTML = leads.map(l => `
    <tr>
      <td>
        <strong style="color:var(--md-gold-lt)">${l.name || '—'}</strong><br>
        <span class="muted" style="font-size:.8rem">${l.email || ''}</span>
      </td>
      <td>${l.phone ? `<a href="tel:${l.phone}" style="color:var(--md-cream)">${l.phone}</a>` : '—'}</td>
      <td>${l.propertyType === 'sale' ? '🏷️ Buy' : l.propertyType === 'rental' ? '🔑 Rent' : '🔄 Both'}</td>
      <td>${l.budget || '—'}</td>
      <td>${statusBadge(l.status)}</td>
      <td class="muted">${formatDate(l.dateAdded)}</td>
      <td>
        <div class="flex gap-1">
          <a href="lead-form.html?id=${l.id}" class="btn btn-secondary btn-sm">Edit</a>
          ${l.phone ? `<button class="btn-wa btn-wa-lead btn-sm" data-phone="${l.phone}" data-name="${l.name}">WhatsApp</button>` : ''}
          <button class="btn btn-ghost btn-sm btn-delete" data-id="${l.id}" title="Delete">✕</button>
        </div>
      </td>
    </tr>
  `).join('')
}
