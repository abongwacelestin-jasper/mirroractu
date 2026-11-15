/**
 * Photographs for stories. Every image is a freely licensed file photo from Wikimedia Commons,
 * stored in /public/media, and is shown with its credit and licence. The list is generated:
 * see media.generated.ts. Stories without a photo fall back to their data graphic.
 */
import { MEDIA_LIST } from './media.generated'

export type Media = {
  /** Path under /public */
  src: string
  /** What the picture shows */
  alt: string
  /** Author or source to credit */
  credit: string
  licence: string
  /** The file's page on Wikimedia Commons */
  page: string
}

export const MEDIA: Record<string, Media> = MEDIA_LIST

export const storyMedia = (storyId: string): Media | undefined => MEDIA[storyId]

export type Video = Media & { title: string }

/** Videos attached to stories. Public-domain material only. */
export const VIDEOS: Record<string, Video> = {
  's-cop31': {
    src: '/media/global-temperature-1880-2022.webm',
    title: 'How global temperatures have changed since 1880',
    alt: 'World map animation: surface temperature compared with the 1951 to 1980 average, year by year from 1880 to 2022. Blue is cooler, red is warmer',
    credit: 'NASA Scientific Visualization Studio',
    licence: 'public domain',
    page: 'https://commons.wikimedia.org/wiki/File:Global_Temperature_Anomalies_from_1880_to_2022_(SVS5060_-_GISTEMP-2022-TemperatureAnomalyBothCelsiusFahrenheit).webm',
  },
}
