/* ══════════════════════════════════════════════════════
   sheets.js — Google Sheets API integration
   Estate Agent Helper · MD Works

   SETUP:
   1. Create a Google Sheet with tabs:
      - PROPERTIES  (shared agency listings)
      - AGENTS      (agent list for admin)
      - One tab per agent email (their private leads)
   2. Get API key from console.cloud.google.com
   3. Share the sheet with "Anyone with the link can view"
   4. Fill in SHEET_ID and API_KEY below
══════════════════════════════════════════════════════ */

const Sheets = (() => {

  /* ── CONFIG (fill these in) ──────────────────────── */
  const CONFIG = {
    API_KEY:  localStorage.getItem('eah_sheets_key')  || 'YOUR_API_KEY',
    SHEET_ID: localStorage.getItem('eah_sheet_id')   || 'YOUR_SHEET_ID',
    BASE_URL: 'https://sheets.googleapis.com/v4/spreadsheets',
  }

  /* ── INTERNAL: fetch a sheet range ──────────────── */
  async function getRange(range) {
    const url = `${CONFIG.BASE_URL}/${CONFIG.SHEET_ID}/values/${encodeURIComponent(range)}?key=${CONFIG.API_KEY}`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Sheets API error: ${res.status}`)
    const data = await res.json()
    return data.values || []
  }

  /* ── INTERNAL: append rows ───────────────────────── */
  async function appendRows(range, values) {
    const url = `${CONFIG.BASE_URL}/${CONFIG.SHEET_ID}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&key=${CONFIG.API_KEY}`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ values }),
    })
    if (!res.ok) throw new Error(`Sheets append error: ${res.status}`)
    return res.json()
  }

  /* ── INTERNAL: rows → objects ────────────────────── */
  function rowsToObjects(rows) {
    if (rows.length < 2) return []
    const headers = rows[0]
    return rows.slice(1).map(row => {
      const obj = {}
      headers.forEach((h, i) => { obj[h] = row[i] || '' })
      return obj
    })
  }

  /* ── LEADS ───────────────────────────────────────── */

  /**
   * Get all leads for a specific agent.
   * Each agent has their own sheet tab named by their email.
   */
  async function getLeads(agentEmail) {
    try {
      const safeTab = agentEmail.replace(/[@.]/g, '_')
      const rows    = await getRange(`${safeTab}!A:Z`)
      return rowsToObjects(rows)
    } catch (err) {
      console.warn('Could not fetch leads:', err.message)
      return []
    }
  }

  /**
   * Add a lead to the agent's private sheet tab.
   * If the tab doesn't exist yet, the API will error —
   * in that case, we fall back to localStorage for now.
   */
  async function addLead(agentEmail, lead) {
    const safeTab = agentEmail.replace(/[@.]/g, '_')

    const row = [
      lead.dateAdded,
      lead.name,
      lead.phone,
      lead.email,
      lead.preferredContact,
      lead.propertyType,
      lead.areas,
      lead.budget,
      lead.bedrooms,
      lead.bathrooms,
      lead.otherRequirements,
      lead.creditScore,
      lead.familySize,
      lead.employment,
      lead.birthDate,
      lead.anniversary,
      lead.status,
      lead.source,
      lead.lastContact,
      lead.followUpDate,
      lead.notes,
    ]

    return appendRows(`${safeTab}!A:U`, [row])
  }

  /* ── PROPERTIES ──────────────────────────────────── */

  async function getProperties() {
    try {
      const rows = await getRange('PROPERTIES!A:Z')
      return rowsToObjects(rows)
    } catch (err) {
      console.warn('Could not fetch properties:', err.message)
      return []
    }
  }

  async function addProperty(property) {
    const row = [
      new Date().toISOString().split('T')[0],
      property.address,
      property.suburb,
      property.city,
      property.type,        // sale / rental / both
      property.price,
      property.bedrooms,
      property.bathrooms,
      property.garages,
      property.size,
      property.description,
      property.assignedAgent,
      property.status,      // active / pending / sold / rented
      property.mandateType, // sole / open
    ]
    return appendRows('PROPERTIES!A:N', [row])
  }

  /* ── CONFIGURE AT RUNTIME ────────────────────────── */
  function configure(sheetId, apiKey) {
    localStorage.setItem('eah_sheet_id', sheetId)
    localStorage.setItem('eah_sheets_key', apiKey)
    CONFIG.SHEET_ID = sheetId
    CONFIG.API_KEY  = apiKey
  }

  function isConfigured() {
    return CONFIG.SHEET_ID !== 'YOUR_SHEET_ID' && CONFIG.API_KEY !== 'YOUR_API_KEY'
  }

  return { getLeads, addLead, getProperties, addProperty, configure, isConfigured }

})()

/* ══════════════════════════════════════════════════════
   LOCAL STORAGE FALLBACK
   When Sheets API is not yet configured, we store
   data in localStorage so the app still works fully.
══════════════════════════════════════════════════════ */

const LocalDB = {

  /* ── LEADS ─────────────────────────────────────── */
  getLeads(agentEmail) {
    const key  = `eah_leads_${agentEmail}`
    const data = localStorage.getItem(key)
    return data ? JSON.parse(data) : []
  },

  saveLead(agentEmail, lead) {
    const leads = this.getLeads(agentEmail)
    lead.id     = lead.id || crypto.randomUUID()
    leads.unshift(lead)
    localStorage.setItem(`eah_leads_${agentEmail}`, JSON.stringify(leads))
    return lead
  },

  updateLead(agentEmail, id, updates) {
    const leads = this.getLeads(agentEmail)
    const idx   = leads.findIndex(l => l.id === id)
    if (idx === -1) throw new Error('Lead not found')
    leads[idx]  = { ...leads[idx], ...updates }
    localStorage.setItem(`eah_leads_${agentEmail}`, JSON.stringify(leads))
    return leads[idx]
  },

  deleteLead(agentEmail, id) {
    const leads = this.getLeads(agentEmail).filter(l => l.id !== id)
    localStorage.setItem(`eah_leads_${agentEmail}`, JSON.stringify(leads))
  },

  /* ── PROPERTIES ────────────────────────────────── */
  getProperties() {
    const data = localStorage.getItem('eah_properties')
    return data ? JSON.parse(data) : []
  },

  saveProperty(property) {
    const props   = this.getProperties()
    property.id   = property.id || crypto.randomUUID()
    props.unshift(property)
    localStorage.setItem('eah_properties', JSON.stringify(props))
    return property
  },

  /* ── DIARY EVENTS ──────────────────────────────── */
  getEvents(agentEmail) {
    const key  = `eah_events_${agentEmail}`
    const data = localStorage.getItem(key)
    return data ? JSON.parse(data) : []
  },

  saveEvent(agentEmail, event) {
    const events = this.getEvents(agentEmail)
    event.id     = event.id || crypto.randomUUID()
    events.push(event)
    events.sort((a, b) => new Date(a.date) - new Date(b.date))
    localStorage.setItem(`eah_events_${agentEmail}`, JSON.stringify(events))
    return event
  },
}
