import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { map } from 'rxjs';
import { PayoutCalculatorService, parseIsoDate } from './payout/payout-calculator.service';
import {
  EaBillingFrequency,
  PAYOUT_POLICY_URL,
  PaymentMethod,
  PayoutQuestionnaire,
  PurchaseAgreement,
} from './payout/payout.models';

interface Option<T> {
  value: T;
  label: string;
  description: string;
}

function toIsoDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

@Component({
  imports: [ReactiveFormsModule, DatePipe],
  selector: 'app-root',
  templateUrl: './app.html',
})
export class App {
  private readonly calculator = inject(PayoutCalculatorService);
  private readonly fb = inject(FormBuilder);

  protected readonly policyUrl = PAYOUT_POLICY_URL;

  protected readonly agreements: Option<PurchaseAgreement>[] = [
    {
      value: 'ea',
      label: 'Enterprise Agreement (EA)',
      description: 'Organization buys through a volume licensing EA enrollment.',
    },
    {
      value: 'mca',
      label: 'Microsoft Customer Agreement (MCA)',
      description: 'Organization buys directly from Microsoft under an MCA billing account.',
    },
    {
      value: 'payg',
      label: 'Pay-as-you-go (online)',
      description:
        'Self-serve Azure subscription bought online (Microsoft Online Subscription Program).',
    },
    {
      value: 'csp',
      label: 'Cloud Solution Provider (CSP)',
      description: 'Customer buys through a CSP partner, whom Microsoft invoices.',
    },
  ];

  protected readonly paymentMethods: Option<PaymentMethod>[] = [
    {
      value: 'creditCard',
      label: 'Credit or debit card',
      description: 'Card on file is charged automatically when the invoice is generated.',
    },
    {
      value: 'invoice',
      label: 'Invoice (check or wire transfer)',
      description: 'Customer pays the invoice by its due date.',
    },
  ];

  protected readonly eaFrequencies: Option<EaBillingFrequency>[] = [
    { value: 'monthly', label: 'Monthly', description: 'Invoiced after the end of each month.' },
    {
      value: 'quarterly',
      label: 'Quarterly',
      description: 'Invoiced after the end of each quarter.',
    },
  ];

  protected readonly paymentTermsOptions = [30, 45, 60, 90];

  protected readonly form = this.fb.nonNullable.group({
    transactionDate: [toIsoDate(new Date()), Validators.required],
    agreement: this.fb.nonNullable.control<PurchaseAgreement | ''>('', Validators.required),
    paymentMethod: this.fb.nonNullable.control<PaymentMethod>('creditCard'),
    eaBillingFrequency: this.fb.nonNullable.control<EaBillingFrequency>('monthly'),
    paymentTermsDays: [30],
    payoutProfileComplete: [true],
  });

  private readonly formValue = toSignal(
    this.form.valueChanges.pipe(map(() => this.form.getRawValue())),
    { initialValue: this.form.getRawValue() },
  );

  protected readonly agreement = computed(() => this.formValue().agreement);
  protected readonly showPaymentMethod = computed(
    () => this.agreement() === 'mca' || this.agreement() === 'payg',
  );
  protected readonly showPaymentTerms = computed(
    () =>
      this.agreement() === 'csp' ||
      (this.showPaymentMethod() && this.formValue().paymentMethod === 'invoice'),
  );
  protected readonly transactionDateInvalid = computed(
    () => parseIsoDate(this.formValue().transactionDate) === null,
  );

  protected readonly submitted = signal(false);

  protected readonly estimate = computed(() => {
    const value = this.formValue();
    if (!this.submitted() || !value.agreement) {
      return null;
    }
    return this.calculator.estimate({
      ...value,
      agreement: value.agreement,
    } as PayoutQuestionnaire);
  });

  constructor() {
    this.form.controls.agreement.valueChanges.subscribe((agreement) => {
      // CSP partners typically have longer payment terms than direct customers.
      this.form.controls.paymentTermsDays.setValue(agreement === 'csp' ? 60 : 30);
    });
  }

  protected onSubmit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.transactionDateInvalid()) {
      this.submitted.set(false);
      return;
    }
    this.submitted.set(true);
  }

  protected onReset(): void {
    this.submitted.set(false);
    this.form.reset();
  }
}
