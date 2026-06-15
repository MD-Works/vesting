/**
 * Vesting — by MD Works
 * js/crypto.js — AES-256-GCM encryption layer (POPIA compliance)
 *
 * Architecture:
 *   passphrase → PBKDF2 (310 000 iterations) → 256-bit AES-GCM key
 *   Key lives in _key variable in memory for this tab session only.
 *   Passphrase stored in sessionStorage so the key can be re-derived
 *   automatically on page navigation — one unlock per tab session.
 *   When the tab closes, sessionStorage is wiped — automatic lock.
 *   Salt lives in IndexedDB settings store — never leaves the device.
 *   Every record is individually encrypted with a fresh random IV.
 *
 * Session flow:
 *   First run  → Crypto.setup(passphrase)   → saves passphrase to sessionStorage
 *   Page load  → App.init() calls Crypto.tryAutoUnlock() → silent re-derive
 *   Explicit   → Crypto.unlock(passphrase)  → saves passphrase to sessionStorage
 *   Lock       → Crypto.lock()              → clears _key + sessionStorage
 *   Tab close  → sessionStorage auto-wiped  → next tab load requires unlock
 *
 * Depends on: db.js (must be loaded first)
 */

const Crypto = (() => {

  // ── Constants ────────────────────────────────────────────────────────────
  const PBKDF2_ITERATIONS = 310_000
  const PBKDF2_HASH       = 'SHA-256'
  const KEY_LENGTH        = 256        // bits
  const IV_LENGTH         = 12         // bytes
  const SALT_LENGTH       = 32         // bytes
  const SALT_SETTING      = 'encryptionSalt'
  const VERIFY_SETTING    = 'encryptionVerify'
  const SESSION_PASS_KEY  = 'vesting_pass'   // sessionStorage — tab-scoped, memory only

  // ── Internal state ───────────────────────────────────────────────────────
  let _key = null   // CryptoKey — lives in memory only

  // ── Encoding helpers ─────────────────────────────────────────────────────
  function _bufToBase64(buffer) {
    const bytes = new Uint8Array(buffer)
    let bin = ''
    bytes.forEach(b => { bin += String.fromCharCode(b) })
    return btoa(bin)
  }

  function _base64ToBuf(base64) {
    const bin   = atob(base64)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return bytes
  }

  function _strToBuf(str) { return new TextEncoder().encode(str) }
  function _bufToStr(buf) { return new TextDecoder().decode(buf) }

  // ── Key derivation ───────────────────────────────────────────────────────
  async function _deriveKey(passphrase, salt) {
    const keyMaterial = await crypto.subtle.importKey(
      'raw', _strToBuf(passphrase), { name: 'PBKDF2' }, false, ['deriveKey']
    )
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: PBKDF2_HASH },
      keyMaterial,
      { name: 'AES-GCM', length: KEY_LENGTH },
      false,
      ['encrypt', 'decrypt']
    )
  }

  // ── Salt management ──────────────────────────────────────────────────────
  function _generateSalt() { return crypto.getRandomValues(new Uint8Array(SALT_LENGTH)) }

  async function _loadSalt() {
    const stored = await DB.getSetting(SALT_SETTING)
    return stored ? _base64ToBuf(stored) : null
  }

  async function _saveSalt(salt) {
    await DB.setSetting(SALT_SETTING, _bufToBase64(salt))
  }

  // ── Verify token ─────────────────────────────────────────────────────────
  // A small known-plaintext blob stored in DB so we can verify the passphrase
  // is correct before granting access on subsequent unlocks.
  async function _writeVerifyToken() {
    const iv         = crypto.getRandomValues(new Uint8Array(IV_LENGTH))
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv }, _key, _strToBuf('vesting-verify')
    )
    const combined = new Uint8Array(IV_LENGTH + ciphertext.byteLength)
    combined.set(iv, 0)
    combined.set(new Uint8Array(ciphertext), IV_LENGTH)
    await DB.setSetting(VERIFY_SETTING, _bufToBase64(combined))
  }

  async function _verifyKey(candidateKey) {
    const token = await DB.getSetting(VERIFY_SETTING)
    if (!token) return true   // no token yet — first unlock after setup
    const raw       = _base64ToBuf(token)
    const iv        = raw.slice(0, IV_LENGTH)
    const cipher    = raw.slice(IV_LENGTH)
    try {
      const dec  = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, candidateKey, cipher)
      return _bufToStr(dec) === 'vesting-verify'
    } catch {
      return false
    }
  }

  // ── Session passphrase (sessionStorage) ──────────────────────────────────
  function _savePassToSession(passphrase) {
    try { sessionStorage.setItem(SESSION_PASS_KEY, passphrase) } catch { /* private mode */ }
  }

  function _loadPassFromSession() {
    try { return sessionStorage.getItem(SESSION_PASS_KEY) } catch { return null }
  }

  function _clearPassFromSession() {
    try { sessionStorage.removeItem(SESSION_PASS_KEY) } catch { /* ignore */ }
  }

  // ── Public: setup (first run) ─────────────────────────────────────────────
  async function setup(passphrase) {
    if (!passphrase || passphrase.length < 8)
      throw new Error('Passphrase must be at least 8 characters.')

    const existingSalt = await _loadSalt()
    if (existingSalt)
      throw new Error('Encryption already set up. Use unlock() or changePassphrase().')

    const salt = _generateSalt()
    await _saveSalt(salt)
    _key = await _deriveKey(passphrase, salt)
    await _writeVerifyToken()
    _savePassToSession(passphrase)
  }

  // ── Public: unlock ────────────────────────────────────────────────────────
  async function unlock(passphrase) {
    if (!passphrase) throw new Error('Passphrase is required.')
    const salt = await _loadSalt()
    if (!salt) throw new Error('No encryption found. Run setup() first.')

    const candidateKey = await _deriveKey(passphrase, salt)
    const valid        = await _verifyKey(candidateKey)
    if (!valid) throw new Error('Wrong passphrase. Please try again.')

    _key = candidateKey

    // Write verify token on first unlock (if missing)
    const hasToken = await DB.getSetting(VERIFY_SETTING)
    if (!hasToken) await _writeVerifyToken()

    _savePassToSession(passphrase)
  }

  // ── Public: tryAutoUnlock ─────────────────────────────────────────────────
  // Called by App.init() on every page load.
  // Silently re-derives the key from the sessionStorage passphrase.
  // Returns true if unlocked, false if no session or wrong passphrase.
  async function tryAutoUnlock() {
    if (_key) return true   // already unlocked this page cycle

    const saved = _loadPassFromSession()
    if (!saved) return false

    try {
      await unlock(saved)
      return true
    } catch {
      // Session passphrase is stale or DB changed — clear it
      _clearPassFromSession()
      return false
    }
  }

  // ── Public: lock ──────────────────────────────────────────────────────────
  function lock() {
    _key = null
    _clearPassFromSession()
  }

  // ── Public: state checks ──────────────────────────────────────────────────
  function isUnlocked() { return _key !== null }

  async function isSetUp() {
    const salt = await _loadSalt()
    return salt !== null
  }

  // ── Encrypt / Decrypt ─────────────────────────────────────────────────────
  async function encrypt(data) {
    if (!_key) throw new Error('[Vesting Crypto] Session is locked. Unlock first.')
    const iv         = crypto.getRandomValues(new Uint8Array(IV_LENGTH))
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv }, _key, _strToBuf(JSON.stringify(data))
    )
    const combined = new Uint8Array(IV_LENGTH + ciphertext.byteLength)
    combined.set(iv, 0)
    combined.set(new Uint8Array(ciphertext), IV_LENGTH)
    return _bufToBase64(combined)
  }

  async function decrypt(blob) {
    if (!_key) throw new Error('[Vesting Crypto] Session is locked. Unlock first.')
    const combined = _base64ToBuf(blob)
    const iv       = combined.slice(0, IV_LENGTH)
    const cipher   = combined.slice(IV_LENGTH)
    try {
      const dec = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, _key, cipher)
      return JSON.parse(_bufToStr(dec))
    } catch {
      throw new Error('[Vesting Crypto] Decryption failed — data may be corrupt or key is wrong.')
    }
  }

  // ── Encrypted DB helpers ──────────────────────────────────────────────────
  async function putEncrypted(storeName, record) {
    const { id, ...rest } = record
    if (!id) throw new Error('[Vesting Crypto] Record must have an id field.')
    const blob = await encrypt(rest)
    return DB.put(storeName, { id, data: blob })
  }

  async function getDecrypted(storeName, id) {
    const record = await DB.get(storeName, id)
    if (!record) return null
    const dec = await decrypt(record.data)
    return { id: record.id, ...dec }
  }

  async function getAllDecrypted(storeName) {
    const records = await DB.getAll(storeName)
    return Promise.all(records.map(async r => {
      const dec = await decrypt(r.data)
      return { id: r.id, ...dec }
    }))
  }

  // ── Change passphrase ─────────────────────────────────────────────────────
  async function changePassphrase(oldPassphrase, newPassphrase, onProgress) {
    if (!newPassphrase || newPassphrase.length < 8)
      throw new Error('New passphrase must be at least 8 characters.')
    if (oldPassphrase === newPassphrase)
      throw new Error('New passphrase must be different from the old one.')

    const salt   = await _loadSalt()
    if (!salt) throw new Error('No encryption found.')

    const oldKey = await _deriveKey(oldPassphrase, salt)
    const valid  = await _verifyKey(oldKey)
    if (!valid) throw new Error('Current passphrase is wrong.')

    const prevKey = _key
    _key = oldKey

    const encryptedStores = Object.keys(DB.STORES).filter(s => s !== 'settings')
    const allData = {}
    for (const storeName of encryptedStores) {
      try { allData[storeName] = await getAllDecrypted(storeName) }
      catch { _key = prevKey; throw new Error(`Failed to decrypt ${storeName}. Wrong passphrase?`) }
    }

    const newSalt = _generateSalt()
    const newKey  = await _deriveKey(newPassphrase, newSalt)
    _key = newKey

    const total = encryptedStores.length
    for (let i = 0; i < total; i++) {
      const storeName = encryptedStores[i]
      await DB.clear(storeName)
      for (const record of allData[storeName]) await putEncrypted(storeName, record)
      if (typeof onProgress === 'function')
        onProgress(Math.round(((i + 1) / total) * 100), storeName)
    }

    await _saveSalt(newSalt)
    await DB.deleteSetting(VERIFY_SETTING)
    await _writeVerifyToken()
    _savePassToSession(newPassphrase)
  }

  // ── Public API ────────────────────────────────────────────────────────────
  return {
    setup, unlock, tryAutoUnlock, lock, isUnlocked, isSetUp,
    encrypt, decrypt,
    putEncrypted, getDecrypted, getAllDecrypted,
    changePassphrase
  }

})()
