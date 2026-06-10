import { PaymentConfig } from './payment-config';
import { PatronFineContext } from './payment-context';
import { buildFormSgUrl, formatPaymentAmount } from './payment-url';

describe('buildFormSgUrl', () => {
  const config: PaymentConfig = {
    formBaseUrl: 'https://form.gov.sg/example-form-id',
    nameFieldId: 'name_field_id',
    patronIdFieldId: 'patron_id_field_id',
    amountFieldId: 'payment_amount_field_id',
    amountMultiplier: 100,
    buttonLabel: 'Pay via PayNow',
    openInSameTab: true,
  };

  const context: PatronFineContext = {
    patronName: 'Jane Tan & Co',
    patronId: 'P/123 45',
    fineAmount: 12.34,
  };

  it('builds a FormSG URL with encoded patron and fine values', () => {
    const paymentUrl = buildFormSgUrl(config, context);

    expect(paymentUrl).not.toBeNull();

    const parsedUrl = new URL(paymentUrl ?? '');
    expect(parsedUrl.searchParams.get(config.nameFieldId)).toBe(context.patronName);
    expect(parsedUrl.searchParams.get(config.patronIdFieldId)).toBe(context.patronId);
    expect(parsedUrl.searchParams.get(config.amountFieldId)).toBe('1234.00');
  });

  it('keeps existing query parameters from the configured FormSG URL', () => {
    const paymentUrl = buildFormSgUrl(
      {
        ...config,
        formBaseUrl: `${config.formBaseUrl}?source=primo`,
      },
      context,
    );

    expect(new URL(paymentUrl ?? '').searchParams.get('source')).toBe('primo');
  });

  it('returns null when config is incomplete', () => {
    expect(buildFormSgUrl({ ...config, nameFieldId: '' }, context)).toBeNull();
  });

  it('returns null when the fine amount is zero', () => {
    expect(buildFormSgUrl(config, { ...context, fineAmount: 0 })).toBeNull();
  });

  it('returns null when the FormSG URL is invalid', () => {
    expect(buildFormSgUrl({ ...config, formBaseUrl: 'not a url' }, context)).toBeNull();
  });
});

describe('formatPaymentAmount', () => {
  it('preserves the current cents-style amount conversion by default', () => {
    expect(formatPaymentAmount(12.34, 100)).toBe('1234.00');
  });

  it('rounds the converted amount before sending it to FormSG', () => {
    expect(formatPaymentAmount(12.345, 100)).toBe('1235.00');
  });
});
