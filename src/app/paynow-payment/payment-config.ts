export interface PaymentConfig {
  formBaseUrl: string;
  nameFieldId: string;
  patronIdFieldId: string;
  amountFieldId: string;
  amountMultiplier: number;
  buttonLabel: string;
  openInSameTab: boolean;
}

export const DEFAULT_PAYMENT_CONFIG: PaymentConfig = {
  formBaseUrl: '',
  nameFieldId: '',
  patronIdFieldId: '',
  amountFieldId: '',
  amountMultiplier: 1,
  buttonLabel: 'Pay via PayNow',
  openInSameTab: true,
};

export function normalizePaymentConfig(rawConfig: unknown): PaymentConfig {
  const config = toRecord(rawConfig);

  return {
    formBaseUrl: readString(config, 'formBaseUrl', DEFAULT_PAYMENT_CONFIG.formBaseUrl),
    nameFieldId: readString(config, 'nameFieldId', DEFAULT_PAYMENT_CONFIG.nameFieldId),
    patronIdFieldId: readString(config, 'patronIdFieldId', DEFAULT_PAYMENT_CONFIG.patronIdFieldId),
    amountFieldId: readString(config, 'amountFieldId', DEFAULT_PAYMENT_CONFIG.amountFieldId),
    amountMultiplier: readNumber(config, 'amountMultiplier', DEFAULT_PAYMENT_CONFIG.amountMultiplier),
    buttonLabel: readString(config, 'buttonLabel', DEFAULT_PAYMENT_CONFIG.buttonLabel),
    openInSameTab: readBoolean(config, 'openInSameTab', DEFAULT_PAYMENT_CONFIG.openInSameTab),
  };
}

export function isPaymentConfigReady(config: PaymentConfig): boolean {
  return Boolean(
    config.formBaseUrl.trim()
    && config.nameFieldId.trim()
    && config.patronIdFieldId.trim()
    && config.amountFieldId.trim()
    && Number.isFinite(config.amountMultiplier)
    && config.amountMultiplier > 0
  );
}

function toRecord(value: unknown): Record<string, unknown> {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

function readString(config: Record<string, unknown>, key: string, fallback: string): string {
  const value = config[key];

  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }

  return fallback;
}

function readNumber(config: Record<string, unknown>, key: string, fallback: number): number {
  const value = config[key];

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsedValue = Number(value);
    return Number.isFinite(parsedValue) ? parsedValue : fallback;
  }

  return fallback;
}

function readBoolean(config: Record<string, unknown>, key: string, fallback: boolean): boolean {
  const value = config[key];

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalizedValue = value.trim().toLowerCase();

    if (normalizedValue === 'true') {
      return true;
    }

    if (normalizedValue === 'false') {
      return false;
    }
  }

  return fallback;
}
