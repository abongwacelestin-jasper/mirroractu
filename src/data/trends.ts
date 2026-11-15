/**
 * Today's trends: the subjects MirrorActu is following most closely, and the videos that go
 * with them. Ranking is done in live/trends.ts from how many stories are filed on a subject
 * and how active it is on the wire. It is our coverage, not audience numbers: there is no
 * analytics behind this yet.
 */
import type { CategoryId } from './index'
import type { Video } from './media'

export type TrendTopic = {
  id: string
  label: string
  /** Search term for "all stories on this" */
  query: string
  cat: CategoryId
  /** Stories on this subject, lead story first */
  storyIds: string[]
}

export const TREND_TOPICS: TrendTopic[] = [
  { id: 'cop31', label: 'COP31', query: 'cop31', cat: 'climate', storyIds: ['s-cop31', 's-fossil', 's-adapt', 's-kigali'] },
  { id: 'ai', label: 'AI money and rules', query: 'ai', cat: 'tech', storyIds: ['s-fraud', 's-openai', 's-euai', 's-wyoming', 's-potential', 's-asia'] },
  { id: 'elections', label: 'Elections', query: 'election', cat: 'world', storyIds: ['s-nz', 's-safrica', 's-abyei'] },
  { id: 'agoa', label: 'AGOA and trade', query: 'agoa', cat: 'africa', storyIds: ['s-agoa'] },
  { id: 'box-office', label: 'Box office', query: 'box office', cat: 'culture', storyIds: ['s-godzilla', 's-ramayana', 's-cat', 's-hunger', 's-holiday'] },
  { id: 'african-football', label: 'African football', query: 'caf', cat: 'sport', storyIds: ['s-afcon', 's-cafw', 's-caf'] },
  { id: 'health', label: 'Health emergencies', query: 'who', cat: 'health', storyIds: ['s-cholera', 's-hiv', 's-food', 's-sudan'] },
  { id: 'markets', label: 'Oil and markets', query: 'oil', cat: 'business', storyIds: ['s-oil', 's-asia', 's-briefs', 's-ms'] },
  { id: 'space', label: 'Space launches', query: 'blue origin', cat: 'tech', storyIds: ['s-space'] },
  { id: 'leagues', label: 'Premier League and NBA', query: 'premier league', cat: 'sport', storyIds: ['s-epl', 's-nba'] },
]

export type TrendVideo = Video & {
  id: string
  topicId: string
  storyId: string
  /** Length, seconds */
  seconds: number
}

const commons = (file: string) => `https://commons.wikimedia.org/wiki/File:${file}`

/** Trending videos. All are public domain or Creative Commons, stored in /public/media. */
export const TREND_VIDEOS: TrendVideo[] = [
  {
    id: 'climate-spiral',
    topicId: 'cop31',
    storyId: 's-cop31',
    title: 'The climate spiral: every month since 1880',
    alt: 'Animated spiral of monthly global temperature from 1880, widening and turning red as the world warms',
    src: '/media/climate-spiral.webm',
    poster: '/media/climate-spiral.poster.jpg',
    seconds: 70,
    credit: 'NASA Scientific Visualization Studio',
    licence: 'public domain',
    page: commons('1880-_Global_warming_climate_spiral_-_NASA_GISTEMP.webm'),
  },
  {
    id: 'new-glenn-launch',
    topicId: 'space',
    storyId: 's-space',
    title: 'New Glenn lifts off from Cape Canaveral',
    alt: 'File footage: a New Glenn rocket launching at night from Space Launch Complex 36, January 2025',
    src: '/media/new-glenn-launch.webm',
    poster: '/media/new-glenn-launch.poster.jpg',
    seconds: 39,
    credit: 'US Space Force / Robert Mason',
    licence: 'public domain',
    page: commons('New_Glenn_launches_from_Space_Launch_Complex_36_(949823).webm'),
  },
  {
    id: 'global-temperature',
    topicId: 'cop31',
    storyId: 's-adapt',
    title: 'How global temperatures have changed since 1880',
    alt: 'World map animation of surface temperature against the 1951 to 1980 average, year by year to 2022',
    src: '/media/global-temperature-1880-2022.webm',
    poster: '/media/global-temperature-1880-2022.poster.jpg',
    seconds: 30,
    credit: 'NASA Scientific Visualization Studio',
    licence: 'public domain',
    page: commons('Global_Temperature_Anomalies_from_1880_to_2022_(SVS5060_-_GISTEMP-2022-TemperatureAnomalyBothCelsiusFahrenheit).webm'),
  },
  {
    id: 'earth-flyover',
    topicId: 'cop31',
    storyId: 's-fossil',
    title: 'Earth from orbit: Pacific to Atlantic in a minute',
    alt: 'Time-lapse from the International Space Station passing over a cloudy Earth',
    src: '/media/earth-flyover.webm',
    poster: '/media/earth-flyover.poster.jpg',
    seconds: 58,
    credit: 'NASA / Nick Hague',
    licence: 'public domain',
    page: commons('Time-lapse_Earth_Flyover_from_NASA_Astronaut_in_Space.webm'),
  },
  {
    id: 'cinema-projector',
    topicId: 'box-office',
    storyId: 's-godzilla',
    title: 'Inside the projection booth',
    alt: 'File footage: a 35mm cinema projector running in a projection booth in Brussels',
    src: '/media/cinema-projector.webm',
    poster: '/media/cinema-projector.poster.jpg',
    seconds: 26,
    credit: 'Gaëlle Courtois / La Fonderie',
    licence: 'CC BY 3.0',
    page: commons('Cinemeccanica_projector_Victoria_9_running.webm'),
  },
]

export const formatSeconds = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`
