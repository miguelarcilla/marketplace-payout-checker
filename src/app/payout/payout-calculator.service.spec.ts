import { TestBed } from '@angular/core/testing';
import { PayoutCalculatorService, parseIsoDate } from './payout-calculator.service';
import { PayoutQuestionnaire } from './payout.models';

function ymd(date: Date | null): string | null {
  if (!date) {
    return null;
  }
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

describe('parseIsoDate', () => {
  it('parses valid dates as local dates', () => {
    expect(ymd(parseIsoDate('2026-02-28'))).toBe('2026-02-28');
  });

  it('rejects invalid input', () => {
    expect(parseIsoDate('')).toBeNull();
    expect(parseIsoDate('2026-02-30')).toBeNull();
    expect(parseIsoDate('02/01/2026')).toBeNull();
  });
});

describe('PayoutCalculatorService', () => {
  let service: PayoutCalculatorService;
  const today = new Date(2026, 0, 1);
  const base: PayoutQuestionnaire = {
    transactionDate: '2026-01-20',
    agreement: 'mca',
    paymentMethod: 'creditCard',
    eaBillingFrequency: 'monthly',
    paymentTermsDays: 30,
    payoutProfileComplete: true,
  };

  beforeEach(() => {
    service = TestBed.inject(PayoutCalculatorService);
  });

  it('returns null for an invalid transaction date', () => {
    expect(service.estimate({ ...base, transactionDate: 'nope' }, today)).toBeNull();
  });

  it('pays EA (monthly) transactions the month after invoicing, without waiting for collection', () => {
    const result = service.estimate({ ...base, agreement: 'ea' }, today)!;
    expect(ymd(result.invoiceDate)).toBe('2026-02-05');
    expect(result.paymentDate).toBeNull();
    expect(result.dependsOnCollection).toBe(false);
    expect(ymd(result.payoutDate)).toBe('2026-03-15');
    expect(result.steps.map((s) => s.kind)).toEqual(['transaction', 'invoice', 'payout']);
  });

  it('invoices EA (quarterly) transactions after the end of the calendar quarter', () => {
    const result = service.estimate(
      { ...base, agreement: 'ea', eaBillingFrequency: 'quarterly', transactionDate: '2026-02-10' },
      today,
    )!;
    expect(ymd(result.invoiceDate)).toBe('2026-04-05');
    expect(ymd(result.payoutDate)).toBe('2026-05-15');
  });

  it('handles EA quarterly transactions in the last quarter of the year', () => {
    const result = service.estimate(
      { ...base, agreement: 'ea', eaBillingFrequency: 'quarterly', transactionDate: '2026-11-30' },
      today,
    )!;
    expect(ymd(result.invoiceDate)).toBe('2027-01-05');
    expect(ymd(result.payoutDate)).toBe('2027-02-15');
  });

  it('pays credit card transactions the month after the card is charged', () => {
    const result = service.estimate(base, today)!;
    expect(ymd(result.invoiceDate)).toBe('2026-02-05');
    expect(ymd(result.paymentDate)).toBe('2026-02-05');
    expect(result.dependsOnCollection).toBe(true);
    expect(ymd(result.payoutDate)).toBe('2026-03-15');
    expect(result.daysFromTransaction).toBe(54);
  });

  it('pays invoiced MCA transactions the month after the customer pays', () => {
    const result = service.estimate({ ...base, paymentMethod: 'invoice' }, today)!;
    expect(ymd(result.paymentDate)).toBe('2026-03-07');
    expect(ymd(result.payoutDate)).toBe('2026-04-15');
    expect(result.steps.map((s) => s.kind)).toEqual([
      'transaction',
      'invoice',
      'payment',
      'payout',
    ]);
  });

  it('applies longer payment terms to invoiced pay-as-you-go customers', () => {
    const result = service.estimate(
      { ...base, agreement: 'payg', paymentMethod: 'invoice', paymentTermsDays: 60 },
      today,
    )!;
    expect(ymd(result.paymentDate)).toBe('2026-04-06');
    expect(ymd(result.payoutDate)).toBe('2026-05-15');
  });

  it('pays CSP transactions after Microsoft collects from the CSP partner', () => {
    const result = service.estimate({ ...base, agreement: 'csp', paymentTermsDays: 60 }, today)!;
    expect(ymd(result.invoiceDate)).toBe('2026-02-05');
    expect(ymd(result.paymentDate)).toBe('2026-04-06');
    expect(ymd(result.payoutDate)).toBe('2026-05-15');
    expect(result.steps[1].title).toContain('CSP partner');
  });

  it('rolls over into the next year', () => {
    const result = service.estimate({ ...base, transactionDate: '2026-12-31' }, today)!;
    expect(ymd(result.invoiceDate)).toBe('2027-01-05');
    expect(ymd(result.payoutDate)).toBe('2027-02-15');
  });

  it('warns when the payout profile is incomplete', () => {
    const result = service.estimate({ ...base, payoutProfileComplete: false }, today)!;
    expect(result.notes.some((n) => n.includes('payout and tax profiles'))).toBe(true);
  });

  it('notes when the estimated payout date has already passed', () => {
    const result = service.estimate(base, new Date(2026, 5, 1))!;
    expect(result.notes.some((n) => n.includes('already passed'))).toBe(true);
    const future = service.estimate(base, today)!;
    expect(future.notes.some((n) => n.includes('already passed'))).toBe(false);
  });
});
