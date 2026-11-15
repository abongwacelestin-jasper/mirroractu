/**
 * Advertiser offers: where an advert's button leads. Every item here is paid placement, kept
 * apart from the newsroom, and is labelled as such on screen.
 *
 * The advertisers and prices below are placeholders until the ad server and partner feeds are
 * connected. Replace this file's data with the partner API; the pages only read these types.
 */
export type OfferCategoryId = 'flights' | 'stays' | 'events' | 'banking'

export type Offer = {
  id: string
  title: string
  detail: string
  /** Price or headline figure, e.g. "$189 return" */
  price: string
  /** Small print: dates, conditions */
  terms: string
}

export type Advertiser = {
  id: string
  name: string
  category: OfferCategoryId
  /** One line used in advert creatives */
  line: string
  /** Button text on adverts */
  cta: string
  /** Advert colours */
  bg: string
  fg: string
  accent: string
  offers: Offer[]
}

export const OFFER_CATEGORIES: { id: OfferCategoryId; name: string; blurb: string }[] = [
  { id: 'flights', name: 'Flights', blurb: 'Fares from airline partners.' },
  { id: 'stays', name: 'Stays', blurb: 'Lodges and hotels.' },
  { id: 'events', name: 'Events', blurb: 'Expos, conferences and tickets.' },
  { id: 'banking', name: 'Banking', blurb: 'Accounts and business services.' },
]

export const ADVERTISERS: Advertiser[] = [
  {
    id: 'kigali-business-expo',
    name: 'Kigali Business Expo',
    category: 'events',
    line: 'Three days, 400 exhibitors, one city. 3 to 5 December 2026.',
    cta: 'Register free',
    bg: '#E9E4D8',
    fg: '#0E1424',
    accent: '#0E1424',
    offers: [
      { id: 'expo-visitor', title: 'Visitor pass, all three days', detail: 'Entry to the exhibition halls and the open stage.', price: 'Free', terms: 'Register by 2 December 2026.' },
      { id: 'expo-forum', title: 'Trade forum seat', detail: 'One day of panels on regional trade and finance.', price: '$40', terms: '4 December 2026. Limited seats.' },
      { id: 'expo-stand', title: 'Exhibitor stand, 9 m²', detail: 'Shell stand with power, for small businesses.', price: 'From $650', terms: 'Bookings close 20 November 2026.' },
    ],
  },
  {
    id: 'akagera-air',
    name: 'Akagera Air',
    category: 'flights',
    line: 'Kigali to Nairobi from $189 return. Book by 30 November.',
    cta: 'See fares',
    bg: '#1A2236',
    fg: '#FFFFFF',
    accent: '#F2B441',
    offers: [
      { id: 'kgl-nbo', title: 'Kigali to Nairobi', detail: 'Daily, 1h 25m, direct.', price: '$189 return', terms: 'Book by 30 November 2026. Travel to 28 February 2027.' },
      { id: 'kgl-ebb', title: 'Kigali to Entebbe', detail: 'Twice daily, 55m, direct.', price: '$129 return', terms: 'Book by 30 November 2026.' },
      { id: 'kgl-jnb', title: 'Kigali to Johannesburg', detail: 'Four a week, 4h, direct.', price: '$420 return', terms: 'Book by 30 November 2026.' },
      { id: 'kgl-dar', title: 'Kigali to Dar es Salaam', detail: 'Daily, 1h 50m, direct.', price: '$210 return', terms: 'Book by 30 November 2026.' },
    ],
  },
  {
    id: 'imboni-bank',
    name: 'Imboni Bank',
    category: 'banking',
    line: 'Open a business account in ten minutes, from your phone.',
    cta: 'Open an account',
    bg: '#F4F1EA',
    fg: '#0E1424',
    accent: '#4A5166',
    offers: [
      { id: 'biz-account', title: 'Business current account', detail: 'Opened from your phone, with a card and online payments.', price: 'No monthly fee', terms: 'For the first 12 months. Fees apply after.' },
      { id: 'biz-savings', title: 'Business savings pot', detail: 'Set money aside for tax and pay.', price: 'Variable rate', terms: 'Rate set by the bank and may change.' },
    ],
  },
  {
    id: 'nyungwe-lodge',
    name: 'Nyungwe Lodge',
    category: 'stays',
    line: 'Rainforest weekends for two, breakfast included.',
    cta: 'Check dates',
    bg: '#C9D1DC',
    fg: '#0E1424',
    accent: '#0E1424',
    offers: [
      { id: 'weekend-two', title: 'Rainforest weekend for two', detail: 'Two nights in a forest-view room, breakfast included.', price: '$340', terms: 'Friday to Sunday. Subject to availability.' },
      { id: 'canopy-day', title: 'Canopy walk day visit', detail: 'Guided walk and lunch at the lodge.', price: '$85 a person', terms: 'Park fees not included.' },
    ],
  },
]

export const offersPath = (category?: OfferCategoryId) => (category ? `/offers/${category}` : '/offers')
export const advertisersIn = (category: OfferCategoryId) => ADVERTISERS.filter((a) => a.category === category)
