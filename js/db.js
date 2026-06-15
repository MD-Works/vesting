/**
 * Vesting — by MD Works
 * js/db.js — IndexedDB wrapper
 *
 * All reads and writes go through this module.
 * crypto.js sits on top — db.js stores/retrieves raw strings,
 * encryption is handled by the caller (app.js / crypto.js).
 *
 * Usage:
 *   await DB.init()
 *   await DB.put('leads', leadObject)
 *   await DB.get('leads', id)
 *   await DB.getAll('leads')
 *   await DB.delete('leads', id)
 *   await DB.clear('leads')
 *   await DB.getSetting('agentName')
 *   await DB.setSetting('agentName', 'Morney Deetlefs')
 */

const DB = (() => {

  // ─── Constants ───────────────────────────────────────────────────────────────

  const DB_NAME    = 'Vesting'
  const DB_VERSION = 1

  const STORES = {
    leads: {
      keyPath: 'id',
      indexes: ['createdAt', 'status', 'source', 'lastContact', 'followUpDate']
    },
    contacts: {
      keyPath: 'id',
      indexes: ['name', 'phone', 'email', 'category', 'createdAt']
    },
    properties: {
      keyPath: 'id',
      indexes: ['address', 'status', 'type', 'createdAt', 'assignedAgent']
    },
    inspections: {
      keyPath: 'id',
      indexes: ['propertyId', 'date', 'type', 'status']
    },
    photos: {
      keyPath: 'id',
      indexes: ['propertyId', 'inspectionId', 'uploadedAt']
    },
    events: {
      keyPath: 'id',
      indexes: ['date', 'type']
    },
    settings: {
      keyPath: 'key',
      indexes: []
    }
  }

  // ─── Internal state ───────────────────────────────────────────────────────────

  let _db = null

  // ─── Init ─────────────────────────────────────────────────────────────────────

  /**
   * Open (or upgrade) the database.
   * Must be called once before any other DB method.
   * Safe to call multiple times — resolves immediately if already open.
   */
  function init () {
    if (_db) return Promise.resolve(_db)

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onupgradeneeded = (event) => {
        const db = event.target.result

        Object.entries(STORES).forEach(([storeName, config]) => {
          // Create store if it doesn't exist
          if (!db.objectStoreNames.contains(storeName)) {
            const store = db.createObjectStore(storeName, {
              keyPath: config.keyPath
            })

            // Create indexes
            ;(config.indexes || []).forEach(indexName => {
              store.createIndex(indexName, indexName, { unique: false })
            })
          }
        })
      }

      request.onsuccess = (event) => {
        _db = event.target.result

        // Handle unexpected version change from another tab
        _db.onversionchange = () => {
          _db.close()
          _db = null
          console.warn('[Vesting DB] Database version changed in another tab. Please reload.')
        }

        resolve(_db)
      }

      request.onerror = (event) => {
        console.error('[Vesting DB] Failed to open database:', event.target.error)
        reject(event.target.error)
      }

      request.onblocked = () => {
        console.warn('[Vesting DB] Database upgrade blocked — close other tabs and reload.')
      }
    })
  }

  // ─── Internal helpers ─────────────────────────────────────────────────────────

  /**
   * Get a transaction and object store.
   * @param {string} storeName
   * @param {IDBTransactionMode} mode  'readonly' | 'readwrite'
   */
  function _store (storeName, mode = 'readonly') {
    if (!_db) throw new Error('[Vesting DB] Database not initialised. Call DB.init() first.')
    const tx = _db.transaction(storeName, mode)
    return tx.objectStore(storeName)
  }

  /**
   * Wrap an IDBRequest in a Promise.
   * @param {IDBRequest} request
   */
  function _promisify (request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror  = () => reject(request.error)
    })
  }

  // ─── Core CRUD ────────────────────────────────────────────────────────────────

  /**
   * Add or update a record.
   * The record must have an `id` field (or `key` for settings store).
   * @param {string} storeName
   * @param {object} record
   */
  function put (storeName, record) {
    return _promisify(_store(storeName, 'readwrite').put(record))
  }

  /**
   * Get a single record by its primary key.
   * Returns undefined if not found.
   * @param {string} storeName
   * @param {string} id
   */
  function get (storeName, id) {
    return _promisify(_store(storeName, 'readonly').get(id))
  }

  /**
   * Get all records in a store.
   * Returns an empty array if the store is empty.
   * @param {string} storeName
   */
  function getAll (storeName) {
    return _promisify(_store(storeName, 'readonly').getAll())
  }

  /**
   * Delete a single record by its primary key.
   * @param {string} storeName
   * @param {string} id
   */
  function remove (storeName, id) {
    return _promisify(_store(storeName, 'readwrite').delete(id))
  }

  /**
   * Delete all records in a store.
   * @param {string} storeName
   */
  function clear (storeName) {
    return _promisify(_store(storeName, 'readwrite').clear())
  }

  /**
   * Count all records in a store.
   * @param {string} storeName
   */
  function count (storeName) {
    return _promisify(_store(storeName, 'readonly').count())
  }

  // ─── Index queries ────────────────────────────────────────────────────────────

  /**
   * Get all records matching an index value.
   * e.g. DB.getByIndex('leads', 'status', 'New Lead')
   * @param {string} storeName
   * @param {string} indexName
   * @param {*} value
   */
  function getByIndex (storeName, indexName, value) {
    const store = _store(storeName, 'readonly')
    const index = store.index(indexName)
    return _promisify(index.getAll(value))
  }

  /**
   * Get all records where index value is within a range.
   * e.g. DB.getByRange('leads', 'followUpDate', IDBKeyRange.upperBound(today))
   * @param {string} storeName
   * @param {string} indexName
   * @param {IDBKeyRange} range
   */
  function getByRange (storeName, indexName, range) {
    const store = _store(storeName, 'readonly')
    const index = store.index(indexName)
    return _promisify(index.getAll(range))
  }

  /**
   * Get all records sorted by an index.
   * @param {string} storeName
   * @param {string} indexName
   * @param {'next'|'prev'} direction  'next' = ascending, 'prev' = descending
   */
  function getAllSorted (storeName, indexName, direction = 'next') {
    return new Promise((resolve, reject) => {
      const store   = _store(storeName, 'readonly')
      const index   = store.index(indexName)
      const results = []

      const request = index.openCursor(null, direction)

      request.onsuccess = (event) => {
        const cursor = event.target.result
        if (cursor) {
          results.push(cursor.value)
          cursor.continue()
        } else {
          resolve(results)
        }
      }

      request.onerror = () => reject(request.error)
    })
  }

  // ─── Settings helpers ─────────────────────────────────────────────────────────

  /**
   * Get a setting value by key.
   * Returns undefined if the key doesn't exist.
   * @param {string} key
   */
  async function getSetting (key) {
    const record = await get('settings', key)
    return record ? record.value : undefined
  }

  /**
   * Set a setting value.
   * @param {string} key
   * @param {*} value
   */
  function setSetting (key, value) {
    return put('settings', { key, value })
  }

  /**
   * Delete a setting by key.
   * @param {string} key
   */
  function deleteSetting (key) {
    return remove('settings', key)
  }

  /**
   * Get all settings as a flat key→value object.
   */
  async function getAllSettings () {
    const records = await getAll('settings')
    return records.reduce((acc, { key, value }) => {
      acc[key] = value
      return acc
    }, {})
  }

  // ─── Bulk operations ──────────────────────────────────────────────────────────

  /**
   * Put multiple records in one transaction.
   * More efficient than calling put() in a loop.
   * @param {string} storeName
   * @param {object[]} records
   */
  function putMany (storeName, records) {
    return new Promise((resolve, reject) => {
      if (!_db) {
        reject(new Error('[Vesting DB] Database not initialised.'))
        return
      }

      const tx    = _db.transaction(storeName, 'readwrite')
      const store = tx.objectStore(storeName)

      records.forEach(record => store.put(record))

      tx.oncomplete = () => resolve()
      tx.onerror    = () => reject(tx.error)
      tx.onabort    = () => reject(tx.error)
    })
  }

  /**
   * Export all data from all stores as a plain object.
   * Used by settings.js for full JSON backup.
   * Returns: { leads: [...], contacts: [...], properties: [...], ... }
   */
  async function exportAll () {
    const result = {}
    for (const storeName of Object.keys(STORES)) {
      result[storeName] = await getAll(storeName)
    }
    return result
  }

  /**
   * Import data into all stores from a backup object.
   * Merges by default (put overwrites matching keys).
   * @param {object} data  — shape matching exportAll() output
   */
  async function importAll (data) {
    for (const [storeName, records] of Object.entries(data)) {
      if (STORES[storeName] && Array.isArray(records) && records.length > 0) {
        await putMany(storeName, records)
      }
    }
  }

  /**
   * Wipe everything — all stores cleared.
   * Used when agent resets passphrase and needs to re-import.
   */
  async function nukeAll () {
    for (const storeName of Object.keys(STORES)) {
      await clear(storeName)
    }
  }

  // ─── Storage estimate ─────────────────────────────────────────────────────────

  /**
   * Estimate storage used (bytes) via the Storage API.
   * Returns null if the API is unavailable.
   */
  async function storageEstimate () {
    if (!navigator.storage || !navigator.storage.estimate) return null
    try {
      const { usage, quota } = await navigator.storage.estimate()
      return { usage, quota }
    } catch {
      return null
    }
  }

  // ─── Public API ───────────────────────────────────────────────────────────────

  return {
    init,
    put,
    get,
    getAll,
    delete: remove,   // 'delete' is a reserved word — alias for remove
    clear,
    count,
    getByIndex,
    getByRange,
    getAllSorted,
    getSetting,
    setSetting,
    deleteSetting,
    getAllSettings,
    putMany,
    exportAll,
    importAll,
    nukeAll,
    storageEstimate,
    STORES            // expose schema for reference
  }

})()
