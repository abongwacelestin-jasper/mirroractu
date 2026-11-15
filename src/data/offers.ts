/**
 * Advertiser offers: where an advert's button leads. Every item here is paid placement, kept
 * apart from the newsroom, and is labelled as such on screen.
 *
 * The advertisers, prices and schedules are placeholders until the ad server and partner
 * feeds are connected: the reference facts (airports, time zones, places) are real, the
 * commercial terms are not. Replace this file's data with the partner API; the pages only
 * read these types.
 */
import type { Media } from './media'
import { MEDIA_LIST } from './media.generated'

export type OfferCategoryId = 'flights' | 'stays' | 'events' | 'banking'

export type Offer = {
  /** Also the last part of the offer's address: /offers/flights/kigali-to-nairobi */
  id: string
  title: string
  /** One line for cards */
  detail: string
  /** A paragraph for the offer page */
  about: string
  price: string
  /** What the price covers, e.g. "per person, return, taxes included" */
  priceNote: string
  /** Key facts as label / value pairs */
  facts: [string, string][]
  includes: string[]
  goodToKnow: string[]
  /** Dates and conditions */
  terms: string
  image: Media
}

export type Advertiser = {
  id: string
  name: string
  category: OfferCategoryId
  /** One line used in advert creatives */
  line: string
  about: string
  /** Button text on adverts */
  cta: string
  /** Advert colours */
  bg: string
  fg: string
  accent: string
  image: Media
  /** How buying works, in three steps */
  steps: [string, string][]
  offers: Offer[]
}

export const OFFER_CATEGORIES: { id: OfferCategoryId; name: string; blurb: string }[] = [
  { id: 'flights', name: 'Flights', blurb: 'Fares from airline partners, out of Kigali.' },
  { id: 'stays', name: 'Stays', blurb: 'Lodges, weekends away and day visits.' },
  { id: 'events', name: 'Events', blurb: 'Expos, forums and tickets.' },
  { id: 'banking', name: 'Banking', blurb: 'Accounts and services for small businesses.' },
]

const img = (name: string, alt: string, credit: string, licence: string, page: string): Media => ({ src: `/media/offers/${name}.jpg`, alt, credit, licence, page })

