/**
 * Vesting — South African tax/rate constants
 * ─────────────────────────────────────────────────────────────────────────
 * This file exists ONLY to hold numbers that change when SARS / SARB
 * updates official rates. Nothing else in the app should be touched to
 * apply a rate change — edit the values below, bump `lastVerified`, and
 * redeploy. Keeping this isolated means updating rates can never
 * accidentally break the calculator's actual math logic in calculator.html.
 *
 * HOW TO UPDATE:
 *   1. Check the source URL for the current official table.
 *   2. Update the `brackets` (or `defaultRate`) below.
 *   3. Update `lastVerified` to today's date.
 *   4. Commit + push — Cloudflare Pages redeploys automatically.
 *
 * WHEN TO CHECK:
 *   - Transfer duty brackets: reviewed annually, usually announced at the
 *     National Budget Speech (February) and effective from 1 March or
 *     1 April. Check every year around March.
 *   - Prime lending rate: can change after any SARB Monetary Policy
 *     Committee meeting (roughly every 2 months). This is just a starting
 *     default for the bond calculator — agents should already be
 *     overriding it with the client's actual quoted rate, but keeping the
 *     default roughly current avoids it looking obviously wrong.
 */

const TaxRates = {

  transferDuty: {
    lastVerified: '2026-09-11',
    sourceUrl: 'https://www.sars.gov.za/tax-rates/transfer-duty/',
    note: 'SARS transfer duty brackets for natural persons, effective 1 April 2025.',
    // Marginal brackets — only the portion of the price within each
    // bracket is taxed at that bracket's rate (same principle as income tax).
    brackets: [
      { floor: 0,          rate: 0.00 },
      { floor: 1210000,    rate: 0.03 },
      { floor: 1663800,    rate: 0.06 },
      { floor: 2329300,    rate: 0.08 },
      { floor: 2994800,    rate: 0.11 },
      { floor: 13310000,   rate: 0.13 }
    ]
  },

  primeLendingRate: {
    lastVerified: '2026-09-11',
    sourceUrl: 'https://www.resbank.co.za/en/home/what-we-do/monetary-policy/decisions',
    note: 'Used only as the bond calculator\'s default starting rate — always editable per client.',
    ratePct: 10.50
  }

}
