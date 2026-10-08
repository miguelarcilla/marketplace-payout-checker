/** How the customer purchased the Marketplace offer from Microsoft. */
export type PurchaseAgreement = 'ea' | 'mca' | 'payg' | 'csp';

/** How a Microsoft Customer Agreement or pay-as-you-go customer pays Microsoft. */
export type PaymentMethod = 'creditCard' | 'invoice';

/** How often Microsoft invoices an Enterprise Agreement customer for Marketplace charges. */
export type EaBillingFrequency = 'monthly' | 'quarterly';

export interface PayoutQuestionnaire {
  /** Date of the purchase, renewal or usage, formatted as `YYYY-MM-DD`. */
  transactionDate: string;
  agreement: PurchaseAgreement;
  /** Only used for `mca` and `payg` agreements. */
  paymentMethod: PaymentMethod;
  /** Only used for `ea` agreements. */
  eaBillingFrequency: EaBillingFrequency;
  /** Days the customer (or CSP partner) has to pay an invoice. Only used when Microsoft must collect an invoice payment. */
  paymentTermsDays: number;
  /** Whether the publisher's payout and tax profiles are complete in Partner Center. */
  payoutProfileComplete: boolean;
}

export type TimelineStepKind = 'transaction' | 'invoice' | 'payment' | 'payout';

export interface TimelineStep {
  kind: TimelineStepKind;
  title: string;
  date: Date;
  description: string;
  /** True when the date is an estimate rather than a fixed date. */
  approximate: boolean;
}

export interface PayoutEstimate {
  /** Expected payout date (on or around the 15th of the month). */
  payoutDate: Date;
  /** Date Microsoft is expected to invoice the customer (or CSP partner). */
  invoiceDate: Date;
  /** Expected date Microsoft collects payment, or `null` when payout does not depend on collection. */
  paymentDate: Date | null;
  /** Whether the payout waits for Microsoft to collect payment from the customer. */
  dependsOnCollection: boolean;
  /** Whole days between the transaction and the expected payout. */
  daysFromTransaction: number;
  steps: TimelineStep[];
  notes: string[];
}

export const PAYOUT_POLICY_URL =
  'https://learn.microsoft.com/partner-center/marketplace-offers/payout-policy-details';
