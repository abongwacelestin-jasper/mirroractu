/**
 * The dashboard's 3D view: the world as a globe, with every reader request drawn as it happens.
 *
 * Each request leaves the country it came from, arcs above the globe and lands on the server.
 * Its colour says what it was (a page, a story, a click, a search). Countries warm up as they
 * get busy and cool down again. When the site is quiet, the last 24 hours are replayed, clearly
 * marked as a replay, so the picture is never empty.
 *
 * It is drawn on a plain canvas with its own small 3D maths (rotate, project, hide what is
 * behind the globe), so the dashboard carries no 3D library. Everything it shows is also in
 * words beside it: counts by kind, the busiest countries, and a list of the latest requests.
 *
 * Nothing here identifies a reader. A request is a kind, a page and a country.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Maximize2, Pause, Play, RotateCcw } from 'lucide-react'

import { ApiError, api } from '@/lib/api'
import { DetailModal, Event, Pick, TYPE, clock, countryName, describe } from './engagement'
import { GLOBE } from './globe.generated'
import { useLive, useLiveStatus, usePresence } from './live'
import { Btn, Notice } from './ui'

type Kind = Event['type']
type Config = { server: { lat: number; lon: number; label: string; known: boolean }; recent: Event[]; today: { requests: number; readers: number; countries: number; medianSeconds: number | null } }
type V = [number, number, number]

/** One colour per kind of request. Checked for colour-blind separation; each is also named in the legend. */
const COLOR: Record<Kind, string> = { page: '#7fa8ff', view: '#f2b441', click: '#ff5a36', search: '#4fd1a5' }
const KINDS: [Kind, string][] = [['page', 'Pages'], ['view', 'Stories'], ['click', 'Clicks'], ['search', 'Searches']]
const INK = '#0e1424'
const DEG = Math.PI / 180

/* ---------- A little 3D ---------- */

const fromLonLat = (lon: number, lat: number): V => [Math.cos(lat * DEG) * Math.sin(lon * DEG), Math.sin(lat * DEG), Math.cos(lat * DEG) * Math.cos(lon * DEG)]
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
/** A point part of the way along the shortest path over the globe from a to b. */
function slerp(a: V, b: V, t: number): V {
  const angle = Math.acos(Math.max(-1, Math.min(1, dot(a, b))))
  if (angle < 1e-4) return a
  const s = Math.sin(angle)
  const p = Math.sin((1 - t) * angle) / s
  const q = Math.sin(t * angle) / s
  return [a[0] * p + b[0] * q, a[1] * p + b[1] * q, a[2] * p + b[2] * q]
}

// Country outlines as 3D points, worked out once.
const SHAPES = GLOBE.map(([code, name, lon, lat, rings]) => ({
  code,
  name,
  centre: fromLonLat(lon, lat),
  rings: rings.map((r) => {
    const out = new Float32Array((r.length / 2) * 3)
    for (let i = 0; i < r.length / 2; i++) out.set(fromLonLat(r[i * 2], r[i * 2 + 1]), i * 3)
    return out
  }),
}))
const CENTRE = new Map(SHAPES.map((s) => [s.code, s.centre]))

type Particle = { from: V; to: V; kind: Kind; t: number; speed: number; lift: number; outer: boolean; code: string | null }
type Pulse = { at: V; kind: Kind; age: number }

/* ---------- The view ---------- */

