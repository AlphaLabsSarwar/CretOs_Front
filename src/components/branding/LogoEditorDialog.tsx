import { useEffect, useMemo, useRef, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Loader2, Minus, Plus, RotateCcw, RotateCw, Undo2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

// Client-side logo editor. Everything happens on <canvas> in the browser — the
// server only ever receives the finished PNG, so it never has to decode or
// resize arbitrary uploads. What you see in the frame is exactly what's saved
// (same paint routine for preview, the document mock-up and the export).

type Aspect = 'original' | 'square' | 'wide'
type Background = 'transparent' | 'white'

const ASPECTS: { id: Aspect; label: string }[] = [
  { id: 'original', label: 'Original' },
  { id: 'square', label: 'Square' },
  { id: 'wide', label: 'Wide 2:1' },
]
const BACKGROUNDS: { id: Background; label: string }[] = [
  { id: 'transparent', label: 'Transparent' },
  { id: 'white', label: 'White' },
]

const MAX_SOURCE_PX = 2000 // decode/edit at most this big; keeps a 24 MP photo from eating memory
const OUTPUT_LONG_SIDE = 640 // saved size — plenty for a 72–84px print slot, still crisp on retina
const STAGE = { w: 360, h: 260 } // the largest the crop frame gets in the editor
const MIN_ZOOM = 0.2
const MAX_ZOOM = 5

interface Size { w: number; h: number }
interface Offset { x: number; y: number }

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode')) }
    img.src = url
  })
}

/** The image, rotated by a multiple of 90° and (optionally) trimmed, on its own canvas. */
function buildSource(img: HTMLImageElement, rotation: number, trim: boolean): HTMLCanvasElement {
  const k = Math.min(1, MAX_SOURCE_PX / Math.max(img.naturalWidth, img.naturalHeight))
  const w = Math.round(img.naturalWidth * k), h = Math.round(img.naturalHeight * k)
  const sideways = rotation % 180 !== 0
  const canvas = document.createElement('canvas')
  canvas.width = sideways ? h : w
  canvas.height = sideways ? w : h
  const ctx = canvas.getContext('2d')!
  ctx.translate(canvas.width / 2, canvas.height / 2)
  ctx.rotate((rotation * Math.PI) / 180)
  ctx.drawImage(img, -w / 2, -h / 2, w, h)
  return trim ? trimEmptyMargins(canvas) : canvas
}

/** Crops away the transparent / near-white border around the artwork (with a little breathing room). */
function trimEmptyMargins(source: HTMLCanvasElement): HTMLCanvasElement {
  const { width, height } = source
  const { data } = source.getContext('2d')!.getImageData(0, 0, width, height)
  let minX = width, minY = height, maxX = -1, maxY = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      const visible = data[i + 3] > 12
      const nearWhite = data[i] > 245 && data[i + 1] > 245 && data[i + 2] > 245
      if (visible && !nearWhite) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < 0) return source // nothing but background — leave it alone
  const pad = Math.round(Math.max(maxX - minX, maxY - minY) * 0.03)
  const x0 = Math.max(0, minX - pad), y0 = Math.max(0, minY - pad)
  const x1 = Math.min(width, maxX + 1 + pad), y1 = Math.min(height, maxY + 1 + pad)
  const out = document.createElement('canvas')
  out.width = x1 - x0
  out.height = y1 - y0
  out.getContext('2d')!.drawImage(source, x0, y0, out.width, out.height, 0, 0, out.width, out.height)
  return out
}

function frameSize(aspect: Aspect, source: HTMLCanvasElement): Size {
  const ratio = aspect === 'square' ? 1 : aspect === 'wide' ? 2 : Math.min(4, Math.max(0.4, source.width / source.height))
  let w = STAGE.w, h = w / ratio
  if (h > STAGE.h) { h = STAGE.h; w = h * ratio }
  return { w, h }
}

/** Scale at which the whole image just fits in the frame (zoom 1). */
const fitScale = (source: HTMLCanvasElement, frame: Size) => Math.min(frame.w / source.width, frame.h / source.height)

