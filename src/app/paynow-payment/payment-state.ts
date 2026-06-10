import { isPaymentConfigReady, PaymentConfig } from './payment-config';
import { isValidPatronFineContext, PatronFineContext } from './payment-context';
import { buildFormSgUrl } from './payment-url';

export type PaymentStateReason = 'ready' | 'missing-config' | 'missing-context' | 'no-fines';

export interface PaymentState {
  visible: boolean;
  paymentUrl: string | null;
  reason: PaymentStateReason;
}

export function getPaymentState(
  config: PaymentConfig,
  context: PatronFineContext | null,
): PaymentState {
  if (!isPaymentConfigReady(config)) {
    return {
      visible: false,
      paymentUrl: null,
      reason: 'missing-config',
    };
  }

  if (!context) {
    return {
      visible: false,
      paymentUrl: null,
      reason: 'missing-context',
    };
  }

  if (!isValidPatronFineContext(context)) {
    return {
      visible: false,
      paymentUrl: null,
      reason: context.fineAmount <= 0 ? 'no-fines' : 'missing-context',
    };
  }

  const paymentUrl = buildFormSgUrl(config, context);

  return {
    visible: Boolean(paymentUrl),
    paymentUrl,
    reason: paymentUrl ? 'ready' : 'missing-config',
  };
}
