/**
 * Vesting — by MD Works
 * js/export.js — CSV and JSON export / import logic
 */
const Export = (() => {

  function download(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = filename
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 5000)
  }

  function csvCell(val) {
    if (val === null || val === undefined) return ''
    const str = Array.isArray(val) ? val.join('; ') : String(val)
    if (str.includes(',') || str.includes('\n') || str.includes('"'))
      return '"' + str.replace(/"/g, '""') + '"'
    return str
  }

  function toCSV(headers, rows) {
    return headers.map(csvCell).join(',') + '\n' +
      rows.map(row => row.map(csvCell).join(',')).join('\n')
  }

  function stamp() { return new Date().toISOString().split('T')[0] }

  async function leadsCSV() {
    let leads
    try { leads = await Crypto.getAllDecrypted('leads') }
    catch { App.toast('Could not read leads.', 'danger'); return }
    if (!leads.length) { App.toast('No leads to export.', 'warning'); return }
    const headers = ['Name','Phone','Email','Preferred Contact','Property Type','Areas','Budget',
      'Bedrooms','Bathrooms','Other Requirements','Employment','Credit Score','Family Size',
      'Date of Birth','Anniversary','Status','Source','Last Contact','Follow-up Date','Notes',
      'Created At','Updated At']
    const rows = leads.map(l => [l.name,l.phone,l.email,l.preferredContact,l.propertyType,
      l.areas,l.budget,l.bedrooms,l.bathrooms,l.otherRequirements,l.employment,l.creditScore,
      l.familySize,l.birthDate,l.anniversary,l.status,l.source,l.lastContact,l.followUpDate,
      l.notes,l.createdAt,l.updatedAt])
    download(`vesting-leads-${stamp()}.csv`, toCSV(headers, rows), 'text/csv')
    App.toast(`${leads.length} leads exported.`, 'success')
    await DB.setSetting('lastBackup', new Date().toISOString())
  }

  async function contactsCSV() {
    let contacts
    try { contacts = await Crypto.getAllDecrypted('contacts') }
    catch { App.toast('Could not read contacts.', 'danger'); return }
    if (!contacts.length) { App.toast('No contacts to export.', 'warning'); return }
    const headers = ['Name','Phone','Email','Company','Category','Relationship',
      'Date of Birth','Last Contact','Notes','Created At','Updated At']
    const rows = contacts.map(c => [c.name,c.phone,c.email,c.company,c.category,
      c.relationship,c.birthDate,c.lastContact,c.notes,c.createdAt,c.updatedAt])
    download(`vesting-contacts-${stamp()}.csv`, toCSV(headers, rows), 'text/csv')
    App.toast(`${contacts.length} contacts exported.`, 'success')
    await DB.setSetting('lastBackup', new Date().toISOString())
  }

  async function propertiesCSV() {
    let props
    try { props = await Crypto.getAllDecrypted('properties') }
    catch { App.toast('Could not read properties.', 'danger'); return }
    if (!props.length) { App.toast('No properties to export.', 'warning'); return }
    const headers = ['Address','Suburb','City','Province','Erf Number','Listing Type','Status',
      'Mandate Type','Mandate Expiry','Price','Levies','Rates','Deposit','Property Type',
      'Bedrooms','Bathrooms','Garages','Floor Size m2','Erf Size m2','Year Built',
      'Features','Other Features','Owner Name','Owner Phone','Owner Email',
      'Showing Instructions','Assigned Agent','Description','Internal Notes','Created At','Updated At']
    const rows = props.map(p => [p.address,p.suburb,p.city,p.province,p.erfNumber,p.type,p.status,
      p.mandateType,p.mandateExpiry,p.price,p.levies,p.rates,p.deposit,p.propertyType,
      p.bedrooms,p.bathrooms,p.garages,p.size,p.erfSize,p.yearBuilt,p.features,p.otherFeatures,
      p.ownerName,p.ownerPhone,p.ownerEmail,p.showingInstructions,p.assignedAgent,
      p.description,p.internalNotes,p.createdAt,p.updatedAt])
    download(`vesting-properties-${stamp()}.csv`, toCSV(headers, rows), 'text/csv')
    App.toast(`${props.length} properties exported.`, 'success')
    await DB.setSetting('lastBackup', new Date().toISOString())
  }

  async function fullBackup() {
    try {
      const raw    = await DB.exportAll()
      const backup = {
        _meta: { app:'Vesting by MD Works', version:'1.0.0',
          exportedAt: new Date().toISOString(), encrypted:true,
          note:'Restore requires your Vesting passphrase.' },
        data: raw
      }
      download(`vesting-backup-${stamp()}.json`, JSON.stringify(backup, null, 2), 'application/json')
      await DB.setSetting('lastBackup', new Date().toISOString())
      App.toast('Full backup downloaded.', 'success')
    } catch(err) {
      console.error(err)
      App.toast('Backup failed. Please try again.', 'danger')
    }
  }

  async function restoreBackup(file) {
    if (!file) return
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = async e => {
        try {
          const backup = JSON.parse(e.target.result)
          if (!backup._meta || !backup.data) {
            App.toast('Invalid backup file.', 'danger'); reject(new Error('Invalid')); return
          }
          await DB.importAll(backup.data)
          await DB.setSetting('lastBackup', new Date().toISOString())
          App.toast('Backup restored. Reload to see your data.', 'success', 8000)
          resolve()
        } catch(err) {
          console.error(err)
          App.toast('Could not restore backup. File may be corrupt.', 'danger')
          reject(err)
        }
      }
      reader.onerror = () => { App.toast('Could not read file.', 'danger'); reject() }
      reader.readAsText(file)
    })
  }

  return { leadsCSV, contactsCSV, propertiesCSV, fullBackup, restoreBackup }
})()