export const ADVERTISERS: Advertiser[] = [
  {
    id: 'akagera-air',
    name: 'Akagera Air',
    category: 'flights',
    line: 'Kigali to Nairobi from $189 return. Book by 30 November.',
    about: 'Direct flights from Kigali International Airport (KGL) to four cities in East and southern Africa. Fares below are return, per adult, with taxes and one checked bag.',
    cta: 'See fares',
    bg: '#1A2236',
    fg: '#FFFFFF',
    accent: '#F2B441',
    image: img('aircraft', 'An airliner taking off at sunset', 'Sardaka', 'CC BY-SA 4.0', "https://commons.wikimedia.org/wiki/File:(1)Kenso_Sunset_014.jpg"),
    steps: [
      ['Pick a route', 'Choose a destination and check the days it flies.'],
      ['Send your dates', 'Leave an email address and the airline replies with seats for your dates.'],
      ['Pay the airline', 'You book and pay with the airline. MirrorActu takes no part in the sale.'],
    ],
    offers: [
      {
        id: 'kigali-to-nairobi',
        title: 'Kigali to Nairobi',
        detail: 'Daily, 1h 25m, direct.',
        about: 'A morning flight to Kenya’s capital and an evening flight back, every day of the week. Nairobi is one hour ahead of Kigali.',
        price: '$189',
        priceNote: 'return, per adult, taxes included',
        facts: [['From', 'Kigali International (KGL)'], ['To', 'Jomo Kenyatta International, Nairobi (NBO)'], ['Flight time', '1h 25m, direct'], ['Flies', 'Daily'], ['Time difference', 'Nairobi is 1 hour ahead']],
        includes: ['One checked bag, 23 kg', 'One cabin bag, 7 kg', 'A drink and a snack on board'],
        goodToKnow: ['Fare is for economy and changes with demand.', 'Date changes carry a fee. Refunds are not included at this fare.', 'Check entry rules for Kenya before you book.'],
        terms: 'Book by 30 November 2026. Travel to 28 February 2027.',
        image: img('nairobi', 'The Nairobi skyline seen from Nairobi National Park', 'Timothy A. Gonsalves', 'CC BY-SA 4.0', "https://commons.wikimedia.org/wiki/File:Nairobi_Skyline_Savannah_Kenya_May19_R1600687.jpg"),
      },
      {
        id: 'kigali-to-entebbe',
        title: 'Kigali to Entebbe',
        detail: 'Twice daily, 55m, direct.',
        about: 'The short hop to Uganda’s main airport on the shore of Lake Victoria, with a morning and a late-afternoon flight. Entebbe is one hour ahead of Kigali.',
        price: '$129',
        priceNote: 'return, per adult, taxes included',
        facts: [['From', 'Kigali International (KGL)'], ['To', 'Entebbe International (EBB)'], ['Flight time', '55m, direct'], ['Flies', 'Twice daily'], ['Time difference', 'Entebbe is 1 hour ahead']],
        includes: ['One checked bag, 23 kg', 'One cabin bag, 7 kg'],
        goodToKnow: ['Entebbe airport is about an hour by road from central Kampala.', 'Date changes carry a fee.'],
        terms: 'Book by 30 November 2026.',
        image: img('entebbe', 'Lake Victoria from the air on the approach to Entebbe', 'Dave Proffer', 'CC BY 2.0', "https://commons.wikimedia.org/wiki/File:Landing_at_Entebbe,_Lake_Victoria_-_Flickr_-_Dave_Proffer.jpg"),
      },
      {
        id: 'kigali-to-johannesburg',
        title: 'Kigali to Johannesburg',
        detail: 'Four a week, 4h, direct.',
        about: 'The longest route on the network, to South Africa’s largest city. Johannesburg keeps the same time as Kigali, so there is no clock change.',
        price: '$420',
        priceNote: 'return, per adult, taxes included',
        facts: [['From', 'Kigali International (KGL)'], ['To', 'O. R. Tambo International, Johannesburg (JNB)'], ['Flight time', '4h, direct'], ['Flies', 'Four days a week'], ['Time difference', 'None']],
        includes: ['One checked bag, 23 kg', 'One cabin bag, 7 kg', 'A hot meal on board'],
        goodToKnow: ['Check visa rules for South Africa before you book.', 'Fare is for economy and changes with demand.'],
        terms: 'Book by 30 November 2026.',
        image: img('joburg', 'Johannesburg’s central business district', 'Evan Bench', 'CC BY 2.0', "https://commons.wikimedia.org/wiki/File:Johannesburg_CBD.jpg"),
      },
      {
        id: 'kigali-to-dar-es-salaam',
        title: 'Kigali to Dar es Salaam',
        detail: 'Daily, 1h 50m, direct.',
        about: 'A daily flight to Tanzania’s commercial capital on the Indian Ocean. Dar es Salaam is one hour ahead of Kigali.',
        price: '$210',
        priceNote: 'return, per adult, taxes included',
        facts: [['From', 'Kigali International (KGL)'], ['To', 'Julius Nyerere International, Dar es Salaam (DAR)'], ['Flight time', '1h 50m, direct'], ['Flies', 'Daily'], ['Time difference', 'Dar es Salaam is 1 hour ahead']],
        includes: ['One checked bag, 23 kg', 'One cabin bag, 7 kg', 'A drink and a snack on board'],
        goodToKnow: ['Ferries to Zanzibar leave from the city’s harbour.', 'Date changes carry a fee.'],
        terms: 'Book by 30 November 2026.',
        image: { ...MEDIA_LIST['s-tanzania'], alt: 'Dar es Salaam from above' },
      },
    ],
  },
  {
    id: 'nyungwe-lodge',
    name: 'Nyungwe Lodge',
    category: 'stays',
    line: 'Rainforest weekends for two, breakfast included.',
    about: 'A lodge on the edge of Nyungwe National Park in south-west Rwanda, one of the oldest rainforests in Africa and home to the country’s canopy walkway.',
    cta: 'Check dates',
    bg: '#C9D1DC',
    fg: '#0E1424',
    accent: '#0E1424',
    image: img('sunset', 'Sunrise over the hills of Nyungwe, Rwanda', 'Jonkmania', 'CC BY-SA 4.0', "https://commons.wikimedia.org/wiki/File:Sunrisenyungwe.jpg"),
    steps: [
      ['Pick a stay', 'A weekend for two, or a day visit with the canopy walk.'],
      ['Ask for dates', 'Leave an email address and the lodge confirms what is free.'],
      ['Pay the lodge', 'You book and pay with the lodge directly.'],
    ],
    offers: [
      {
        id: 'rainforest-weekend-for-two',
        title: 'Rainforest weekend for two',
        detail: 'Two nights in a forest-view room, breakfast included.',
        about: 'Arrive on Friday, leave on Sunday. Rooms face the forest, and the park’s trails start a short drive away.',
        price: '$340',
        priceNote: 'for two people, two nights',
        facts: [['Where', 'Nyungwe National Park, Rwanda'], ['Stay', 'Friday to Sunday, 2 nights'], ['Room', 'Double, forest view'], ['From Kigali', 'About 5 hours by road']],
        includes: ['Breakfast both mornings', 'Afternoon tea on arrival', 'Parking'],
        goodToKnow: ['Park entry and guided walks are paid to the park, not the lodge.', 'It is cool and wet at altitude: bring a rain jacket.', 'Subject to availability.'],
        terms: 'Friday to Sunday. Subject to availability.',
        image: img('forest', 'Rainforest in Nyungwe National Park, Rwanda', 'Brian Harries', 'CC BY 2.0', "https://commons.wikimedia.org/wiki/File:Nyungwe_Forest_NP_20150928-DSCF4880.jpg"),
      },
      {
        id: 'canopy-walk-day-visit',
        title: 'Canopy walk day visit',
        detail: 'Guided walk and lunch at the lodge.',
        about: 'A day out built around the suspended walkway through the treetops, with lunch at the lodge afterwards.',
        price: '$85',
        priceNote: 'per person',
        facts: [['Where', 'Nyungwe National Park, Rwanda'], ['Length', 'A full day, around 6 hours'], ['Walk', 'Guided, moderate, some steep steps'], ['Group', 'Up to 8 people']],
        includes: ['Lunch at the lodge', 'A guide from the lodge to the trailhead', 'Tea and coffee'],
        goodToKnow: ['Park fees are not included.', 'Wear walking shoes with grip.', 'Not suitable for young children.'],
        terms: 'Park fees not included. Daily, weather permitting.',
        image: img('canopy', 'A canopy walkway through rainforest in Rwanda', 'Alex Niragira', 'CC BY-SA 4.0', "https://commons.wikimedia.org/wiki/File:Nyungwe_Inside_Canopy_Walk.jpg"),
      },
    ],
  },
  {
    id: 'kigali-business-expo',
    name: 'Kigali Business Expo',
    category: 'events',
    line: 'Three days, 400 exhibitors, one city. 3 to 5 December 2026.',
    about: 'A three-day trade exhibition in Kigali for companies selling across East Africa, with a one-day forum on regional trade and finance.',
    cta: 'Register free',
    bg: '#E9E4D8',
    fg: '#0E1424',
    accent: '#0E1424',
    image: MEDIA_LIST['s-kigali'],
    steps: [
      ['Choose a pass', 'A free visitor pass, a forum seat or a stand.'],
      ['Register', 'Leave an email address and the organiser sends your confirmation.'],
      ['Collect your badge', 'Bring photo ID to the registration desk on the day.'],
    ],
    offers: [
      {
        id: 'visitor-pass',
        title: 'Visitor pass, all three days',
        detail: 'Entry to the exhibition halls and the open stage.',
        about: 'Walk the halls, meet exhibitors and sit in on the open-stage talks on any of the three days.',
        price: 'Free',
        priceNote: 'registration required',
        facts: [['When', '3 to 5 December 2026'], ['Hours', '09:00 to 18:00'], ['Where', 'Kigali'], ['Exhibitors', '400']],
        includes: ['Entry on all three days', 'Open-stage talks', 'The exhibitor directory'],
        goodToKnow: ['Bring photo ID to collect your badge.', 'The trade forum is ticketed separately.'],
        terms: 'Register by 2 December 2026.',
        image: img('street', 'A street in central Kigali', 'Emmanuelkwizera', 'CC BY-SA 4.0', "https://commons.wikimedia.org/wiki/File:High_Angle_View_Of_Kigali_City_Street_on_November_29,_2018._Emmanuel_Kwizera.jpg"),
      },
      {
        id: 'trade-forum-seat',
        title: 'Trade forum seat',
        detail: 'One day of panels on regional trade and finance.',
        about: 'A day of panels and questions on selling across borders, payments and trade finance, with lunch for delegates.',
        price: '$40',
        priceNote: 'per person',
        facts: [['When', '4 December 2026'], ['Hours', '09:30 to 16:30'], ['Format', 'Panels and audience questions'], ['Seats', 'Limited']],
        includes: ['A seat at every session', 'Lunch and coffee', 'A visitor pass for all three days'],
        goodToKnow: ['Sessions are in English, with French interpretation.', 'Seats are not transferable after 1 December.'],
        terms: '4 December 2026. Limited seats.',
        image: img('forum', 'An audience at a conference session', 'Gangulybiswarup', 'CC BY 4.0', "https://commons.wikimedia.org/wiki/File:Audience_-_Panel_Discussion_On_AI_Open_Knowledge_Platforms_And_Technology_-_WikiConference_India_2026_-_Kochi_2026-09-05_04068.jpg"),
      },
      {
        id: 'exhibitor-stand',
        title: 'Exhibitor stand, 9 m²',
        detail: 'Shell stand with power, for small businesses.',
        about: 'A ready-built stand for a small business showing for the first time, with your company name on the fascia.',
        price: 'From $650',
        priceNote: 'for three days',
        facts: [['Size', '3 m × 3 m'], ['Built with', 'Walls, fascia, carpet, one power socket'], ['Passes', 'Three exhibitor badges'], ['Set-up', '2 December 2026']],
        includes: ['Shell stand and fascia name', 'One table and two chairs', 'A listing in the exhibitor directory'],
        goodToKnow: ['Corner positions cost more.', 'Extra furniture and lighting are hired separately.'],
        terms: 'Bookings close 20 November 2026.',
        image: img('dusk', 'Central Kigali at dusk', 'Adrien K', 'CC BY 2.0', "https://commons.wikimedia.org/wiki/File:Kigali2018.jpg"),
      },
    ],
  },
  {
    id: 'imboni-bank',
    name: 'Imboni Bank',
    category: 'banking',
    line: 'Open a business account in ten minutes, from your phone.',
    about: 'Accounts for sole traders and small companies, opened and run from a phone.',
    cta: 'Open an account',
    bg: '#F4F1EA',
    fg: '#0E1424',
    accent: '#4A5166',
    image: img('phone', 'A banking app on a smartphone', 'Torsten Dettlaff', 'CC BY-SA 4.0', "https://commons.wikimedia.org/wiki/File:Banca_m%C3%B3vil.jpg"),
    steps: [
      ['Check you qualify', 'For registered businesses and sole traders in Rwanda.'],
      ['Leave your details', 'The bank emails a link to start the application.'],
      ['Apply with the bank', 'Identity checks and the account itself are between you and the bank.'],
    ],
    offers: [
      {
        id: 'business-current-account',
        title: 'Business current account',
        detail: 'Opened from your phone, with a card and online payments.',
        about: 'An everyday account for takings and bills, with a debit card and payments from the app.',
        price: 'No monthly fee',
        priceNote: 'for the first 12 months',
        facts: [['For', 'Sole traders and small companies'], ['Opened', 'On your phone, about 10 minutes'], ['Comes with', 'Debit card and app'], ['You need', 'ID and your business registration']],
        includes: ['A debit card', 'Payments and transfers in the app', 'Monthly statements'],
        goodToKnow: ['A monthly fee applies after the first 12 months.', 'Accounts are subject to the bank’s checks and approval.', 'This is an advert, not financial advice.'],
        terms: 'For the first 12 months. Fees apply after.',
        image: img('form', 'Filling in an account application form', 'USAID', 'public domain', "https://commons.wikimedia.org/wiki/File:Mobile_banking_form_(5494590033).jpg"),
      },
      {
        id: 'business-savings-pot',
        title: 'Business savings pot',
        detail: 'Set money aside for tax and pay.',
        about: 'A separate pot beside the current account for money you must not spend, such as tax and wages.',
        price: 'Variable rate',
        priceNote: 'set by the bank',
        facts: [['For', 'Current account holders'], ['Access', 'Instant, from the app'], ['Minimum', 'None'], ['Rate', 'Variable']],
        includes: ['Unlimited transfers to and from your account', 'Named pots, such as “Tax” or “Wages”'],
        goodToKnow: ['The rate is set by the bank and may change.', 'This is an advert, not financial advice.'],
        terms: 'Rate set by the bank and may change.',
        image: { ...img('phone', 'A banking app on a smartphone', 'Torsten Dettlaff', 'CC BY-SA 4.0', "https://commons.wikimedia.org/wiki/File:Banca_m%C3%B3vil.jpg") },
      },
    ],
  },
]

export const offersPath = (category?: OfferCategoryId) => (category ? `/offers/${category}` : '/offers')
/** /offers/flights/kigali-to-nairobi */
export const offerPath = (advertiser: Advertiser, offer: Offer) => `/offers/${advertiser.category}/${offer.id}`
export const advertisersIn = (category: OfferCategoryId) => ADVERTISERS.filter((a) => a.category === category)
export const allOffers = () => ADVERTISERS.flatMap((advertiser) => advertiser.offers.map((offer) => ({ advertiser, offer })))
export const findOffer = (category: string | undefined, offerId: string | undefined) => allOffers().find((x) => x.advertiser.category === category && x.offer.id === offerId)
