/**
 * Geography shared by the website and the API: the country editions, their regions and
 * languages, the time-zone map, and which countries each snapshot story is about.
 * This file imports nothing, so the API can read it too.
 */
export type Region = 'Africa' | 'Europe' | 'Asia' | 'Americas' | 'Oceania' | 'Middle East'

export type Country = {
  /** ISO 3166-1 alpha-2, or INT for the international edition */
  code: string
  name: string
  region?: Region
  /** Languages to suggest first, as translate codes. English is the source language. */
  langs: string[]
}

export const INTERNATIONAL: Country = { code: 'INT', name: 'International', langs: ['fr', 'es', 'ar'] }

export const COUNTRIES: Country[] = [
  INTERNATIONAL,
  { code: 'RW', name: 'Rwanda', region: 'Africa', langs: ['rw', 'fr', 'sw'] },
  { code: 'KE', name: 'Kenya', region: 'Africa', langs: ['sw'] },
  { code: 'UG', name: 'Uganda', region: 'Africa', langs: ['sw', 'lg'] },
  { code: 'TZ', name: 'Tanzania', region: 'Africa', langs: ['sw'] },
  { code: 'BI', name: 'Burundi', region: 'Africa', langs: ['fr', 'sw'] },
  { code: 'CD', name: 'DR Congo', region: 'Africa', langs: ['fr', 'sw', 'ln'] },
  { code: 'ET', name: 'Ethiopia', region: 'Africa', langs: ['am', 'om'] },
  { code: 'SD', name: 'Sudan', region: 'Africa', langs: ['ar'] },
  { code: 'SS', name: 'South Sudan', region: 'Africa', langs: ['ar'] },
  { code: 'EG', name: 'Egypt', region: 'Africa', langs: ['ar'] },
  { code: 'MA', name: 'Morocco', region: 'Africa', langs: ['ar', 'fr'] },
  { code: 'NG', name: 'Nigeria', region: 'Africa', langs: ['ha', 'yo', 'ig'] },
  { code: 'GH', name: 'Ghana', region: 'Africa', langs: ['ak'] },
  { code: 'SN', name: 'Senegal', region: 'Africa', langs: ['fr'] },
  { code: 'CI', name: 'Côte d’Ivoire', region: 'Africa', langs: ['fr'] },
  { code: 'CM', name: 'Cameroon', region: 'Africa', langs: ['fr'] },
  { code: 'ZA', name: 'South Africa', region: 'Africa', langs: ['zu', 'af', 'xh'] },
  { code: 'ZW', name: 'Zimbabwe', region: 'Africa', langs: ['sn'] },
  { code: 'GB', name: 'United Kingdom', region: 'Europe', langs: ['fr'] },
  { code: 'FR', name: 'France', region: 'Europe', langs: ['fr'] },
  { code: 'DE', name: 'Germany', region: 'Europe', langs: ['de'] },
  { code: 'TR', name: 'Türkiye', region: 'Europe', langs: ['tr'] },
  { code: 'US', name: 'United States', region: 'Americas', langs: ['es'] },
  { code: 'CA', name: 'Canada', region: 'Americas', langs: ['fr'] },
  { code: 'BR', name: 'Brazil', region: 'Americas', langs: ['pt'] },
  { code: 'IN', name: 'India', region: 'Asia', langs: ['hi'] },
  { code: 'CN', name: 'China', region: 'Asia', langs: ['zh-CN'] },
  { code: 'JP', name: 'Japan', region: 'Asia', langs: ['ja'] },
  { code: 'KR', name: 'South Korea', region: 'Asia', langs: ['ko'] },
  { code: 'AE', name: 'United Arab Emirates', region: 'Middle East', langs: ['ar'] },
  { code: 'AU', name: 'Australia', region: 'Oceania', langs: [] },
  { code: 'NZ', name: 'New Zealand', region: 'Oceania', langs: ['mi'] },
]

export const getCountry = (code: string | undefined) => COUNTRIES.find((c) => c.code === code) ?? INTERNATIONAL

/** IANA time zone to country, for the editions above. Used to detect a country without any network call. */
export const TIMEZONE_COUNTRY: Record<string, string> = {
  'Africa/Kigali': 'RW', 'Africa/Nairobi': 'KE', 'Africa/Kampala': 'UG', 'Africa/Dar_es_Salaam': 'TZ', 'Africa/Bujumbura': 'BI',
  'Africa/Kinshasa': 'CD', 'Africa/Lubumbashi': 'CD', 'Africa/Addis_Ababa': 'ET', 'Africa/Khartoum': 'SD', 'Africa/Juba': 'SS',
  'Africa/Cairo': 'EG', 'Africa/Casablanca': 'MA', 'Africa/Lagos': 'NG', 'Africa/Accra': 'GH', 'Africa/Dakar': 'SN',
  'Africa/Abidjan': 'CI', 'Africa/Douala': 'CM', 'Africa/Johannesburg': 'ZA', 'Africa/Harare': 'ZW',
  'Europe/London': 'GB', 'Europe/Paris': 'FR', 'Europe/Berlin': 'DE', 'Europe/Istanbul': 'TR',
  'America/New_York': 'US', 'America/Chicago': 'US', 'America/Denver': 'US', 'America/Los_Angeles': 'US', 'America/Phoenix': 'US', 'America/Anchorage': 'US',
  'America/Toronto': 'CA', 'America/Vancouver': 'CA', 'America/Edmonton': 'CA', 'America/Winnipeg': 'CA', 'America/Halifax': 'CA',
  'America/Sao_Paulo': 'BR', 'America/Manaus': 'BR', 'America/Fortaleza': 'BR',
  'Asia/Kolkata': 'IN', 'Asia/Calcutta': 'IN', 'Asia/Shanghai': 'CN', 'Asia/Tokyo': 'JP', 'Asia/Seoul': 'KR', 'Asia/Dubai': 'AE',
  'Australia/Sydney': 'AU', 'Australia/Melbourne': 'AU', 'Australia/Brisbane': 'AU', 'Australia/Perth': 'AU', 'Australia/Adelaide': 'AU',
  'Pacific/Auckland': 'NZ',
}

/** Countries each story is about. Stories with no entry are global or continent-wide. */
export const STORY_COUNTRIES: Record<string, string[]> = {
  's-cop31': ['TR'], 's-fossil': ['TR'], 's-agoa': ['RW', 'ZA', 'US'], 's-kigali': ['RW'], 's-nz': ['NZ'], 's-safrica': ['ZA'],
  's-egypt': ['EG'], 's-cafw': ['EG'], 's-sudan': ['SD'], 's-abyei': ['SD', 'SS'], 's-cholera': ['CD'], 's-tanzania': ['TZ'],
  's-zim': ['ZW'], 's-caf': ['NG'], 's-epl': ['GB'], 's-potential': ['GB'], 's-euai': ['FR', 'DE'],
  's-godzilla': ['US', 'CA', 'JP'], 's-fraud': ['US'], 's-nba': ['US'], 's-faa': ['US'], 's-hunger': ['US'], 's-unhr': ['US'],
  's-ms': ['US'], 's-openai': ['US'], 's-space': ['US'], 's-wyoming': ['US'], 's-cat': ['US'], 's-holiday': ['US'],
  's-asia': ['KR', 'JP'], 's-briefs': ['JP', 'IN'], 's-abb': ['CN', 'JP'], 's-ramayana': ['IN'],
}
