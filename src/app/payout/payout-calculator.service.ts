import { Injectable } from '@angular/core';
import { PayoutEstimate, PayoutQuestionnaire, TimelineStep } from './payout.models';

/** Microsoft generates monthly invoices around this day of the month. */
export const INVOICE_DAY_OF_MONTH = 5;
/** Microsoft issues Marketplace payouts on or around this day of the month. */
export const PAYOUT_DAY_OF_MONTH = 15;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Parses a `YYYY-MM-DD` string into a local date. Returns `null` for invalid input.
 */
export function parseIsoDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '');
  if (!match) {
    return null;
  }
  const [year, month, day] = [Number(match[1]), Number(match[2]) - 1, Number(match[3])];
  const date = new Date(year, month, day);
  if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) {
    return null;
  }
  return date;
}

function addMonths(date: Date, months: number, day: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, day);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function wholeDaysBetween(from: Date, to: Date): number {
  const start = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const end = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((end - start) / MS_PER_DAY);
}

function formatMonth(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

/**
 * Estimates when Microsoft pays a publisher for a commercial marketplace transaction, based on the
 * Microsoft payout policy:
 *
 * - Microsoft invoices customers (or CSP partners) after the end of the billing period.
 * - Enterprise Agreement transactions become eligible for payout once the customer is invoiced.
 * - All other transactions become eligible for payout once Microsoft collects payment.
 * - Payouts are issued on or around the 15th of the month following the month the transaction
 *   became eligible.
 */
@Injectable({ providedIn: 'root' })
export class PayoutCalculatorService {
  estimate(input: PayoutQuestionnaire, today: Date = new Date()): PayoutEstimate | null {
    const transactionDate = parseIsoDate(input.transactionDate);
    if (!transactionDate) {
      return null;
    }

    const notes: string[] = [];
    const steps: TimelineStep[] = [
      {
        kind: 'transaction',
        title: 'Transaction',
        date: transactionDate,
        description: 'Customer purchases, renews, or consumes your Marketplace offer.',
        approximate: false,
      },
    ];

    let invoiceDate: Date;
    let paymentDate: Date | null = null;
    let eligibleDate: Date;

    switch (input.agreement) {
      case 'ea': {
        if (input.eaBillingFrequency === 'quarterly') {
          const quarterEndMonth = Math.floor(transactionDate.getMonth() / 3) * 3 + 2;
          const quarterEnd = new Date(transactionDate.getFullYear(), quarterEndMonth, 1);
          invoiceDate = addMonths(quarterEnd, 1, INVOICE_DAY_OF_MONTH);
          notes.push(
            "Quarterly billing is assumed to follow calendar quarters. If the customer's Enterprise Agreement enrollment uses a different quarter, the invoice and payout shift accordingly.",
          );
        } else {
          invoiceDate = addMonths(transactionDate, 1, INVOICE_DAY_OF_MONTH);
        }
        eligibleDate = invoiceDate;
        steps.push({
          kind: 'invoice',
          title: 'Microsoft invoices the customer',
          date: invoiceDate,
          description: `Charges are included on the customer's ${input.eaBillingFrequency} Enterprise Agreement invoice in ${formatMonth(invoiceDate)}. For Enterprise Agreement customers, the transaction is eligible for payout once it's invoiced — Microsoft doesn't wait to collect payment.`,
          approximate: true,
        });
        break;
      }
      case 'csp': {
        invoiceDate = addMonths(transactionDate, 1, INVOICE_DAY_OF_MONTH);
        paymentDate = addDays(invoiceDate, input.paymentTermsDays);
        eligibleDate = paymentDate;
        steps.push(
          {
            kind: 'invoice',
            title: 'Microsoft invoices the CSP partner',
            date: invoiceDate,
            description: `Microsoft invoices the Cloud Solution Provider partner in ${formatMonth(invoiceDate)} for the previous month's charges.`,
            approximate: true,
          },
          {
            kind: 'payment',
            title: 'CSP partner pays Microsoft',
            date: paymentDate,
            description: `Payment is due ${input.paymentTermsDays} days after the invoice. The transaction is eligible for payout once Microsoft receives the payment.`,
            approximate: true,
          },
        );
        break;
      }
      case 'mca':
      case 'payg':
      default: {
        const agreementName =
          input.agreement === 'mca' ? 'Microsoft Customer Agreement' : 'pay-as-you-go';
        invoiceDate = addMonths(transactionDate, 1, INVOICE_DAY_OF_MONTH);
        if (input.paymentMethod === 'creditCard') {
          paymentDate = invoiceDate;
          steps.push({
            kind: 'invoice',
            title: 'Microsoft invoices and charges the customer',
            date: invoiceDate,
            description: `The customer's ${agreementName} invoice is generated in ${formatMonth(invoiceDate)} and the credit card on file is charged automatically. The transaction is eligible for payout once the charge succeeds.`,
            approximate: true,
          });
        } else {
          paymentDate = addDays(invoiceDate, input.paymentTermsDays);
          steps.push(
            {
              kind: 'invoice',
              title: 'Microsoft invoices the customer',
              date: invoiceDate,
              description: `The customer's ${agreementName} invoice is generated in ${formatMonth(invoiceDate)}.`,
              approximate: true,
            },
            {
              kind: 'payment',
              title: 'Customer pays the invoice',
              date: paymentDate,
              description: `Payment is due ${input.paymentTermsDays} days after the invoice (check or wire transfer). The transaction is eligible for payout once Microsoft receives the payment.`,
              approximate: true,
            },
          );
        }
        eligibleDate = paymentDate;
        break;
      }
    }

    const payoutDate = addMonths(eligibleDate, 1, PAYOUT_DAY_OF_MONTH);
    steps.push({
      kind: 'payout',
      title: 'Microsoft pays you',
      date: payoutDate,
      description: `Payouts are issued on or around the ${PAYOUT_DAY_OF_MONTH}th of the month after the transaction becomes eligible. Depending on your bank, funds may take a few more business days to arrive.`,
      approximate: true,
    });

    const dependsOnCollection = input.agreement !== 'ea';
    if (dependsOnCollection) {
      notes.push(
        'This payout depends on Microsoft collecting payment. If the customer pays late, or a payment fails, the payout moves to the month after Microsoft actually receives the payment.',
      );
    }
    if (!input.payoutProfileComplete) {
      notes.push(
        'Your payout and tax profiles must be complete and verified in Partner Center before Microsoft can release payouts. Earnings are held until they are.',
      );
    }
    if (wholeDaysBetween(today, payoutDate) < 0) {
      notes.push(
        'This estimated payout date has already passed. Check Payouts in Partner Center to see the status of this transaction.',
      );
    }
    notes.push(
      'Recurring subscriptions and metered usage are billed per billing period. Each period is a separate transaction with its own payout date.',
    );

    return {
      payoutDate,
      invoiceDate,
      paymentDate: dependsOnCollection ? paymentDate : null,
      dependsOnCollection,
      daysFromTransaction: wholeDaysBetween(transactionDate, payoutDate),
      steps,
      notes,
    };
  }
}
