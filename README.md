# marketplace-payout-checker
Web tool to help a partner check when they can expect to get paid by Microsoft for a Microsoft Marketplace transaction

A single-page Angular app. Answer a few questions about a commercial marketplace transaction and get:

- the expected payout date (on or around the 15th of the month),
- when Microsoft invoices the customer (or CSP partner),
- when Microsoft is expected to collect payment, if the payout depends on it,
- a timeline and notes that explain the estimate.

The UI follows [Fluent 2](https://fluent2.microsoft.design/) design tokens (type ramp, color palette, spacing, corner radius, shadows) and supports light and dark themes.

## How the estimate works

The rules are based on the [Microsoft commercial marketplace payout policy](https://learn.microsoft.com/partner-center/marketplace-offers/payout-policy-details) and implemented in [`src/app/payout/payout-calculator.service.ts`](src/app/payout/payout-calculator.service.ts):

| How the customer buys | Microsoft invoices | Eligible for payout | Payout |
| --- | --- | --- | --- |
| Enterprise Agreement (EA) | After the end of the monthly or quarterly billing period | When invoiced (payout doesn't wait for collection) | ~15th of the month after eligibility |
| Microsoft Customer Agreement / pay-as-you-go, credit card | Early in the month after the transaction; card charged automatically | When the card is charged | ~15th of the month after eligibility |
| Microsoft Customer Agreement / pay-as-you-go, invoice | Early in the month after the transaction | When Microsoft receives payment (invoice date + payment terms) | ~15th of the month after eligibility |
| Cloud Solution Provider (CSP) | Microsoft invoices the CSP partner early in the month after the transaction | When Microsoft receives payment from the CSP partner | ~15th of the month after eligibility |

Results are estimates. Actual dates can vary. For the status of a specific transaction, check **Payouts** in Partner Center.

## Development

Requires Node.js 22.22.3+ or 24.15+ (see Angular version compatibility).

```bash
npm install
npm start          # dev server at http://localhost:4200
npm test -- --watch=false   # unit tests (Vitest)
npm run build      # production build in dist/
```