/** Draws the framed logo. `k` scales from editor pixels to target pixels. */
function paint(ctx: CanvasRenderingContext2D, source: HTMLCanvasElement, frame: Size, zoom: number, offset: Offset, background: Background, k: number) {
  const W = frame.w * k, H = frame.h * k
  ctx.clearRect(0, 0, W, H)
  if (background === 'white') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H) }
  const s = fitScale(source, frame) * zoom * k
  const dw = source.width * s, dh = source.height * s
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, W / 2 + offset.x * k - dw / 2, H / 2 + offset.y * k - dh / 2, dw, dh)
}

const CHECKER = 'repeating-conic-gradient(#e5e7eb 0% 25%, #ffffff 0% 50%) 50% / 16px 16px'
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { id: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-gray-700 dark:text-slate-300">{label}</p>
      <div role="radiogroup" aria-label={label} className="grid grid-flow-col auto-cols-fr gap-1 rounded-lg bg-gray-100 p-1 dark:bg-slate-800">
        {options.map(o => (
          <button
            key={o.id}
            role="radio"
            aria-checked={value === o.id}
            onClick={() => onChange(o.id)}
            className={cn(
              'rounded-md px-2 py-1.5 text-xs font-medium transition-colors duration-150',
              value === o.id ? 'bg-white text-gray-900 shadow-sm dark:bg-slate-600 dark:text-white' : 'text-gray-500 hover:text-gray-800 dark:text-slate-400 dark:hover:text-slate-200',
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

interface LogoEditorDialogProps {
  file: File
  onClose: () => void
  /** Called with the finished PNG. Throw (or reject) to keep the dialog open and show the message. */
  onApply: (png: Blob) => Promise<void>
}

export default function LogoEditorDialog({ file, onClose, onApply }: LogoEditorDialogProps) {
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [rotation, setRotation] = useState(0)
  const [trim, setTrim] = useState(false)
  const [aspect, setAspect] = useState<Aspect>('original')
  const [background, setBackground] = useState<Background>('transparent')
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 })
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const stageRef = useRef<HTMLCanvasElement>(null)
  const miniRef = useRef<HTMLCanvasElement>(null)
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)

  useEffect(() => {
    let cancelled = false
    loadImage(file).then(i => !cancelled && setImg(i)).catch(() => !cancelled && setLoadError(true))
    return () => { cancelled = true }
  }, [file])

  const source = useMemo(() => (img ? buildSource(img, rotation, trim) : null), [img, rotation, trim])
  const frame = useMemo(() => (source ? frameSize(aspect, source) : null), [source, aspect])

  // Any change to the picture itself starts the framing over.
  const resetFraming = () => { setZoom(1); setOffset({ x: 0, y: 0 }) }
  useEffect(resetFraming, [rotation, trim, aspect])

  const resetAll = () => { setRotation(0); setTrim(false); setAspect('original'); setBackground('transparent'); resetFraming() }
  const changed = rotation !== 0 || trim || aspect !== 'original' || background !== 'transparent' || zoom !== 1 || offset.x !== 0 || offset.y !== 0

  // Editor canvas — repainted on every change.
  useEffect(() => {
    const canvas = stageRef.current
    if (!canvas || !source || !frame) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.round(frame.w * dpr)
    canvas.height = Math.round(frame.h * dpr)
    paint(canvas.getContext('2d')!, source, frame, zoom, offset, background, dpr)
  }, [source, frame, zoom, offset, background])

  // "On your documents" mock-up: the same picture at the size print pages use (72px box).
  const MINI = 72
  useEffect(() => {
    const canvas = miniRef.current
    if (!canvas || !source || !frame) return
    const dpr = window.devicePixelRatio || 1
    const k = MINI / Math.max(frame.w, frame.h)
    canvas.width = Math.round(frame.w * k * dpr)
    canvas.height = Math.round(frame.h * k * dpr)
    canvas.style.width = `${Math.round(frame.w * k)}px`
    canvas.style.height = `${Math.round(frame.h * k)}px`
    paint(canvas.getContext('2d')!, source, frame, zoom, offset, background, k * dpr)
  }, [source, frame, zoom, offset, background])

  // Scroll wheel zooms (needs a non-passive listener to stop the page scrolling).
  useEffect(() => {
    const canvas = stageRef.current
    if (!canvas) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      setZoom(z => clamp(z * (e.deltaY < 0 ? 1.08 : 1 / 1.08), MIN_ZOOM, MAX_ZOOM))
    }
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  }, [source])

  const dragTo = (e: React.PointerEvent) => {
    if (!drag.current || !source || !frame) return
    const dw = source.width * fitScale(source, frame) * zoom, dh = source.height * fitScale(source, frame) * zoom
    // Keep at least a sliver of the picture inside the frame so it can't be dragged out of reach.
    const maxX = frame.w / 2 + dw / 2 - 24, maxY = frame.h / 2 + dh / 2 - 24
    setOffset({
      x: clamp(drag.current.ox + e.clientX - drag.current.x, -maxX, maxX),
      y: clamp(drag.current.oy + e.clientY - drag.current.y, -maxY, maxY),
    })
  }

  const nudge = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 20 : 5
    const d: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }
    if (!d[e.key]) return
    e.preventDefault()
    setOffset(o => ({ x: o.x + d[e.key][0], y: o.y + d[e.key][1] }))
  }

  const apply = async () => {
    if (!source || !frame) return
    setApplying(true); setError(null)
    try {
      const k = OUTPUT_LONG_SIDE / Math.max(frame.w, frame.h)
      const out = document.createElement('canvas')
      out.width = Math.round(frame.w * k)
      out.height = Math.round(frame.h * k)
      paint(out.getContext('2d')!, source, frame, zoom, offset, background, k)
      const png = await new Promise<Blob | null>(resolve => out.toBlob(resolve, 'image/png'))
      if (!png) throw new Error('Could not prepare the image.')
      await onApply(png)
    } catch (e: any) {
      setError(e?.message ?? 'Something went wrong.')
      setApplying(false)
    }
  }

  const kb = file.size < 1024 * 1024 ? `${Math.max(1, Math.round(file.size / 1024))} KB` : `${(file.size / 1024 / 1024).toFixed(1)} MB`

  return (
    <Dialog.Root open onOpenChange={open => { if (!open && !applying) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[90] bg-black/50 backdrop-blur-[1px]" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-[91] max-h-[92vh] w-[calc(100vw-2rem)] max-w-3xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-white shadow-2xl outline-none dark:bg-slate-900"
          onInteractOutside={e => { if (applying) e.preventDefault() }}
        >
          <div className="flex items-start justify-between border-b border-gray-200 px-5 py-4 dark:border-slate-800">
            <div>
              <Dialog.Title className="text-base font-semibold text-gray-900 dark:text-white">Edit your company logo</Dialog.Title>
              <Dialog.Description className="mt-0.5 text-xs text-gray-500 dark:text-slate-400">
                Position it the way you want it. It will appear on your challans, invoices, quotations, reports and other documents.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button aria-label="Close" disabled={applying} className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-40 dark:hover:bg-slate-800"><X size={18} /></button>
            </Dialog.Close>
          </div>

          {loadError ? (
            <div className="px-5 py-14 text-center">
              <p className="text-sm font-medium text-gray-800 dark:text-slate-200">We couldn't open that image.</p>
              <p className="mt-1 text-xs text-gray-500">It may be damaged. Try exporting it again as a PNG or JPG.</p>
              <Button variant="secondary" size="sm" className="mt-4" onClick={onClose}>Close</Button>
            </div>
          ) : !source || !frame ? (
            <div className="flex items-center justify-center gap-2 px-5 py-20 text-sm text-gray-500"><Loader2 size={16} className="animate-spin" /> Opening image…</div>
          ) : (
            <>
              <div className="grid gap-5 p-5 md:grid-cols-[minmax(0,1fr)_240px]">
                {/* Stage */}
                <div>
                  <div className="flex items-center justify-center rounded-xl bg-gray-100 p-4 dark:bg-slate-800" style={{ minHeight: STAGE.h + 32 }}>
                    <div className="overflow-hidden rounded-md shadow-sm ring-1 ring-gray-300 dark:ring-slate-600" style={{ width: frame.w, height: frame.h, background: background === 'transparent' ? CHECKER : '#fff' }}>
                      <canvas
                        ref={stageRef}
                        tabIndex={0}
                        role="img"
                        aria-label="Logo preview. Drag to move, scroll or use the zoom slider to resize, arrow keys to nudge."
                        className="block cursor-grab touch-none outline-none focus-visible:ring-2 focus-visible:ring-accent active:cursor-grabbing"
                        style={{ width: frame.w, height: frame.h }}
                        onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y } }}
                        onPointerMove={dragTo}
                        onPointerUp={() => { drag.current = null }}
                        onPointerCancel={() => { drag.current = null }}
                        onKeyDown={nudge}
                      />
                    </div>
                  </div>
                  <p className="mt-2 text-center text-[11px] text-gray-400">Drag to reposition · scroll or use the slider to zoom</p>

                  <div className="mt-3 flex items-center gap-2">
                    <button aria-label="Zoom out" onClick={() => setZoom(z => clamp(z / 1.15, MIN_ZOOM, MAX_ZOOM))} className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800"><Minus size={14} /></button>
                    <input
                      type="range" min={MIN_ZOOM} max={MAX_ZOOM} step={0.01} value={zoom}
                      onChange={e => setZoom(Number(e.target.value))}
                      aria-label="Zoom"
                      className="h-1.5 flex-1 cursor-pointer accent-[#E8630A]"
                    />
                    <button aria-label="Zoom in" onClick={() => setZoom(z => clamp(z * 1.15, MIN_ZOOM, MAX_ZOOM))} className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800"><Plus size={14} /></button>
                    <span className="w-11 text-right font-mono text-[11px] text-gray-500">{Math.round(zoom * 100)}%</span>
                  </div>
                </div>

                {/* Options */}
                <div className="space-y-4">
                  <div>
                    <p className="mb-1.5 text-xs font-medium text-gray-700 dark:text-slate-300">Rotate</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      <Button variant="secondary" size="sm" onClick={() => setRotation(r => (r + 270) % 360)}><RotateCcw size={13} /> Left</Button>
                      <Button variant="secondary" size="sm" onClick={() => setRotation(r => (r + 90) % 360)}><RotateCw size={13} /> Right</Button>
                    </div>
                  </div>

                  <Segmented label="Crop shape" value={aspect} options={ASPECTS} onChange={setAspect} />
                  <Segmented label="Background" value={background} options={BACKGROUNDS} onChange={setBackground} />

                  <label className="flex cursor-pointer items-start gap-2.5 text-xs">
                    <input type="checkbox" checked={trim} onChange={e => setTrim(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-[#E8630A]" />
                    <span>
                      <span className="font-medium text-gray-700 dark:text-slate-300">Trim empty margins</span>
                      <span className="block text-[11px] text-gray-400">Crops the blank space around the artwork so it prints larger.</span>
                    </span>
                  </label>

                  <div>
                    <p className="mb-1.5 text-xs font-medium text-gray-700 dark:text-slate-300">On your documents</p>
                    <div className="rounded-lg border border-gray-200 bg-white p-2.5 dark:border-slate-700">
                      <div className="flex items-start justify-between gap-2 border-b-2 border-gray-800 pb-2">
                        <div className="space-y-1 pt-0.5">
                          <div className="h-1.5 w-24 rounded bg-gray-800" />
                          <div className="h-1 w-32 rounded bg-gray-300" />
                          <div className="h-1 w-20 rounded bg-gray-300" />
                        </div>
                        <canvas ref={miniRef} aria-label="Logo as it will appear on a printed document" />
                      </div>
                      <div className="mt-2 space-y-1"><div className="h-1 rounded bg-gray-200" /><div className="h-1 w-4/5 rounded bg-gray-200" /></div>
                    </div>
                  </div>

                  <button onClick={resetAll} disabled={!changed} className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 disabled:opacity-40 dark:hover:text-slate-200">
                    <Undo2 size={12} /> Reset edits
                  </button>
                </div>
              </div>

              {error && <p role="alert" className="mx-5 mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

              <div className="flex items-center justify-between gap-3 border-t border-gray-200 px-5 py-3 dark:border-slate-800">
                <p className="min-w-0 truncate text-[11px] text-gray-400">{file.name} · {kb}</p>
                <div className="flex shrink-0 items-center gap-2">
                  <Button variant="secondary" onClick={onClose} disabled={applying}>Cancel</Button>
                  <Button onClick={apply} loading={applying}>Apply logo</Button>
                </div>
              </div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
