import { TestBed } from '@angular/core/testing';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
    }).compileComponents();
  });

  async function render() {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  function setDate(el: HTMLElement, value: string) {
    const input = el.querySelector<HTMLInputElement>('#transactionDate')!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  function choose(el: HTMLElement, name: string, value: string) {
    el.querySelector<HTMLInputElement>(`#${name}-${value}`)!.click();
  }

  function submit(el: HTMLElement) {
    el.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
  }

  it('should render the title and an empty result', async () => {
    const { el } = await render();
    expect(el.querySelector('h1')?.textContent).toContain('When will I get paid?');
    expect(el.querySelector('.card--empty')).toBeTruthy();
  });

  it('shows a validation error when no agreement is selected', async () => {
    const { fixture, el } = await render();
    submit(el);
    await fixture.whenStable();
    expect(el.querySelector('.field__error')?.textContent).toContain(
      'Select how the customer bought',
    );
    expect(el.querySelector('.payout-date')).toBeNull();
  });

  it('only asks EA billing frequency for Enterprise Agreement customers', async () => {
    const { fixture, el } = await render();
    choose(el, 'agreement', 'ea');
    await fixture.whenStable();
    expect(el.querySelector('input[name="eaBillingFrequency"]')).toBeTruthy();
    expect(el.querySelector('input[name="paymentMethod"]')).toBeNull();
    expect(el.querySelector('#paymentTermsDays')).toBeNull();
  });

  it('asks payment terms for invoiced MCA customers', async () => {
    const { fixture, el } = await render();
    choose(el, 'agreement', 'mca');
    await fixture.whenStable();
    expect(el.querySelector('#paymentTermsDays')).toBeNull();
    choose(el, 'paymentMethod', 'invoice');
    await fixture.whenStable();
    expect(el.querySelector('#paymentTermsDays')).toBeTruthy();
  });

  it('shows the expected payout date and timeline after submitting', async () => {
    const { fixture, el } = await render();
    setDate(el, '2026-01-20');
    choose(el, 'agreement', 'ea');
    submit(el);
    await fixture.whenStable();
    expect(el.querySelector('.payout-date')?.textContent).toContain('March 15, 2026');
    expect(el.querySelectorAll('.timeline__item').length).toBe(3);
  });

  it('updates the estimate when answers change after submitting', async () => {
    const { fixture, el } = await render();
    setDate(el, '2026-01-20');
    choose(el, 'agreement', 'csp');
    submit(el);
    await fixture.whenStable();
    expect(el.querySelector('.payout-date')?.textContent).toContain('May 15, 2026');

    choose(el, 'agreement', 'payg');
    await fixture.whenStable();
    expect(el.querySelector('.payout-date')?.textContent).toContain('March 15, 2026');
  });
});
