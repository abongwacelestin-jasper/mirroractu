/** "COP31 opens in Antalya…" → "cop31-opens-in-antalya". The same rule the website uses for story addresses. */
export function slugify(text: string) {
  const base = text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’'‘]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (base.length <= 72) return base
  const cut = base.slice(0, 72)
  return cut.slice(0, cut.lastIndexOf('-'))
}
