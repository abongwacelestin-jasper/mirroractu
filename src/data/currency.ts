/**
 * Money by country: which currency each edition uses, and a built-in table of exchange rates
 * for when live rates cannot be fetched. This file imports nothing, so the API reads it too.
 */

/** Currency of each country edition (ISO 4217). Countries not listed, and the international edition, use US dollars. */
export const COUNTRY_CURRENCY: Record<string, string> = {
  RW: 'RWF', KE: 'KES', UG: 'UGX', TZ: 'TZS', BI: 'BIF', CD: 'CDF', ET: 'ETB', SD: 'SDG', SS: 'SSP', EG: 'EGP', MA: 'MAD',
  NG: 'NGN', GH: 'GHS', SN: 'XOF', CI: 'XOF', CM: 'XAF', ZA: 'ZAR', ZW: 'USD',
  GB: 'GBP', FR: 'EUR', DE: 'EUR', TR: 'TRY', US: 'USD', CA: 'CAD', BR: 'BRL',
  IN: 'INR', CN: 'CNY', JP: 'JPY', KR: 'KRW', AE: 'AED', AU: 'AUD', NZ: 'NZD',
}

export const CURRENCY_NAMES: Record<string, string> = {
  USD: 'US dollars', RWF: 'Rwandan francs', KES: 'Kenyan shillings', UGX: 'Ugandan shillings', TZS: 'Tanzanian shillings', BIF: 'Burundian francs',
  CDF: 'Congolese francs', ETB: 'Ethiopian birr', SDG: 'Sudanese pounds', SSP: 'South Sudanese pounds', EGP: 'Egyptian pounds', MAD: 'Moroccan dirhams',
  NGN: 'Nigerian naira', GHS: 'Ghanaian cedis', XOF: 'CFA francs (BCEAO)', XAF: 'CFA francs (BEAC)', ZAR: 'South African rand',
  GBP: 'pounds sterling', EUR: 'euros', TRY: 'Turkish lira', CAD: 'Canadian dollars', BRL: 'Brazilian reais', INR: 'Indian rupees',
  CNY: 'Chinese yuan', JPY: 'Japanese yen', KRW: 'South Korean won', AED: 'UAE dirhams', AUD: 'Australian dollars', NZD: 'New Zealand dollars',
}

export const currencyOf = (countryCode: string | undefined) => COUNTRY_CURRENCY[countryCode ?? ''] ?? 'USD'

/**
 * Units of each currency per one US dollar. Rough figures, used only when live rates are not
 * available; the site then says the conversion is from a built-in table.
 */
export const FALLBACK_RATES: Record<string, number> = {
  USD: 1, RWF: 1450, KES: 129, UGX: 3600, TZS: 2600, BIF: 2950, CDF: 2850, ETB: 150, SDG: 600, SSP: 4500, EGP: 50, MAD: 9.6,
  NGN: 1500, GHS: 12, XOF: 600, XAF: 600, ZAR: 18, GBP: 0.76, EUR: 0.9, TRY: 42, CAD: 1.38, BRL: 5.5, INR: 86,
  CNY: 7.2, JPY: 150, KRW: 1400, AED: 3.67, AUD: 1.52, NZD: 1.68,
}
