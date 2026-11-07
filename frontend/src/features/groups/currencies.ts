/** The currencies offered when creating a group. The API accepts any ISO 4217 code; this list is only the menu. */
export const SUPPORTED_CURRENCIES = ['MAD', 'EUR', 'USD', 'GBP', 'SAR', 'AED', 'TND', 'DZD', 'EGP', 'CAD', 'CHF'] as const
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number]
export const DEFAULT_CURRENCY: SupportedCurrency = 'MAD'
