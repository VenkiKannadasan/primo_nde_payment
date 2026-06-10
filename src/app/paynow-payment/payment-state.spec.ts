import { PaymentConfig } from './payment-config';
import { PatronFineContext } from './payment-context';
import { getPaymentState } from './payment-state';

describe('getPaymentState', () => {
  const config: PaymentConfig = {
    formBaseUrl: 'https://form.gov.sg/example',
    nameFieldId: 'name',
    patronIdFieldId: 'patron',
    amountFieldId: 'amount',
    amountMultiplier: 100,
    buttonLabel: 'Pay via PayNow',
    openInSameTab: true,
  };

  const context: PatronFineContext = {
    patronName: 'Asha Kumar',
    patronId: 'A1234567',
    fineAmount: 15.5,
  };

  it('shows the payment button when config and fine context are valid', () => {
    const state = getPaymentState(config, context);

    expect(state.visible).toBeTrue();
    expect(state.reason).toBe('ready');
    expect(state.paymentUrl).toContain('https://form.gov.sg/example');
  });

  it('hides the button when runtime config is missing', () => {
    const state = getPaymentState({ ...config, formBaseUrl: '' }, context);

    expect(state.visible).toBeFalse();
    expect(state.reason).toBe('missing-config');
  });

  it('hides the button while patron fine context is unavailable', () => {
    const state = getPaymentState(config, null);

    expect(state.visible).toBeFalse();
    expect(state.reason).toBe('missing-context');
  });

  it('hides the button when the patron has no fines', () => {
    const state = getPaymentState(config, { ...context, fineAmount: 0 });

    expect(state.visible).toBeFalse();
    expect(state.reason).toBe('no-fines');
  });
});