export function Universe() {
  const canvas = useRef<HTMLCanvasElement>(null)
  const frame = useRef<HTMLDivElement>(null)
  const [config, setConfig] = useState<Config | null>(null)
  const [error, setError] = useState('')
  const [paused, setPaused] = useState(false)
  const [replay, setReplay] = useState(true)
  const [mode, setMode] = useState<'live' | 'replay' | 'waiting'>('waiting')
  const [latest, setLatest] = useState<(Event & { replayed?: boolean })[]>([])
  const [counts, setCounts] = useState<Record<Kind, number>>({ page: 0, view: 0, click: 0, search: 0 })
  const [hot, setHot] = useState<[string, number][]>([])
  const [pick, setPick] = useState<Pick | null>(null)
  const presence = usePresence()
  const connection = useLiveStatus()
  const reduce = useMemo(() => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches, [])

  // Everything the animation needs between frames lives here, outside React's renders.
  const world = useRef({ yaw: -0.45, pitch: 0.28, zoom: 1, drag: null as null | { x: number; y: number; yaw: number; pitch: number; moved: boolean }, particles: [] as Particle[], pulses: [] as Pulse[], heat: new Map<string, number>(), arrivals: 0, lastLive: 0, serverGlow: 0, paused: false, hover: null as string | null })
  world.current.paused = paused

  useEffect(() => {
    api<Config>('/admin/universe').then(setConfig).catch((e: ApiError) => setError(e.message))
  }, [])
  const server = useMemo<V>(() => (config ? fromLonLat(config.server.lon, config.server.lat) : fromLonLat(4.9, 52.37)), [config])

  /** Put one request into the picture. */
  const launch = (e: Event, replayed = false) => {
    const w = world.current
    const centre = e.country ? CENTRE.get(e.country) : undefined
    // A request with no country arrives from outside the globe, not from a made-up place.
    const outer = !centre
    const a = Math.random() * Math.PI * 2
    const from: V = centre ? [centre[0] + (Math.random() - 0.5) * 0.02, centre[1] + (Math.random() - 0.5) * 0.02, centre[2] + (Math.random() - 0.5) * 0.02] : [Math.cos(a) * 0.9, 0.45, Math.sin(a) * 0.9]
    const spread = Math.acos(Math.max(-1, Math.min(1, dot(centre ?? server, server))))
    if (w.particles.length < 260) w.particles.push({ from, to: server, kind: e.type, t: 0, speed: 1 / (1.5 + spread * 0.7 + Math.random() * 0.4), lift: 0.1 + (spread / Math.PI) * 0.42, outer, code: e.country })
    if (centre) w.pulses.push({ at: centre, kind: e.type, age: 0 })
    if (e.country) w.heat.set(e.country, Math.min(1, (w.heat.get(e.country) ?? 0) + 0.28))
    if (!replayed) w.lastLive = performance.now()
    setLatest((l) => [{ ...e, replayed }, ...l].slice(0, 9))
    setCounts((c) => ({ ...c, [e.type]: c[e.type] + 1 }))
  }

  // Live: each batch from the API is spread over half a second so requests do not land as one.
  useLive(['events'], (m) => {
    if (m.t !== 'events') return
    setMode('live')
    ;(m.d.items as Event[]).forEach((e, i) => window.setTimeout(() => launch(e), i * 60))
  }, 0)

  // Replay: when nothing live has arrived for a while, play the last 24 hours on a loop.
  useEffect(() => {
    if (!config || !replay || config.recent.length === 0) return
    let i = 0
    const t = window.setInterval(() => {
      const w = world.current
      if (w.paused || performance.now() - w.lastLive < 9000) return
      setMode('replay')
      // One or two at a time, a few a second: the shape of the day, not its speed.
      for (let n = 0; n < (Math.random() < 0.3 ? 2 : 1); n++) launch(config.recent[i++ % config.recent.length], true)
    }, 520)
    return () => window.clearInterval(t)
  }, [config, replay])
  useEffect(() => {
    if (!replay) setMode((m) => (m === 'replay' ? 'waiting' : m))
  }, [replay])

  // The busiest countries in the picture right now, refreshed once a second.
  useEffect(() => {
    const t = window.setInterval(() => setHot([...world.current.heat.entries()].filter(([, v]) => v > 0.08).sort((a, b) => b[1] - a[1]).slice(0, 6)), 1000)
    return () => window.clearInterval(t)
  }, [])

  /* ---------- Drawing ---------- */
  useEffect(() => {
    const el = canvas.current
    const box = frame.current
    if (!el || !box) return
    const ctx = el.getContext('2d')!
    let width = 0
    let height = 0
    let raf = 0
    let last = performance.now()
    const stars = Array.from({ length: 220 }, () => ({ x: Math.random(), y: Math.random(), r: Math.random() * 1.2 + 0.2, a: Math.random() * 0.6 + 0.15, tw: Math.random() * 6 }))

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      width = box.clientWidth
      height = box.clientHeight
      el.width = Math.round(width * dpr)
      el.height = Math.round(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    const observer = new ResizeObserver(resize)
    observer.observe(box)
    resize()

    const draw = (now: number) => {
      const w = world.current
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      if (!w.paused && !w.drag && !reduce) w.yaw += dt * 0.09
      const R = Math.min(width, height) * 0.38 * w.zoom
      const cx = width / 2
      const cy = height / 2 + R * 0.04
      const cosY = Math.cos(w.yaw), sinY = Math.sin(w.yaw), cosP = Math.cos(w.pitch), sinP = Math.sin(w.pitch)
      /** Turn the globe, then flatten to the screen. z > 0 faces us. */
      const project = (x: number, y: number, z: number): V => {
        const x1 = x * cosY + z * sinY
        const z1 = -x * sinY + z * cosY
        return [cx + R * x1, cy - R * (y * cosP - z1 * sinP), y * sinP + z1 * cosP]
      }
      /** Behind the globe? (Facing away, and inside its outline as we see it.) */
      const hidden = (p: V) => p[2] < 0 && Math.hypot(p[0] - cx, p[1] - cy) < R * 0.995

      // Space
      ctx.fillStyle = '#070b16'
      ctx.fillRect(0, 0, width, height)
      for (const s of stars) {
        ctx.globalAlpha = s.a * (reduce ? 1 : 0.7 + 0.3 * Math.sin(now / 900 + s.tw))
        ctx.fillStyle = '#c9d1dc'
        ctx.beginPath()
        ctx.arc(((s.x * width - w.yaw * 14) % width + width) % width, s.y * height, s.r, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1

      // Atmosphere and ocean
      const glow = ctx.createRadialGradient(cx, cy, R * 0.96, cx, cy, R * 1.22)
      glow.addColorStop(0, 'rgba(127,168,255,0.28)')
      glow.addColorStop(1, 'rgba(127,168,255,0)')
      ctx.fillStyle = glow
      ctx.beginPath()
      ctx.arc(cx, cy, R * 1.22, 0, Math.PI * 2)
      ctx.fill()
      const sea = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R)
      sea.addColorStop(0, '#1b2a4a')
      sea.addColorStop(1, '#0b1224')
      ctx.fillStyle = sea
      ctx.beginPath()
      ctx.arc(cx, cy, R, 0, Math.PI * 2)
      ctx.fill()

      // Countries: clipped to the globe, the far side folded onto the rim so shapes stay closed.
      ctx.save()
      ctx.beginPath()
      ctx.arc(cx, cy, R, 0, Math.PI * 2)
      ctx.clip()
      ctx.lineWidth = 0.6
      ctx.lineJoin = 'round'
      for (const shape of SHAPES) {
        const heat = w.heat.get(shape.code) ?? 0
        for (const ring of shape.rings) {
          let front = false
          ctx.beginPath()
          for (let i = 0; i < ring.length; i += 3) {
            const p = project(ring[i], ring[i + 1], ring[i + 2])
            let x = p[0], y = p[1]
            if (p[2] > 0) front = true
            else {
              const d = Math.hypot(x - cx, y - cy) || 1
              x = cx + ((x - cx) / d) * R
              y = cy + ((y - cy) / d) * R
            }
            if (i === 0) ctx.moveTo(x, y)
            else ctx.lineTo(x, y)
          }
          if (!front) continue
          ctx.closePath()
          // Cool blue-grey at rest, warming towards the signal colour as requests arrive.
          ctx.fillStyle = heat > 0.02 ? `rgb(${Math.round(38 + 217 * heat)},${Math.round(52 + 38 * heat)},${Math.round(84 - 30 * heat)})` : shape.code === w.hover ? '#34466e' : '#26345a'
          ctx.fill()
          ctx.strokeStyle = 'rgba(174,184,198,0.28)'
          ctx.stroke()
        }
      }
      ctx.restore()
      // A soft shadow on the night side gives the ball its roundness.
      const shade = ctx.createRadialGradient(cx - R * 0.45, cy - R * 0.5, R * 0.2, cx, cy, R * 1.02)
      shade.addColorStop(0, 'rgba(0,0,0,0)')
      shade.addColorStop(1, 'rgba(3,6,14,0.55)')
      ctx.fillStyle = shade
      ctx.beginPath()
      ctx.arc(cx, cy, R, 0, Math.PI * 2)
      ctx.fill()

      // Pulses where requests start
      w.pulses = w.pulses.filter((p) => (p.age += dt) < 1.4)
      for (const p of w.pulses) {
        const s = project(p.at[0], p.at[1], p.at[2])
        if (s[2] <= 0) continue
        const k = p.age / 1.4
        ctx.strokeStyle = COLOR[p.kind]
        ctx.globalAlpha = (1 - k) * 0.9
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.arc(s[0], s[1], 3 + k * 16, 0, Math.PI * 2)
        ctx.stroke()
      }
      ctx.globalAlpha = 1

      // The server
      const sv = project(server[0], server[1], server[2])
      w.serverGlow = Math.max(0, w.serverGlow - dt * 1.6)
      if (sv[2] > 0) {
        const beat = reduce ? 0.5 : 0.5 + 0.5 * Math.sin(now / 420)
        const halo = ctx.createRadialGradient(sv[0], sv[1], 0, sv[0], sv[1], 22 + w.serverGlow * 22)
        halo.addColorStop(0, `rgba(255,255,255,${0.55 + w.serverGlow * 0.4})`)
        halo.addColorStop(1, 'rgba(255,255,255,0)')
        ctx.fillStyle = halo
        ctx.beginPath()
        ctx.arc(sv[0], sv[1], 22 + w.serverGlow * 22, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = `rgba(255,255,255,${0.35 + beat * 0.4})`
        ctx.lineWidth = 1.2
        ctx.beginPath()
        ctx.arc(sv[0], sv[1], 7 + beat * 4, 0, Math.PI * 2)
        ctx.stroke()
        ctx.fillStyle = '#ffffff'
        ctx.beginPath()
        ctx.arc(sv[0], sv[1], 3.5, 0, Math.PI * 2)
        ctx.fill()
        ctx.font = '600 11px ui-monospace, Menlo, monospace'
        ctx.fillStyle = 'rgba(255,255,255,0.9)'
        ctx.fillText(config && config.server.label.toLowerCase() !== 'server' ? `SERVER · ${config.server.label.toUpperCase()}` : 'SERVER', sv[0] + 14, sv[1] - 10)
      }

      // Requests in flight: a bright head and a fading tail along the arc.
      ctx.lineCap = 'round'
      const alive: Particle[] = []
      for (const p of w.particles) {
        if (!w.paused) p.t += dt * p.speed
        if (p.t >= 1) {
          w.serverGlow = Math.min(1, w.serverGlow + 0.35)
          w.arrivals++
          continue
        }
        alive.push(p)
        const at = (t: number): V => {
          const g = slerp(p.from, p.to, t)
          // Up and over: highest half-way. A request from outside comes down from further out.
          const h = 1 + p.lift * Math.sin(Math.PI * t) + (p.outer ? 0.55 * (1 - t) : 0)
          return project(g[0] * h, g[1] * h, g[2] * h)
        }
        let prev = at(Math.max(0, p.t - 0.16))
        for (let i = 1; i <= 8; i++) {
          const t = Math.max(0, p.t - 0.16 + (0.16 * i) / 8)
          const cur = at(t)
          if (!hidden(prev) && !hidden(cur)) {
            ctx.strokeStyle = COLOR[p.kind]
            ctx.globalAlpha = (i / 8) * 0.85
            ctx.lineWidth = 0.6 + (i / 8) * 1.8
            ctx.beginPath()
            ctx.moveTo(prev[0], prev[1])
            ctx.lineTo(cur[0], cur[1])
            ctx.stroke()
          }
          prev = cur
        }
        if (!hidden(prev)) {
          ctx.globalAlpha = 1
          ctx.fillStyle = '#ffffff'
          ctx.beginPath()
          ctx.arc(prev[0], prev[1], 1.8, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = COLOR[p.kind]
          ctx.globalAlpha = 0.35
          ctx.beginPath()
          ctx.arc(prev[0], prev[1], 5, 0, Math.PI * 2)
          ctx.fill()
        }
      }
      ctx.globalAlpha = 1
      w.particles = alive

      // Names of the busiest countries, on the side facing us.
      ctx.font = '600 11.5px ui-sans-serif, system-ui, sans-serif'
      for (const [code, v] of w.heat) {
        if (v > 0.2) {
          const c = CENTRE.get(code)
          if (!c) continue
          const s = project(c[0], c[1], c[2])
          if (s[2] > 0.15) {
            ctx.fillStyle = `rgba(255,255,255,${Math.min(1, 0.35 + v)})`
            ctx.fillText(countryName(code), s[0] + 7, s[1] + 4)
          }
        }
        // Countries cool down over about twenty seconds.
        const next = w.paused ? v : v * Math.pow(0.5, dt / 7)
        if (next < 0.01) w.heat.delete(code)
        else w.heat.set(code, next)
      }
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
    }
  }, [server, config, reduce])

  /* ---------- Turning it by hand, and picking a country ---------- */
  const nearest = (clientX: number, clientY: number): string | null => {
    const box = frame.current!.getBoundingClientRect()
    const w = world.current
    const R = Math.min(box.width, box.height) * 0.38 * w.zoom
    const cx = box.width / 2
    const cy = box.height / 2 + R * 0.04
    const cosY = Math.cos(w.yaw), sinY = Math.sin(w.yaw), cosP = Math.cos(w.pitch), sinP = Math.sin(w.pitch)
    let best: string | null = null
    let bestD = 26
    for (const s of SHAPES) {
      const [x, y, z] = s.centre
      const x1 = x * cosY + z * sinY
      const z1 = -x * sinY + z * cosY
      if (y * sinP + z1 * cosP <= 0) continue
      const d = Math.hypot(cx + R * x1 - (clientX - box.left), cy - R * (y * cosP - z1 * sinP) - (clientY - box.top))
      if (d < bestD) [best, bestD] = [s.code, d]
    }
    return best
  }
  const onDown = (e: React.PointerEvent) => {
    const w = world.current
    w.drag = { x: e.clientX, y: e.clientY, yaw: w.yaw, pitch: w.pitch, moved: false }
    ;(e.target as Element).setPointerCapture(e.pointerId)
  }
  const onMove = (e: React.PointerEvent) => {
    const w = world.current
    if (!w.drag) {
      w.hover = nearest(e.clientX, e.clientY)
      return
    }
    const dx = e.clientX - w.drag.x
    const dy = e.clientY - w.drag.y
    if (Math.abs(dx) + Math.abs(dy) > 4) w.drag.moved = true
    w.yaw = w.drag.yaw + dx * 0.006
    w.pitch = Math.max(-1.2, Math.min(1.2, w.drag.pitch + dy * 0.006))
  }
  const onUp = (e: React.PointerEvent) => {
    const w = world.current
    const moved = w.drag?.moved
    w.drag = null
    if (moved) return
    const code = nearest(e.clientX, e.clientY)
    if (code) setPick({ by: 'country', value: code, title: countryName(code) })
  }
  const onWheel = (e: React.WheelEvent) => {
    world.current.zoom = Math.max(0.7, Math.min(2.2, world.current.zoom * (e.deltaY > 0 ? 0.93 : 1.07)))
  }
  const turn = (dYaw: number, dPitch = 0) => {
    world.current.yaw += dYaw
    world.current.pitch = Math.max(-1.2, Math.min(1.2, world.current.pitch + dPitch))
  }

  if (error) return <Notice kind="error">{error}</Notice>
  const total = counts.page + counts.view + counts.click + counts.search
  const time = config?.today.medianSeconds
  const state = mode === 'live' ? ['Live', 'Requests are drawn as they happen.'] : mode === 'replay' ? ['Replay', 'The site is quiet, so the last 24 hours are being replayed. A live request takes over at once.'] : ['Waiting', connection === 'live' ? 'Connected. Waiting for the next reader.' : 'Reconnecting to live updates.']

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <div ref={frame} className="relative h-[min(74dvh,820px)] min-h-[440px] overflow-hidden bg-[#070b16] text-white">
        <canvas
          ref={canvas}
          role="img"
          tabIndex={0}
          aria-label={`A globe showing reader requests travelling from their countries to the server in ${config?.server.label ?? 'its region'}. ${state[0]}: ${state[1]} ${total} drawn so far. The same information is listed beside and below it. Use the arrow keys to turn the globe.`}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerLeave={() => (world.current.hover = null)}
          onWheel={onWheel}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') turn(-0.15)
            if (e.key === 'ArrowRight') turn(0.15)
            if (e.key === 'ArrowUp') turn(0, -0.12)
            if (e.key === 'ArrowDown') turn(0, 0.12)
            if (e.key === ' ') { e.preventDefault(); setPaused((p) => !p) }
          }}
          className="absolute inset-0 size-full cursor-grab touch-none outline-none focus-visible:ring-2 focus-visible:ring-signal active:cursor-grabbing"
        />

        {/* What we are looking at */}
        <div className="pointer-events-none absolute left-4 top-4 max-w-[min(360px,70%)] sm:left-6 sm:top-5">
          <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em]">
            <span className={`size-2 rounded-full ${mode === 'live' ? 'animate-pulse bg-[#4fd1a5]' : mode === 'replay' ? 'bg-dew' : 'bg-faint'}`} />
            <span role="status">{state[0]}</span>
          </p>
          <p className="mt-1 text-[12.5px] leading-snug text-mirror-light">{state[1]}</p>
        </div>

        {/* Controls */}
        <div className="absolute right-3 top-3 flex gap-1.5 sm:right-5 sm:top-4">
          {([[paused ? Play : Pause, paused ? 'Resume' : 'Pause', () => setPaused((p) => !p)], [RotateCcw, 'Face Africa again', () => { world.current.yaw = -0.45; world.current.pitch = 0.28; world.current.zoom = 1 }], [Maximize2, 'Full screen', () => (document.fullscreenElement ? document.exitFullscreen() : frame.current?.requestFullscreen?.())]] as [typeof Play, string, () => void][]).map(([Icon, label, run]) => (
            <button key={label} type="button" onClick={run} aria-label={label} title={label} className="flex size-10 items-center justify-center rounded-full border border-white/20 bg-white/5 text-white backdrop-blur transition-colors hover:bg-white/15"><Icon className="size-[18px]" /></button>
          ))}
        </div>

        {/* By kind */}
        <ul className="pointer-events-none absolute bottom-4 left-4 grid gap-1.5 sm:bottom-6 sm:left-6" aria-label="Requests drawn, by kind">
          {KINDS.map(([k, name]) => (
            <li key={k} className="flex items-center gap-2.5 text-[13px]">
              <span className="size-2.5 rounded-full" style={{ background: COLOR[k], boxShadow: `0 0 10px ${COLOR[k]}` }} />
              <span className="w-[68px] text-mirror-light">{name}</span>
              <b className="tabular-nums">{counts[k].toLocaleString('en')}</b>
            </li>
          ))}
          <li className="mt-1 flex items-center gap-2.5 border-t border-white/15 pt-1.5 text-[12px] text-mirror"><span className="size-2.5 rounded-full border border-white/60" /><span>From outside the globe: no country known</span></li>
        </ul>

        {/* Right now */}
        <div className="pointer-events-none absolute bottom-4 right-4 hidden w-[250px] sm:block sm:bottom-6 sm:right-6">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-right">
            <div><dt className="text-[11px] uppercase tracking-[0.1em] text-mirror">On the site now</dt><dd className="text-[30px] font-extrabold leading-none tracking-[-0.03em] tabular-nums">{presence ? presence.total.toLocaleString('en') : '–'}</dd></div>
            <div><dt className="text-[11px] uppercase tracking-[0.1em] text-mirror">Time on a page</dt><dd className="text-[30px] font-extrabold leading-none tracking-[-0.03em] tabular-nums">{time != null ? duration(time) : '–'}</dd></div>
          </dl>
          {hot.length > 0 && (
            <ul className="mt-3 grid gap-1 border-t border-white/15 pt-2 text-[12.5px]" aria-label="Busiest countries in the picture now">
              {hot.map(([code, v]) => (
                <li key={code} className="flex items-center justify-end gap-2"><span className="truncate text-mirror-light">{countryName(code)}</span><span className="h-1.5 w-[70px] bg-white/10"><span className="block h-full bg-signal" style={{ width: `${Math.round(v * 100)}%` }} /></span></li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <p className="min-w-0 flex-1 text-[12.5px] text-muted">Drag to turn, scroll to zoom, click a country for its requests. {config && !config.server.known && <>The server’s place is assumed: set <code>SERVER_LOCATION</code> on the API (for example <code>52.37,4.90,Amsterdam</code>). </>}Readers who allowed measurement only; nobody is identified.</p>
        <label className="flex cursor-pointer items-center gap-2 text-[13px] font-semibold"><input type="checkbox" checked={replay} onChange={(e) => setReplay(e.target.checked)} className="size-4 accent-ink" /> Replay the last 24 hours when quiet</label>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,320px)]">
        <section className="min-w-0 border-t-2 border-ink bg-white px-4 pb-4 pt-3 sm:px-5">
          <h2 className="text-[18px]">Latest in the picture</h2>
          {latest.length === 0 ? <p className="mt-2 text-[14px] text-muted">Nothing yet. Each request appears here as it is drawn.</p> : (
            <ol className="mt-2">
              {latest.map((e, i) => (
                <li key={e.at + i} className="grid grid-cols-[72px_minmax(0,1fr)_auto] items-baseline gap-x-3 border-t border-rule py-1.5">
                  <time dateTime={e.at} className="font-mono text-[12px] tabular-nums">{clock(e.at)}</time>
                  <span className="min-w-0 truncate text-[13.5px]"><span aria-hidden="true" className="mr-2 inline-block size-2 rounded-full align-middle" style={{ background: COLOR[e.type] }} /><b className="mr-1.5 font-semibold">{TYPE[e.type][0]}</b>{describe(e)}{e.replayed && <span className="text-muted"> · replayed</span>}</span>
                  <span className="text-[12px] text-muted">{e.country ? countryName(e.country) : 'No country'}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
        <section className="min-w-0 border-t-2 border-ink bg-white px-4 pb-4 pt-3 sm:px-5">
          <h2 className="text-[18px]">Last 24 hours</h2>
          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-3">
            {([['Requests', config?.today.requests], ['Readers', config?.today.readers], ['Countries', config?.today.countries]] as [string, number | undefined][]).map(([k, v]) => (
              <div key={k}><dt className="text-[12px] text-muted">{k}</dt><dd className="text-[24px] font-extrabold leading-tight tracking-[-0.03em] tabular-nums">{v != null ? v.toLocaleString('en') : '–'}</dd></div>
            ))}
            <div><dt className="text-[12px] text-muted">Time on a page</dt><dd className="text-[24px] font-extrabold leading-tight tracking-[-0.03em] tabular-nums">{time != null ? duration(time) : '–'}</dd></div>
          </dl>
          <p className="mt-3 text-[12.5px] text-muted">Time on a page is the middle value: half of visits were shorter, half longer. It counts only seconds the page was on screen.</p>
          <div className="mt-3"><Btn size="sm" tone="line" onClick={() => setPick({ by: 'type', value: 'page', title: 'Pages' })}>See every request</Btn></div>
        </section>
      </div>
      {pick && <DetailModal pick={pick} days={1} onClose={() => setPick(null)} onPick={setPick} />}
    </div>
  )
}

/** 75 → "1m 15s" */
export const duration = (seconds: number) => (seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, '0')}s`)
