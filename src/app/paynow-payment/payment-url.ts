import { isPaymentConfigReady, PaymentConfig } from './payment-config';
import { isValidPatronFineContext, PatronFineContext } from './payment-context';

export function buildFormSgUrl(
  config: PaymentConfig,
  context: PatronFineContext | null,
): string | null {
  if (!isPaymentConfigReady(config) || !context || !isValidPatronFineContext(context)) {
    return null;
  }

  try {
    const paymentUrl = new URL(config.formBaseUrl);

    paymentUrl.searchParams.set(config.nameFieldId, context.patronName);
    paymentUrl.searchParams.set(config.patronIdFieldId, context.patronId);
    paymentUrl.searchParams.set(
      config.amountFieldId,
      formatPaymentAmount(context.fineAmount, config.amountMultiplier),
    );

    return paymentUrl.toString();
  } catch {
    return null;
  }
}

export function formatPaymentAmount(fineAmount: number, amountMultiplier: number): string {
  return (Math.round(fineAmount * amountMultiplier * 100) / 100).toFixed(2);
}
