export type StoreConfiguration = {
  checkoutEnabled: boolean;
  razorpayKeyId: string;
  razorpayKeySecret: string;
  razorpayWebhookSecret: string;
  razorpayMode: string;
  shippingFeePaise: number;
  taxRateBasisPoints: number;
  storeName: string;
};

function configuredInteger(value: string | undefined): number | undefined {
  if (!value || !/^\d+$/.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

export function readStoreConfiguration(environment: NodeJS.ProcessEnv = process.env): StoreConfiguration {
  return {
    checkoutEnabled: environment.CHECKOUT_ENABLED === 'true',
    razorpayKeyId: environment.RAZORPAY_KEY_ID ?? '',
    razorpayKeySecret: environment.RAZORPAY_KEY_SECRET ?? '',
    razorpayWebhookSecret: environment.RAZORPAY_WEBHOOK_SECRET ?? '',
    razorpayMode: environment.RAZORPAY_MODE ?? '',
    shippingFeePaise: configuredInteger(environment.SHIPPING_FEE_PAISE) ?? -1,
    taxRateBasisPoints: configuredInteger(environment.TAX_RATE_BPS) ?? -1,
    storeName: environment.STORE_NAME?.trim() ?? '',
  };
}

export function publicStoreConfiguration(environment: NodeJS.ProcessEnv = process.env) {
  return {
    name: environment.STORE_NAME?.trim() || null,
    legalName: environment.STORE_LEGAL_NAME?.trim() || null,
    address: environment.STORE_ADDRESS?.trim() || null,
    contactEmail: environment.STORE_CONTACT_EMAIL?.trim() || null,
    contactPhone: environment.STORE_CONTACT_PHONE?.trim() || null,
    shippingPolicyUrl: environment.SHIPPING_POLICY_URL?.trim() || null,
    returnsPolicyUrl: environment.RETURNS_POLICY_URL?.trim() || null,
    privacyPolicyUrl: environment.PRIVACY_POLICY_URL?.trim() || null,
    termsPolicyUrl: environment.TERMS_POLICY_URL?.trim() || null,
  };
}

export function checkoutUnavailableReasons(environment: NodeJS.ProcessEnv = process.env): string[] {
  const configuration = readStoreConfiguration(environment);
  const missing: string[] = [];
  missing.push('Pending-payment inventory reservations do not have an automated expiry and reconciliation process.');
  if (!configuration.checkoutEnabled) missing.push('Checkout has not been explicitly enabled.');
  if (!configuration.razorpayKeyId || !configuration.razorpayKeySecret || !configuration.razorpayWebhookSecret) {
    missing.push('Razorpay credentials and webhook secret are not fully configured.');
  }
  if (!['test', 'live'].includes(configuration.razorpayMode)) {
    missing.push('Razorpay mode must be explicitly set to test or live.');
  }
  if (configuration.razorpayMode === 'test' && configuration.razorpayKeyId
    && !configuration.razorpayKeyId.startsWith('rzp_test_')) {
    missing.push('The configured Razorpay key ID is not a test-mode key.');
  }
  if (configuration.razorpayMode === 'live') {
    if (environment.ENABLE_LIVE_PAYMENTS !== 'true' || environment.NODE_ENV !== 'production') {
      missing.push('Live payments require an explicit production-only ENABLE_LIVE_PAYMENTS=true setting.');
    }
    if (!configuration.razorpayKeyId.startsWith('rzp_live_')) {
      missing.push('The configured Razorpay key ID is not a live-mode key.');
    }
  }
  if (!configuration.storeName) missing.push('The genuine store name has not been configured.');
  if (!environment.STORE_LEGAL_NAME?.trim()) missing.push('The genuine registered business name has not been configured.');
  if (!environment.STORE_ADDRESS?.trim()) missing.push('The verified business contact address has not been configured.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(environment.STORE_CONTACT_EMAIL?.trim() ?? '')) {
    missing.push('A valid store contact email has not been configured.');
  }
  if (!/^[+\d][\d\s()+.-]{6,24}$/.test(environment.STORE_CONTACT_PHONE?.trim() ?? '')) {
    missing.push('A valid store contact phone has not been configured.');
  }
  for (const variable of ['SHIPPING_POLICY_URL', 'RETURNS_POLICY_URL', 'PRIVACY_POLICY_URL', 'TERMS_POLICY_URL']) {
    const value = environment[variable]?.trim();
    if (!value) {
      missing.push(`Store configuration ${variable} is missing.`);
    } else {
      try {
        const url = new URL(value);
        const localHttpAllowed = environment.NODE_ENV !== 'production'
          && url.protocol === 'http:'
          && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
        if (url.protocol !== 'https:' && !localHttpAllowed) missing.push(`${variable} must be an HTTPS URL.`);
      } catch {
        missing.push(`${variable} must be a valid HTTPS URL.`);
      }
    }
  }
  if (configuration.shippingFeePaise < 0) missing.push('A verified shipping fee in paise has not been configured.');
  if (configuration.taxRateBasisPoints < 0 || configuration.taxRateBasisPoints > 10000) {
    missing.push('A verified tax rate in basis points has not been configured.');
  }
  return missing;
}
