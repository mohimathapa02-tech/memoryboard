import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Rnd } from 'react-rnd'
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string'
import { loadBoard, saveBoard } from './supabase'
import './App.css'

function getOrCreateBoardId(): string {
  let id = localStorage.getItem('memoryboard-id')
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem('memoryboard-id', id)
  }
  return id
}

type BoardItemBase = {
  id: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
  createdAt: number
}

type NoteColors = 'mint' | 'yellow' | 'pink' | 'lavender'

type NoteItem = BoardItemBase & {
  type: 'note'
  text: string
  color: NoteColors
}

type PhotoItem = BoardItemBase & {
  type: 'photo'
  src: string
  caption: string
}

type SpotifyStyle = 'horizontal' | 'square' | 'disc'

type SpotifyItem = BoardItemBase & {
  type: 'spotify'
  url: string
  style: SpotifyStyle
  songTitle: string
  artist: string
  albumCover: string
  theme: 'light' | 'dark'
}

type DoodleItem = BoardItemBase & {
  type: 'doodle'
  src: string
}

type TextItem = BoardItemBase & {
  type: 'text'
  text: string
  fontSize: number
  color: string
  fontFamily: 'ui' | 'note'
  bold: boolean
}

type StickerItem = BoardItemBase & {
  type: 'sticker'
  src: string
}

type DateTimeItem = BoardItemBase & {
  type: 'datetime'
}

type CountdownItem = BoardItemBase & {
  type: 'countdown'
  label: string
  targetMs: number
}

type LocationItem = BoardItemBase & {
  type: 'location'
  name: string
  address: string
  lat: number
  lng: number
}

type BoardItem = NoteItem | PhotoItem | SpotifyItem | DoodleItem | TextItem | StickerItem | DateTimeItem | CountdownItem | LocationItem

type Tool = 'note' | 'photo' | 'spotify' | 'doodle' | 'text' | null

type SerializedBoard = {
  items: BoardItem[]
}


// ── Toolbar SVG icons ──────────────────────────────────────────────────────

const CameraIcon = () => (
  <svg width="86" height="86" viewBox="0 14 54 34" fill="none">
    <rect x="6" y="16" width="42" height="30" rx="6" fill="#F5A623" stroke="#E8951A" strokeWidth="1.5"/>
    <rect x="6" y="16" width="42" height="8" rx="4" fill="#E8951A"/>
    <circle cx="27" cy="34" r="9" fill="#fff" stroke="#E8951A" strokeWidth="1.5"/>
    <circle cx="27" cy="34" r="6" fill="#F5A623" stroke="#E8951A" strokeWidth="1"/>
    <circle cx="27" cy="34" r="3" fill="#2a1a00" opacity="0.7"/>
    <circle cx="28.5" cy="32.5" r="1" fill="#fff" opacity="0.6"/>
    <rect x="14" y="19.5" width="6" height="3" rx="1.5" fill="#fff" opacity="0.5"/>
    <circle cx="39" cy="21" r="2" fill="#fff" opacity="0.4"/>
  </svg>
)

const NoteIcon = () => (
  <svg width="76" height="76" viewBox="0 1 54 54" fill="none">
    <rect x="10" y="14" width="34" height="34" rx="3" fill="#F8C8D4" stroke="#f0a0b8" strokeWidth="1.2"/>
    <rect x="10" y="14" width="34" height="6" rx="3" fill="#f0a0b8" opacity="0.5"/>
    <line x1="16" y1="28" x2="38" y2="28" stroke="#d4849a" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="16" y1="34" x2="35" y2="34" stroke="#d4849a" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="16" y1="40" x2="30" y2="40" stroke="#d4849a" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="27" y1="6" x2="27" y2="17" stroke="#aaa" strokeWidth="2" strokeLinecap="round"/>
    <ellipse cx="27" cy="6" rx="3" ry="2.5" fill="#c8c8c8" stroke="#aaa" strokeWidth="1"/>
  </svg>
)

const CDIcon = () => (
  <div style={{ width: 64, height: 64, position: 'relative' }}>
    <style>{`
      @keyframes cd-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      .cd-disc { animation: cd-spin 3s linear infinite; transform-origin: center; display: block; }
    `}</style>
    <svg className="cd-disc" width="64" height="64" viewBox="0 0 54 54" fill="none">
      <defs>
        <radialGradient id="rSilver" cx="36%" cy="30%" r="72%">
          <stop offset="0%" stopColor="#ffffff"/>
          <stop offset="28%" stopColor="#d0d0d0"/>
          <stop offset="48%" stopColor="#a8a8a8"/>
          <stop offset="82%" stopColor="#e2e2e2"/>
          <stop offset="100%" stopColor="#b0b0b0"/>
        </radialGradient>
        <radialGradient id="rDepth" cx="68%" cy="72%" r="60%">
          <stop offset="0%" stopColor="rgba(0,0,0,0.18)"/>
          <stop offset="100%" stopColor="rgba(0,0,0,0)"/>
        </radialGradient>
        <linearGradient id="rSheen" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.7)"/>
          <stop offset="55%" stopColor="rgba(180,180,180,0.05)"/>
          <stop offset="100%" stopColor="rgba(255,255,255,0.45)"/>
        </linearGradient>
        <radialGradient id="rHub" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#666"/>
          <stop offset="100%" stopColor="#111"/>
        </radialGradient>
        <radialGradient id="rCap" cx="38%" cy="35%" r="62%">
          <stop offset="0%" stopColor="#ffffff"/>
          <stop offset="100%" stopColor="#cccccc"/>
        </radialGradient>
      </defs>
      <circle cx="27" cy="27" r="23" fill="url(#rSilver)"/>
      <circle cx="27" cy="27" r="23" fill="url(#rDepth)"/>
      <circle cx="27" cy="27" r="21.5" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="0.5"/>
      <circle cx="27" cy="27" r="17.5" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="0.4"/>
      <circle cx="27" cy="27" r="13.5" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.3"/>
      <circle cx="27" cy="27" r="23" fill="url(#rSheen)"/>
      <circle cx="27" cy="27" r="23" fill="none" stroke="rgba(80,80,80,0.45)" strokeWidth="0.8"/>
      <circle cx="27" cy="27" r="7" fill="url(#rHub)"/>
      <circle cx="27" cy="27" r="4.2" fill="url(#rCap)"/>
      <circle cx="27" cy="27" r="2" fill="#ddd" stroke="#bbb" strokeWidth="0.4"/>
      <ellipse cx="18" cy="16" rx="6" ry="2.5" fill="white" opacity="0.35" transform="rotate(-30 18 16)"/>
    </svg>
  </div>
)

const PencilIcon = () => (
  <svg width="62" height="62" viewBox="0 0 54 54" fill="none">
    <polygon points="18,8 36,8 27,2" fill="#2a1a00"/>
    <rect x="18" y="8" width="18" height="5" fill="#E8A870" stroke="#c87840" strokeWidth="1"/>
    <rect x="18" y="13" width="18" height="28" fill="#F5C842" stroke="#E0A800" strokeWidth="1.2"/>
    <line x1="22" y1="14" x2="22" y2="40" stroke="#E0A800" strokeWidth="0.8" opacity="0.35"/>
    <rect x="18" y="41" width="18" height="5" fill="#c0c0c0" stroke="#aaa" strokeWidth="0.8"/>
    <rect x="18" y="45" width="18" height="7" rx="2" fill="#d4d4d4" stroke="#bbb" strokeWidth="1"/>
  </svg>
)

const CreativeIcon = () => (
  <span style={{ fontSize: 52, lineHeight: 1 }}>🌸</span>
)

const CREATIVE_OPTIONS = [
  { id: 'gif',       label: 'GIF',        emoji: '🎞️', color: '#FFE4E1', stroke: '#f5d8d6', strokeHover: '#e08880' },
  { id: 'stickers',  label: 'Emojis',     emoji: '😄', color: '#E8F5E9', stroke: '#cce8ce', strokeHover: '#7eb882' },
  { id: 'scribbles', label: 'Scribbles',  emoji: '🖌️', color: '#FFF3E0', stroke: '#f5e8c8', strokeHover: '#d4aa60' },
  { id: 'countdown', label: 'Countdown',  emoji: '⏱️', color: '#E3F2FD', stroke: '#cce4f8', strokeHover: '#6aa0dc' },
  { id: 'datetime',  label: 'Date & Time',emoji: '🗓️', color: '#F3E5F5', stroke: '#e8d4f0', strokeHover: '#b07ed0' },
  { id: 'location',  label: 'Location',   emoji: '📍', color: '#FCE4EC', stroke: '#f8d4e0', strokeHover: '#e07898' },
]

const NOTE_COLOR_OPTIONS: { color: NoteColors; bg: string; label: string }[] = [
  { color: 'mint',     bg: '#C8E6C9', label: 'Mint'     },
  { color: 'yellow',  bg: '#FFF9C4', label: 'Yellow'   },
  { color: 'pink',    bg: '#F8C8D4', label: 'Pink'     },
  { color: 'lavender',bg: '#E1BEE7', label: 'Lavender' },
]

const randomRotation = () => (Math.random() - 0.5) * 10


function App() {
  const [items, setItems] = useState<BoardItem[]>([])
  const boardLoaded = useRef(false)
  const [_activeTool, setActiveTool] = useState<Tool>('note')
  const [isReadonly, setIsReadonly] = useState(false)
  const [showToast, setShowToast] = useState<string | null>(null)
  const [showDoodleModal, setShowDoodleModal] = useState(false)
  const [showSpotifyModal, setShowSpotifyModal] = useState(false)
  const [pendingSpotifyUrl, setPendingSpotifyUrl] = useState('')
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [notePicker, setNotePicker] = useState(false)
  const [cameraHovered, setCameraHovered] = useState(false)
  const [noteIconHovered, setNoteIconHovered] = useState(false)
  const [cdHovered, setCdHovered] = useState(false)
  const [pencilHovered, setPencilHovered] = useState(false)
  const [flowerHovered, setFlowerHovered] = useState(false)
  const [showCreativePicker, setShowCreativePicker] = useState(false)
  const [showGifModal, setShowGifModal] = useState(false)
  const [showStickerModal, setShowStickerModal] = useState(false)
  const [showIllustrationsModal, setShowIllustrationsModal] = useState(false)
  const [isSharing, setIsSharing] = useState(false)
  const [showCountdownModal, setShowCountdownModal] = useState(false)
  const [showLocationPicker, setShowLocationPicker] = useState(false)
  const [locationQuery, setLocationQuery] = useState('')
  const [locationResults, setLocationResults] = useState<NominatimResult[]>([])
  const [locationLoading, setLocationLoading] = useState(false)
  const [locationGeoLoading, setLocationGeoLoading] = useState(false)
  const [showPhotoModal, setShowPhotoModal] = useState(false)
  const [draggingItemId, setDraggingItemId] = useState<string | null>(null)
  const [binProximity, setBinProximity] = useState(0)
  const [_draggingOverBin, setDraggingOverBin] = useState(false)
  const [lidOpen, setLidOpen] = useState(false)
  const [dragScaleVal, setDragScaleVal] = useState(1)
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [_hoveredCardId, setHoveredCardId] = useState<string | null>(null)
  const [toolbarCollapsed, setToolbarCollapsed] = useState(false)
  const hoverLeaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const binRef = useRef<HTMLDivElement>(null)
  const dragMoveCleanup = useRef<(() => void) | null>(null)
  const spotifyApiRef = useRef<any>(null)
  const spotifyControllerRef = useRef<any>(null)
  const spotifyContainerRef = useRef<HTMLDivElement | null>(null)
  const [playingSpotifyId, setPlayingSpotifyId] = useState<string | null>(null)

  const handleCardMouseEnter = (id: string) => {
    if (hoverLeaveTimer.current) clearTimeout(hoverLeaveTimer.current)
    setHoveredCardId(id)
  }
  const handleCardMouseLeave = () => {
    hoverLeaveTimer.current = setTimeout(() => setHoveredCardId(null), 400)
  }



  const boardMeta = useMemo(
    () => ({
      count: items.length,
      lastUpdated: items.length
        ? new Date(
            Math.max(...items.map((item) => item.createdAt)),
          ).toLocaleString()
        : null,
    }),
    [items],
  )

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedItemId) ?? null,
    [items, selectedItemId],
  )

  const selectedTextItem = selectedItem && selectedItem.type === 'text' ? selectedItem : null

  useEffect(() => {
    const sharedBoardId = new URLSearchParams(window.location.search).get('board')
    if (sharedBoardId) {
      // Load a shared board (readonly)
      loadBoard(sharedBoardId).then((parsed) => {
        if (parsed && Array.isArray(parsed.items)) {
          setItems(parsed.items as BoardItem[])
          setIsReadonly(true)
        }
        boardLoaded.current = true
      }).catch(() => { boardLoaded.current = true })
      return
    }
    // Legacy: #hash shared links
    const hash = window.location.hash.replace(/^#/, '')
    if (hash) {
      try {
        const raw = decompressFromEncodedURIComponent(hash)
        if (!raw) return
        const parsed = JSON.parse(raw) as SerializedBoard
        if (Array.isArray(parsed.items)) {
          setItems(parsed.items)
          setIsReadonly(true)
        }
      } catch { /* ignore */ }
      boardLoaded.current = true
      return
    }
    // Load own board from Supabase
    const myBoardId = getOrCreateBoardId()
    loadBoard(myBoardId).then((parsed) => {
      if (parsed && Array.isArray(parsed.items)) {
        setItems(parsed.items as BoardItem[])
      }
      boardLoaded.current = true
    }).catch(() => { boardLoaded.current = true })
  }, [])

  // Auto-save board to Supabase (debounced 1.5s, only after initial load)
  useEffect(() => {
    if (isReadonly) return
    if (!boardLoaded.current) return
    const timer = setTimeout(() => {
      const myBoardId = getOrCreateBoardId()
      saveBoard(myBoardId, items).catch(() => {})
    }, 1500)
    return () => clearTimeout(timer)
  }, [items, isReadonly])

  useEffect(() => {
    const container = document.createElement('div')
    container.style.cssText = 'position:fixed;left:0;top:0;width:300px;height:80px;opacity:0;pointer-events:none;z-index:-1;overflow:hidden;display:none;'
    document.body.appendChild(container)
    spotifyContainerRef.current = container

    const initController = (IFrameAPI: any) => {
      spotifyApiRef.current = IFrameAPI
      IFrameAPI.createController(
        container,
        { width: 300, height: 80 },
        (controller: any) => {
          spotifyControllerRef.current = controller
          controller.addListener('playback_update', (e: any) => {
            if (e.data?.isPaused) setPlayingSpotifyId(null)
          })
        }
      )
    }

    ;(window as any).onSpotifyIframeApiReady = initController

    if (!document.getElementById('spotify-iframe-api')) {
      const s = document.createElement('script')
      s.id = 'spotify-iframe-api'
      s.src = 'https://open.spotify.com/embed/iframe-api/v1'
      s.async = true
      document.head.appendChild(s)
    }

    return () => { document.body.removeChild(container) }
  }, [])

  const extractSpotifyUri = (url: string) => {
    const m = url.match(/open\.spotify\.com\/(track|album|playlist|artist)\/([a-zA-Z0-9]+)/)
    return m ? `spotify:${m[1]}:${m[2]}` : ''
  }

  const handleSpotifyPlay = (item: SpotifyItem) => {
    const uri = extractSpotifyUri(item.url)
    if (!uri) return
    const controller = spotifyControllerRef.current
    if (!controller) return
    if (playingSpotifyId === item.id) {
      controller.togglePlay()
      setPlayingSpotifyId(null)
      return
    }
    setPlayingSpotifyId(item.id)
    controller.loadUri(uri)
    controller.play()
  }

  const startBinTracking = () => {
    const onMove = (e: MouseEvent) => {
      if (!binRef.current) return
      const r = binRef.current.getBoundingClientRect()
      const binCx = (r.left + r.right) / 2
      const binCy = (r.top + r.bottom) / 2
      const dist = Math.hypot(e.clientX - binCx, e.clientY - binCy)
      const startFade = 220, snapZone = 60
      const proximity = Math.max(0, Math.min(1, 1 - (dist - snapZone) / (startFade - snapZone)))
      const isOver = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom
      setBinProximity(proximity)
      setDraggingOverBin(isOver)
      setLidOpen(dist < snapZone + 30)
      setDragScaleVal(1 - proximity * 0.6)
    }
    window.addEventListener('mousemove', onMove)
    dragMoveCleanup.current = () => window.removeEventListener('mousemove', onMove)
  }

  const stopBinTracking = () => {
    dragMoveCleanup.current?.()
    dragMoveCleanup.current = null
  }

  const _serializeBoard = (sourceItems: BoardItem[]) => {
    const payload: SerializedBoard = { items: sourceItems }
    return compressToEncodedURIComponent(JSON.stringify(payload))
  }

  const showTempToast = (message: string) => {
    setShowToast(message)
    window.setTimeout(() => {
      setShowToast((current) => (current === message ? null : current))
    }, 2200)
  }

  const handleShare = async () => {
    if (!items.length) {
      showTempToast('Add a few memories first.')
      return
    }
    if (isSharing) return
    setIsSharing(true)

    try {
      // Use the existing board ID — already saved in Supabase, no upload needed
      const myBoardId = getOrCreateBoardId()
      const shareUrl = `${window.location.origin}${window.location.pathname}?board=${myBoardId}`

      try {
        await navigator.clipboard.writeText(shareUrl)
        showTempToast('Share link copied!')
      } catch {
        window.prompt('Copy this link to share your board:', shareUrl)
        showTempToast('Share link copied!')
      }
    } catch (err) {
      console.error('Share failed:', err)
      showTempToast('Could not generate link. Try again.')
    } finally {
      setIsSharing(false)
    }
  }

  const handleNewBoard = () => {
    localStorage.setItem('memoryboard-id', crypto.randomUUID())
    window.location.href = window.location.pathname
  }

  const addNote = (color?: NoteColors) => {
    const centerX = 180 + Math.random() * 120
    const centerY = 140 + Math.random() * 120
    const colors: NoteColors[] = ['mint', 'yellow', 'pink', 'lavender']
    const note: NoteItem = {
      id: crypto.randomUUID(),
      type: 'note',
      text: '',
      color: color ?? colors[Math.floor(Math.random() * colors.length)],
      x: centerX,
      y: centerY,
      width: 190,
      height: 170,
      rotation: randomRotation(),
      createdAt: Date.now(),
    }
    setItems((prev) => [...prev, note])
  }

  const _addText = () => {
    const centerX = 220 + Math.random() * 120
    const centerY = 160 + Math.random() * 120
    const id = crypto.randomUUID()
    const textItem: TextItem = {
      id,
      type: 'text',
      text: 'Double-click to edit',
      fontSize: 18,
      color: '#1a1a1a',
      fontFamily: 'ui',
      bold: false,
      x: centerX,
      y: centerY,
      width: 260,
      height: 80,
      rotation: randomRotation(),
      createdAt: Date.now(),
    }
    setItems((prev) => [...prev, textItem])
    setSelectedItemId(id)
    setActiveTool('text')
  }

  const handlePhotoUpload = (file: File | null) => {
    if (!file || isReadonly) return
    const reader = new FileReader()
    reader.onload = () => {
      const src = typeof reader.result === 'string' ? reader.result : ''
      if (!src) return
      const centerX = 220 + Math.random() * 120
      const centerY = 180 + Math.random() * 120
      const item: PhotoItem = {
        id: crypto.randomUUID(),
        type: 'photo',
        src,
        caption: '',
        x: centerX,
        y: centerY,
        width: 220,
        height: 320,
        rotation: randomRotation(),
        createdAt: Date.now(),
      }
      setItems((prev) => [...prev, item])
    }
    reader.readAsDataURL(file)
  }

  const handleCreativeOption = (id: string) => {
    setShowCreativePicker(false)
    if (id === 'gif') { setShowGifModal(true); return }
    if (id === 'stickers') { setShowStickerModal(true); return }
    if (id === 'scribbles') { setShowIllustrationsModal(true); return }
    if (id === 'datetime') {
      const newItem: DateTimeItem = {
        id: crypto.randomUUID(),
        type: 'datetime',
        x: 180 + Math.random() * 120,
        y: 120 + Math.random() * 120,
        width: 270,
        height: 100,
        rotation: randomRotation(),
        createdAt: Date.now(),
      }
      setItems((prev) => [...prev, newItem])
      return
    }
    if (id === 'countdown') { setShowCountdownModal(true); return }
    if (id === 'location') { setShowLocationPicker(true); return }
    showTempToast('Coming soon ✨')
  }

  const locationDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const searchLocations = async (q: string) => {
    if (!q.trim()) { setLocationResults([]); return }
    setLocationLoading(true)
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=6&addressdetails=1`, { headers: { 'Accept-Language': 'en' } })
      setLocationResults(await res.json())
    } catch { /* ignore */ } finally {
      setLocationLoading(false)
    }
  }

  const handleLocationInput = (val: string) => {
    setLocationQuery(val)
    if (locationDebounceRef.current) clearTimeout(locationDebounceRef.current)
    locationDebounceRef.current = setTimeout(() => searchLocations(val), 500)
  }

  const closeLocationPicker = () => {
    setShowLocationPicker(false)
    setLocationQuery('')
    setLocationResults([])
  }

  const addLocationItem = (loc: { name: string; address: string; lat: number; lng: number }) => {
    const newItem: LocationItem = {
      id: crypto.randomUUID(),
      type: 'location',
      ...loc,
      x: 180 + Math.random() * 120,
      y: 120 + Math.random() * 120,
      width: 210,
      height: 52,
      rotation: randomRotation(),
      createdAt: Date.now(),
    }
    setItems((prev) => [...prev, newItem])
    closeLocationPicker()
  }

  const handleLocationMyLocation = () => {
    if (!navigator.geolocation) return
    setLocationGeoLoading(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`, { headers: { 'Accept-Language': 'en' } })
          const data = await res.json()
          const name = data.name || data.address?.city || data.address?.town || 'My Location'
          const parts = (data.display_name || '').split(',')
          const address = parts.slice(1, 3).join(',').trim()
          addLocationItem({ name, address, lat, lng })
        } catch {
          addLocationItem({ name: 'My Location', address: '', lat, lng })
        } finally { setLocationGeoLoading(false) }
      },
      () => setLocationGeoLoading(false),
      { timeout: 8000 },
    )
  }

  const handleLocationPick = (r: NominatimResult) => {
    const parts = r.display_name.split(',')
    const name = r.name || parts[0].trim()
    const address = parts.slice(1, 3).join(',').trim()
    addLocationItem({ name, address, lat: parseFloat(r.lat), lng: parseFloat(r.lon) })
  }

  const handleCountdownCreate = (label: string, targetMs: number) => {
    const newItem: CountdownItem = {
      id: crypto.randomUUID(),
      type: 'countdown',
      label,
      targetMs,
      x: 180 + Math.random() * 120,
      y: 120 + Math.random() * 120,
      width: 270,
      height: 130,
      rotation: randomRotation(),
      createdAt: Date.now(),
    }
    setItems((prev) => [...prev, newItem])
    setShowCountdownModal(false)
  }

  const handleStickerSelect = (s: StickerResult) => {
    const newItem: StickerItem = {
      id: crypto.randomUUID(),
      type: 'sticker',
      src: s.url,
      x: 160 + Math.random() * 140,
      y: 100 + Math.random() * 140,
      width: 80,
      height: 80,
      rotation: randomRotation(),
      createdAt: Date.now(),
    }
    setItems((prev) => [...prev, newItem])
    setShowStickerModal(false)
  }

  const handleGifSelect = (gif: GifItem) => {
    const aspect = gif.height / gif.width
    const w = 260
    const h = Math.round(w * aspect)
    const newItem: PhotoItem = {
      id: crypto.randomUUID(),
      type: 'photo',
      src: gif.url,
      caption: '',
      x: 160 + Math.random() * 140,
      y: 100 + Math.random() * 140,
      width: w,
      height: h,
      rotation: randomRotation(),
      createdAt: Date.now(),
    }
    setItems((prev) => [...prev, newItem])
    setShowGifModal(false)
  }

  const handleSpotifyAdd = async () => {
    if (!pendingSpotifyUrl.trim() || isReadonly) return
    const url = pendingSpotifyUrl.trim()
    setShowSpotifyModal(false)
    setPendingSpotifyUrl('')
    let meta = { songTitle: 'Unknown Track', artist: 'Unknown Artist', albumCover: '' }
    try {
      const res = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`)
      if (res.ok) {
        const data = await res.json()
        meta = { songTitle: data.title ?? meta.songTitle, artist: data.author_name ?? meta.artist, albumCover: data.thumbnail_url ?? '' }
      }
    } catch { /* use defaults */ }
    const item: SpotifyItem = {
      id: crypto.randomUUID(),
      type: 'spotify',
      url,
      style: 'disc',
      theme: 'dark',
      ...meta,
      x: 260 + Math.random() * 120,
      y: 220 + Math.random() * 120,
      width: 160,
      height: 160,
      rotation: randomRotation(),
      createdAt: Date.now(),
    }
    setItems((prev) => [...prev, item])
    showTempToast('Music added.')
  }

  const SPOTIFY_SIZES: Record<SpotifyStyle, { width: number; height: number }> = {
    disc: { width: 160, height: 160 },
    horizontal: { width: 300, height: 86 },
    square: { width: 210, height: 252 },
  }

  const updateSpotifyStyle = (id: string, style: SpotifyStyle) => {
    setItems((prev) => prev.map((it) =>
      it.id === id && it.type === 'spotify' ? { ...it, style, ...SPOTIFY_SIZES[style] } : it
    ))
  }


  const handleDoodleSaved = (dataUrl: string) => {
    const centerX = 260 + Math.random() * 120
    const centerY = 200 + Math.random() * 120
    const item: DoodleItem = {
      id: crypto.randomUUID(),
      type: 'doodle',
      src: dataUrl,
      x: centerX,
      y: centerY,
      width: 260,
      height: 200,
      rotation: randomRotation(),
      createdAt: Date.now(),
    }
    setItems((prev) => [...prev, item])
    setShowDoodleModal(false)
    showTempToast('Doodle pinned to your board.')
  }

  const updateItem = (id: string, updater: (item: BoardItem) => BoardItem) => {
    setItems((prev) => prev.map((item) => (item.id === id ? updater(item) : item)))
  }

  const deleteItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id))
  }

  const noteColorClass = (color: NoteColors) => {
    switch (color) {
      case 'mint':
        return 'note note-mint'
      case 'yellow':
        return 'note note-yellow'
      case 'pink':
        return 'note note-pink'
      case 'lavender':
      default:
        return 'note note-lavender'
    }
  }

  const renderItemCard = (item: BoardItem) => {
    switch (item.type) {
      case 'note':
        return (
          <div
            className={noteColorClass(item.color)}
            onMouseEnter={() => handleCardMouseEnter(item.id)}
            onMouseLeave={handleCardMouseLeave}
          >
            <textarea
              value={item.text}
              onChange={(e) =>
                updateItem(item.id, (prev) => ({ ...prev, text: e.target.value }))
              }
              onFocus={() => setEditingNoteId(item.id)}
              onBlur={() => setEditingNoteId(null)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  setEditingNoteId(null)
                  e.currentTarget.blur()
                }
              }}
              className="note-text"
              placeholder="Type a memory…"
              style={{ fontFamily: 'var(--font-note)', cursor: editingNoteId === item.id ? 'text' : 'grab', userSelect: draggingItemId === item.id ? 'none' : 'auto' }}
              readOnly={isReadonly}
            />
          </div>
        )
      case 'photo':
        return (
          <div
            className="polaroid"
            onMouseEnter={() => handleCardMouseEnter(item.id)}
            onMouseLeave={handleCardMouseLeave}
          >
            <div className="polaroid-inner">
              <div className="polaroid-photo-wrap">
                <img src={item.src} className="polaroid-photo" alt={item.caption} draggable={false} />
              </div>
              {!item.src.includes('giphy.com') && (
                <input
                  className="polaroid-caption"
                  value={item.caption}
                  onChange={(e) =>
                    updateItem(item.id, (prev) => ({ ...prev, caption: e.target.value }))
                  }
                  placeholder="Add a caption…"
                  style={{ fontFamily: 'var(--font-note)', cursor: draggingItemId === item.id ? 'grabbing' : 'grab', userSelect: draggingItemId === item.id ? 'none' : 'auto' }}
                  readOnly={isReadonly}
                />
              )}
            </div>
          </div>
        )
      case 'spotify':
        return (
          <SpotifyCard
            item={item}
            isDragging={draggingItemId === item.id}
            isReadonly={isReadonly}
            isPlaying={playingSpotifyId === item.id}
            onDelete={() => deleteItem(item.id)}
            onStyleChange={(s) => updateSpotifyStyle(item.id, s)}
            onPlay={() => handleSpotifyPlay(item)}
          />
        )
      case 'doodle':
        return (
          <div
            style={{ width: '100%', height: '100%', position: 'relative', cursor: 'grab' }}
            onMouseEnter={() => handleCardMouseEnter(item.id)}
            onMouseLeave={handleCardMouseLeave}
          >
            <img src={item.src} alt="Doodle" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
          </div>
        )
      case 'sticker':
        return (
          <div
            style={{ width: '100%', height: '100%', position: 'relative' }}
            onMouseEnter={() => handleCardMouseEnter(item.id)}
            onMouseLeave={handleCardMouseLeave}
          >
            <img src={item.src} alt="Sticker" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
          </div>
        )
      case 'datetime':
        return (
          <div
            style={{ width: '100%', height: '100%', position: 'relative' }}
            onMouseEnter={() => handleCardMouseEnter(item.id)}
            onMouseLeave={handleCardMouseLeave}
          >
            <RetroClockCard />
          </div>
        )
      case 'countdown':
        return (
          <div
            style={{ width: '100%', height: '100%', position: 'relative' }}
            onMouseEnter={() => handleCardMouseEnter(item.id)}
            onMouseLeave={handleCardMouseLeave}
          >
            <RetroCountdownCard label={item.label} targetMs={item.targetMs} />
          </div>
        )
      case 'location':
        return (
          <div
            style={{ width: '100%', height: '100%', position: 'relative' }}
            onMouseEnter={() => handleCardMouseEnter(item.id)}
            onMouseLeave={handleCardMouseLeave}
          >
            <LocationCard name={item.name} address={item.address} />
          </div>
        )
      case 'text': {
        const isSelected = item.id === selectedItemId
        const fontFamily =
          item.fontFamily === 'note' ? 'var(--font-note)' : 'var(--font-ui)'
        const fontWeight = item.bold ? 700 : 400
        return (
          <div className={`text-card ${isSelected ? 'text-card-selected' : ''}`}>
            <div
              className="text-body"
              contentEditable={!isReadonly}
              suppressContentEditableWarning
              style={{
                fontFamily,
                fontSize: `${item.fontSize}px`,
                color: item.color,
                fontWeight,
              }}
              onInput={(e) => {
                if (isReadonly) return
                const nextText = (e.currentTarget.textContent ?? '').trimEnd()
                updateItem(item.id, (prev) =>
                  prev.type === 'text' ? { ...prev, text: nextText } : prev,
                )
              }}
            >
              {item.text}
            </div>
          </div>
        )
      }
      default:
        return null
    }
  }

  const _toolbarDisabled = isReadonly

  if (isReadonly) {
    return (
      <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden' }}>
        <div className="board-canvas" style={{ width: '100%', height: '100%' }}>
          {items.map((item) => (
            <Rnd
              key={item.id}
              size={{ width: item.width, height: item.height }}
              position={{ x: item.x, y: item.y }}
              enableResizing={false}
              disableDragging={true}
              bounds="parent"
              style={{ transform: `rotate(${item.rotation}deg)`, transformOrigin: 'center' }}
            >
              <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                {renderItemCard(item)}
              </div>
            </Rnd>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-title app-title-group">Memory Board</div>
        <div className="app-header-actions">
          {isReadonly && <span className="pill">Viewing shared board</span>}
          {!isReadonly && (
            <button
              type="button"
              className={`app-share-button icon-only${isSharing ? ' sharing' : ''}`}
              onClick={handleShare}
              aria-label="Share board"
              disabled={isSharing}
            >
              {isSharing ? (
                <svg className="share-spinner" viewBox="0 0 24 24" width="18" height="18" fill="none">
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="40" strokeDashoffset="20" />
                </svg>
              ) : (
                <img
                  className="app-share-icon"
                  src="https://api.iconify.design/material-symbols:share.svg?color=white"
                  alt=""
                />
              )}
            </button>
          )}
          <button
            type="button"
            className="app-share-button"
            onClick={handleNewBoard}
          >
            New Board
          </button>
        </div>
      </header>

      <main className="app-main">
        <section className="app-board-wrapper">
          <div className="board-meta-row">
            <span>
              {boardMeta.count > 0 && (
                <>
                  <strong>{boardMeta.count}</strong>{' '}
                  {boardMeta.count === 1 ? 'memory pinned' : 'memories pinned'}
                </>
              )}
            </span>
            <span>{boardMeta.lastUpdated && `Last updated ${boardMeta.lastUpdated}`}</span>
          </div>
          <div className="board-frame">
            <div
              className={`board-canvas ${isReadonly ? 'readonly' : ''}`}
              onMouseDown={(e) => { if (e.target === e.currentTarget) setSelectedItemId(null) }}
            >
              {items.map((item) => (
                <Rnd
                  key={item.id}
                  size={{ width: item.width, height: item.height }}
                  position={{ x: item.x, y: item.y }}
                  lockAspectRatio={item.type === 'sticker'}
                  enableResizing={isReadonly ? false : {
                    top: true, right: true, bottom: true, left: true,
                    topLeft: true, topRight: true,
                    bottomLeft: true, bottomRight: true,
                  }}
                  disableDragging={isReadonly || (item.type === 'note' && editingNoteId === item.id)}
                  bounds="window"

                  onDragStart={() => { setDraggingItemId(item.id); startBinTracking() }}
                  onDrag={() => {}}
                  onDragStop={(e, data) => {
                    setDraggingItemId(null)
                    stopBinTracking()
                    setDraggingOverBin(false)
                    setBinProximity(0)
                    setLidOpen(false)
                    setDragScaleVal(1)
                    if (isReadonly) return
                    if (binRef.current) {
                      const r = binRef.current.getBoundingClientRect()
                      const mx = (e as MouseEvent).clientX
                      const my = (e as MouseEvent).clientY
                      if (mx >= r.left && mx <= r.right && my >= r.top && my <= r.bottom) {
                        deleteItem(item.id)
                        return
                      }
                    }
                    updateItem(item.id, (prev) => ({
                      ...prev,
                      x: data.x,
                      y: data.y,
                    }))
                  }}
                  onResizeStop={(_, __, ref, _delta, position) => {
                    if (isReadonly) return
                    const nextWidth = ref.offsetWidth
                    const nextHeight = ref.offsetHeight
                    updateItem(item.id, (prev) => ({
                      ...prev,
                      width: nextWidth,
                      height: nextHeight,
                      x: position.x,
                      y: position.y,
                    }))
                  }}
                  style={{
                    transform: `rotate(${item.rotation}deg)`,
                    transformOrigin: 'center',
                    zIndex: draggingItemId === item.id ? 9999 : undefined,
                  }}
                >
                  <div
                    style={{
                      width: '100%', height: '100%', position: 'relative',
                      transform: `scale(${draggingItemId === item.id ? dragScaleVal : 1})`,
                      opacity: draggingItemId === item.id ? (0.4 + dragScaleVal * 0.6) : 1,
                      transition: 'transform 0.15s ease, opacity 0.15s ease',
                      transformOrigin: 'center',
                    }}
                    onMouseDown={() => setSelectedItemId(item.id)}
                    onMouseEnter={() => handleCardMouseEnter(item.id)}
                    onMouseLeave={handleCardMouseLeave}
                  >
                    {renderItemCard(item)}
                  </div>
                </Rnd>
              ))}


            </div>

            {!isReadonly && (
              <>
              <div style={{
                position: 'absolute',
                bottom: 22,
                left: '50%',
                transform: toolbarCollapsed ? 'translateX(-50%) translateY(18px)' : 'translateX(-50%) translateY(0)',
                opacity: toolbarCollapsed ? 0 : 1,
                pointerEvents: toolbarCollapsed ? 'none' : 'auto',
                transition: 'opacity 220ms ease, transform 220ms ease',
                background: '#fff',
                borderRadius: 26,
                padding: '4px 8px',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                zIndex: 100,
                boxShadow: '0 8px 40px rgba(0,0,0,0.10), 0 0 0 1px rgba(0,0,0,0.05)',
              }}>
              {/* Toggle arrow — half inside, half outside the top edge */}
              <button
                type="button"
                onClick={() => setToolbarCollapsed((c) => !c)}
                style={{
                  position: 'absolute',
                  top: -8,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: '#fff',
                  border: 'none',
                  borderRadius: 999,
                  width: 28,
                  height: 16,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  boxShadow: '0 -2px 6px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.06)',
                  zIndex: 1,
                }}
              >
                <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{ transition: 'transform 220ms ease', transform: toolbarCollapsed ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                  <path d="M1 1L5 5L9 1" stroke="#666" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
                {/* Camera / Photo */}
                <div
                  style={{ position: 'relative' }}
                  onMouseEnter={() => setCameraHovered(true)}
                  onMouseLeave={() => setCameraHovered(false)}
                >
                  <ToolbarBtn onClick={() => setShowPhotoModal((o) => !o)} icon={
                    <div className={`camera-icon-wrap${cameraHovered ? ' is-hovered' : ''}`}>
                      <CameraIcon />
                    </div>
                  } />
                  {showPhotoModal && (
                    <>
                      <div style={{ position: 'fixed', inset: 0, zIndex: 199 }} onClick={() => setShowPhotoModal(false)} />
                      <div style={{
                        position: 'absolute',
                        bottom: 'calc(100% + 12px)',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        zIndex: 200,
                      }}>
                        <PhotoModal
                          onClose={() => setShowPhotoModal(false)}
                          onAdd={(file) => { handlePhotoUpload(file); setShowPhotoModal(false) }}
                        />
                      </div>
                    </>
                  )}
                  {!showPhotoModal && cameraHovered && (
                    <div style={{
                      position: 'absolute',
                      bottom: 'calc(100% + 10px)',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: 110,
                      height: 80,
                      pointerEvents: 'none',
                    }}>
                      {/* Back-left polaroid */}
                      <div
                        className="polaroid-preview"
                        style={{ left: 4, top: 12, '--rot': '-14deg' } as React.CSSProperties}
                      >
                        <div className="polaroid-preview-inner" style={{ background: '#1a1a1a' }} />
                      </div>
                      {/* Back-right polaroid */}
                      <div
                        className="polaroid-preview"
                        style={{ left: 50, top: 8, '--rot': '12deg', animationDelay: '60ms' } as React.CSSProperties}
                      >
                        <div className="polaroid-preview-inner" style={{ background: '#2a2a2a' }} />
                      </div>
                      {/* Front-center polaroid */}
                      <div
                        className="polaroid-preview"
                        style={{ left: 27, top: 16, '--rot': '-3deg', animationDelay: '120ms' } as React.CSSProperties}
                      >
                        <div className="polaroid-preview-inner" style={{ background: '#1a1a1a' }} />
                      </div>
                    </div>
                  )}
                </div>

                {/* Note with color picker */}
                <div
                  style={{ position: 'relative' }}
                  onMouseEnter={() => setNoteIconHovered(true)}
                  onMouseLeave={() => setNoteIconHovered(false)}
                >
                  <ToolbarBtn onClick={() => setNotePicker((o) => !o)} icon={
                    <div className={`note-icon-wrap${noteIconHovered ? ' is-hovered' : ''}`}>
                      <NoteIcon />
                    </div>
                  } />
                  {noteIconHovered && !notePicker && (
                    <div style={{
                      position: 'absolute',
                      bottom: 'calc(100% + 10px)',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: 110,
                      height: 72,
                      pointerEvents: 'none',
                    }}>
                      {/* Back-left — pink */}
                      <div
                        className="note-preview"
                        style={{ left: 6, top: 14, background: '#FDE8EE', '--rot': '-13deg' } as React.CSSProperties}
                      >
                        <div className="note-preview-tape" />
                      </div>
                      {/* Back-right — mint */}
                      <div
                        className="note-preview"
                        style={{ left: 52, top: 10, background: '#E6F4EA', '--rot': '11deg', animationDelay: '60ms' } as React.CSSProperties}
                      >
                        <div className="note-preview-tape" />
                      </div>
                      {/* Front-center — light blue */}
                      <div
                        className="note-preview"
                        style={{ left: 29, top: 20, background: '#E3F2FD', '--rot': '-2deg', animationDelay: '120ms' } as React.CSSProperties}
                      >
                        <div className="note-preview-tape" />
                      </div>
                    </div>
                  )}
                  {notePicker && (
                    <>
                      <div
                        style={{ position: 'fixed', inset: 0, zIndex: 199 }}
                        onClick={() => setNotePicker(false)}
                      />
                      <div style={{
                        position: 'absolute',
                        bottom: 'calc(100% + 12px)',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        background: '#fff',
                        borderRadius: 20,
                        padding: '14px 16px',
                        boxShadow: '0 12px 40px rgba(0,0,0,0.16), 0 0 0 1px rgba(0,0,0,0.05)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 10,
                        zIndex: 200,
                        width: 220,
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontFamily: 'var(--font-note)', fontWeight: 700, fontSize: 15 }}>Add a Note</span>
                          <button type="button" onClick={() => setNotePicker(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#999', lineHeight: 1, padding: 0 }}>×</button>
                        </div>
                        <p style={{ fontFamily: 'var(--font-note)', fontSize: 11, color: '#999', margin: 0, fontStyle: 'italic' }}>
                          Pick a colour and drop a note on your board.
                        </p>
                        <div style={{ display: 'flex', gap: 8 }}>
                        {NOTE_COLOR_OPTIONS.map((nc) => (
                          <button
                            key={nc.color}
                            title={nc.label}
                            type="button"
                            className="note-color-swatch"
                            onClick={() => { addNote(nc.color); setNotePicker(false) }}
                            style={{
                              width: 34, height: 34, borderRadius: 8,
                              background: nc.bg,
                              border: '1.5px solid rgba(0,0,0,0.08)',
                              cursor: 'pointer',
                            }}
                          />
                        ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Spotify / CD */}
                <div style={{ position: 'relative', marginLeft: -6 }}
                  onMouseEnter={() => setCdHovered(true)}
                  onMouseLeave={() => setCdHovered(false)}
                >
                  <ToolbarBtn
                    onClick={() => { setActiveTool('spotify'); setShowSpotifyModal((o) => !o) }}
                    icon={
                      <div className={`cd-icon-wrap${cdHovered ? ' is-hovered' : ''}`}>
                        <CDIcon />
                      </div>
                    }
                  />
                  {cdHovered && !showSpotifyModal && (
                    <div style={{
                      position: 'absolute',
                      bottom: 'calc(100% + 10px)',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      pointerEvents: 'none',
                    }}>
                      <div className="eq-preview">
                        <div className="eq-bar" style={{ '--delay': '0ms', '--height': '60%' } as React.CSSProperties} />
                        <div className="eq-bar" style={{ '--delay': '120ms', '--height': '90%' } as React.CSSProperties} />
                        <div className="eq-bar" style={{ '--delay': '60ms', '--height': '40%' } as React.CSSProperties} />
                        <div className="eq-bar" style={{ '--delay': '180ms', '--height': '75%' } as React.CSSProperties} />
                        <div className="eq-bar" style={{ '--delay': '90ms', '--height': '55%' } as React.CSSProperties} />
                      </div>
                    </div>
                  )}
                  {showSpotifyModal && (
                    <>
                      <div style={{ position: 'fixed', inset: 0, zIndex: 199 }} onClick={() => { setShowSpotifyModal(false); setPendingSpotifyUrl('') }} />
                      <div style={{
                        position: 'absolute',
                        bottom: 'calc(100% + 12px)',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        background: '#fff',
                        borderRadius: 20,
                        padding: '14px 16px',
                        boxShadow: '0 12px 40px rgba(0,0,0,0.16), 0 0 0 1px rgba(0,0,0,0.05)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 10,
                        zIndex: 200,
                        width: 280,
                      }}>
                        {/* Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontFamily: 'var(--font-note)', fontWeight: 700, fontSize: 15 }}>Add Spotify</span>
                          <button
                            type="button"
                            onClick={() => { setShowSpotifyModal(false); setPendingSpotifyUrl('') }}
                            style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#999', lineHeight: 1, padding: 0 }}
                          >×</button>
                        </div>
                        {/* Subtitle */}
                        <p style={{ fontFamily: 'var(--font-note)', fontSize: 11, color: '#999', margin: 0, fontStyle: 'italic' }}>
                          Paste a Spotify track, album, or playlist link.
                        </p>
                        {/* Input + button */}
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <input
                            autoFocus
                            type="text"
                            placeholder="https://open.spotify.com/…"
                            value={pendingSpotifyUrl}
                            onChange={(e) => setPendingSpotifyUrl(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter' && pendingSpotifyUrl.trim()) { handleSpotifyAdd() } }}
                            style={{
                              flex: 1,
                              padding: '8px 12px',
                              borderRadius: 10,
                              border: '1.5px solid #e0e0e0',
                              fontSize: '0.78rem',
                              outline: 'none',
                              fontFamily: 'var(--font-note)',
                            }}
                          />
                          <button
                            type="button"
                            disabled={!pendingSpotifyUrl.trim()}
                            onClick={() => { handleSpotifyAdd() }}
                            style={{
                              padding: '8px 14px',
                              borderRadius: 10,
                              border: 'none',
                              background: '#222',
                              color: '#fff',
                              fontSize: '0.82rem',
                              fontWeight: 700,
                              cursor: pendingSpotifyUrl.trim() ? 'pointer' : 'default',
                              opacity: pendingSpotifyUrl.trim() ? 1 : 0.5,
                              whiteSpace: 'nowrap',
                              fontFamily: 'var(--font-note)',
                            }}
                          >
                            Add
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Doodle / Pencil */}
                <div style={{ position: 'relative', marginLeft: -6 }}
                  onMouseEnter={() => setPencilHovered(true)}
                  onMouseLeave={() => setPencilHovered(false)}
                >
                  <ToolbarBtn
                    onClick={() => { setActiveTool('doodle'); setShowDoodleModal((o) => !o) }}
                    icon={
                      <div className={`pencil-icon-wrap${pencilHovered ? ' is-hovered' : ''}`}>
                        <PencilIcon />
                      </div>
                    }
                  />
                  {showDoodleModal && (
                    <>
                      <div style={{ position: 'fixed', inset: 0, zIndex: 199 }} onClick={() => setShowDoodleModal(false)} />
                      <div style={{
                        position: 'absolute',
                        bottom: 'calc(100% + 12px)',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        zIndex: 200,
                      }}>
                        <DoodleModal
                          onClose={() => setShowDoodleModal(false)}
                          onSave={(dataUrl) => { handleDoodleSaved(dataUrl); setShowDoodleModal(false) }}
                        />
                      </div>
                    </>
                  )}
                  {!showDoodleModal && pencilHovered && (
                    <div style={{
                      position: 'absolute',
                      bottom: 'calc(100% + 2px)',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: 110,
                      height: 60,
                      pointerEvents: 'none',
                    }}>
                      {/* red squiggle */}
                      <svg className="doodle-squiggle" style={{ left: 4, top: 18, '--rot': '-14deg', color: '#E8635A' } as React.CSSProperties} viewBox="0 0 52 24" width="52" height="24">
                        <path d="M 3,16 C 9,4 17,22 26,12 C 35,2 43,20 49,8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" fill="none"/>
                      </svg>
                      {/* green squiggle */}
                      <svg className="doodle-squiggle" style={{ left: 50, top: 14, '--rot': '13deg', color: '#1DB954', animationDelay: '60ms' } as React.CSSProperties} viewBox="0 0 52 24" width="52" height="24">
                        <path d="M 3,16 C 9,4 17,22 26,12 C 35,2 43,20 49,8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" fill="none"/>
                      </svg>
                      {/* blue squiggle */}
                      <svg className="doodle-squiggle" style={{ left: 27, top: 22, '--rot': '-2deg', color: '#3B82F6', animationDelay: '120ms' } as React.CSSProperties} viewBox="0 0 52 24" width="52" height="24">
                        <path d="M 3,16 C 9,4 17,22 26,12 C 35,2 43,20 49,8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" fill="none"/>
                      </svg>
                    </div>
                  )}
                </div>

                {/* Creative picker */}
                <div style={{ position: 'relative', marginLeft: -6 }}
                  onMouseEnter={() => setFlowerHovered(true)}
                  onMouseLeave={() => setFlowerHovered(false)}
                >
                  <ToolbarBtn
                    onClick={() => setShowCreativePicker((o) => !o)}
                    icon={<div className={`flower-icon-wrap${flowerHovered ? ' is-hovered' : ''}`}><CreativeIcon /></div>}
                  />
                  {flowerHovered && !showCreativePicker && (
                    <div style={{
                      position: 'absolute',
                      bottom: 'calc(100% + 10px)',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: 110,
                      height: 60,
                      pointerEvents: 'none',
                    }}>
                      <span className="flower-petal-preview" style={{ left: 7, top: 18, '--rot': '-14deg', animationDelay: '0ms' } as React.CSSProperties}>🎞️</span>
                      <span className="flower-petal-preview" style={{ left: 76, top: 14, '--rot': '13deg', animationDelay: '60ms' } as React.CSSProperties}>⏱️</span>
                      <span className="flower-petal-preview" style={{ left: 41, top: 22, '--rot': '-2deg', animationDelay: '120ms' } as React.CSSProperties}>🖌️</span>
                    </div>
                  )}
                  {showCreativePicker && (
                    <>
                      <div
                        style={{ position: 'fixed', inset: 0, zIndex: 199 }}
                        onClick={() => setShowCreativePicker(false)}
                      />
                      <div style={{
                        position: 'absolute',
                        bottom: 'calc(100% + 14px)',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        background: '#fff',
                        borderRadius: 20,
                        padding: '14px 12px',
                        boxShadow: '0 12px 40px rgba(0,0,0,0.16), 0 0 0 1px rgba(0,0,0,0.05)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                        zIndex: 200,
                        width: 220,
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontFamily: 'var(--font-note)', fontWeight: 700, fontSize: 15 }}>Creative Tools</span>
                          <button type="button" onClick={() => setShowCreativePicker(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#999', lineHeight: 1, padding: 0 }}>×</button>
                        </div>
                        <p style={{ fontFamily: 'var(--font-note)', fontSize: 11, color: '#999', margin: 0, fontStyle: 'italic' }}>
                          Add fun elements to your board.
                        </p>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                        {CREATIVE_OPTIONS.map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => handleCreativeOption(opt.id)}
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 5,
                              padding: 0,
                              height: 64,
                              borderRadius: 14,
                              border: `1.5px solid ${opt.stroke}`,
                              background: opt.color,
                              cursor: 'pointer',
                              transition: 'transform 0.15s, box-shadow 0.15s, border-color 0.15s',
                            }}
                            onMouseEnter={(e) => {
                              const el = e.currentTarget as HTMLButtonElement
                              el.style.transform = 'scale(1.06)'
                              el.style.boxShadow = '0 4px 14px rgba(0,0,0,0.12)'
                              el.style.borderColor = opt.strokeHover
                            }}
                            onMouseLeave={(e) => {
                              const el = e.currentTarget as HTMLButtonElement
                              el.style.transform = 'scale(1)'
                              el.style.boxShadow = 'none'
                              el.style.borderColor = opt.stroke
                            }}
                          >
                            <span style={{ fontSize: 22 }}>{opt.emoji}</span>
                            <span style={{ fontFamily: 'var(--font-note)', fontSize: 9, color: '#555', fontWeight: 600, lineHeight: 1 }}>{opt.label}</span>
                          </button>
                        ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Divider */}
                <div style={{ width: 1, background: 'rgba(0,0,0,0.08)', margin: '8px 4px', alignSelf: 'stretch' }} />

                {/* Bin — inside toolbar */}
                {(() => {
                  const binColor = binProximity > 0.05 ? `rgb(${Math.round(232 * binProximity)},${Math.round(99 * (1 - binProximity) + 40 * binProximity)},${Math.round(90 * binProximity)})` : '#c0c0c0'
                  const binBg = lidOpen ? 'rgba(232,99,90,0.1)' : binProximity > 0.1 ? `rgba(232,99,90,${binProximity * 0.08})` : 'transparent'
                  return (
                    <div ref={binRef} style={{
                      width: 54, height: 54, borderRadius: 16,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: binBg,
                      transition: 'all 0.25s ease',
                      transform: lidOpen ? 'scale(1.2)' : binProximity > 0.2 ? `scale(${1 + binProximity * 0.12})` : 'scale(1)',
                      flexShrink: 0,
                    }}>
                      <svg width="36" height="36" viewBox="0 0 54 54" fill="none" style={{ overflow: 'visible' }}>
                        <g style={{
                          transformOrigin: '11px 10px',
                          transform: lidOpen ? 'rotate(-35deg)' : 'rotate(0deg)',
                          transition: 'transform 0.25s cubic-bezier(0.34,1.56,0.64,1)',
                        } as React.CSSProperties}>
                          <rect x="21" y="6" width="12" height="4" rx="2" fill={binColor}/>
                          <rect x="11" y="10" width="32" height="5" rx="2.5" fill={binColor}/>
                        </g>
                        <rect x="13" y="16" width="28" height="28" rx="3" fill={binColor}/>
                        <line x1="20" y1="20" x2="20" y2="40" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
                        <line x1="27" y1="20" x2="27" y2="40" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
                        <line x1="34" y1="20" x2="34" y2="40" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                    </div>
                  )
                })()}

                {/* Text style controls when a text item is selected */}
                {selectedTextItem && (
                  <div className="board-toolbar-right">
                    <span className="text-style-label">Text</span>
                    <select
                      className="text-style-control"
                      value={selectedTextItem.fontSize}
                      onChange={(e) =>
                        updateItem(selectedTextItem.id, (prev) =>
                          prev.type === 'text' ? { ...prev, fontSize: Number(e.target.value) } : prev,
                        )
                      }
                    >
                      <option value={14}>S</option>
                      <option value={18}>M</option>
                      <option value={24}>L</option>
                      <option value={32}>XL</option>
                    </select>
                    <input
                      type="color"
                      className="text-style-color"
                      value={selectedTextItem.color}
                      onChange={(e) =>
                        updateItem(selectedTextItem.id, (prev) =>
                          prev.type === 'text' ? { ...prev, color: e.target.value } : prev,
                        )
                      }
                    />
                    <select
                      className="text-style-control"
                      value={selectedTextItem.fontFamily}
                      onChange={(e) =>
                        updateItem(selectedTextItem.id, (prev) =>
                          prev.type === 'text'
                            ? { ...prev, fontFamily: e.target.value === 'note' ? 'note' : 'ui' }
                            : prev,
                        )
                      }
                    >
                      <option value="ui">Sans</option>
                      <option value="note">Mono</option>
                    </select>
                    <button
                      type="button"
                      className={`text-style-button ${selectedTextItem.bold ? 'is-active' : ''}`}
                      onClick={() =>
                        updateItem(selectedTextItem.id, (prev) =>
                          prev.type === 'text' ? { ...prev, bold: !prev.bold } : prev,
                        )
                      }
                    >
                      B
                    </button>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setToolbarCollapsed(false)}
                style={{
                  position: 'absolute',
                  bottom: 22,
                  left: '50%',
                  transform: toolbarCollapsed ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(10px)',
                  opacity: toolbarCollapsed ? 1 : 0,
                  pointerEvents: toolbarCollapsed ? 'auto' : 'none',
                  transition: 'opacity 220ms ease, transform 220ms ease',
                  background: '#fff',
                  border: 'none',
                  borderRadius: 999,
                  width: 28,
                  height: 16,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.06)',
                  zIndex: 100,
                }}
              >
                <svg width="10" height="6" viewBox="0 0 10 6" fill="none">
                  <path d="M1 5L5 1L9 5" stroke="#666" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              </>
            )}
          </div>
        </section>
      </main>

      {showToast && <div className="toast">{showToast}</div>}


      {showGifModal && !isReadonly && (
        <GifModal
          onClose={() => setShowGifModal(false)}
          onSelect={handleGifSelect}
        />
      )}
      {showStickerModal && !isReadonly && (
        <StickerModal
          onClose={() => setShowStickerModal(false)}
          onSelect={handleStickerSelect}
        />
      )}
      {showIllustrationsModal && !isReadonly && (
        <IllustrationsModal
          onClose={() => setShowIllustrationsModal(false)}
          onSelect={(svg) => {
            let normalizedSvg = svg
            if (!normalizedSvg.includes('viewBox')) {
              const wMatch = normalizedSvg.match(/width="(\d+(?:\.\d+)?)"/)
              const hMatch = normalizedSvg.match(/height="(\d+(?:\.\d+)?)"/)
              const w = wMatch ? wMatch[1] : '256'
              const h = hMatch ? hMatch[1] : '256'
              normalizedSvg = normalizedSvg.replace('<svg ', `<svg viewBox="0 0 ${w} ${h}" `)
            }
            const blob = new Blob([normalizedSvg], { type: 'image/svg+xml' })
            const url = URL.createObjectURL(blob)
            const newItem: StickerItem = {
              id: crypto.randomUUID(), type: 'sticker', src: url,
              x: 160 + Math.random() * 140, y: 100 + Math.random() * 140,
              width: 200, height: 200, rotation: randomRotation(), createdAt: Date.now(),
            }
            setItems((prev) => [...prev, newItem])
            setShowIllustrationsModal(false)
          }}
        />
      )}
      {showCountdownModal && !isReadonly && (
        <CountdownModal
          onClose={() => setShowCountdownModal(false)}
          onCreate={handleCountdownCreate}
        />
      )}

      {showLocationPicker && !isReadonly && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} onClick={closeLocationPicker} />
          <div style={{
            position: 'relative', background: '#fff', borderRadius: 20, width: 360, maxWidth: '95vw',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
            boxShadow: '0 24px 60px rgba(0,0,0,0.25)',
          }}>
            <div style={{ padding: '16px 18px 14px', borderBottom: '1px solid rgba(0,0,0,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 700, fontSize: '1rem', fontFamily: 'var(--font-note)' }}>Find a Location</span>
              <button type="button" onClick={closeLocationPicker} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', color: '#888' }}>✕</button>
            </div>
            <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  autoFocus
                  type="text"
                  placeholder="Search a place…"
                  value={locationQuery}
                  onChange={(e) => handleLocationInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && searchLocations(locationQuery)}
                  style={{
                    flex: 1, padding: '8px 12px', borderRadius: 10,
                    border: '1.5px solid #e0e0e0', fontSize: '0.82rem',
                    outline: 'none', fontFamily: 'var(--font-note)',
                  }}
                />
                <button
                  type="button"
                  onClick={handleLocationMyLocation}
                  disabled={locationGeoLoading}
                  title="Use my location"
                  style={{
                    padding: '8px 12px', borderRadius: 10, border: '1.5px solid #e0e0e0',
                    background: '#fff', cursor: 'pointer', fontSize: 16,
                    opacity: locationGeoLoading ? 0.5 : 1,
                  }}
                >📍</button>
              </div>
              {locationLoading && (
                <div style={{ fontSize: '0.75rem', color: '#aaa', fontFamily: 'var(--font-ui)', textAlign: 'center', padding: '6px 0' }}>Searching…</div>
              )}
              {locationResults.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 260, overflowY: 'auto' }}>
                  {locationResults.map((r) => (
                    <button
                      key={r.place_id}
                      type="button"
                      onClick={() => handleLocationPick(r)}
                      style={{
                        textAlign: 'left', padding: '8px 10px', borderRadius: 8,
                        border: 'none', cursor: 'pointer', background: 'transparent',
                        fontFamily: 'var(--font-ui)', transition: 'background 100ms',
                        display: 'flex', alignItems: 'center', gap: 8,
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(0,0,0,0.06)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <span style={{ fontSize: 14, flexShrink: 0 }}>📍</span>
                      <div>
                        <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#1a1a1a' }}>{r.name || r.display_name.split(',')[0]}</div>
                        <div style={{ fontSize: '0.65rem', color: '#999' }}>{r.display_name.split(',').slice(1, 3).join(',').trim()}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  )
}

// ── Retro Clock ────────────────────────────────────────────────────────────

function RetroClockCard() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  const ss = String(now.getSeconds()).padStart(2, '0')
  const date = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase()

  return (
    <div style={{
      width: '100%', height: '100%',
      background: 'linear-gradient(160deg, #0a1a0a 0%, #050e05 100%)',
      borderRadius: 10,
      border: '2px solid #1c3c1c',
      boxShadow: 'inset 0 0 18px rgba(0,255,60,0.06), 0 0 0 1px #0a1a0a',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Courier New', Courier, monospace",
      position: 'relative',
      overflow: 'hidden',
      gap: 4,
    }}>
      {/* scanlines overlay */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.18) 2px, rgba(0,0,0,0.18) 4px)',
        borderRadius: 8,
      }} />
      <div style={{
        fontSize: '2rem', fontWeight: 700, letterSpacing: '0.18em',
        color: '#39ff6a',
        textShadow: '0 0 6px #39ff6a, 0 0 16px rgba(57,255,106,0.55)',
        lineHeight: 1,
        userSelect: 'none',
      }}>
        {hh}<span style={{ opacity: now.getSeconds() % 2 === 0 ? 1 : 0.15, transition: 'opacity 0.1s' }}>:</span>{mm}<span style={{ opacity: now.getSeconds() % 2 === 0 ? 1 : 0.15, transition: 'opacity 0.1s' }}>:</span>{ss}
      </div>
      <div style={{
        fontSize: '0.6rem', letterSpacing: '0.12em',
        color: '#1ec44a',
        textShadow: '0 0 5px rgba(30,196,74,0.6)',
        opacity: 0.85,
        userSelect: 'none',
      }}>
        {date}
      </div>
    </div>
  )
}

// ── Retro Countdown ────────────────────────────────────────────────────────

function RetroCountdownCard({ label, targetMs }: { label: string; targetMs: number }) {
  const [remaining, setRemaining] = useState(() => Math.max(0, targetMs - Date.now()))

  useEffect(() => {
    const t = setInterval(() => {
      const left = Math.max(0, targetMs - Date.now())
      setRemaining(left)
      if (left === 0) clearInterval(t)
    }, 1000)
    return () => clearInterval(t)
  }, [targetMs])

  const done = remaining === 0
  const totalSecs = Math.floor(remaining / 1000)
  const dd = Math.floor(totalSecs / 86400)
  const hh = Math.floor((totalSecs % 86400) / 3600)
  const mm = Math.floor((totalSecs % 3600) / 60)
  const ss = totalSecs % 60

  const pad = (n: number) => String(n).padStart(2, '0')

  const accent = '#ff9500'
  const accentDim = '#cc7700'
  const glow = `0 0 6px ${accent}, 0 0 18px rgba(255,149,0,0.5)`

  return (
    <div style={{
      width: '100%', height: '100%',
      background: 'linear-gradient(160deg, #1a0e00 0%, #0d0700 100%)',
      borderRadius: 10,
      border: `2px solid #3a2200`,
      boxShadow: 'inset 0 0 18px rgba(255,149,0,0.06)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Courier New', Courier, monospace",
      position: 'relative', overflow: 'hidden',
      gap: 6,
    }}>
      {/* scanlines */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.2) 2px, rgba(0,0,0,0.2) 4px)',
        borderRadius: 8,
      }} />

      {/* label */}
      {label && (
        <div style={{
          fontSize: '0.58rem', letterSpacing: '0.2em', textTransform: 'uppercase',
          color: accentDim, textShadow: `0 0 5px ${accentDim}`,
          opacity: 0.9, userSelect: 'none',
        }}>{label}</div>
      )}

      {done ? (
        <div style={{
          fontSize: '1.3rem', fontWeight: 700, letterSpacing: '0.12em',
          color: accent, textShadow: glow, userSelect: 'none',
          animation: 'retro-blink 0.8s step-start infinite',
        }}>TIME'S UP!</div>
      ) : (
        <>
          {/* digit blocks */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
            {[
              { val: dd, unit: 'DAYS' },
              { val: hh, unit: 'HRS' },
              { val: mm, unit: 'MIN' },
              { val: ss, unit: 'SEC' },
            ].map(({ val, unit }, i) => (
              <React.Fragment key={unit}>
                {i > 0 && (
                  <div style={{
                    color: accent, textShadow: glow,
                    fontSize: '1.5rem', fontWeight: 700,
                    lineHeight: 1, paddingTop: 2,
                    opacity: (Date.now() / 500 | 0) % 2 === 0 ? 1 : 0.2,
                    userSelect: 'none',
                  }}>:</div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <div style={{
                    fontSize: '1.6rem', fontWeight: 700, letterSpacing: '0.08em',
                    color: accent, textShadow: glow,
                    lineHeight: 1, userSelect: 'none',
                  }}>{pad(val)}</div>
                  <div style={{
                    fontSize: '0.45rem', letterSpacing: '0.15em',
                    color: accentDim, opacity: 0.75, userSelect: 'none',
                  }}>{unit}</div>
                </div>
              </React.Fragment>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ── Location ───────────────────────────────────────────────────────────────

function LocationCard({ name, address }: { name: string; address: string }) {
  return (
    <div style={{
      width: '100%', height: '100%',
      background: 'rgba(255,255,255,0.95)',
      borderRadius: 10,
      border: '1.5px solid rgba(0,0,0,0.10)',
      boxShadow: '0 2px 10px rgba(0,0,0,0.08)',
      display: 'flex', alignItems: 'center',
      padding: '0 14px 0 10px',
      gap: 8,
      fontFamily: 'var(--font-ui)',
      overflow: 'hidden',
    }}>
      <img
        src="https://api.iconify.design/material-symbols:location-on-outline.svg?color=%23e53935"
        width="28" height="28" alt=""
        draggable={false}
        style={{ flexShrink: 0 }}
      />
      <div style={{ overflow: 'hidden', lineHeight: 1.2 }}>
        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#1a1a1a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
        {address && (
          <div style={{ fontSize: '0.58rem', color: '#888', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{address}</div>
        )}
      </div>
    </div>
  )
}

type NominatimResult = { place_id: number; display_name: string; lat: string; lon: string; name: string; address: { city?: string; town?: string; country?: string } }

function CountdownModal({ onClose, onCreate }: { onClose: () => void; onCreate: (label: string, targetMs: number) => void }) {
  const [label, setLabel] = useState('')
  const [mode, setMode] = useState<'date' | 'duration'>('date')

  const minDate = new Date(Date.now() + 60000).toISOString().slice(0, 16)
  const [targetDate, setTargetDate] = useState(minDate)
  const [days, setDays] = useState(0)
  const [hours, setHours] = useState(1)
  const [minutes, setMinutes] = useState(0)

  const handleCreate = () => {
    let ms: number
    if (mode === 'date') {
      ms = new Date(targetDate).getTime()
    } else {
      ms = Date.now() + (days * 86400 + hours * 3600 + minutes * 60) * 1000
    }
    if (isNaN(ms) || ms <= Date.now()) return
    onCreate(label.trim(), ms)
  }

  const inputStyle: React.CSSProperties = {
    padding: '8px 12px', borderRadius: 10, border: '1.5px solid rgba(0,0,0,0.14)',
    fontSize: '0.85rem', outline: 'none', fontFamily: 'var(--font-ui)', boxSizing: 'border-box', width: '100%',
  }

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} onClick={onClose} />
      <div style={{
        position: 'relative', background: '#fff', borderRadius: 20, width: 380, maxWidth: '95vw',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: '0 24px 60px rgba(0,0,0,0.25)',
      }}>
        <div style={{ padding: '16px 18px 14px', borderBottom: '1px solid rgba(0,0,0,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 700, fontSize: '1rem', fontFamily: 'var(--font-ui)' }}>Countdown</span>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', color: '#888' }}>✕</button>
        </div>

        <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: '0.72rem', fontWeight: 600, color: '#555', fontFamily: 'var(--font-ui)', display: 'block', marginBottom: 5 }}>LABEL (optional)</label>
            <input
              autoFocus
              type="text"
              placeholder="e.g. New Year, Birthday…"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              style={inputStyle}
            />
          </div>

          <div style={{ display: 'flex', gap: 6 }}>
            {(['date', 'duration'] as const).map((m) => (
              <button key={m} type="button" onClick={() => setMode(m)} style={{
                flex: 1, padding: '7px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
                background: mode === m ? '#1a1a1a' : 'rgba(0,0,0,0.06)',
                color: mode === m ? '#fff' : '#555',
                fontSize: '0.75rem', fontWeight: 600, fontFamily: 'var(--font-ui)',
              }}>
                {m === 'date' ? 'Set date & time' : 'Count from now'}
              </button>
            ))}
          </div>

          {mode === 'date' ? (
            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 600, color: '#555', fontFamily: 'var(--font-ui)', display: 'block', marginBottom: 5 }}>TARGET DATE & TIME</label>
              <input type="datetime-local" min={minDate} value={targetDate} onChange={(e) => setTargetDate(e.target.value)} style={inputStyle} />
            </div>
          ) : (
            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 600, color: '#555', fontFamily: 'var(--font-ui)', display: 'block', marginBottom: 5 }}>DURATION</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[
                  { lbl: 'Days', value: days, set: setDays, max: 999 },
                  { lbl: 'Hours', value: hours, set: setHours, max: 23 },
                  { lbl: 'Minutes', value: minutes, set: setMinutes, max: 59 },
                ].map(({ lbl, value, set, max }) => (
                  <div key={lbl} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={{ fontSize: '0.65rem', fontWeight: 600, color: '#888', fontFamily: 'var(--font-ui)' }}>{lbl}</label>
                    <input type="number" min={0} max={max} value={value}
                      onChange={(e) => set(Math.max(0, Math.min(max, Number(e.target.value))))}
                      style={{ ...inputStyle, textAlign: 'center' }} />
                  </div>
                ))}
              </div>
            </div>
          )}

          <button type="button" onClick={handleCreate} style={{
            marginTop: 2, padding: '11px 0', borderRadius: 12, border: 'none', cursor: 'pointer',
            background: '#1a1a1a', color: '#fff',
            fontSize: '0.85rem', fontWeight: 700, fontFamily: 'var(--font-ui)',
          }}>
            Add Countdown
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

// ── Illustrations Modal ────────────────────────────────────────────────────

const ILLUSTRATIONS: { id: string; label: string; svg: string }[] = [
  {
    id: 'notebook',
    label: 'Notebook',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="none"><path d="M 10.709 6.821 C 10.677 4.778 10.842 4.382 11.851 4.081 C 12.881 3.773 23.718 4.402 28.241 5.033 C 30.437 5.339 30.566 5.495 30.773 8.105 C 30.882 9.474 30.943 9.764 31.318 10.693 C 32.054 12.517 32.743 14.857 33.042 16.555 C 33.401 18.588 34.001 27.188 34 30.282 C 33.999 33.077 33.825 33.31 31.205 34.033 C 30.497 34.228 29.39 34.599 28.744 34.857 C 25.467 36.167 25.072 36.208 20.86 35.692 C 17.703 35.305 16.574 35.139 11.745 34.352 C 8.044 33.75 7.511 33.594 7.196 33.026 C 6.952 32.586 6.935 30 7.15 26.217 C 7.617 18.007 8.182 14.955 10.191 9.794 L 10.734 8.4 Z M 14.094 7.602 C 16.412 7.727 19.247 7.973 20.58 8.165 C 21.672 8.323 26.722 8.819 27.235 8.82 C 27.641 8.82 27.725 8.767 28.149 8.242 C 28.405 7.925 28.822 7.412 29.074 7.102 C 29.84 6.163 29.724 6.109 26.158 5.746 C 20.237 5.143 12.233 4.771 11.745 5.075 C 11.559 5.192 11.524 7.221 11.706 7.39 C 11.758 7.438 12.833 7.534 14.094 7.602 Z M 29.78 9.069 C 29.817 9.841 29.819 9.834 29.84 8.848 C 29.853 8.288 29.85 7.833 29.835 7.836 C 29.819 7.839 29.685 8 29.535 8.194 C 29.386 8.387 29.333 8.484 29.418 8.408 C 29.69 8.164 29.74 8.255 29.78 9.069 Z M 8.316 32.724 C 8.457 32.836 8.668 32.861 8.978 32.92 C 13.561 33.793 22.2 35.03 23.669 35.023 C 24.208 35.021 25.016 34.879 25.13 34.767 C 25.162 34.736 25.233 32.836 25.289 30.546 C 25.547 19.855 26.117 15.17 27.482 12.518 C 27.737 12.023 27.768 11.837 27.757 10.87 C 27.749 10.271 27.727 9.764 27.707 9.744 C 27.686 9.724 26.842 9.654 25.83 9.589 C 24.819 9.523 23.111 9.373 22.034 9.254 C 18.442 8.858 15.951 8.619 14.709 8.551 C 14.032 8.515 13.098 8.457 12.632 8.423 L 11.785 8.361 L 11.274 9.664 C 9.021 15.41 8.305 19.828 8.091 29.303 C 8.035 31.789 7.999 32.474 8.316 32.724 Z M 29.924 26.29 L 30.01 30.492 L 30.692 30.676 C 31.066 30.777 31.75 31.068 32.211 31.323 L 33.05 31.786 L 33.021 30.405 C 32.939 26.426 32.361 18.281 32.037 16.528 C 31.747 14.962 30.531 11.049 30.207 10.642 C 30.157 10.579 30.063 10.379 29.998 10.197 C 29.928 10 29.877 9.946 29.872 10.064 C 29.867 10.172 29.958 10.445 30.074 10.669 C 30.402 11.303 31.515 14.708 31.755 15.812 C 32.197 17.844 32.638 23.346 32.844 29.388 L 32.916 31.513 L 32.102 31.111 C 31.655 30.89 31.031 30.623 30.715 30.517 L 30.142 30.326 L 30.066 25.932 C 29.983 21.119 29.724 17.545 29.236 14.439 C 29.079 13.442 28.932 12.596 28.909 12.559 C 28.885 12.522 28.917 11.863 28.98 11.094 C 29.042 10.326 29.073 9.512 29.049 9.286 C 29.025 9.061 28.997 8.975 28.986 9.096 C 28.744 11.771 28.74 12.486 28.961 13.699 C 29.564 17.013 29.794 20.02 29.924 26.29 Z M 27.962 13.996 C 27.9 13.996 27.85 14.033 27.851 14.078 C 27.856 14.32 28.07 14.48 28.072 14.243 C 28.073 14.107 28.023 13.996 27.962 13.996 Z M 26.4 33.206 C 26.499 33.146 26.497 33.106 26.392 33.041 C 26.28 32.973 26.278 32.197 26.386 29.174 C 26.682 20.82 27.025 17.151 27.733 14.774 C 27.795 14.566 27.826 14.376 27.802 14.353 C 27.778 14.329 27.68 14.574 27.585 14.898 C 26.869 17.322 26.507 21.182 26.268 28.944 C 26.139 33.123 26.147 33.361 26.4 33.206 Z M 28.853 24.511 L 28.931 27.484 L 28.948 25.281 C 28.969 22.687 28.833 20.209 28.516 17.441 C 28.301 15.562 28.113 14.33 28.086 14.617 C 28.079 14.686 28.195 15.801 28.344 17.095 C 28.707 20.248 28.761 21.037 28.853 24.511 Z M 13.105 24.99 C 10.661 22.529 12.825 16.701 16.447 15.986 C 17.707 15.737 18.987 16.16 19.875 17.118 C 20.656 17.961 20.86 18.594 20.86 20.172 L 20.86 21.449 L 20.329 22.502 C 18.75 25.633 15.02 26.918 13.105 24.99 Z M 14.083 23.768 L 14.446 23.3 L 14.045 23.732 C 13.586 24.227 13.462 24.165 13.192 23.3 C 12.482 21.025 14.004 17.883 16.27 16.947 C 16.519 16.845 16.644 16.758 16.548 16.755 C 16.453 16.751 16.117 16.875 15.802 17.029 C 13.718 18.052 12.345 21.356 13.132 23.455 C 13.475 24.369 13.588 24.407 14.083 23.768 Z M 18.008 17.409 C 18.078 17.155 18.113 16.925 18.086 16.898 C 18.059 16.872 17.983 17.061 17.917 17.319 C 17.85 17.576 17.815 17.806 17.839 17.83 C 17.862 17.853 17.939 17.663 18.008 17.409 Z M 19.325 17.694 C 19.475 17.87 19.56 17.94 19.513 17.849 C 19.281 17.399 18.791 17.105 18.791 17.416 C 18.791 17.48 18.85 17.496 18.921 17.453 C 18.997 17.407 19.166 17.507 19.325 17.694 Z M 18.092 19.547 C 18.068 19.523 17.965 19.677 17.862 19.888 C 17.76 20.099 17.699 20.272 17.727 20.272 C 17.804 20.272 18.143 19.598 18.092 19.547 Z M 15.297 23.791 C 15.491 23.783 17.829 20.382 17.64 20.382 C 17.618 20.382 17.357 20.759 17.06 21.22 C 16.764 21.681 16.227 22.449 15.867 22.927 C 15.507 23.404 15.251 23.793 15.297 23.791 Z M 15.394 22.144 C 15.37 22.144 15.282 22.23 15.198 22.336 C 15.059 22.511 15.063 22.515 15.24 22.378 C 15.427 22.234 15.486 22.144 15.394 22.144 Z M 14.946 22.694 C 14.923 22.694 14.835 22.781 14.751 22.887 C 14.612 23.061 14.615 23.065 14.793 22.928 C 14.979 22.784 15.038 22.694 14.946 22.694 Z M 18.344 23.837 C 18.344 23.746 18.252 23.804 18.106 23.988 C 17.967 24.162 17.971 24.166 18.148 24.029 C 18.256 23.946 18.344 23.86 18.344 23.837 Z M 14.653 24.767 C 14.653 24.696 14.736 24.548 14.838 24.437 C 15.109 24.142 14.959 24.191 14.673 24.49 C 14.408 24.767 14.367 24.896 14.541 24.896 C 14.603 24.896 14.653 24.838 14.653 24.767 Z M 17.4 24.514 C 17.676 24.309 17.588 24.307 17.225 24.511 C 17.071 24.597 16.999 24.67 17.064 24.672 C 17.129 24.674 17.28 24.603 17.4 24.514 Z M 15.52 24.974 C 15.658 25 15.885 25 16.023 24.974 C 16.161 24.948 16.048 24.926 15.771 24.926 C 15.495 24.926 15.381 24.948 15.52 24.974 Z M 28.935 29.383 C 28.908 29.247 28.887 29.358 28.887 29.631 C 28.887 29.903 28.908 30.015 28.935 29.878 C 28.962 29.742 28.962 29.519 28.935 29.383 Z M 28.325 31.291 C 28.612 31.041 28.684 30.952 28.596 30.952 C 28.576 30.952 28.438 31.088 28.289 31.255 L 28.017 31.557 Z M 27.919 31.502 C 27.896 31.502 27.808 31.589 27.724 31.695 C 27.585 31.87 27.588 31.874 27.766 31.737 C 27.952 31.593 28.011 31.502 27.919 31.502 Z M 27.358 34.358 C 28.417 33.877 29.623 33.467 31.432 32.972 C 32.045 32.804 32.547 32.64 32.547 32.607 C 32.547 32.575 32.056 32.312 31.456 32.024 C 31.433 32.013 31.41 32.001 31.387 31.99 C 30.492 31.56 30.097 31.369 29.6 31.599 L 29.583 31.597 L 29.563 31.616 C 29.178 31.808 28.724 32.25 27.931 33.022 L 27.85 33.101 C 26.959 33.969 26.26 34.708 26.296 34.744 C 26.333 34.781 26.811 34.607 27.358 34.358 Z" fill="rgb(0,0,0)" stroke-width="0.11" stroke="rgba(0,0,0,1)" stroke-miterlimit="10"></path></svg>`,
  },
  {
    id: 'shell',
    label: 'Shell',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="none"><path d="M 23.792 8.352 C 28.341 9.333 32.429 12.368 34.124 16.027 C 35.467 18.924 35.244 23.162 33.604 25.897 C 31.422 29.534 25.758 31.99 19.529 32 C 12.211 32.012 6.528 28.8 5.222 23.913 C 4.923 22.795 4.927 20.115 5.229 18.888 C 6.085 15.407 8.53 12.347 11.437 11.118 C 11.938 10.907 12.636 10.517 12.988 10.253 C 14.21 9.335 16.34 8.476 18.008 8.227 C 18.53 8.15 19.1 8.062 19.275 8.033 C 19.943 7.92 22.689 8.115 23.792 8.352 Z M 18.361 9.372 C 13.669 10.064 11.192 13.378 13.225 16.245 C 15.048 18.817 22.582 18.659 24.408 16.01 C 25.928 13.803 23.622 11.604 20.023 11.828 C 18.375 11.93 17.566 12.36 17.848 12.983 C 18.054 13.436 18.748 13.701 19.738 13.703 C 20.743 13.706 20.963 13.804 20.904 14.225 C 20.85 14.612 20.398 14.829 19.438 14.93 C 16.977 15.189 15.208 13.14 16.708 11.767 C 18.376 10.239 21.864 10.15 24.521 11.567 C 27.432 13.119 27.121 16.848 23.952 18.384 C 21.068 19.781 15.512 19.672 13.187 18.172 C 11.467 17.061 10.695 14.893 11.38 13.095 C 11.694 12.272 11.664 12.271 10.546 13.061 C 8.516 14.494 7.925 16.493 8.931 18.517 C 9.778 20.218 11.147 21.136 13.564 21.621 C 14.879 21.885 15.267 22.021 17.354 22.957 C 19.246 23.804 20.436 23.574 23.251 21.815 C 23.867 21.431 24.838 20.939 25.408 20.724 C 25.979 20.509 26.831 20.151 27.302 19.928 C 30.101 18.606 30.626 14.448 28.315 11.908 C 26.456 9.864 22.264 8.796 18.361 9.372 Z M 30.843 14.084 C 31.26 15.213 31.15 17.196 30.609 18.301 C 29.916 19.716 28.701 20.796 27.17 21.358 C 26.632 21.555 25.506 22.074 24.669 22.511 C 23.831 22.948 22.775 23.5 22.321 23.737 C 19.853 25.028 17.984 24.971 15.494 23.528 C 14.87 23.166 14.338 22.978 13.5 22.822 C 11.104 22.375 10.12 21.948 8.951 20.849 C 8.131 20.077 7.218 18.609 7.218 18.062 C 7.218 17.918 7.161 17.765 7.091 17.722 C 7.021 17.679 6.964 17.661 6.964 17.683 C 6.964 17.705 6.814 18.125 6.631 18.616 C 6.239 19.67 6.086 21.827 6.315 23.083 C 7.421 29.145 17.514 32.439 26.229 29.581 C 29.804 28.409 31.753 26.925 32.918 24.487 C 34.448 21.287 33.77 16.851 31.346 14.212 L 30.584 13.382 Z" fill="rgb(0,0,0)" stroke-width="0.11" stroke="rgba(0,0,0,1)" stroke-miterlimit="10"></path></svg>`,
  },
  {
    id: 'frog',
    label: 'Frog',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="none"><path d="M 22.426 8.266 C 25.46 9.088 29.04 11.897 30.577 14.661 C 30.792 15.047 31.132 15.591 31.333 15.869 C 32.381 17.321 32.194 18.797 30.776 20.262 L 30.082 20.979 L 29.432 23.679 C 29.075 25.164 28.626 27.084 28.435 27.945 C 27.723 31.159 27.069 31.921 24.456 32.584 C 21.646 33.296 16.486 33.063 14.153 32.118 C 12.52 31.456 11.995 30.785 11.599 28.848 C 11.454 28.135 10.988 26.075 10.565 24.27 L 9.795 20.987 L 9.199 20.457 C 8.135 19.512 7.796 18.465 8.115 17.109 C 8.778 14.288 10.782 11.762 13.056 10.884 C 13.383 10.758 13.772 10.518 13.921 10.352 C 14.773 9.4 16.469 8.492 18.092 8.117 C 18.999 7.908 21.413 7.991 22.426 8.266 Z M 18.58 8.836 C 17.234 9.038 15.709 9.774 14.896 10.613 C 14.565 10.955 14.031 11.306 13.228 11.709 C 11.092 12.783 9.862 14.258 9.056 16.715 C 8.666 17.905 8.667 17.897 8.895 18.664 C 9.133 19.467 9.662 19.949 10.769 20.375 C 11.85 20.79 11.914 20.79 11.929 20.373 C 11.942 20.022 12.13 19.825 12.404 19.875 C 12.527 19.898 12.558 20.026 12.532 20.4 L 12.498 20.895 L 12.966 20.956 C 13.223 20.99 13.897 21.096 14.463 21.193 C 16.99 21.623 20.657 21.8 23.103 21.611 L 23.997 21.541 L 23.997 21.233 C 23.997 21.026 24.052 20.925 24.167 20.925 C 24.441 20.925 24.756 21.135 24.756 21.318 C 24.756 21.436 24.814 21.466 24.945 21.416 C 25.049 21.376 25.476 21.272 25.893 21.186 C 27.137 20.928 28.732 20.399 29.559 19.97 C 31.2 19.119 31.52 17.493 30.355 15.929 C 30.211 15.737 29.937 15.287 29.744 14.931 C 28.882 13.332 26.862 11.353 24.864 10.15 C 22.967 9.009 20.655 8.525 18.58 8.836 Z M 17.72 10.52 C 17.922 11.051 16.512 12.137 15.985 11.856 C 15.525 11.61 15.757 11.017 16.496 10.55 C 17.144 10.14 17.571 10.13 17.72 10.52 Z M 24.084 12.76 C 25.075 13.271 25.004 14.445 23.981 14.445 C 23.126 14.445 22.317 13.247 22.827 12.738 C 23.003 12.562 23.725 12.575 24.084 12.76 Z M 14.534 14.618 C 14.77 14.976 14.692 15.101 13.823 15.766 C 13.04 16.365 12.62 16.436 12.343 16.015 C 12.002 15.497 12.421 14.797 13.274 14.457 C 13.807 14.245 14.333 14.312 14.534 14.618 Z M 20.283 17.244 C 20.674 17.752 20.254 18.333 19.495 18.333 C 18.448 18.333 17.968 17.753 18.479 17.106 C 18.839 16.65 19.887 16.73 20.283 17.244 Z M 28.006 17.493 C 28.006 17.884 27.647 18.073 27.217 17.91 C 26.864 17.776 26.797 17.229 27.112 17.046 C 27.584 16.772 28.006 16.983 28.006 17.493 Z M 17.605 20.484 C 17.605 20.73 17.456 20.925 17.268 20.925 C 17.068 20.925 16.979 20.613 17.135 20.457 C 17.243 20.349 17.605 20.37 17.605 20.484 Z M 29.05 21.117 C 29.017 21.171 28.625 21.323 28.18 21.455 L 27.371 21.694 L 27.263 22.201 C 27.076 23.076 26.189 27.734 25.994 28.863 C 25.749 30.286 25.683 30.453 25.378 30.41 C 25.177 30.382 25.136 30.31 25.142 29.997 C 25.15 29.566 25.813 25.571 26.232 23.431 C 26.387 22.64 26.491 21.971 26.463 21.943 C 26.378 21.858 24.818 22.143 24.687 22.267 C 24.62 22.331 24.507 22.917 24.436 23.57 C 24.365 24.223 24.239 25.17 24.157 25.676 C 23.754 28.144 23.455 30.147 23.455 30.383 C 23.455 30.713 23.086 31.095 22.854 31.006 C 22.716 30.954 22.694 30.838 22.744 30.442 C 22.78 30.168 23.027 28.3 23.294 26.291 C 23.562 24.283 23.78 22.579 23.78 22.504 C 23.78 22.367 23.294 22.366 21.76 22.501 L 21.094 22.56 L 21.03 23.012 C 20.994 23.26 20.916 24.362 20.856 25.461 C 20.617 29.817 20.45 31.185 20.16 31.185 C 19.816 31.185 19.775 30.923 19.88 29.396 C 20.008 27.531 20.224 22.637 20.181 22.593 C 20.14 22.552 17.351 22.33 17.316 22.365 C 17.301 22.38 17.382 23.508 17.496 24.872 L 17.828 28.838 C 17.959 30.406 17.872 30.861 17.442 30.861 C 17.238 30.861 17.202 30.675 17.061 28.917 C 16.887 26.744 16.517 23.084 16.428 22.653 L 16.35 22.275 L 14.961 22.081 C 14.196 21.974 13.557 21.901 13.54 21.919 C 13.505 21.955 13.503 21.939 14.25 26.428 C 14.841 29.978 14.859 30.25 14.506 30.3 C 14.2 30.343 14.055 29.799 13.495 26.487 C 13.254 25.062 12.969 23.409 12.861 22.815 L 12.665 21.735 L 11.695 21.45 C 11.161 21.294 10.716 21.173 10.706 21.182 C 10.671 21.21 10.889 22.238 11.27 23.841 C 11.821 26.157 12.372 28.564 12.511 29.262 C 12.928 31.354 14.979 32.106 20.259 32.101 C 23.999 32.097 25.315 31.814 26.527 30.753 C 27.082 30.267 27.209 29.907 27.842 26.997 C 28.161 25.529 28.6 23.605 28.817 22.723 C 29.168 21.293 29.238 20.814 29.05 21.117 Z" fill="rgb(0,0,0)" stroke-width="0.11" stroke="rgba(0,0,0,1)" stroke-miterlimit="10"></path></svg>`,
  },
  {
    id: 'bear',
    label: 'Bear',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="none"><g transform="translate(7 7)"><path d="M 3.014 6.026 C 4.38 2.881 7.706 0.698 12.065 0.088 C 13.438 -0.104 16.613 0.036 17.767 0.339 C 21.006 1.191 23.351 3.282 24.294 6.162 C 24.458 6.663 24.507 6.713 25.062 6.943 C 26.445 7.516 26.946 8.347 26.937 10.056 C 26.928 11.893 26.326 13.018 24.803 14.049 C 24.767 14.073 24.733 14.097 24.7 14.119 C 24.397 14.323 24.22 14.442 24.108 14.606 C 23.949 14.838 23.919 15.159 23.849 15.934 L 23.841 16.019 L 23.837 16.062 L 23.832 16.12 C 23.307 21.817 22.939 22.706 20.63 23.863 C 17.412 25.476 9.512 25.59 6.503 24.067 C 4.242 22.924 3.837 22.035 3.052 16.502 C 2.82 14.863 2.711 14.356 2.576 14.275 C 0.351 12.931 -0.098 12.221 0.016 10.237 C 0.1 8.802 0.791 7.778 2.127 7.112 C 2.619 6.867 2.684 6.787 3.014 6.026 Z M 2.734 7.841 C 1.281 8.374 0.604 9.676 0.939 11.292 C 1.129 12.208 1.507 12.635 2.691 13.276 C 3.92 13.941 4.747 14.038 5.555 13.612 C 5.8 13.484 6.013 13.378 6.03 13.378 C 6.047 13.378 6.36 13.662 6.727 14.009 C 8.137 15.344 9.841 15.514 11.506 14.486 L 12.134 14.098 L 12.789 14.518 C 13.91 15.236 15.151 15.399 16.542 15.008 C 17.241 14.812 17.956 14.107 18.141 13.922 C 18.299 13.764 18.357 13.807 18.457 13.869 C 18.516 13.906 18.615 13.975 18.826 14.186 C 18.836 14.196 19.381 14.769 20.389 14.768 C 21.39 14.767 21.674 14.663 23.551 13.618 C 25.318 12.633 25.676 12.216 26.002 10.765 C 26.142 10.145 26.143 9.967 26.012 9.346 C 25.809 8.382 25.657 8.191 24.729 7.726 C 23.87 7.295 23.686 7.086 23.32 6.119 C 21.866 2.276 17.489 0.245 12.157 0.939 C 7.978 1.483 4.624 3.838 3.529 6.997 C 3.316 7.612 3.293 7.636 2.734 7.841 Z M 9.674 5.331 C 8.539 5.178 8.585 4.13 9.752 3.524 C 10.668 3.049 11.391 3.803 10.91 4.733 C 10.691 5.158 10.19 5.4 9.674 5.331 Z M 17.402 5.523 C 16.799 5.211 16.754 4.133 17.327 3.723 C 17.721 3.441 18.708 3.78 19.127 4.341 C 19.7 5.109 18.367 6.022 17.402 5.523 Z M 14.231 9.055 C 13.057 9.392 12.291 8.184 13.195 7.422 C 13.641 7.048 14.448 7.044 14.819 7.415 C 15.371 7.966 15.066 8.816 14.231 9.055 Z M 4.873 21.276 C 5.263 22.324 6.337 23.125 8.117 23.697 C 11.228 24.696 17.711 24.299 20.437 22.944 C 22.099 22.117 22.506 21.095 22.883 16.806 C 22.944 16.11 23.02 15.41 23.052 15.25 L 23.057 15.225 C 23.082 15.104 23.097 15.028 23.067 15 C 23.015 14.951 22.826 15.05 22.309 15.32 L 22.246 15.353 C 21.253 15.872 19.957 15.914 18.959 15.461 L 18.357 15.187 L 17.653 15.541 C 16.276 16.234 14.165 16.304 12.737 15.704 L 12.013 15.4 L 11.357 15.68 C 9.994 16.261 7.891 16.039 6.548 15.171 C 5.836 14.711 5.502 14.642 4.347 14.717 C 3.984 14.74 3.687 14.809 3.687 14.869 C 3.687 15.322 4.706 20.828 4.873 21.276 Z M 7.168 19.548 C 7.114 18.272 7.037 16.859 6.998 16.409 L 6.926 15.589 L 7.39 15.797 C 7.847 16.002 7.854 16.013 7.879 16.564 C 7.893 16.871 7.952 17.763 8.009 18.546 C 8.261 21.989 8.181 22.886 7.645 22.642 C 7.317 22.492 7.284 22.276 7.168 19.548 Z" fill="rgb(0,0,0)" stroke-width="0.11" stroke="rgba(0,0,0,1)" stroke-miterlimit="10"></path><path d="M 14.676 17.925 C 14.667 18.984 14.633 20.68 14.599 21.695 C 14.566 22.71 14.399 22.986 14.59 23.241 C 14.669 23.346 14.748 23.346 14.748 23.346 C 14.748 23.346 15.137 23.514 15.267 23.146 C 15.402 22.764 15.544 20.704 15.631 17.872 L 15.688 16 L 15.19 16 L 14.692 16.001 Z" fill="rgb(0,0,0)" stroke-width="0.11" stroke="rgba(0,0,0,1)" stroke-miterlimit="10"></path><path d="M 19.13 17.205 C 19.093 18.085 19.053 18.964 19.01 19.843 C 18.941 21.203 19.231 22.057 19.627 21.661 C 19.74 21.548 19.789 21.232 19.802 20.524 C 19.811 19.984 19.859 18.665 19.907 17.592 C 19.955 16.519 19.989 15.636 19.981 15.629 C 19.974 15.623 19.796 15.591 19.585 15.559 L 19.203 15.5 Z" fill="rgb(0,0,0)" stroke-width="0.11" stroke="rgba(0,0,0,1)" stroke-miterlimit="10"></path><path d="M 11.462 15.713 L 11 15.918 L 11.064 16.383 C 11.099 16.639 11.16 18.019 11.2 19.449 C 11.278 22.216 11.355 22.594 11.809 22.419 C 11.974 22.356 11.987 22.072 11.964 18.921 C 11.95 17.036 11.936 15.496 11.932 15.5 C 11.928 15.504 11.717 15.6 11.462 15.713 Z" fill="rgb(0,0,0)" stroke-width="0.11" stroke="rgba(0,0,0,1)" stroke-miterlimit="10"></path></g></svg>`,
  },
  {
    id: 'snail',
    label: 'Snail',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="none"><path d="M 23.456 7.017 C 24.177 7.053 25.598 7.094 26.614 7.109 C 29.353 7.149 31.349 7.795 33.347 9.29 C 36.588 11.713 38.002 16.479 36.226 18.991 C 35.817 19.57 35.791 19.661 35.806 20.436 C 35.826 21.455 35.584 24.945 35.425 25.937 C 35.026 28.414 34.198 29.235 30.393 30.927 C 17.5 36.66 15.568 36.988 8.738 34.604 C 4.651 33.177 4.249 32.499 4.128 26.831 C 4.055 23.46 4.044 23.338 3.778 22.926 C 2.992 21.709 2.766 19.612 3.264 18.157 C 4.072 15.799 6.265 13.304 8.134 12.616 C 8.626 12.435 9.063 12.115 9.95 11.286 C 11.658 9.691 13.744 8.795 15.749 8.795 C 16.249 8.795 16.592 8.737 16.713 8.631 C 17.398 8.035 19.554 7.302 21.327 7.063 C 21.777 7.003 22.735 6.982 23.456 7.017 Z M 21.311 8.066 C 20.285 8.204 18.272 8.837 18.272 9.021 C 18.272 9.066 18.552 9.23 18.896 9.384 C 20.362 10.044 22.759 12.227 24.395 14.392 C 25.231 15.498 25.377 15.574 24.619 14.508 C 23.086 12.353 20.918 10.322 19.188 9.423 C 18.489 9.06 18.467 9.035 18.746 8.935 C 20.089 8.451 24.1 11.448 25.348 13.866 C 25.828 14.796 25.602 15.952 24.914 16.081 C 24.67 16.126 23.769 15.271 23.043 14.305 C 21.294 11.977 18.857 10.184 16.974 9.84 C 14.864 9.455 12.131 10.362 10.532 11.976 L 10.121 12.391 L 10.591 12.393 C 12.612 12.401 15.304 13.88 17.646 16.268 C 18.878 17.524 18.968 17.674 18.744 18.082 C 18.519 18.491 18.225 18.313 16.782 16.898 C 15.139 15.288 14.307 14.671 12.967 14.073 C 10.81 13.109 8.809 13.085 7.583 14.007 C 4.4 16.399 3.138 20.087 4.729 22.348 C 5.025 22.769 5.028 22.793 5.102 26.135 C 5.238 32.263 5.41 32.544 9.87 33.982 C 13.843 35.263 16.053 35.325 19.642 34.254 C 21.375 33.737 24.839 32.32 29.414 30.257 C 34.518 27.956 34.478 28.02 34.675 21.67 L 34.752 19.176 L 35.204 18.694 C 36.323 17.499 36.312 15.169 35.175 13.006 C 34.015 10.799 32.098 9.272 29.465 8.459 C 28.761 8.242 26.733 7.96 26.733 8.08 C 26.733 8.251 27.198 8.416 27.532 8.363 C 27.867 8.31 27.935 8.342 28.038 8.607 C 28.104 8.774 28.215 8.911 28.286 8.911 C 28.357 8.911 28.382 8.859 28.342 8.795 C 28.301 8.731 28.374 8.679 28.504 8.679 C 29.156 8.679 31.133 11.18 31.692 12.711 C 31.893 13.263 31.893 13.31 31.688 13.834 C 31.288 14.853 31.013 14.684 29.535 12.507 C 28.04 10.304 26.273 8.778 24.544 8.197 C 23.958 7.999 22.303 7.933 21.311 8.066 Z M 27.707 8.803 C 28.339 9.306 29.673 10.878 30.604 12.217 C 31.544 13.569 31.613 13.652 31.285 13.029 C 30.604 11.737 27.815 8.44 27.413 8.451 C 27.334 8.453 27.466 8.612 27.707 8.803 Z M 13.176 12.035 C 15.721 12.669 18.987 15.371 18.987 16.843 L 18.987 17.379 L 17.586 16.008 C 15.799 14.258 14.194 13.159 12.551 12.559 C 12.23 12.442 12.195 12.405 12.399 12.399 C 12.582 12.393 12.642 12.338 12.595 12.218 C 12.557 12.122 12.492 12.065 12.449 12.089 C 12.407 12.114 12.303 12.062 12.219 11.973 C 12.019 11.762 12.101 11.768 13.176 12.035 Z M 35.79 16.789 C 35.79 18.436 34.391 19.555 29.939 21.466 C 23.354 24.293 16.777 26.889 16.199 26.889 C 15.893 26.889 15.635 26.467 15.854 26.324 C 15.915 26.284 16 26.159 16.043 26.045 C 16.086 25.932 16.216 25.809 16.332 25.772 C 16.448 25.735 17.08 25.478 17.735 25.202 C 19.286 24.549 22.231 23.368 23.515 22.885 C 24.687 22.444 27.057 21.444 28.521 20.773 C 29.306 20.413 30.092 20.056 30.879 19.702 C 33.71 18.426 34.555 17.872 35.194 16.873 C 35.706 16.073 35.79 16.061 35.79 16.789 Z" fill="rgb(0,0,0)" stroke-width="0.11" stroke="rgba(0,0,0,1)" stroke-miterlimit="10"></path></svg>`,
  },
  {
    id: 'wave',
    label: 'Wave',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="none"><path d="M 35.986 13.281 C 36.221 16.151 33.571 19.958 28.411 24.164 C 18.879 31.933 10.147 34.876 5.759 31.8 C 4.414 30.857 3.983 29.967 4.001 28.163 C 4.054 22.636 10.16 15.635 18.664 11.351 C 22.38 9.479 25.44 8.387 27.805 8.09 C 32.306 7.524 35.689 9.67 35.986 13.281 Z M 27.355 9.041 C 26.259 9.237 23.346 10.125 22.473 10.531 L 21.741 10.87 L 22.568 10.946 C 26.996 11.349 31.044 13.574 30.004 15.032 C 29.709 15.446 29.341 15.325 25.986 13.712 C 24.197 12.852 22.233 11.978 21.621 11.771 L 20.51 11.394 L 18.865 12.233 C 17.96 12.695 16.85 13.3 16.398 13.577 L 15.576 14.082 L 16.488 14.082 C 20.162 14.082 25.832 17.231 24.73 18.658 C 24.52 18.929 24.279 18.897 23.232 18.463 C 22.722 18.252 21.325 17.743 20.127 17.331 C 17.672 16.489 15.929 15.716 15.147 15.125 L 14.618 14.725 L 13.313 15.652 C 10.811 17.428 9.839 18.515 10.747 18.521 C 11.59 18.527 14.423 19.303 15.694 19.876 C 17.535 20.708 19.531 22.333 19.459 22.943 C 19.389 23.54 18.935 23.588 17.728 23.127 C 13.76 21.608 11.412 20.984 9.117 20.836 L 8.043 20.767 L 7.594 21.365 C 5.101 24.68 4.117 28.134 5.138 29.985 C 6.751 32.908 12.176 32.893 18.083 29.951 C 24.836 26.587 31.265 21.412 33.993 17.143 C 35.283 15.124 35.506 13.615 34.791 11.736 C 33.964 9.565 30.816 8.424 27.355 9.041 Z M 23.891 11.921 C 23.891 11.968 24.042 12.039 24.227 12.079 C 24.412 12.119 25.584 12.662 26.831 13.285 C 28.078 13.908 29.126 14.39 29.161 14.357 C 29.252 14.267 28.846 13.765 28.387 13.4 C 27.784 12.921 23.891 11.64 23.891 11.921 Z M 16.669 15.183 C 18.019 15.87 23.893 17.988 23.889 17.786 C 23.886 17.64 21.842 16.361 20.914 15.923 C 19.571 15.292 18.403 14.979 17.11 14.907 L 16.007 14.846 Z M 9.482 19.053 C 9.287 19.194 8.675 19.944 8.675 20.043 C 8.675 20.101 8.929 20.148 9.24 20.148 C 10.975 20.148 14.642 21.032 16.889 21.992 C 17.769 22.368 18.267 22.528 18.267 22.433 C 18.267 22.087 15.713 20.571 14.338 20.101 C 13.087 19.674 9.65 18.932 9.482 19.053 Z" fill="rgb(0,0,0)" stroke-width="0.11" stroke="rgba(0,0,0,1)" stroke-miterlimit="10"></path></svg>`,
  },
  {
    id: 'carrot',
    label: 'Carrot',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="none"><path d="M 29.862 3.695 C 30.474 6.113 30.258 10.329 29.337 13.946 C 29.11 14.835 28.932 15.568 28.942 15.577 C 28.951 15.586 29.184 15.548 29.46 15.493 C 30.043 15.377 30.385 15.484 30.513 15.823 C 30.558 15.941 30.573 17.661 30.547 19.645 C 30.5 23.194 30.691 30.073 30.905 32.558 C 31.055 34.306 31.028 35.235 30.818 35.43 C 30.721 35.521 30.049 36.173 29.325 36.878 C 27.34 38.813 26.855 39.002 23.886 39 C 20.542 38.998 14.003 38.403 10.801 37.811 C 9.786 37.623 9.687 37.585 9.356 37.255 L 9 36.9 L 9.005 35.251 C 9.008 34.344 9.048 32.727 9.094 31.656 C 9.217 28.77 9.38 23.067 9.455 19.007 C 9.521 15.477 9.525 15.422 9.732 15.215 C 10.03 14.916 10.812 14.928 11.139 15.236 C 11.442 15.521 11.487 15.453 11.318 14.964 C 10.512 12.619 10.17 7.221 10.686 4.976 C 11.655 0.76 14.906 -0.581 17.509 2.163 C 18.585 3.298 19.31 4.691 19.968 6.895 C 20.167 7.562 20.353 8.108 20.382 8.109 C 20.41 8.109 20.514 7.864 20.613 7.564 C 22.013 3.306 23.381 1.05 25.027 0.282 C 27.043 -0.658 29.133 0.817 29.862 3.695 Z M 25.371 1.075 C 23.759 1.898 22.27 4.781 20.955 9.629 C 20.642 10.779 19.756 15.401 19.834 15.477 C 19.846 15.489 20.04 15.465 20.266 15.424 C 20.974 15.294 21.433 15.466 22.13 16.125 C 22.588 16.557 22.477 16.583 23.696 15.753 C 25.105 14.792 25.242 14.79 26.204 15.701 C 27.457 16.889 27.779 16.735 28.287 14.708 C 29.35 10.475 29.603 6.255 28.947 3.702 C 28.394 1.549 26.774 0.359 25.371 1.075 Z M 14.137 1.666 C 11.477 2.15 10.554 7.087 11.894 13.664 C 12.441 16.349 12.415 16.269 12.799 16.491 L 13.137 16.688 L 13.557 16.399 C 15.223 15.255 16.361 15.166 17.529 16.09 C 18.051 16.504 18.165 16.511 18.604 16.156 C 18.854 15.955 18.888 15.831 19.199 13.996 C 19.381 12.926 19.659 11.418 19.817 10.647 L 20.106 9.244 L 19.879 8.973 C 19.751 8.822 19.412 7.999 19.106 7.101 C 17.676 2.902 16.203 1.29 14.137 1.666 Z M 27.204 5.848 C 27.204 6.169 26.779 6.526 24.941 7.747 C 23.548 8.673 23.331 8.714 23.46 8.024 C 23.579 7.39 23.767 7.194 25.139 6.272 C 26.744 5.195 27.204 5.1 27.204 5.848 Z M 16.08 6.257 C 16.597 6.619 16.542 6.909 15.799 7.725 C 14.073 9.619 13.437 9.993 13.109 9.304 C 12.96 8.991 12.963 8.967 13.198 8.569 C 13.482 8.089 14.179 7.389 15.115 6.645 C 15.867 6.047 15.812 6.069 16.08 6.257 Z M 15.415 7.049 C 15.184 7.304 15.223 7.377 15.495 7.199 C 15.727 7.046 15.81 6.875 15.652 6.875 C 15.607 6.875 15.501 6.953 15.415 7.049 Z M 14.847 7.983 C 14.812 8.018 14.784 8.09 14.784 8.144 C 14.784 8.204 14.828 8.198 14.896 8.13 C 14.957 8.068 14.986 7.996 14.959 7.969 C 14.932 7.942 14.882 7.948 14.847 7.983 Z M 14.015 8.703 C 13.903 8.915 13.904 8.916 14.106 8.736 C 14.332 8.535 14.353 8.489 14.218 8.489 C 14.168 8.489 14.076 8.585 14.015 8.703 Z M 26.114 10.106 L 26.28 10.305 C 26.779 10.904 26.309 11.468 23.887 13.178 C 22.866 13.899 22.89 13.72 22.558 13.672 C 22.416 13.625 22.444 13.575 22.369 13.555 C 22.274 13.53 22.34 13.521 22.226 13.427 C 21.887 13.145 22.049 12.819 22.772 12.329 C 23.15 12.072 23.736 11.662 24.075 11.417 C 24.414 11.172 25.011 10.777 25.403 10.539 Z M 17.44 11.124 C 17.928 11.746 17.494 12.438 15.957 13.487 C 14.834 14.253 14.451 14.344 14.214 13.9 C 13.912 13.335 14.14 13.05 15.965 11.701 C 17.258 10.746 17.17 10.78 17.44 11.124 Z M 24.636 11.742 C 24.045 12.112 23.215 12.807 23.322 12.843 C 23.379 12.862 23.518 12.791 23.632 12.686 C 23.745 12.581 24.155 12.277 24.542 12.011 C 25.232 11.538 25.307 11.321 24.636 11.742 Z M 15.956 12.502 C 15.629 12.748 14.875 13.571 15.03 13.513 C 15.203 13.449 16.336 12.386 16.286 12.336 C 16.26 12.31 16.112 12.385 15.956 12.502 Z M 10.327 19.1 C 10.327 22.55 10.275 25.135 10.135 28.808 C 10.086 30.087 10.017 32.378 9.982 33.899 L 9.919 36.664 L 10.242 36.77 C 12.308 37.451 25.048 38.485 25.764 38.03 C 25.917 37.933 26.021 36.884 26.157 34.03 C 26.214 32.855 26.323 30.996 26.399 29.9 C 26.476 28.803 26.626 26.496 26.732 24.773 C 26.839 23.049 26.967 21.084 27.017 20.405 C 27.184 18.161 27.154 17.636 26.848 17.445 C 26.705 17.355 26.374 17.084 26.114 16.843 C 25.123 15.927 24.988 15.921 23.823 16.74 C 22.484 17.681 22.402 17.689 21.6 16.953 C 20.634 16.068 20.28 16.067 19.05 16.945 C 18.062 17.651 17.845 17.671 17.302 17.103 C 16.309 16.066 15.378 16.104 13.916 17.241 C 13.226 17.777 12.566 17.642 11.631 16.772 C 11.069 16.248 10.585 15.895 10.431 15.895 C 10.358 15.895 10.327 16.84 10.327 19.1 Z M 29.053 16.646 C 28.74 16.859 28.403 17.096 28.304 17.173 C 28.146 17.296 28.11 17.548 28.001 19.286 C 27.789 22.701 27.491 27.036 27.442 27.431 C 27.416 27.64 27.332 28.9 27.255 30.232 C 27.178 31.563 27.068 33.465 27.011 34.457 C 26.954 35.449 26.865 36.597 26.814 37.008 C 26.763 37.419 26.742 37.776 26.766 37.801 C 26.916 37.951 28.888 36.21 29.574 35.321 C 29.757 35.085 29.96 34.89 30.025 34.888 C 30.167 34.883 30.17 34.683 30.05 32.938 C 29.859 30.167 29.739 26.403 29.681 21.417 L 29.622 16.257 Z M 27.928 33.743 C 28.127 33.924 28.547 34.212 28.861 34.382 C 29.495 34.724 29.51 34.799 28.886 34.505 C 28.665 34.401 28.25 34.123 27.963 33.888 C 27.677 33.653 27.41 33.46 27.371 33.46 C 27.331 33.46 27.299 33.415 27.299 33.36 C 27.299 33.226 27.489 33.342 27.928 33.743 Z M 27.27 34.033 C 27.332 34.031 27.412 34.078 27.448 34.136 C 27.484 34.194 27.839 34.451 28.236 34.706 C 28.633 34.961 28.928 35.169 28.892 35.169 C 28.774 35.169 27.686 34.502 27.417 34.266 C 27.274 34.139 27.207 34.034 27.27 34.033 Z M 29.602 34.748 C 29.696 34.784 29.748 34.837 29.719 34.866 C 29.69 34.895 29.613 34.866 29.549 34.801 C 29.456 34.707 29.467 34.696 29.602 34.748 Z" fill="rgb(0,0,0)" stroke-width="0.11" stroke="rgba(0,0,0,1)" stroke-miterlimit="10"></path></svg>`,
  },
  {
    id: 'polaroid',
    label: 'Polaroid',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="none"><path d="M 33.654 5.967 C 33.758 6.673 34.277 9.499 35.127 14.001 C 37.045 24.152 37.874 28.923 37.971 30.383 C 38.103 32.365 37.843 32.714 35.961 33.079 C 34.231 33.415 33.356 32.683 33.356 30.897 C 33.356 30.135 33.425 30.151 31.42 30.437 C 29.811 30.665 21.601 31.681 17.072 32.212 C 15.963 32.342 16.01 32.287 16.198 33.238 C 16.498 34.747 15.702 35.624 13.76 35.925 C 12.967 36.048 12.871 36.037 12.315 35.761 C 11.492 35.353 11.261 34.849 10.991 32.873 C 10.616 30.121 10.292 28.233 10.177 28.113 C 10.07 28.002 6.824 28.224 6.451 28.367 C 6.364 28.4 6.197 28.824 6.08 29.309 C 5.655 31.066 5.132 31.54 3.619 31.54 C 1.976 31.54 1.702 30.942 2.269 28.597 C 3.02 25.493 4.743 17.482 5.593 13.142 C 6.109 10.511 6.629 8.133 6.749 7.857 C 7.299 6.593 7.802 6.49 19.81 5.172 C 21.679 4.967 29.108 4.162 29.801 4.089 C 32.595 3.795 33.39 4.183 33.654 5.967 Z M 30.966 4.925 C 30.753 5.02 21.221 6.085 16.082 6.587 C 11.064 7.078 8.225 7.497 8.225 7.747 C 8.225 7.836 9.525 16.339 10.128 20.195 C 11.131 26.609 11.526 29.274 11.728 30.988 C 12.175 34.796 12.247 34.972 13.345 34.969 C 14.875 34.965 15.276 34.469 14.915 33.029 C 14.515 31.437 14.565 31.402 17.637 31.095 C 18.899 30.968 20.98 30.728 22.262 30.559 C 23.543 30.391 25.28 30.173 26.123 30.076 C 26.966 29.979 29.026 29.724 30.702 29.509 L 33.748 29.118 L 34.073 29.362 C 34.388 29.597 34.397 29.64 34.356 30.649 C 34.297 32.104 34.763 32.39 36.399 31.904 L 37.034 31.715 L 37.034 31.137 C 37.033 30.069 35.455 20.888 34.152 14.369 C 33.6 11.609 33.245 9.71 32.868 7.501 C 32.659 6.276 32.416 5.219 32.323 5.126 C 32.157 4.96 31.202 4.818 30.966 4.925 Z M 7.345 9.769 C 7.302 9.938 6.88 12.008 6.407 14.369 C 5.934 16.73 5.32 19.683 5.043 20.931 C 4.164 24.883 3.304 28.564 3.188 28.87 C 3.126 29.032 3.076 29.492 3.076 29.893 L 3.076 30.621 L 3.75 30.621 C 4.638 30.621 4.827 30.419 5.091 29.195 C 5.77 26.05 7.013 21.031 7.42 19.792 C 7.593 19.268 7.734 18.731 7.734 18.601 C 7.734 18.25 8.176 18.046 8.337 18.324 C 8.44 18.501 8.463 18.465 8.466 18.12 C 8.471 17.532 8.545 17.683 8.64 18.478 C 8.696 18.948 8.683 19.096 8.597 18.968 C 8.529 18.867 8.473 18.836 8.472 18.9 C 8.471 18.963 8.384 18.908 8.279 18.777 C 8.094 18.546 8.092 18.546 8.214 18.8 C 8.359 19.101 8.291 19.577 7.737 22.157 C 7.526 23.135 7.217 24.598 7.05 25.408 C 6.882 26.217 6.717 26.971 6.683 27.083 C 6.615 27.308 6.482 27.31 8.807 27.052 C 9.732 26.95 10.063 26.868 10.063 26.743 C 10.063 26.351 9.053 19.77 7.974 13.142 C 7.711 11.523 7.479 10.033 7.459 9.83 C 7.425 9.472 7.422 9.471 7.345 9.769 Z M 28.545 14.502 C 29.033 14.981 29.433 15.432 29.433 15.505 C 29.433 15.578 29.561 15.794 29.717 15.984 C 31.12 17.702 30.967 19.084 29.306 19.683 C 28.53 19.964 27.365 19.904 27.161 19.574 C 27.131 19.526 26.884 19.563 26.613 19.657 C 26.341 19.751 25.591 19.906 24.947 20.003 C 24.303 20.1 23.704 20.239 23.616 20.313 C 23.527 20.386 22.993 20.529 22.429 20.629 C 21.552 20.785 20.96 20.815 19.435 20.784 C 19.297 20.782 18.936 20.954 18.633 21.167 C 18.056 21.574 16.688 21.876 16.09 21.728 C 15.599 21.606 14.968 20.809 14.968 20.309 C 14.966 19.176 15.378 18.207 16.729 16.171 C 18.762 13.107 19.339 12.589 21.22 12.151 C 23.448 11.631 26.665 12.663 28.545 14.502 Z M 22.128 12.991 C 21.92 13.074 21.355 13.414 20.872 13.746 C 19.703 14.551 19.71 14.821 20.93 15.968 C 21.573 16.572 21.587 16.601 21.587 17.271 C 21.587 17.974 21.369 18.657 20.96 19.232 C 20.622 19.71 20.607 19.704 22.17 19.704 L 23.61 19.704 L 24.046 19.117 C 25.528 17.121 25.744 15.939 24.919 14.343 C 24.772 14.059 24.652 13.711 24.652 13.57 C 24.652 13.074 22.918 12.677 22.128 12.991 Z M 25.956 14.223 C 25.915 14.385 25.991 14.821 26.126 15.205 C 26.259 15.585 26.368 16.033 26.368 16.2 C 26.368 16.664 25.828 18.053 25.459 18.537 L 25.13 18.968 L 25.438 18.968 C 25.945 18.968 27.081 18.484 27.337 18.159 C 27.648 17.763 28.024 16.167 27.912 15.719 C 27.812 15.318 26.673 14.116 26.291 14.007 C 26.086 13.948 26.013 13.996 25.956 14.223 Z M 18.522 15.429 C 18.292 15.767 18.113 16.162 18.124 16.308 C 18.139 16.513 18.119 16.532 18.033 16.395 C 17.973 16.296 17.906 16.242 17.885 16.273 C 17.152 17.409 17.139 17.462 17.531 17.693 C 17.754 17.826 17.915 18.043 17.962 18.28 C 18.107 19.004 18.641 19.609 19.09 19.557 C 19.308 19.531 19.459 19.554 19.426 19.607 C 19.393 19.661 19.29 19.704 19.197 19.704 C 19.104 19.704 18.998 19.751 18.962 19.809 C 18.769 20.123 19.606 19.718 20.057 19.28 C 21.014 18.349 20.921 17.229 19.788 16.045 C 19.507 15.751 19.201 15.354 19.109 15.163 L 18.941 14.816 Z M 28.894 16.921 C 28.852 17.145 28.628 17.628 28.397 17.995 C 27.938 18.722 27.958 18.821 28.586 18.923 C 29.557 19.08 29.896 18.153 29.296 16.977 C 29.009 16.414 28.99 16.411 28.894 16.921 Z M 16.592 18.508 C 15.699 20.356 16.122 21.291 17.489 20.49 C 18.097 20.134 18.131 20.053 17.803 19.74 C 17.465 19.417 16.947 18.252 17.018 17.978 C 17.136 17.527 16.961 17.745 16.592 18.508 Z" fill="rgb(0,0,0)" stroke-width="0.11" stroke="rgba(0,0,0,1)" stroke-miterlimit="10"></path></svg>`,
  },
  {
    id: 'planet',
    label: 'Planet',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="none"><path d="M 19.497 8.029 C 20.272 8.6 20.366 8.613 20.793 8.207 C 23.552 5.584 28.922 5.324 32.478 7.642 C 37.5 10.915 38.514 19.17 34.636 25.199 L 34.208 25.865 L 34.469 26.705 C 35.321 29.446 34.615 31.072 32.577 31.06 C 32.069 31.057 31.602 30.978 31.377 30.857 L 31.007 30.659 L 29.668 31.714 C 26.663 34.084 23.421 35.156 19.795 34.982 C 16.369 34.817 12.721 33.562 10.233 31.693 L 9.348 31.028 L 8.203 31.094 C 6.86 31.171 6.162 30.919 5.775 30.216 C 5.476 29.672 5.48 27.666 5.781 26.879 L 5.989 26.337 L 5.477 25.649 C 4.684 24.582 3.878 22.796 3.442 21.14 C 1.632 14.25 5.567 7.171 11.785 6.132 C 14.446 5.687 17.259 6.379 19.497 8.029 Z M 12.258 6.96 C 12.119 6.987 11.692 7.072 11.309 7.148 C 8.241 7.758 5.285 10.814 4.339 14.356 C 3.427 17.771 4.39 22.908 6.394 25.324 L 6.675 25.663 L 8.233 24.873 C 9.089 24.438 9.79 24.055 9.79 24.021 C 9.79 23.987 9.655 23.692 9.488 23.366 C 8.664 21.749 8.013 19.128 8.023 17.467 C 8.061 11.344 13.555 8.906 17.763 13.147 C 18.819 14.211 19.036 14.532 20.645 17.41 C 21.221 18.441 22.753 20.447 23.035 20.54 C 23.464 20.682 23.877 16.731 23.588 15.266 C 23.01 12.347 20.176 9.004 17.152 7.674 C 15.666 7.021 13.537 6.71 12.258 6.96 Z M 25.798 6.998 C 24.371 7.171 22.531 7.948 21.506 8.809 L 21.011 9.225 L 21.72 9.992 C 22.111 10.413 22.641 11.073 22.898 11.458 C 23.156 11.843 23.385 12.158 23.407 12.158 C 23.43 12.158 23.814 11.958 24.261 11.715 C 26.956 10.244 29.966 11.008 31.339 13.512 C 32.54 15.703 32.205 19.565 30.528 22.866 L 30.162 23.586 L 31.081 24.042 C 31.586 24.292 32.32 24.689 32.711 24.923 C 33.58 25.442 33.499 25.445 33.829 24.889 C 36.153 20.979 36.665 16.936 35.351 12.865 C 34.066 8.884 30.138 6.471 25.798 6.998 Z M 25.998 11.981 C 24.567 12.363 23.97 12.934 24.197 13.702 C 24.884 16.033 24.835 18.013 24.019 20.787 C 23.923 21.112 24.292 21.319 26.99 22.454 C 29.506 23.513 29.208 23.522 29.736 22.375 C 32.166 17.092 31.347 12.713 27.79 11.965 C 26.777 11.752 26.859 11.751 25.998 11.981 Z M 12.171 12.21 C 8.934 13.135 8.101 17.229 10.074 22.521 C 10.318 23.175 10.573 23.664 10.681 23.681 C 11 23.733 16.183 21.03 16.161 20.824 C 16.15 20.721 15.987 20.214 15.798 19.696 C 15.018 17.554 15.271 15.336 16.443 14.049 L 16.88 13.569 L 16.431 13.177 C 15.29 12.182 13.605 11.8 12.171 12.21 Z M 16.95 14.831 C 15.701 16.948 16.323 19.929 18.48 22.153 C 20.041 23.764 21.928 24.925 26.178 26.892 C 28.958 28.178 29.953 28.722 30.924 29.484 C 31.998 30.326 32.883 30.458 33.481 29.865 C 33.867 29.481 33.867 29.48 33.807 28.325 C 33.745 27.154 33.516 26.46 33.087 26.141 C 32.547 25.74 30.216 24.563 29.088 24.123 C 28.203 23.777 27.317 23.432 26.431 23.089 C 22.579 21.597 20.703 20 19.439 17.135 C 18.961 16.052 17.725 14.294 17.441 14.294 C 17.345 14.294 17.125 14.535 16.95 14.831 Z M 16.054 22.037 C 15.229 22.538 12.787 23.738 10.486 24.771 C 6.755 26.448 6.522 26.668 6.507 28.529 C 6.499 29.513 6.614 29.793 7.13 30.059 C 7.845 30.426 8.286 30.313 9.586 29.432 C 11.211 28.331 13.302 27.081 15.334 25.997 C 16.261 25.503 17.456 24.835 17.992 24.513 L 18.965 23.926 L 17.818 22.816 C 17.187 22.205 16.646 21.711 16.616 21.718 C 16.585 21.724 16.333 21.868 16.054 22.037 Z M 18.642 25.197 C 18.117 25.523 16.907 26.209 15.953 26.722 C 15 27.235 14.219 27.694 14.219 27.743 C 14.219 27.791 14.839 28.035 15.595 28.285 C 17.868 29.034 20.593 29.184 22.753 28.679 C 23.879 28.415 25.355 27.846 25.355 27.675 C 25.355 27.603 24.515 27.129 23.489 26.623 C 22.462 26.117 21.184 25.454 20.648 25.149 C 20.111 24.845 19.656 24.597 19.635 24.6 C 19.614 24.603 19.168 24.871 18.642 25.197 Z M 25.988 28.383 C 22.973 30.213 18.28 30.378 14.334 28.792 C 13.418 28.424 13.132 28.358 12.906 28.46 C 12.343 28.715 10.044 30.248 10.044 30.368 C 10.044 30.544 11.704 31.634 12.827 32.196 C 18.806 35.185 25.022 34.599 29.574 30.617 L 30.186 30.082 L 29.511 29.653 C 28.791 29.197 26.691 28.112 26.528 28.113 C 26.475 28.114 26.232 28.235 25.988 28.383 Z" fill="rgb(0,0,0)" stroke-width="0.11" stroke="rgba(0,0,0,1)" stroke-miterlimit="10"></path></svg>`,
  },
  {
    id: 'book',
    label: 'Book',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="none"><path d="M 29.627 4.256 C 29.646 4.268 29.665 4.279 29.683 4.29 C 29.739 4.323 29.789 4.353 29.834 4.388 C 30.191 4.664 30.274 5.289 31.016 10.836 C 31.046 11.065 31.078 11.304 31.111 11.55 C 31.337 13.234 31.564 14.917 31.792 16.6 C 32.337 20.607 32.91 24.911 32.981 25.522 C 33.077 26.34 33.449 29.141 33.778 31.525 C 34.089 33.772 34.077 34.392 33.717 34.683 C 33.392 34.945 32.104 35.047 31.399 34.867 C 30.598 34.663 30.535 34.485 30.158 31.353 L 29.838 28.696 L 29.323 28.761 C 29.039 28.797 28.466 28.86 28.048 28.901 C 27.631 28.942 27.246 29.031 27.194 29.1 C 27.114 29.204 26.952 30.66 26.668 33.81 C 26.589 34.684 26.116 35.011 24.953 34.996 C 23.252 34.973 22.978 34.626 23.029 32.562 L 23.063 31.186 L 15.853 31.245 L 15.815 32.535 C 15.753 34.612 15.506 34.892 13.733 34.892 C 12.09 34.892 11.759 34.472 11.748 32.379 L 11.741 31.156 L 10.879 31.228 C 10.405 31.268 9.551 31.301 8.981 31.301 L 7.945 31.301 L 7.869 32.545 C 7.754 34.436 7.553 34.731 6.239 34.947 C 4.927 35.163 3.876 34.697 4.012 33.96 C 4.048 33.763 4.306 31.708 4.586 29.393 C 4.865 27.079 5.221 24.226 5.377 23.053 C 6.155 17.208 6.359 15.666 6.675 13.234 C 6.884 11.625 7.091 10.017 7.296 8.408 C 7.784 4.564 7.792 4.534 8.429 4.203 C 9.011 3.9 29.124 3.951 29.627 4.256 Z M 6.235 22.997 C 5.8 26.299 5.341 29.96 5.214 31.133 C 5.088 32.305 4.964 33.451 4.939 33.678 C 4.882 34.189 4.975 34.232 5.936 34.142 C 6.961 34.047 6.998 33.987 7.086 32.263 C 7.134 31.318 7.209 30.782 7.306 30.685 C 7.538 30.454 10.938 30.344 20.327 30.263 C 20.667 30.26 20.975 30.256 21.254 30.252 C 22.875 30.23 23.539 30.222 23.8 30.54 C 23.982 30.762 23.968 31.142 23.946 31.786 C 23.94 31.946 23.934 32.122 23.93 32.316 L 23.897 33.996 L 24.204 34.112 C 24.373 34.176 24.794 34.214 25.139 34.196 L 25.766 34.163 L 25.854 33.153 C 25.903 32.597 26.09 30.905 26.272 29.393 C 26.453 27.881 26.782 25.104 27.003 23.221 C 27.224 21.339 27.556 18.586 27.74 17.105 C 27.924 15.624 28.28 12.72 28.531 10.653 C 28.782 8.585 29.052 6.447 29.13 5.901 L 29.274 4.908 L 29.002 4.805 C 28.69 4.687 9.473 4.688 9.039 4.806 C 8.676 4.905 8.511 5.249 8.417 6.097 C 8.304 7.113 7.136 16.156 6.235 22.997 Z" fill="rgb(0,0,0)" stroke-width="0.11" stroke="rgba(0,0,0,1)" stroke-miterlimit="10"></path><path d="M 16.448 28.554 C 8.628 28.637 8.57 28.633 7.916 28.009 C 7.89 27.984 7.866 27.962 7.842 27.94 L 7.841 27.939 C 7.773 27.876 7.715 27.822 7.666 27.76 C 7.36 27.368 7.454 26.664 8.146 21.526 L 8.146 21.521 C 8.184 21.239 8.224 20.943 8.266 20.633 C 8.592 18.195 8.916 15.757 9.237 13.318 C 9.839 8.738 9.898 8.447 10.33 7.868 C 10.347 7.845 10.363 7.823 10.378 7.802 C 10.464 7.686 10.535 7.589 10.621 7.509 C 11.047 7.112 11.837 7.105 16.528 7.059 C 16.702 7.058 16.882 7.056 17.067 7.054 L 17.224 7.053 C 25.501 6.972 25.991 6.967 26.38 7.162 C 26.404 7.175 26.429 7.188 26.454 7.202 L 26.462 7.206 L 26.844 7.413 L 26.773 8.552 C 26.696 9.784 25.915 17.299 25.639 19.469 C 25.545 20.202 25.39 21.634 25.292 22.653 C 24.983 25.893 24.784 27.293 24.575 27.695 C 24.568 27.708 24.562 27.721 24.555 27.733 C 24.55 27.744 24.544 27.755 24.539 27.766 C 24.485 27.871 24.44 27.96 24.378 28.037 C 24.023 28.475 23.134 28.485 17.148 28.547 L 16.804 28.551 L 16.789 28.551 L 16.78 28.551 Z M 16.973 11.074 L 16.975 11.074 C 16.996 11.073 17.017 11.072 17.039 11.071 C 17.757 11.037 18.064 10.769 17.67 10.52 C 17.471 10.395 16.238 10.406 15.913 10.536 C 15.773 10.592 15.659 10.677 15.659 10.726 C 15.659 10.774 15.583 11.52 15.491 12.385 C 15.281 14.353 15.274 15.204 15.465 15.277 C 15.745 15.384 17.233 15.217 17.36 15.064 C 17.646 14.722 17.384 14.543 16.671 14.595 L 15.997 14.643 L 15.999 14.131 C 16.001 13.214 16.06 13.129 16.713 13.091 C 17.247 13.06 17.293 13.036 17.293 12.777 C 17.293 12.519 17.247 12.494 16.709 12.463 L 16.126 12.429 L 16.181 12.014 C 16.187 11.976 16.191 11.939 16.196 11.904 C 16.253 11.473 16.28 11.275 16.393 11.178 C 16.49 11.096 16.651 11.089 16.95 11.075 Z M 11.407 15.114 C 11.644 15.08 11.669 14.995 11.79 13.787 C 11.861 13.077 11.928 12.421 11.94 12.328 C 11.951 12.236 12.031 12.463 12.117 12.833 C 12.559 14.727 12.657 14.758 13.444 13.245 C 14.067 12.045 14.081 12.037 13.963 12.946 C 13.915 13.316 13.872 13.985 13.866 14.433 C 13.857 15.228 13.863 15.246 14.138 15.246 C 14.293 15.246 14.421 15.208 14.422 15.162 C 14.424 15.116 14.499 14.219 14.59 13.17 L 14.593 13.132 C 14.771 11.079 14.808 10.648 14.649 10.557 C 14.607 10.533 14.551 10.533 14.48 10.533 L 14.475 10.533 C 14.135 10.533 13.947 10.812 13.342 12.22 L 12.912 13.22 L 12.618 12.014 C 12.456 11.35 12.286 10.746 12.239 10.67 C 12.128 10.492 11.775 10.494 11.635 10.673 C 11.506 10.84 11.149 13.698 11.152 14.553 C 11.153 15.107 11.171 15.147 11.407 15.114 Z M 18.71 15.162 C 18.715 15.054 18.779 14.309 18.853 13.507 L 18.987 12.048 L 19.36 13.114 C 19.907 14.675 20.175 15.183 20.475 15.226 L 20.481 15.227 C 20.552 15.237 20.607 15.245 20.653 15.227 C 20.819 15.165 20.862 14.778 21.059 12.996 L 21.063 12.958 C 21.296 10.849 21.292 10.757 20.957 10.757 C 20.728 10.757 20.726 10.767 20.49 12.752 L 20.353 13.905 L 19.772 12.353 C 19.453 11.499 19.154 10.74 19.108 10.667 C 18.982 10.463 18.723 10.507 18.589 10.755 C 18.451 11.013 18.087 14.954 18.18 15.196 C 18.271 15.43 18.699 15.402 18.71 15.162 Z M 24.152 14.375 C 24.346 13.78 24.558 12.226 24.558 11.398 C 24.558 10.898 24.538 10.857 24.305 10.89 C 24.066 10.924 24.044 11.006 23.915 12.368 C 23.757 14.026 23.545 14.609 23.082 14.663 C 22.588 14.72 22.484 14.266 22.572 12.433 L 22.647 10.87 L 22.377 10.87 C 22.168 10.87 22.093 10.945 22.04 11.21 C 21.874 12.035 21.832 13.648 21.961 14.262 C 22.261 15.697 23.696 15.771 24.152 14.375 Z" fill="rgb(0,0,0)"></path></svg>`,
  },
  {
    id: 'cabinet',
    label: 'Cabinet',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="none"><path d="M 25.488 6.002 L 25.489 6.465 L 26.29 6.531 C 28.071 6.68 28.293 7.154 27.208 8.497 L 26.783 9.023 L 27.321 9.181 C 29.832 9.917 34.227 12.133 35.569 13.339 C 36.916 14.549 37.085 15.947 36.971 24.933 C 36.886 31.6 36.882 31.647 36.348 31.923 C 35.549 32.336 30.694 33.072 19.086 34.54 C 16.868 34.821 14.419 35.135 13.644 35.238 C 7.803 36.017 4.704 36.195 4.081 35.788 C 3.461 35.383 3.308 33.539 3.075 23.679 C 2.922 17.201 2.883 17.456 4.184 16.46 C 5.907 15.139 10.99 12.004 13.826 10.513 C 14.207 10.312 14.561 10.061 14.613 9.956 C 14.796 9.572 14.979 9.188 15.161 8.804 C 15.968 7.104 17.394 5.882 19.114 5.417 C 19.809 5.229 20.002 5.108 20.435 4.589 C 21.584 3.214 22.199 2.996 22.262 3.941 C 22.299 4.502 22.53 4.836 22.882 4.836 C 22.971 4.836 23.253 4.461 23.509 4.004 C 23.765 3.546 24.069 3.119 24.184 3.055 C 24.829 2.694 25.485 4.175 25.488 6.002 Z M 24.166 4.507 C 24.127 4.608 24.149 4.709 24.214 4.731 C 24.279 4.753 24.383 5.261 24.446 5.86 C 24.548 6.845 24.561 6.88 24.576 6.23 C 24.608 4.894 24.381 3.945 24.166 4.507 Z M 23.589 5.545 C 23.381 6.002 23.404 6.33 23.651 6.425 C 23.935 6.534 24.001 6.443 23.775 6.255 C 23.636 6.14 23.619 6.003 23.705 5.701 C 23.849 5.199 23.786 5.114 23.589 5.545 Z M 22.928 5.604 C 22.928 5.674 22.989 5.732 23.064 5.732 C 23.138 5.732 23.164 5.674 23.12 5.604 C 23.077 5.533 23.016 5.476 22.985 5.476 C 22.953 5.476 22.928 5.533 22.928 5.604 Z M 18.854 6.39 C 17.716 6.827 15.885 8.819 15.885 9.619 C 15.885 9.667 15.683 10.221 15.437 10.852 C 14.258 13.867 15.313 14.975 19.19 14.791 C 22.536 14.632 25.617 12.66 25.617 10.677 C 25.617 9.923 23.06 6.9 21.979 6.377 C 21.245 6.022 19.797 6.028 18.854 6.39 Z M 25.677 7.518 C 25.07 7.764 25.027 8.017 25.509 8.499 L 25.958 8.948 L 26.371 8.172 L 26.785 7.396 L 26.361 7.404 C 26.128 7.408 25.82 7.459 25.677 7.518 Z M 25.966 7.654 C 26.391 7.652 26.45 7.934 26.056 8.086 C 25.955 8.124 25.874 8.253 25.874 8.372 C 25.874 8.569 25.851 8.568 25.617 8.356 C 25.27 8.041 25.286 7.787 25.649 7.867 C 25.881 7.918 25.9 7.903 25.745 7.793 C 25.593 7.684 25.638 7.655 25.966 7.654 Z M 27.026 10.436 C 27.026 11.674 25.14 13.913 23.387 14.755 C 21.756 15.539 20.691 15.763 18.574 15.763 C 15.233 15.764 13.974 14.881 13.967 12.534 C 13.964 11.404 14.259 11.343 11.239 13.104 C 6.838 15.669 3.975 17.716 3.975 18.297 C 3.975 18.558 9.859 18.321 13.772 17.903 C 14.476 17.828 16.897 17.592 19.151 17.379 C 30.851 16.273 32.88 15.996 34.244 15.319 C 34.69 15.098 35.154 14.954 35.32 14.986 C 35.986 15.113 35.342 14.199 34.261 13.482 C 32.799 12.511 27.711 10.084 27.139 10.084 C 27.077 10.084 27.026 10.242 27.026 10.436 Z M 35.294 15.58 C 34.487 16.471 32.456 16.835 22.736 17.831 C 12.501 18.88 7.636 19.245 5.24 19.147 L 3.847 19.089 L 3.847 21.733 L 4.264 21.731 C 4.868 21.729 12.5 20.842 27.282 19.057 C 32.232 18.46 33.253 18.359 33.476 18.444 C 33.645 18.509 33.684 18.715 33.681 19.521 C 33.676 20.619 33.466 23.915 33.396 23.985 C 33.372 24.009 32.577 24.118 31.63 24.227 C 30.682 24.335 28.351 24.623 26.45 24.866 C 24.21 25.15 21.969 25.427 19.727 25.698 C 17.931 25.913 16.243 26.118 15.977 26.153 C 13.26 26.514 4.246 27.621 4.028 27.621 C 3.951 27.621 3.964 28.267 4.053 28.92 C 4.128 29.463 4.147 29.485 4.533 29.453 C 7.931 29.166 24.56 27.244 28.115 26.727 C 29.03 26.594 30.384 26.421 31.124 26.344 C 31.864 26.266 32.661 26.169 32.895 26.128 L 33.322 26.053 L 33.228 28.905 L 33.135 31.757 L 33.57 31.666 C 33.809 31.615 34.425 31.499 34.937 31.408 C 35.45 31.316 35.911 31.2 35.962 31.149 C 36.013 31.098 36.054 27.763 36.054 23.738 C 36.054 15.452 35.994 14.806 35.294 15.58 Z M 31.508 19.389 C 31.262 19.414 29.446 19.634 27.474 19.877 C 18.353 21 16.421 21.23 14.028 21.477 C 11.59 21.729 10.173 21.892 6.749 22.314 C 5.915 22.417 4.921 22.501 4.54 22.501 L 3.847 22.501 L 3.848 23.813 C 3.849 24.535 3.884 25.499 3.928 25.957 L 4.006 26.789 L 12.923 25.687 C 17.827 25.081 22.935 24.457 24.273 24.301 C 25.611 24.145 27.08 23.965 27.538 23.9 C 27.996 23.835 29.206 23.666 30.228 23.523 C 31.249 23.381 32.209 23.237 32.361 23.203 C 32.613 23.147 32.643 23.037 32.715 21.893 C 32.757 21.207 32.821 20.342 32.856 19.973 L 32.919 19.301 L 32.438 19.321 C 32.173 19.332 31.755 19.363 31.508 19.389 Z M 29.779 27.305 C 22.777 28.21 17.828 28.826 14.348 29.223 C 12.2 29.469 9.981 29.726 9.418 29.795 C 8.854 29.864 7.445 30.01 6.287 30.12 C 5.128 30.229 4.166 30.333 4.148 30.35 C 4.11 30.388 4.315 33.256 4.43 34.298 C 4.522 35.132 4.583 35.169 5.848 35.172 C 6.766 35.174 12.007 34.595 16.877 33.953 C 18.761 33.705 21.196 33.386 22.288 33.245 L 27.218 32.606 C 29.933 32.254 31.138 32.077 32.052 31.895 L 32.405 31.825 L 32.405 29.403 C 32.405 27.544 32.367 26.984 32.244 26.994 C 32.157 27.001 31.047 27.141 29.779 27.305 Z" fill="rgb(0,0,0)" stroke-width="0.11" stroke="rgba(0,0,0,1)" stroke-miterlimit="10"></path></svg>`,
  },
  {
    id: 'tree',
    label: 'Tree',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="none"><path d="M 23.624 3.017 C 24.778 4.142 25.736 5.917 25.777 7.007 C 25.798 7.577 25.901 7.721 26.554 8.104 C 27.941 8.916 28.909 10.7 28.768 12.184 C 28.703 12.865 28.746 12.95 29.349 13.331 C 31.154 14.47 31.984 16.135 31.806 18.259 C 31.715 19.348 31.746 19.532 32.069 19.824 C 33.279 20.919 33.226 21.764 31.502 28.883 C 29.919 35.422 29.861 35.582 28.753 36.49 C 26.652 38.209 24.04 38.99 20.347 39 C 16.057 39.012 13.868 38.436 11.556 36.688 C 10.121 35.603 10.226 35.875 8.56 28.874 C 6.89 21.859 6.886 21.832 7.4 20.637 C 7.732 19.866 7.764 19.627 7.596 19.147 C 7.143 17.846 7.637 16.25 8.71 15.546 C 9.277 15.175 9.323 15.08 9.24 14.456 C 9.047 13.021 10.377 11.095 11.956 10.525 C 12.502 10.327 12.613 10.201 12.613 9.777 C 12.613 8.323 14.206 6.592 16.597 5.448 C 18.941 4.326 19.777 3.339 19.524 1.99 C 19.462 1.663 19.466 1.309 19.531 1.204 C 19.928 0.561 22.084 1.515 23.624 3.017 Z M 20.347 2.546 C 20.347 4.001 19.508 4.928 17.093 6.141 C 14.547 7.421 13.051 9.058 13.458 10.119 C 13.557 10.376 15.11 11.141 15.926 11.335 C 16.848 11.555 19.209 11.463 20.368 11.163 C 24.108 10.195 25.674 8.052 24.465 5.557 C 23.464 3.49 20.347 1.211 20.347 2.546 Z M 25.383 8.746 C 25.383 9.146 23.812 10.601 22.872 11.07 C 20.892 12.06 20.069 12.244 17.628 12.246 C 15.373 12.247 15.351 12.243 14.089 11.596 L 12.819 10.945 L 12.041 11.384 C 9.757 12.674 9.379 14.221 10.927 15.934 C 13.943 19.27 25.509 17.519 27.638 13.404 C 28.013 12.678 27.971 11.201 27.552 10.38 C 26.988 9.275 25.383 8.066 25.383 8.746 Z M 27.809 14.498 C 24.868 18.74 13.21 20.032 10.195 16.45 C 9.458 15.575 8.296 16.541 8.296 18.031 C 8.296 24.381 26.365 25.733 30.45 19.688 C 31.681 17.867 30.946 15.06 28.972 14.04 C 28.308 13.697 28.386 13.666 27.809 14.498 Z M 30.083 21.34 C 27.669 23.591 24.187 24.503 18.694 24.326 C 14.087 24.177 11.381 23.344 9.234 21.415 L 8.336 20.608 L 8.037 21.238 C 7.631 22.093 7.881 22.571 9.375 23.794 C 10.529 24.739 10.557 24.75 11.481 24.644 C 12.524 24.524 13.319 24.803 14.163 25.585 C 14.635 26.021 14.671 26.027 15.249 25.752 C 15.946 25.42 16.738 25.517 17.613 26.042 C 18.176 26.38 18.223 26.382 18.55 26.087 C 19.131 25.561 20.453 25.516 21.107 26 C 21.551 26.328 21.72 26.368 21.949 26.201 C 22.963 25.459 23.801 25.319 24.78 25.728 C 25.395 25.985 25.447 25.977 25.951 25.553 C 26.711 24.914 27.797 24.622 28.468 24.875 C 28.964 25.062 29.1 25.007 30.416 24.081 C 32.271 22.776 32.547 22.101 31.746 20.83 C 31.385 20.258 31.175 20.323 30.083 21.34 Z M 8.492 24.876 C 8.578 25.246 9.13 27.652 9.718 30.223 L 10.787 34.896 L 11.543 35.57 C 12.47 36.396 12.629 36.412 12.426 35.66 C 12.339 35.339 11.937 33.149 11.532 30.794 C 10.655 25.693 10.708 25.853 9.614 25.064 C 8.295 24.113 8.315 24.116 8.492 24.876 Z M 30.959 24.78 C 29.709 25.48 29.382 25.941 29.156 27.323 C 29.041 28.028 28.631 30.297 28.245 32.365 C 27.859 34.433 27.579 36.162 27.624 36.207 C 27.669 36.251 28.02 36.039 28.404 35.735 C 29.191 35.112 29.147 35.242 30.512 29.504 C 30.959 27.625 31.415 25.742 31.526 25.319 C 31.775 24.372 31.743 24.342 30.959 24.78 Z M 11.422 25.722 C 11.366 25.867 11.529 27.06 11.783 28.374 C 12.038 29.687 12.487 32.119 12.782 33.778 C 13.076 35.436 13.362 36.866 13.417 36.955 C 13.528 37.135 15.297 37.757 15.401 37.653 C 15.437 37.616 15.356 36.698 15.221 35.612 C 15.004 33.846 14.792 32.08 14.585 30.313 C 14.37 28.484 14.127 26.86 14.044 26.704 C 13.581 25.834 11.656 25.113 11.422 25.722 Z M 27.092 25.891 C 25.954 26.393 25.939 26.445 25.284 32.223 C 24.95 35.167 24.709 37.608 24.749 37.647 C 24.788 37.687 25.251 37.522 25.778 37.282 L 26.735 36.844 L 27.337 33.533 C 27.668 31.712 28.126 29.292 28.353 28.155 C 28.861 25.62 28.633 25.211 27.092 25.891 Z M 15.292 26.697 L 14.873 27.035 L 15.188 29.618 C 15.361 31.038 15.624 33.292 15.772 34.627 C 16.143 37.967 16.096 37.827 16.886 37.96 C 17.256 38.022 17.697 38.111 17.864 38.157 C 18.135 38.23 18.16 38.101 18.09 37.017 C 18.046 36.345 17.96 33.871 17.899 31.519 L 17.788 27.242 L 17.138 26.8 C 16.357 26.27 15.854 26.242 15.292 26.697 Z M 22.642 26.78 C 22.21 27.18 22.18 27.332 22.076 29.612 C 21.702 37.872 21.695 38.222 21.912 38.222 C 22.816 38.221 23.951 37.801 24.018 37.443 C 24.057 37.229 24.347 34.791 24.662 32.025 L 25.234 26.997 L 24.839 26.677 C 24.265 26.213 23.2 26.263 22.642 26.78 Z M 18.75 26.916 C 18.527 27.123 18.386 27.402 18.437 27.534 C 18.488 27.667 18.587 30.126 18.657 32.999 L 18.784 38.222 L 21.014 38.222 L 21.129 35.84 C 21.191 34.53 21.296 32.031 21.361 30.286 L 21.479 27.113 L 20.922 26.825 C 20.142 26.422 19.24 26.459 18.75 26.916 Z" fill="rgb(0,0,0)" stroke-width="0.11" stroke="rgba(0,0,0,1)" stroke-miterlimit="10"></path></svg>`,
  },
  {
    id: 'leaf',
    label: 'Leaf',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="none"><path d="M 21.214 8.017 C 21.822 7.879 27.218 8.627 28.575 9.037 C 33.186 10.43 36.386 14.695 34.4 16.798 C 33.553 17.694 30.953 18.155 29.496 17.667 C 29.201 17.568 28.949 17.504 28.937 17.524 C 28.14 18.846 26.728 20.362 25.703 20.997 C 25.274 21.262 25.11 21.453 24.965 21.853 C 23.939 24.69 21.744 26.432 19.198 26.432 C 18.73 26.432 18.557 26.494 18.231 26.777 C 17.426 27.474 14.89 28.493 13.96 28.493 C 13.236 28.493 12.563 29.47 11.861 31.541 C 10.968 34.176 10.021 35.128 8.436 34.986 C 5.456 34.72 3.143 29.369 4.307 25.433 C 4.44 24.982 4.432 24.846 4.239 24.282 C 3.878 23.227 4.325 21.115 5.26 19.469 C 5.453 19.129 5.645 18.483 5.79 17.694 C 6.725 12.575 11.41 8.797 16.656 8.93 C 17.409 8.949 17.715 8.894 18.554 8.593 C 19.105 8.395 19.914 8.188 20.352 8.132 C 20.791 8.077 21.179 8.025 21.214 8.017 Z M 20.744 8.991 C 20.023 9.053 18.54 9.375 18.54 9.47 C 18.54 9.513 18.787 9.677 19.09 9.834 C 21.416 11.043 24.156 15.599 24.753 19.249 C 24.864 19.926 24.989 20.48 25.031 20.48 C 25.487 20.48 27.5 18.341 28.007 17.319 L 28.325 16.677 L 28.105 16.032 C 26.294 10.703 24.197 8.697 20.744 8.991 Z M 25.679 10.018 C 26.978 11.282 27.572 12.213 28.627 14.635 C 29.136 15.803 29.637 16.792 29.751 16.855 C 30.502 17.27 33.23 16.772 33.787 16.119 C 34.93 14.779 32.829 11.852 29.72 10.453 C 28.647 9.97 26.432 9.32 25.445 9.199 L 24.75 9.114 Z M 14.305 9.945 C 11.196 10.596 8.06 13.423 6.92 16.599 C 6.497 17.779 6.498 17.785 7.083 17.478 C 7.488 17.265 7.752 17.22 8.562 17.225 C 11.922 17.247 15.512 19.93 17.572 23.955 C 18.258 25.296 18.489 25.517 19.202 25.515 C 21.515 25.51 23.754 23.63 24.046 21.448 C 24.408 18.749 22.221 13.706 19.684 11.388 C 18.362 10.181 17.701 9.901 16.103 9.872 C 15.37 9.858 14.56 9.891 14.305 9.945 Z M 7.982 18.181 C 6.968 18.388 6.62 18.732 5.852 20.286 C 5.271 21.461 4.966 22.487 4.966 23.263 C 4.966 24.12 5.025 24.178 5.586 23.882 C 6.309 23.5 8.06 23.53 9.239 23.943 C 10.942 24.54 12.352 25.623 13.048 26.87 C 13.282 27.29 13.483 27.647 13.494 27.663 C 13.546 27.742 14.861 27.425 15.581 27.162 C 17.138 26.592 17.945 25.962 17.481 25.679 C 17.409 25.635 17.167 25.207 16.944 24.728 C 15.062 20.686 10.835 17.597 7.982 18.181 Z M 6.014 24.69 C 5.438 25.005 5.22 25.351 5.025 26.261 C 4.441 28.99 5.822 33.018 7.65 33.917 C 9.283 34.719 10.103 34.075 11.012 31.275 C 11.467 29.87 11.809 29.104 12.28 28.429 L 12.648 27.9 L 12.433 27.502 C 11.903 26.526 10.089 25.135 8.855 24.76 C 7.875 24.463 6.491 24.428 6.014 24.69 Z" fill="rgb(0,0,0)" stroke-width="0.11" stroke="rgba(0,0,0,1)" stroke-miterlimit="10"></path></svg>`,
  },
  {
    id: 'flower',
    label: 'Flower',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="none"><path d="M 23.948 8.82 C 26.2 9.447 27.965 11.165 28.265 13.02 C 28.331 13.43 28.388 13.496 28.674 13.498 C 29.83 13.505 31.913 14.249 32.865 14.995 C 33.947 15.843 34.693 17.392 34.848 19.109 C 34.93 20.028 34.957 20.094 35.417 20.486 C 37.44 22.214 37.549 28.101 35.6 30.382 C 34.665 31.477 32.983 31.821 31.73 31.174 C 30.619 30.6 27.473 26.955 27.217 25.944 C 27.126 25.586 27.154 25.587 26.499 25.929 C 24.959 26.735 22.302 25.846 21.38 24.217 C 21.268 24.019 21.229 24.022 20.824 24.258 C 19.573 24.988 17.277 25.098 16.069 24.486 C 15.418 24.157 14.127 22.862 14.123 22.535 C 14.122 22.422 14.048 22.396 13.9 22.457 C 11.809 23.322 10.008 23.183 9.094 22.087 L 8.709 21.624 L 7.918 22.129 C 6.671 22.927 5.868 23.187 4.621 23.197 C 3.244 23.209 2.803 22.985 2.309 22.023 C 1.181 19.826 3.259 16.205 6.665 14.435 C 7.322 14.093 7.579 13.882 7.708 13.578 C 8.29 12.201 11.202 10.775 13.494 10.743 C 13.704 10.741 14.009 10.545 14.374 10.177 C 15.144 9.4 16.442 8.882 18.429 8.558 C 19.371 8.404 23.087 8.581 23.948 8.82 Z M 18.092 9.546 C 15.967 9.928 15.302 10.303 14.768 11.421 C 13.987 13.055 13.805 13.964 13.813 16.19 C 13.836 22.25 15.778 24.832 19.565 23.835 C 20.668 23.545 20.866 23.333 21.109 22.191 C 21.803 18.913 24.391 15.04 26.576 14.008 C 27.15 13.737 27.423 13.537 27.423 13.386 C 27.423 12.336 26.114 10.684 24.82 10.102 C 23.236 9.39 20.311 9.148 18.092 9.546 Z M 12.598 11.738 C 11.547 11.873 10.303 12.324 9.543 12.846 C 8.255 13.73 7.96 15.846 8.718 18.768 C 9.53 21.899 10.426 22.594 12.836 21.96 C 13.706 21.731 13.667 21.823 13.37 20.704 C 12.638 17.937 12.721 13.768 13.548 11.835 C 13.651 11.595 13.691 11.599 12.598 11.738 Z M 27.343 14.525 C 25.31 15.172 21.791 20.695 22.005 22.901 C 22.14 24.291 23.491 25.335 25.154 25.336 C 26.167 25.336 26.317 25.23 27.359 23.759 C 28.783 21.752 30.737 20.445 32.902 20.054 L 34.01 19.854 L 34.01 19.395 C 34.01 18.798 33.7 17.63 33.372 16.995 C 32.466 15.238 29.246 13.918 27.343 14.525 Z M 6.374 15.621 C 4.256 16.998 3.037 18.816 3.037 20.601 C 3.037 22.039 3.315 22.334 4.656 22.32 C 6.004 22.306 8.388 21.145 8.24 20.575 C 8.205 20.437 8.027 19.789 7.845 19.134 C 7.625 18.346 7.485 17.445 7.429 16.467 L 7.344 14.991 Z M 32.553 20.997 C 31.342 21.341 30.495 21.872 29.196 23.102 C 27.616 24.599 27.528 24.76 27.92 25.442 C 28.919 27.179 31.342 29.959 32.261 30.423 C 32.789 30.689 33.434 30.729 33.97 30.528 C 36.104 29.729 36.853 23.9 35.139 21.436 C 34.611 20.677 34.027 20.578 32.553 20.997 Z" fill="rgb(0,0,0)" stroke-width="0.11" stroke="rgba(0,0,0,1)" stroke-miterlimit="10"></path></svg>`,
  },
  {
    id: 'bowling-pin',
    label: 'Bowling Pin',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="none"><path d="M 28.733 2.146 C 29.052 2.367 28.99 2.701 28.35 4.214 C 26.902 7.637 25.165 12.1 25.171 12.38 C 25.173 12.459 25.328 12.638 25.516 12.778 C 26.474 13.492 27.346 14.88 27.615 16.121 C 27.751 16.746 27.8 16.845 27.996 16.894 C 29.311 17.221 29.345 19.759 28.034 19.766 C 27.537 19.769 27.535 19.776 27.198 22.998 C 27.054 24.378 26.862 26.131 26.462 29.693 C 26.263 31.471 26.03 33.603 25.945 34.429 C 25.849 35.364 25.728 36.076 25.625 36.313 C 25.328 36.996 25.562 36.97 19.674 36.988 C 12.948 37.009 13.512 37.223 13.166 34.506 C 12.801 31.635 12.311 27.607 12.165 26.277 C 12.088 25.576 11.9 23.894 11.748 22.541 C 11.596 21.187 11.471 20.029 11.471 19.968 C 11.471 19.896 11.316 19.855 11.034 19.854 C 10.302 19.851 10 19.481 10 18.589 C 10 17.602 10.372 17.066 11.172 16.898 C 11.467 16.837 11.471 16.83 11.471 16.311 C 11.471 15.241 12.194 13.87 13.332 12.784 C 14.433 11.733 15.269 11.257 16.849 10.78 C 18.591 10.254 21.782 10.468 23.249 11.209 C 23.681 11.427 23.687 11.423 23.943 10.748 C 25.054 7.814 27.306 2.474 27.544 2.209 C 27.767 1.961 28.417 1.926 28.733 2.146 Z M 17.88 11.201 C 14.912 11.735 12.272 14.068 12.13 16.281 L 12.091 16.88 L 15.481 16.82 C 17.345 16.787 19.471 16.76 20.204 16.759 L 21.537 16.758 L 22.433 14.543 C 22.926 13.325 23.33 12.257 23.33 12.171 C 23.33 11.979 22.859 11.762 21.721 11.428 C 20.813 11.162 18.769 11.041 17.88 11.201 Z M 24.657 13.457 C 24.577 13.645 24.283 14.352 24.004 15.029 C 23.725 15.705 23.442 16.371 23.374 16.509 L 23.252 16.759 L 27.032 16.759 L 26.98 16.259 C 26.908 15.569 26.375 14.617 25.596 13.787 C 24.867 13.01 24.85 13.005 24.657 13.457 Z M 12.497 17.574 C 10.847 17.633 10.643 17.738 10.643 18.534 C 10.643 19.299 10.294 19.256 15.974 19.188 C 18.73 19.155 22.565 19.128 24.495 19.127 C 28.571 19.127 28.349 19.177 28.267 18.287 C 28.187 17.408 28.911 17.486 20.951 17.506 C 17.077 17.516 13.272 17.547 12.497 17.574 Z M 15.033 19.833 C 12.294 19.857 12.114 19.869 12.114 20.023 C 12.114 20.113 12.177 20.655 12.253 21.228 C 12.33 21.801 12.497 23.212 12.624 24.365 C 13.348 30.928 14.016 36.08 14.16 36.217 C 14.317 36.368 14.137 36.363 19.711 36.352 C 24.331 36.343 24.702 36.33 24.89 36.18 C 25.109 36.004 25.132 35.848 25.666 30.968 C 25.794 29.791 26.003 27.905 26.129 26.778 C 26.255 25.651 26.463 23.766 26.59 22.588 C 26.718 21.411 26.847 20.294 26.877 20.106 L 26.931 19.765 L 22.441 19.786 C 19.972 19.798 16.638 19.819 15.033 19.833 Z" fill="rgb(0,0,0)" stroke-width="0.11" stroke="rgba(0,0,0,1)" stroke-miterlimit="10"></path></svg>`,
  },
  {
    id: 'jar',
    label: 'Jar',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="none"><path d="M 11.264 5 L 20.053 5.002 C 26.814 5.003 28.905 5.035 29.114 5.141 C 29.6 5.387 29.826 5.944 29.878 7.021 L 29.925 8 L 30.359 8 C 31.507 8 31.898 8.515 31.897 10.024 C 31.897 11.376 31.406 12 30.346 12 L 30.009 12 L 30.008 13.639 C 30.007 14.54 29.975 15.54 29.937 15.861 C 29.878 16.352 29.895 16.444 30.045 16.444 C 30.382 16.444 30.473 16.835 30.297 17.527 C 30.153 18.096 29.93 19.793 29.119 26.484 C 28.891 28.366 28.827 28.625 28.522 28.878 C 28.355 29.016 28.334 29.148 28.117 31.389 C 27.681 35.904 27.796 35.774 24.126 35.915 C 19.857 36.078 13.354 35.981 12.926 35.748 C 12.263 35.385 12.226 35.244 11.96 32.081 C 11.719 29.209 11.71 29.156 11.418 28.863 C 11.254 28.7 11.12 28.497 11.12 28.412 C 11.12 28.328 10.971 26.638 10.789 24.657 C 10.607 22.676 10.407 20.456 10.344 19.722 C 10.281 18.989 10.148 18.02 10.049 17.57 C 9.883 16.814 9.883 16.722 10.05 16.372 C 10.196 16.065 10.231 15.611 10.231 13.996 L 10.231 12 L 9.87 11.997 C 8.38 11.986 7.936 11.394 8.081 9.611 C 8.178 8.415 8.54 8 9.486 8 L 10.097 8 L 10.139 7.083 C 10.188 6.026 10.358 5.61 10.886 5.254 Z M 14.271 5.863 C 10.763 5.897 10.996 5.809 10.919 7.135 L 10.867 8.036 L 11.966 7.963 C 12.57 7.923 16.683 7.89 21.107 7.889 L 29.149 7.889 L 29.095 7.048 C 29.01 5.72 29.58 5.833 22.977 5.833 C 19.847 5.833 15.929 5.847 14.271 5.863 Z M 9.023 8.989 C 8.817 9.119 8.715 10.547 8.888 10.871 L 9.016 11.111 L 19.853 11.111 C 27.111 11.111 30.761 11.073 30.905 10.996 C 31.086 10.899 31.12 10.759 31.12 10.1 C 31.12 8.738 32.501 8.889 20.033 8.891 C 14.059 8.892 9.107 8.936 9.023 8.989 Z M 10.978 14.139 C 11.003 15.315 11.044 16.34 11.068 16.417 C 11.103 16.526 13.01 16.556 20.107 16.556 L 29.102 16.556 L 29.162 15.861 C 29.195 15.479 29.247 14.454 29.276 13.583 L 29.33 12 L 10.932 12 Z M 10.9 17.417 C 10.901 17.462 10.949 17.825 11.006 18.222 C 11.102 18.89 11.67 24.988 11.849 27.268 L 11.927 28.258 L 19.985 28.19 C 25.548 28.144 28.067 28.086 28.118 28.004 C 28.158 27.938 28.253 27.273 28.329 26.525 C 28.471 25.117 29.271 18.635 29.405 17.806 L 29.482 17.333 L 20.19 17.333 C 15.079 17.333 10.899 17.371 10.9 17.417 Z M 12.5 29.306 C 12.535 29.474 12.64 30.586 12.732 31.778 C 12.962 34.737 12.997 34.908 13.405 35.094 C 13.716 35.236 19.353 35.254 23.867 35.128 C 26.814 35.045 26.836 35.038 27.018 34.065 C 27.097 33.642 27.564 29.384 27.564 29.087 C 27.564 29.039 24.16 29 20 29 L 12.435 29 Z" fill="rgb(0,0,0)" stroke-width="0.11" stroke="rgba(0,0,0,1)" stroke-miterlimit="10"></path></svg>`,
  },
  {
    id: 'bottle',
    label: 'Bottle',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="none"><path d="M 29.817 8.315 C 30.339 8.814 30.561 9.312 30.708 10.317 C 30.83 11.147 30.856 11.206 31.132 11.266 C 31.951 11.445 34.169 13.001 34.964 13.953 C 39.262 19.101 36.362 27.114 29.947 27.814 L 29.351 27.879 L 28.724 29.144 C 27.012 32.593 23.276 34.207 17.531 33.979 C 11.628 33.744 8.602 31.514 7.303 26.439 C 6.113 21.791 5.566 11.66 6.403 9.773 C 7.246 7.872 11.226 6.467 16.878 6.074 C 22.174 5.706 28.176 6.746 29.817 8.315 Z M 16.824 7.044 C 11.562 7.559 7.937 8.767 7.334 10.207 C 6.763 11.569 7.103 20.151 7.902 24.568 C 9.013 30.704 11.828 32.968 18.348 32.969 C 23.334 32.969 26.451 31.629 27.788 28.911 C 29.089 26.267 29.746 21.308 29.769 13.982 C 29.78 10.303 29.773 10.166 29.545 9.674 C 29.024 8.551 27.308 7.875 23.497 7.292 C 22.112 7.081 18.01 6.928 16.824 7.044 Z M 27.295 10.795 C 28.243 11.58 25.583 12.713 21.669 13.191 C 16.363 13.839 8.305 12.58 9.037 11.217 C 9.453 10.442 13.784 9.503 17.749 9.328 C 21.08 9.18 26.316 9.985 27.295 10.795 Z M 30.815 13.731 L 30.815 15.177 L 31.387 15.617 C 33.958 17.599 33.967 22.165 31.402 23.925 C 31.144 24.101 30.783 24.276 30.6 24.312 C 30.174 24.397 30.167 24.41 29.833 25.735 L 29.553 26.848 L 29.83 26.847 C 30.98 26.841 32.805 25.936 33.901 24.827 C 36.734 21.962 36.746 17.11 33.927 14.329 C 33.19 13.602 31.621 12.523 31.059 12.357 L 30.814 12.285 Z M 30.719 17.809 C 30.699 19.084 30.441 22.442 30.308 23.152 L 30.237 23.527 L 30.771 23.138 C 32.541 21.846 32.836 18.721 31.346 17.033 C 31.103 16.758 30.867 16.534 30.821 16.534 C 30.775 16.534 30.729 17.108 30.719 17.809 Z" fill="rgb(0,0,0)" stroke-width="0.11" stroke="rgba(0,0,0,1)" stroke-miterlimit="10"></path></svg>`,
  },
  {
    id: 'bag',
    label: 'Bag',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="none"><path d="M 6.262 8.763 C 7.159 6.879 10.592 5.499 15.331 5.117 C 21.892 4.588 28.082 5.891 30.222 8.251 C 30.837 8.929 31.347 10.382 31.229 11.12 C 31.16 11.549 31.169 11.56 31.499 11.466 C 35.431 10.347 38 13.363 38 17.175 C 38 22.444 34.946 26.395 30.364 27.056 C 29.808 27.136 29.568 27.148 29.421 27.273 C 29.28 27.394 29.224 27.619 29.055 28.112 C 26.662 35.054 14.291 35.65 9.606 30.991 C 8.293 29.685 7.642 28.154 7.077 25.044 C 6.161 20.004 5.661 10.024 6.262 8.763 Z M 7.779 22.65 C 8.657 29.343 9.84 31.125 14.188 32.307 C 18.354 33.439 25.459 33.082 27.749 28.635 C 28.696 26.797 28.753 26.419 29.814 14.79 C 30.21 10.441 30.209 10.243 29.774 9.432 C 28.532 7.116 21.642 5.562 15.204 6.144 C 10.659 6.556 7.328 8.069 7.066 9.841 C 6.858 11.251 7.282 18.86 7.779 22.65 Z M 9.355 11.504 C 8.786 10.622 10.435 9.76 13.934 9.113 C 16.908 8.562 23.716 8.991 26.433 9.899 C 28.036 10.435 28.996 11.05 28.777 11.403 C 27.68 13.171 20.199 14.252 14.68 13.44 C 12.1 13.061 9.825 12.234 9.355 11.504 Z M 30.731 15.186 C 31.281 14.856 31.794 14.62 32.448 14.571 C 35.602 14.337 36.133 18.617 33.34 21.754 C 32.58 22.608 31.153 23.439 30.446 23.439 L 30.038 23.439 C 29.982 23.91 29.494 25.808 29.795 26.115 C 29.917 26.239 31.555 25.756 32.469 25.325 C 34.395 24.419 35.731 22.806 36.519 20.436 C 37.055 18.824 37.109 15.729 36.621 14.531 C 35.949 12.881 31.288 10.662 30.956 13.408 C 30.884 14.001 30.808 14.594 30.731 15.186 Z M 24.013 14.169 C 26.193 13.796 27.542 13.346 28.475 12.681 C 29.01 12.3 29.051 12.376 28.868 13.409 C 28.031 18.14 28.59 23.422 26.64 27.887 C 24.669 32.401 13.533 32.865 10.85 28.545 C 8.371 24.553 8.563 18.674 8.562 14.144 C 8.562 13.538 8.725 12.639 8.794 12.616 C 9.147 12.51 9.329 12.981 9.619 13.197 C 10.599 13.497 11.588 13.843 12.537 14.037 C 13.003 14.132 13.61 14.098 14.315 14.231 C 16.192 14.585 21.795 14.549 24.013 14.169 Z M 30.181 22.617 C 30.377 22.703 31.11 22.183 31.295 22.091 C 33.754 20.882 35.114 16.756 33.404 15.697 C 31.565 14.557 30.618 17.064 30.501 18.44 C 30.463 18.883 29.876 22.481 30.181 22.617 Z" fill="rgb(0,0,0)" stroke-width="0.11" stroke="rgba(0,0,0,1)" stroke-miterlimit="10"></path></svg>`,
  },
  {
    id: 'plant',
    label: 'Plant',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="none"><path d="M 19.088 4.614 C 19.128 4.68 19.056 4.733 18.929 4.733 C 18.802 4.733 18.556 4.905 18.382 5.114 C 17.839 5.769 17.979 6.642 18.914 8.453 C 19.806 10.179 19.928 11.046 19.401 11.906 C 18.92 12.692 18.274 12.492 18.689 11.686 C 19.03 11.023 18.945 10.183 18.442 9.228 C 17.346 7.15 17.328 7.103 17.328 6.269 C 17.328 5.403 17.464 5.146 18.149 4.717 C 18.535 4.475 18.974 4.427 19.088 4.614 Z M 23.185 5.753 C 22.88 6.493 23.008 7.35 23.612 8.597 C 24.415 10.257 24.343 11.592 23.395 12.62 C 23.229 12.8 23.142 12.948 23.203 12.948 C 23.617 12.95 25.61 13.35 26.48 13.606 C 28.619 14.235 30.123 15.34 30.605 16.638 L 30.848 17.293 L 31.833 17.374 C 33.681 17.524 35.421 18.301 36.181 19.315 C 37.583 21.185 37.153 24.259 35.138 26.783 C 34.456 27.637 34.438 27.759 34.976 27.868 C 35.877 28.051 36.358 29.767 35.837 30.938 C 33.966 35.14 23.669 37.553 14.021 36.052 C 4.843 34.623 0.758 31.155 4.226 27.735 C 5.212 26.763 6.789 25.783 7.999 25.39 C 8.897 25.098 8.886 25.142 8.429 23.705 C 7.27 20.067 7.299 16.98 8.503 15.766 C 10.145 14.111 14.055 13.094 19.205 12.981 C 22.402 12.911 22.467 12.895 22.927 12.035 C 23.512 10.939 23.476 10.388 22.703 8.602 C 21.988 6.951 22.097 5.832 23.019 5.366 C 23.395 5.176 23.409 5.208 23.185 5.753 Z M 14.402 7.225 C 14.041 7.629 14.243 8.367 15.039 9.555 C 15.798 10.689 15.796 12.35 15.035 12.148 C 14.843 12.097 14.805 11.983 14.805 11.466 C 14.805 10.816 14.621 10.363 13.875 9.174 C 13.186 8.077 13.246 7.228 14.028 7.012 C 14.495 6.883 14.635 6.963 14.402 7.225 Z M 18.56 13.629 C 13.448 13.839 9.093 15.404 8.651 17.188 C 8.477 17.891 8.85 17.963 10.161 17.48 C 15.98 15.336 22.083 15.282 28.221 17.319 C 30.045 17.925 30.153 17.909 29.874 17.079 C 29.494 15.948 28.201 14.895 26.657 14.459 C 24.731 13.914 21.492 13.492 19.851 13.571 C 19.496 13.588 18.915 13.614 18.56 13.629 Z M 16.154 17.058 C 14.977 17.252 13.16 17.695 12.927 17.846 C 12.789 17.935 12.802 17.946 12.986 17.899 C 16.387 17.034 19.331 16.776 21.904 17.115 C 23.03 17.263 24.316 17.341 23.841 17.232 C 22.253 16.867 17.909 16.769 16.154 17.058 Z M 25.425 17.719 C 25.812 17.843 26.294 17.945 26.495 17.946 C 26.697 17.947 27.08 18.026 27.346 18.121 C 27.612 18.216 27.83 18.247 27.83 18.189 C 27.83 18.131 27.527 18.023 27.156 17.948 C 26.676 17.85 26.196 17.748 25.718 17.641 C 24.691 17.412 24.568 17.444 25.425 17.719 Z M 31.03 18.217 C 31.066 18.31 31.131 18.683 31.176 19.046 L 31.257 19.705 L 31.784 19.765 C 35.141 20.149 35.468 24.923 32.221 26.156 C 31.874 26.288 31.123 26.458 30.553 26.535 C 29.527 26.674 29.513 26.68 29.259 27.128 L 29.002 27.581 L 31.193 27.507 L 33.384 27.433 L 34.123 26.649 C 36.088 24.566 36.74 21.409 35.535 19.807 C 34.974 19.061 33.364 18.384 31.54 18.128 C 31.07 18.062 30.978 18.078 31.03 18.217 Z M 11.636 18.424 C 11.531 18.493 11.516 18.54 11.6 18.541 C 11.677 18.542 11.773 18.49 11.813 18.424 C 11.903 18.276 11.862 18.276 11.636 18.424 Z M 29.524 18.668 C 27.795 20.063 24.444 20.903 20.19 21.01 C 14.65 21.149 11.083 20.4 8.746 18.607 C 8.157 18.154 8.289 20.843 8.959 22.948 C 9.509 24.675 11.312 27.857 12.24 28.739 C 15.213 31.565 21.452 31.982 25.377 29.616 C 28.535 27.713 30.452 24.081 30.398 20.105 C 30.373 18.278 30.253 18.081 29.524 18.668 Z M 27.53 18.599 C 27.405 18.695 27.362 18.775 27.435 18.777 C 27.507 18.78 27.633 18.701 27.713 18.603 C 27.899 18.376 27.823 18.374 27.53 18.599 Z M 10.815 18.764 C 10.815 18.814 11.066 18.943 11.372 19.05 C 11.781 19.194 12.189 19.34 12.595 19.488 C 14.845 20.307 21.263 20.538 24.075 19.9 C 24.925 19.708 26.619 19.173 26.892 19.012 C 27.235 18.809 26.811 18.905 25.821 19.255 C 24.037 19.886 23.403 19.978 20.313 20.053 C 16.51 20.145 13.645 19.844 12.153 19.196 C 11.324 18.835 10.815 18.671 10.815 18.764 Z M 31.187 21.428 C 31.093 22.573 30.752 24.011 30.338 25.009 C 30.177 25.396 30.073 25.739 30.105 25.772 C 30.234 25.903 31.914 25.423 32.482 25.094 C 34.158 24.121 34.016 21.401 32.255 20.76 C 31.198 20.375 31.277 20.325 31.187 21.428 Z M 7.757 26.351 C 5.897 27.269 4.347 28.573 3.94 29.562 C 3.538 30.537 4.275 31.664 6.021 32.745 C 8.391 34.213 13.639 35.397 18.795 35.627 C 27.008 35.993 35.223 33.057 35.223 29.754 C 35.223 28.659 34.299 28.248 31.879 28.266 C 29.011 28.287 28.171 28.447 27.512 29.099 C 25.463 31.127 22.554 32.087 18.853 31.957 C 16.087 31.859 14.509 31.412 12.56 30.176 C 11.514 29.512 11.585 29.598 10.052 27.132 C 9.58 26.372 9.152 25.809 9.046 25.808 C 8.945 25.806 8.365 26.051 7.757 26.351 Z" fill="rgb(0,0,0)" stroke-width="0.11" stroke="rgba(0,0,0,1)" stroke-miterlimit="10"></path></svg>`,
  },
  {
    id: 'cloud',
    label: 'Cloud',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="none"><path d="M 19.197 5.942 C 19.554 6.42 20.145 7.954 20.145 8.4 C 20.145 8.698 20.158 8.702 20.621 8.533 C 22.763 7.751 24.522 9.25 24.281 11.652 L 24.201 12.448 L 24.967 12.392 C 26.904 12.248 28.769 13.887 28.769 15.733 C 28.769 15.932 28.803 16.271 28.846 16.487 L 28.923 16.88 L 29.385 16.672 C 30.139 16.332 31.979 16.377 32.729 16.753 C 35.01 17.899 35.704 21.625 34.207 24.684 C 33.064 27.019 30.163 28.849 27.274 29.059 L 26.35 29.126 L 25.904 29.814 C 23.825 33.016 19.692 34.543 15.04 33.826 C 8.291 32.786 5.045 27.545 5.001 17.618 C 4.989 14.801 5.053 14.564 6.1 13.578 C 6.621 13.086 7.827 12.499 8.324 12.495 C 8.651 12.492 8.802 12.345 8.958 11.879 C 9.185 11.202 9.438 10.92 10.201 10.496 C 10.882 10.117 10.934 10.051 11.277 9.138 C 11.864 7.573 13.138 6.659 14.204 7.039 C 14.752 7.234 14.78 7.226 14.873 6.849 C 14.98 6.414 15.921 5.374 16.404 5.158 C 17.28 4.765 18.595 5.135 19.197 5.942 Z M 16.66 6.569 C 16.415 6.82 16.214 7.133 16.214 7.265 C 16.213 7.932 15.456 9.455 15.061 9.583 C 14.564 9.744 14.35 9.545 14.269 8.846 C 14.172 8.008 14.173 8.008 13.509 8.268 C 12.681 8.591 12.367 8.996 12.368 9.74 C 12.369 10.174 12.276 10.509 12.055 10.868 L 11.742 11.379 L 12.099 11.692 C 12.587 12.122 13.286 12.031 14.287 11.41 C 15.179 10.855 17.154 10.078 17.982 9.956 C 19.005 9.805 19.294 9.115 18.702 8.24 C 18.494 7.934 18.37 7.576 18.37 7.286 C 18.37 6.229 17.394 5.819 16.66 6.569 Z M 21.053 9.468 C 20.933 9.522 20.968 9.587 21.177 9.693 C 21.338 9.776 21.581 10.116 21.717 10.452 C 21.96 11.053 21.96 11.068 21.72 11.612 C 21.257 12.663 20.408 13.348 19.257 13.599 C 19.013 13.652 18.557 13.826 18.243 13.985 C 17.535 14.345 16.108 14.82 14.121 15.355 C 11.725 16.002 11.648 16.081 12.364 17.161 C 12.528 17.41 12.663 17.714 12.663 17.838 C 12.663 18.567 16.991 18.816 19.92 18.255 C 23.585 17.554 25.553 16.178 25.793 14.15 L 25.881 13.404 L 25.201 13.405 C 24.442 13.405 23.772 13.732 23.637 14.169 C 23.567 14.392 21.612 15.738 21.357 15.738 C 21.074 15.738 20.053 16.347 19.508 16.842 C 18.883 17.41 18.492 17.54 18.124 17.301 C 17.894 17.152 18.288 16.512 19.295 15.399 C 19.968 14.657 20.268 14.482 21.365 14.19 C 22.09 13.998 22.512 13.513 22.809 12.53 C 23.368 10.68 23.005 9.58 21.794 9.452 C 21.48 9.419 21.147 9.426 21.053 9.468 Z M 19.295 10.761 C 18.978 10.956 18.34 11.165 17.717 11.276 C 17.142 11.378 16.542 11.549 16.384 11.655 C 16.226 11.761 16.014 11.848 15.913 11.848 C 15.812 11.848 15.303 12.144 14.78 12.505 C 13.056 13.695 10.959 13.413 10.673 11.952 C 10.634 11.752 10.549 11.589 10.485 11.589 C 10.24 11.589 9.746 12.288 9.746 12.636 C 9.746 12.999 9.464 13.404 9.211 13.404 C 9.136 13.404 8.745 13.527 8.341 13.677 L 7.608 13.951 L 7.665 14.662 C 7.757 15.805 8.217 16.435 9.411 17.058 C 9.912 17.319 11.521 17.844 11.521 17.746 C 11.521 17.399 10.937 16.775 10.613 16.775 C 9.815 16.775 9.3 16.172 9.704 15.71 C 10.283 15.048 11.71 14.443 13.297 14.187 C 14.491 13.994 16.603 13.344 17.515 12.889 C 17.948 12.673 18.41 12.497 18.541 12.497 C 19.047 12.497 20.621 11.348 20.68 10.935 C 20.711 10.724 20.707 10.521 20.673 10.486 C 20.509 10.319 19.774 10.465 19.295 10.761 Z M 26.517 14.542 C 26.617 16.838 23.339 18.586 18.153 19.002 C 14.594 19.287 9.933 18.456 8.062 17.202 C 7.765 17.003 7.414 16.778 7.281 16.702 C 7.148 16.627 7.023 16.452 7.003 16.313 C 6.983 16.175 6.909 15.748 6.839 15.363 C 6.75 14.873 6.754 14.583 6.851 14.391 C 6.975 14.147 6.952 14.152 6.64 14.441 C 5.861 15.162 5.771 16.165 6.135 20.114 C 6.801 27.36 8.776 30.765 13.22 32.328 C 15.951 33.289 19.878 33.115 22.037 31.939 C 25.163 30.235 26.733 26.972 27.584 20.405 C 28.068 16.677 27.861 14.623 26.942 14.007 C 26.488 13.703 26.481 13.712 26.517 14.542 Z M 6.501 15.828 C 6.67 16.028 6.784 16.215 6.756 16.245 C 6.665 16.338 6.195 15.835 6.195 15.646 C 6.195 15.54 6.324 15.616 6.501 15.828 Z M 30.013 17.518 C 28.923 17.803 28.815 17.923 28.735 18.937 C 28.652 19.983 28.616 19.913 29.157 19.754 C 31.044 19.201 32.314 20.219 32.161 22.163 C 32.011 24.07 30.058 26.038 28.043 26.311 C 27.416 26.397 27.41 26.402 27.194 27.064 C 27.074 27.43 26.944 27.812 26.904 27.912 C 26.676 28.49 29.926 27.501 31.282 26.579 C 33.863 24.825 34.835 21.48 33.529 18.849 C 32.915 17.613 31.581 17.107 30.013 17.518 Z M 29.052 20.787 C 28.6 21.122 28.519 21.262 28.395 21.922 C 28.318 22.335 28.122 23.307 27.961 24.081 L 27.668 25.488 L 28.095 25.418 C 29.327 25.213 30.739 24.025 31.112 22.879 C 31.739 20.947 30.514 19.704 29.052 20.787 Z" fill="rgb(0,0,0)" stroke-width="0.11" stroke="rgba(0,0,0,1)" stroke-miterlimit="10"></path></svg>`,
  },
  {
    id: 'mushroom',
    label: 'Mushroom',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="none"><path d="M 20.681 3 L 21.147 3.439 C 22.294 4.519 22.377 6.544 21.364 8.715 C 20.853 9.811 20.798 10.095 20.883 11.228 C 20.977 12.494 20.975 12.499 20.696 11.834 C 20.292 10.875 20.471 9.109 21.098 7.867 C 21.763 6.552 21.778 5.171 21.141 3.91 Z M 19.353 7.444 C 19.865 8.374 19.71 9.43 18.86 10.81 C 18.308 11.708 18.166 12.132 18.164 12.89 C 18.162 13.576 18.109 13.763 17.976 13.556 C 17.55 12.896 17.767 11.626 18.548 10.208 C 19.417 8.63 19.453 8.368 18.945 7.368 C 18.489 6.472 18.856 6.54 19.353 7.444 Z M 28.981 16.542 C 29.898 17.07 30.043 17.393 29.971 18.758 L 29.918 19.745 L 31.196 19.698 C 33.128 19.628 34.192 20.572 34.192 22.355 C 34.192 24.311 32.192 26.078 29.183 26.78 C 27.827 27.096 27.87 27.303 29.38 27.73 C 34.392 29.147 36.048 31.828 33.222 33.95 C 26.425 39.054 5.399 37.363 6.013 31.762 C 6.16 30.42 7.837 29.005 10.234 28.202 C 10.75 28.029 11.231 27.851 11.303 27.806 C 11.375 27.761 11.273 27.248 11.077 26.664 C 10.327 24.435 9.615 19.331 9.879 18.069 C 10.212 16.477 12.509 15.404 16.248 15.093 C 21.246 14.678 26.85 15.315 28.981 16.542 Z M 14.776 15.677 C 13.123 15.931 11.504 16.572 10.843 17.236 L 10.287 17.793 L 10.411 20.123 C 10.861 28.634 13.665 32.409 19.502 32.365 C 24.699 32.325 27.07 30.046 28.672 23.548 C 29.939 18.411 29.857 17.345 28.14 16.601 C 26.03 15.688 18.221 15.147 14.776 15.677 Z M 28.223 18.79 C 27.493 20.986 11.68 20.871 11.68 18.669 C 11.68 18.207 13.006 17.62 14.794 17.292 C 19.67 16.398 28.685 17.403 28.223 18.79 Z M 30.242 20.195 C 29.924 20.256 29.782 20.471 29.66 21.077 C 29.468 22.025 29.61 22.138 30.338 21.619 C 31.835 20.55 33.047 21.049 33.047 22.733 C 33.047 23.786 31.136 25.293 29.293 25.693 C 28.705 25.821 28.126 26.286 28.317 26.477 C 28.511 26.672 30.897 25.784 31.936 25.13 C 35.205 23.074 33.968 19.47 30.242 20.195 Z M 30.653 21.958 C 30.124 22.262 29.595 22.627 29.479 22.769 C 29.265 23.028 28.625 25.256 28.733 25.363 C 29.016 25.647 31.985 24.065 32.309 23.459 C 32.628 22.861 32.554 21.931 32.164 21.645 C 31.727 21.325 31.768 21.316 30.653 21.958 Z M 27.393 28.347 C 27.223 28.682 26.784 29.37 26.418 29.874 C 26.052 30.379 25.784 30.819 25.823 30.853 C 25.862 30.886 26.345 31.062 26.897 31.243 C 32.352 33.03 19.87 34.947 13.61 33.283 C 11.249 32.656 11.052 31.877 13.072 31.158 L 13.605 30.968 L 13.192 30.536 C 12.965 30.299 12.521 29.689 12.205 29.181 C 11.541 28.115 11.463 28.112 9.396 29.073 C 6.309 30.506 5.605 31.998 7.296 33.529 C 12.747 38.467 34.183 36.92 34.191 31.588 C 34.193 30.454 31.867 28.871 29.088 28.114 L 27.703 27.737 Z" fill="rgb(0,0,0)" stroke-width="0.11" stroke="rgba(0,0,0,1)" stroke-miterlimit="10"></path></svg>`,
  },
  {
    id: 'brush-strokes',
    label: 'Brush Strokes',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="201" height="205" fill="none"><path d="M 2.682 47.102 C 6.188 55.533 13.384 74.817 14.123 84.51 M 93.775 2.678 C 85.775 26.263 68.253 76.519 62.171 88.862 M 112.568 111.508 C 127.119 95.424 159.092 61.82 170.565 56.074 M 137.669 150.355 C 149.514 147.171 178.122 140.202 197.788 137.796 M 135.299 189.381 C 141.147 190.144 155.439 193.681 165.824 201.728" fill="transparent" stroke-width="5" stroke="#999999" stroke-linecap="round" stroke-miterlimit="10"></path></svg>`,
  },
  {
    id: 'flower',
    label: 'Flower',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" fill="none"><g transform="translate(20 20)"><path d="M 117.021 83.026 C 144.15 86.853 150.451 117.729 137.583 136.058 C 124.714 154.388 92.734 153.477 80.92 134.447 C 69.106 115.415 80.92 77.934 117.021 83.026 Z" fill="rgba(0, 0, 0, 0)" stroke-width="10" stroke="rgb(84, 84, 84)" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray=""></path><path d="M 93.869 56.987 C 84.15 38.566 92.479 12.941 111.193 3.691 C 129.905 -5.563 155.439 3.318 164.301 22.159 C 173.16 41.003 163.659 66.221 144.54 74.61 C 152.65 56.597 176.625 47.679 194.607 55.984 C 212.59 64.292 221.238 88.282 212.667 106.081 C 204.096 123.881 179.899 132.184 162.135 123.422 C 183.248 120.057 205.512 136.264 208.7 157.319 C 211.887 178.374 195.408 200.397 174.236 203.378 C 153.065 206.359 131.102 189.747 128.304 168.637 C 134.274 194.833 105.546 222.054 79.569 214.815 C 53.593 207.575 43.228 169.458 61.985 150.154 C 49.959 164.612 25.587 166.529 11.431 154.132 C -2.726 141.734 -3.933 117.418 8.928 103.691 C 21.788 89.964 46.231 89.481 59.632 102.688 C 33.363 100.873 17.236 64.67 33.509 44.058 C 49.787 23.445 88.917 30.516 96.883 55.509" fill="transparent" stroke-width="10" stroke="rgb(84, 84, 84)" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray=""></path></g></svg>`,
  },
  {
    id: 'leaf',
    label: 'Leaf',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" fill="none"><g transform="translate(32 20)"><path d="M 0 216 C 44.082 153.317 96.097 96.625 154.742 47.341" fill="transparent" stroke-width="10" stroke="rgb(84, 84, 84)" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray=""></path><path d="M 60.462 140.656 C 44.344 133.305 32.225 107.847 37.393 91.272 C 42.56 74.697 55.952 61.988 69.9 51.431 C 105.268 24.656 147.617 6.802 191.888 0 C 192.203 25.811 192.293 51.956 185.823 76.9 C 179.352 101.845 165.51 125.852 143.354 139.489 C 121.197 153.128 80.882 157.11 60.462 140.656 Z" fill="transparent" stroke-width="10" stroke="rgb(84, 84, 84)" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray=""></path></g></svg>`,
  },
  {
    id: 'infinity',
    label: 'Infinity',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" fill="none"><g transform="translate(46 20)"><path d="M 84.473 82.968 C 87.652 71.783 90.86 60.354 90.283 48.741 C 89.705 37.13 84.663 25.095 74.687 19.066 C 63.301 12.184 47.951 14.81 37.152 22.574 C 26.353 30.338 19.393 42.316 14.154 54.513 C 0.397 86.552 -3.481 122.723 3.175 156.934 C 5.967 171.279 12.869 187.499 27.205 190.585 C 37.466 192.794 48.114 186.957 54.595 178.731 C 61.077 170.505 64.234 160.234 67.263 150.221 C 66.262 162.577 65.281 175.208 68.391 187.211 C 71.5 199.215 79.51 210.69 91.324 214.58 C 102.759 218.345 115.711 214.26 124.99 206.612 C 134.268 198.964 140.42 188.221 145.404 177.298 C 159.696 145.983 165.966 111.075 163.462 76.766 C 162.48 63.325 159.26 48.466 148.089 40.864 C 135.976 32.621 118.661 36.563 107.476 46.021 C 96.292 55.479 89.813 69.187 83.661 82.454" fill="rgba(0, 0, 0, 0)" stroke-width="10" stroke="rgb(84, 84, 84)" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray=""></path><path d="M 129.23 0 C 113.261 16.679 100.491 38.153 92.368 61.991 L 93.844 57.941" fill="transparent" stroke-width="10" stroke="rgb(84, 84, 84)" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray=""></path></g></svg>`,
  },
  {
    id: 'moon',
    label: 'Moon',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" fill="none"><path d="M 224 201.047 C 197.447 231.038 161.336 241.381 122.298 233.414 C 83.261 225.445 49.611 195.398 37.228 157.458 C 25.056 120.153 34.371 75.744 62.749 48.441 C 91.129 21.139 155.969 9.469 195.992 31.632 C 103.643 36.776 91.835 81.028 85.928 108.315 C 80.021 135.603 99.157 180.3 129.657 201.09 C 160.157 221.881 193.788 222.605 223.999 201.047 Z" fill="rgba(0, 0, 0, 0)" stroke-width="10" stroke="rgb(84, 84, 84)" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray=""></path></svg>`,
  },
  {
    id: 'smiley',
    label: 'Smiley',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" fill="none"><g transform="translate(20 20)"><path d="M 139.099 29.656 C 17.319 7.239 -22.246 103.215 11.595 171.52 C 38.146 225.112 117.685 221.157 150.67 206.483 C 248.972 162.751 229.101 35.889 139.229 0" fill="transparent" stroke-width="10" stroke="rgb(84, 84, 84)" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray=""></path><path d="M 73.557 158.539 C 76.417 171.088 87.793 180.646 99.602 180.42 C 111.409 180.193 122.473 170.204 124.93 157.553 M 57.322 101.658 C 57.322 101.646 56.977 101.63 56.412 101.697 C 56.184 101.723 56.113 101.921 56.071 102.17 C 56.029 102.418 56.029 102.76 56.11 103.026 C 56.65 103.737 57.287 104.037 57.898 104.187 C 58.144 104.201 58.256 104.09 58.378 103.647 M 149.045 100.376 C 148.783 100.754 148.252 102.582 148.282 104.48 C 148.289 104.87 148.639 105.09 148.923 105.234 C 149.491 105.526 150.261 105.47 151.013 105.412 C 151.666 105.363 152.164 104.842 152.561 104.221 C 152.734 103.878 152.85 103.477 152.913 103.052 C 152.996 102.578 152.948 102.087 152.775 101.642" fill="transparent" stroke-width="10" stroke="rgb(84, 84, 84)" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray=""></path></g></svg>`,
  },
  {
    id: 'splash',
    label: 'Splash',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" fill="none"><g transform="translate(54 20)"><path d="M 36.748 145.944 C 44.726 172.906 48.367 180.237 48.367 180.237 C 51.447 178.659 60.46 171.043 65.268 167.697 C 70.078 164.35 74.571 160.296 88.23 151.237 C 101.891 142.179 124.045 128.53 135.566 121.343 C 147.087 114.157 148 112.911 148 112.911 C 148 112.911 143.989 110.222 132.841 102.923 L 132.661 102.804 C 125.205 97.923 112.014 89.287 89.017 70.785 C 65.834 52.132 43.61 36.739 27.095 22.618 C 10.58 8.497 0 0 0 0 C 0 0 1.383 13.149 8.843 42.613 C 16.304 72.077 29.312 120.818 36.748 145.944 Z" fill="rgba(0, 0, 0, 0)" stroke-width="10" stroke="rgb(84, 84, 84)" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray=""></path><path d="M 97.384 148.168 L 98.375 150.253 C 99.189 151.966 100.727 155.199 108.104 166.13 C 115.481 177.06 128.652 195.591 143.684 216" fill="transparent" stroke-width="10" stroke="rgb(84, 84, 84)" stroke-linecap="round" stroke-miterlimit="10" stroke-dasharray=""></path></g></svg>`,
  },
  {
    id: 'arrow-swoosh',
    label: 'Swoosh',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" fill="none"><g transform="translate(20 50)"><path d="M 0 117.878 C 41.518 151.642 135.658 193.798 180.074 92.309" fill="transparent" stroke-width="10" stroke="rgb(84, 84, 84)" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray=""></path><path d="M 216 106.466 L 156.063 74.665 C 190.6 48.703 216 0 216 0 C 216 0 210.948 92.178 216 106.466 Z" fill="transparent" stroke-width="10" stroke="rgb(84, 84, 84)" stroke-linejoin="round" stroke-dasharray=""></path></g></svg>`,
  },
  {
    id: 'scribble-arrow',
    label: 'Scribble Arrow',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" fill="none"><g transform="translate(20 34)"><path d="M 0 188 C 54.437 141.472 149.434 48.469 93.919 48.684 C 24.524 48.952 26.628 175.324 97.605 132.126 C 154.384 97.568 170.424 65.407 171.346 53.646" fill="transparent" stroke-width="10" stroke="rgb(84, 84, 84)" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray=""></path><path d="M 162.094 48.615 C 177.17 56.112 182.563 58.283 195.475 69.093 C 198.332 45.087 205.305 21.616 216 0 C 193.37 12.387 171.523 26.138 150.58 41.178" fill="transparent" stroke-width="10" stroke="rgb(84, 84, 84)" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray=""></path></g></svg>`,
  },
  {
    id: 'cross-marks',
    label: 'Marks',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" fill="none"><path d="M 81.995 20 L 81.995 51.081 M 85.862 85.35 L 85.862 89.927 C 85.862 94.23 85.862 102.697 85.728 111.557 M 107.507 65.549 C 107.507 65.501 107.507 65.453 111.598 65.41 C 115.692 65.362 123.872 65.315 132.304 65.267 M 48 65.576 L 71.049 65.576 M 140.752 117.994 L 140.752 149.372 M 140.489 201.076 L 140.489 236 M 160.076 174.516 L 191.352 174.516 M 124.293 174.516 L 117.216 174.516 C 110.258 174.516 96.4 174.516 81.818 174.342 M 192.57 43.692 L 192.57 65.338 M 181.183 54.262 L 204.071 54.262 M 140.968 25.259 L 140.509 23.561 M 207.658 122.662 L 208 120.084 M 82.805 220.077 L 82.585 220.077" fill="transparent" stroke-width="10" stroke="rgb(84, 84, 84)" stroke-linecap="round" stroke-miterlimit="10" stroke-dasharray=""></path></svg>`,
  },
  {
    id: 'four-arcs',
    label: 'Arcs',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" fill="none"><path d="M 84.565 35.534 C 94.662 63.657 121.86 84.859 151.645 87.838 C 181.429 90.817 212.301 75.408 227.783 49.839 M 236 97.568 C 197.53 127.691 186.771 187.23 212.315 228.659 M 35.261 225.514 C 51.9 204.121 79.629 191.364 107.165 192.438 C 134.703 193.512 161.299 208.381 176.13 231 M 22.277 25 C 53.322 39.099 74.47 72.183 73.992 105.908 C 73.514 139.632 51.433 172.119 20 185.352" fill="transparent" stroke-width="10" stroke="rgb(84, 84, 84)" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray=""></path></svg>`,
  },
  {
    id: 'plant-stem',
    label: 'Plant',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" fill="none"><path d="M 98.322 119.313 C 146.979 126.179 136.42 20 136.42 20 C 136.42 20 133.869 116.466 175.38 125.379 C 140.615 137.437 130.652 191.399 127.478 227.612 C 129.786 189.39 132.759 144.669 98.322 119.313 Z M 169.132 70.33 L 191 33.631 M 80.62 31.534 L 104.57 68.233 M 100.405 169.942 L 65 225.515 M 161.843 184.621 L 188.917 236" fill="transparent" stroke-width="10" stroke="rgb(84, 84, 84)" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray=""></path></svg>`,
  },
  {
    id: 'strikethrough',
    label: 'Strike',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" fill="none"><g transform="translate(20 118)"><path d="M 0 0 L 37.778 0 C 75.042 0 149.307 0 186.626 0.624 C 223.946 1.247 222.747 5.946 199.569 9.714 C 176.39 13.483 160.287 13.73 135.887 17" fill="transparent" stroke-width="10" stroke="rgb(84, 84, 84)" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray=""></path><path d="M 121.563 20 C 118.951 19 122.725 20.877 120.558 19" fill="transparent" stroke-width="10" stroke="rgb(84, 84, 84)" stroke-linecap="round" stroke-miterlimit="10" stroke-dasharray=""></path></g></svg>`,
  },
  {
    id: 'squiggle',
    label: 'Squiggle',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" fill="none"><path d="M 20 124.822 C 86.971 143.258 175.135 83.568 147.997 67.428 C 114.074 47.253 96.7 129.173 128 141 C 159.3 152.827 245.54 116.556 225.11 96.125 C 204.679 75.695 169.219 127.694 193 163 C 212.025 191.245 226.8 192.42 237 193" fill="transparent" stroke-width="10" stroke="rgb(84, 84, 84)" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray=""></path></svg>`,
  },
  {
    id: 'spiral',
    label: 'Spiral',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" fill="none"><path d="M 46.534 169.374 C 34.063 146.686 24.672 121.553 25.009 95.68 C 25.346 69.804 36.731 43.127 58.503 29.069 C 80.275 15.01 112.632 17.042 129.196 36.949 C 140.822 50.922 143.157 70.414 142.145 88.544 C 141.216 105.183 137.673 122.171 128.235 135.92 C 118.797 149.668 101.406 157.635 91.859 152.439 C 62.817 136.633 95.313 92.593 120.418 72.87 C 145.519 53.146 184.692 50.966 208.805 71.881 C 229.615 89.928 235.603 121.328 227.562 147.645 C 219.521 173.96 199.421 195.336 176.113 210.035 C 144.865 229.741 106.982 238.761 70.182 235.261" fill="transparent" stroke-width="10" stroke="rgb(84, 84, 84)" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray=""></path></svg>`,
  },
  {
    id: 'bookmark',
    label: 'Bookmark',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" fill="none"><path d="M 113.907 97.607 C 122.147 143.298 126.574 189.586 127.142 236 L 163.092 235.625 L 138.03 96.409 L 186 92.84 C 161.699 73.606 142.191 48.363 129.706 20 C 113.35 46.919 70 101.757 70 101.757 C 70 101.757 102.831 99.009 113.907 97.607 Z" fill="rgba(0, 0, 0, 0)" stroke-width="10" stroke="rgb(84, 84, 84)" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray=""></path></svg>`,
  },
  {
    id: 'oval-highlight',
    label: 'Highlight',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" fill="none"><path d="M 143.096 151.982 C 113.292 161.95 81.81 162.044 52.585 150.398 C 43.727 146.869 35.052 142.248 28.671 135.15 C 22.291 128.05 18.494 118.114 20.57 108.802 C 24.127 92.857 42.065 85.189 57.933 81.419 C 105.223 70.186 155.494 71.74 202.042 85.872 C 217.983 90.713 236.291 100.894 235.996 117.572 C 235.788 129.487 225.739 138.724 215.763 145.199 C 185.596 164.775 119.456 185.367 83.777 180.745" fill="transparent" stroke-width="10" stroke="rgb(84, 84, 84)" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray=""></path></svg>`,
  },
  {
    id: 'underline-curve',
    label: 'Underline',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" fill="none"><path d="M 129.395 107.84 C 100.244 98.203 69.352 98.699 42.015 109.244 C 31.923 113.136 21.135 120.161 20.085 132.527 C 18.664 149.227 35.31 161.721 49.607 167.654 C 105.227 190.729 166.876 187.649 216.569 159.31 C 225.216 154.378 234.262 147.509 235.775 136.337 C 238.12 119.056 221.663 104.647 207.087 97.054 C 175.888 80.802 142.069 72.516 109.013 73.022" fill="transparent" stroke-width="10" stroke="rgb(84, 84, 84)" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray=""></path></svg>`,
  },
  {
    id: 'grid-cross',
    label: 'Grid',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" fill="none"><g transform="translate(22 20)"><path d="M 103.525 0 C 82.588 68.304 69.415 138.762 64.257 210.033 M 155.883 11.934 L 134.464 216 M 28.559 52.508 L 207.05 72.796" fill="transparent" stroke-width="10" stroke="rgb(84, 84, 84)" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray=""></path><path d="M 0 134.851 L 213 155.138 C 209.672 154.229 206.345 153.318 203.016 152.412" fill="transparent" stroke-width="10" stroke="rgb(84, 84, 84)" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray=""></path></g></svg>`,
  },
  {
    id: 'star',
    label: 'Star',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" fill="none"><path d="M 145.91 34.217 L 111.927 94.752 L 76.567 20 L 76.567 126.854 L 21 145.197 L 90.343 160.79 L 76.567 230.038 L 126.622 165.834 L 204.691 236 L 162.442 145.197 L 235 82.369 L 145.91 105.299 Z" fill="rgba(0, 0, 0, 0)" stroke-width="10" stroke="rgb(84, 84, 84)" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray=""></path></svg>`,
  },
  {
    id: 'swirl-path',
    label: 'Swirl',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" fill="none"><path d="M 29 93.622 C 37.348 110.028 46.293 126.44 59.084 139.682 C 71.875 152.922 89.114 162.818 107.522 163.117 C 125.931 163.416 145.015 152.405 150.652 134.882 C 156.29 117.359 144.583 95.297 126.299 93.143 C 116.972 92.045 106.214 97.356 104.597 106.605 C 103.194 114.642 108.887 122.195 115.14 127.435 C 132.648 142.102 157.603 147.362 179.543 141.012 C 201.482 134.661 219.765 116.884 226.726 95.134" fill="transparent" stroke-width="10" stroke="rgb(84, 84, 84)" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray=""></path></svg>`,
  },
  {
    id: 'infinity-loops',
    label: 'Clover',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="216" height="216" fill="none" overflow="visible"><path d="M 62.232 127.779 C 47.707 120.732 32.577 112.666 21.115 102.152 C 12.982 94.692 7.805 84.792 3.657 75.144 C 0.818 68.541 -0.151 61.403 0.019 54.35 C 0.354 40.413 5.475 26.091 16.838 16.314 C 28.2 6.539 46.435 2.359 60.789 8.423 C 70.092 12.352 76.72 19.839 82.345 27.42 C 95.241 44.805 104.733 64.117 110.285 84.263 C 109.793 70.196 111.339 56.131 114.875 42.506 C 117.457 32.53 121.219 22.554 128.291 14.405 C 135.363 6.257 146.214 0.123 157.91 0.002 C 172.319 -0.146 185.338 8.938 191.763 20.218 C 198.189 31.497 199.048 44.585 198.147 57.161 C 197.228 69.999 194.436 83.124 186.443 93.921 C 178.45 104.717 164.374 112.766 149.711 111.779 C 163.971 113.627 178.798 115.664 190.642 122.852 C 210.18 134.708 216.636 157.632 215.951 178.421 C 215.635 188.039 213.855 198.18 206.879 205.622 C 197.147 216.007 179.146 218.324 164.692 213.796 C 150.237 209.267 138.933 199.147 130.169 188.121 C 121.931 177.757 115.345 165.951 114.411 153.355 C 107.861 174.245 89.617 193.149 65.509 198.116 C 41.399 203.082 12.88 190.819 6.781 169.825 C 3.017 156.863 8.29 142.22 19.87 133.483 C 31.447 124.746 48.783 122.331 62.233 127.781 Z" fill="rgba(0, 0, 0, 0)" stroke-width="10" stroke="rgb(84, 84, 84)" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray=""></path></svg>`,
  },
  {
    id: 'loop',
    label: 'Loop',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="68" height="53" fill="none"><path d="M 5.113 35.27 C -0.717 35.998 7.086 43.577 9.717 44.078 C 16.287 45.33 25.488 44.942 32.14 43.878 C 46.781 41.535 53.247 19.828 47.956 6.84 C 41.507 -8.989 14.211 28.296 23.932 42.877 C 30.822 53.212 56.696 52.155 64.573 44.278" fill="transparent" stroke-width="5" stroke="rgb(153, 153, 153)" stroke-linecap="round" stroke-miterlimit="10" stroke-dasharray=""></path></svg>`,
  },
  {
    id: 'flame',
    label: 'Flame',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="41" height="71" fill="none"><path d="M 26.415 56.557 C 24.554 56.557 24.231 55.241 22.91 54.127 C 18.848 50.7 15.387 45.961 12.585 41.487 C 8.75 35.365 5.13 28.618 3.503 21.557 C 2.843 18.687 2.862 14.043 3.39 11.16 C 4.162 6.95 6.91 11.579 8.1 12.507 C 12.837 16.2 16.035 24.376 17.635 29.932 C 18.232 32.008 19.632 33.416 19.632 30.157 C 19.632 24.515 20.946 20.476 23.551 15.498 C 24.928 12.866 32.854 -1.991 36.439 4.728 C 38.439 8.479 37.946 12.74 37.946 17.181 C 37.946 26.526 33.937 35.306 31.126 44.142 C 29.376 49.64 27.538 55.384 25.058 60.596 C 24.372 62.037 23.455 67.449 22.345 68" fill="transparent" stroke-width="5" stroke="rgb(153, 153, 153)" stroke-linecap="round" stroke-miterlimit="10" stroke-dasharray=""></path></svg>`,
  },
  {
    id: 'lightning',
    label: 'Lightning',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="43" height="76" fill="none"><path d="M 23.998 4.627 C 23.847 5.383 23.125 5.841 22.688 6.435 C 21.525 8.013 20.539 9.831 19.546 11.521 C 16.6 16.527 13.384 21.361 10.392 26.347 C 7.56 31.067 5.884 35.941 3.567 40.834 C 3.367 41.254 2.467 42.806 3.454 42.258 C 5.204 41.285 9.013 42.054 10.957 42.054 C 11.624 42.054 19.877 41.554 19.93 42.461 C 20.196 46.993 18.4 52.161 17.896 56.7 C 17.529 60 16.816 63.296 16.178 66.553 C 15.793 68.523 15.923 70.703 15.138 72.565 C 14.64 73.75 15.371 72.435 15.478 71.955 C 15.96 69.785 17.076 67.476 17.918 65.423 C 21.141 57.568 26.116 50.725 30.078 43.297 C 33.086 37.657 36.678 32.167 39.66 26.799 C 39.904 26.359 40.936 25.086 40.18 25.691 C 39.42 26.299 37.307 26.542 36.383 26.595 C 31.504 26.874 26.513 29.178 21.76 30.234 C 20.942 30.416 17.464 32.464 18.393 30.256 C 19.756 27.019 19.838 23.254 20.743 19.86 C 21.712 16.229 21.955 12.328 23.093 8.786 C 23.41 7.805 24.212 3.3 24.813 3" fill="transparent" stroke-width="5" stroke="rgb(153, 153, 153)" stroke-linecap="round" stroke-miterlimit="10" stroke-dasharray=""></path></svg>`,
  },
  {
    id: 'plus-cross',
    label: 'Plus',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="61" height="63" fill="none"><path d="M 24.87 2.812 C 23.965 3.038 24.524 7.678 24.524 8.23 L 24.524 60.22" fill="transparent" stroke-width="5" stroke="rgb(153, 153, 153)" stroke-linecap="round" stroke-miterlimit="10" stroke-dasharray=""></path><path d="M 3.428 25.291 C 9.658 25.291 15.938 25.003 22.122 25.887 C 30.642 27.104 38.73 29.6 47.119 31.324 C 50.952 32.112 54.505 32.9 58.416 32.9" fill="transparent" stroke-width="5" stroke="rgb(153, 153, 153)" stroke-linecap="round" stroke-miterlimit="10" stroke-dasharray=""></path><path d="M 10.345 5.233 C 10.519 6.798 12.203 8.506 12.996 9.767 C 16.633 15.551 20.409 21.245 24.178 26.943 C 28.798 33.927 32.312 41.291 36.475 48.501 C 38.008 51.157 39.123 54.279 40.778 56.762" fill="transparent" stroke-width="5" stroke="rgb(153, 153, 153)" stroke-linecap="round" stroke-miterlimit="10" stroke-dasharray=""></path><path d="M 7.232 46.733 C 7.619 44.153 10.682 41.339 12.151 39.317 C 17.8 31.543 23.494 23.45 30.21 16.549 C 33.792 12.869 37.459 8.787 41.469 5.579" fill="transparent" stroke-width="5" stroke="rgb(153, 153, 153)" stroke-linecap="round" stroke-miterlimit="10" stroke-dasharray=""></path></svg>`,
  },
  {
    id: 'handwriting-doodle',
    label: 'Handwriting',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="76" height="56" fill="none"><path d="M 3.323 38.541 C 3.323 33.492 6.616 28.078 8.831 23.693 C 10.588 20.215 12.601 16.862 14.525 13.476 C 16.159 10.6 17.349 7.319 19.362 4.678 C 19.772 4.14 20.979 2.326 21.144 3.817 C 21.753 9.327 21.317 15.199 21.214 20.737 C 21.031 30.558 20.038 40.489 19.154 50.271 M 37.901 9.216 C 32.306 10.154 30.471 17.392 29.754 21.924 C 28.973 26.86 28.375 32.571 30.818 37.098 C 31.989 39.266 35.703 41.357 38.109 40.426 C 42.007 38.918 45.91 33.683 47.274 29.72 C 49.407 23.526 50.155 17.812 45.816 12.358 C 43.372 9.286 40.824 10.054 37.484 10.054 M 59.872 9.2 C 57.381 12.479 55.137 16.832 54.337 20.69 C 53.504 24.703 52.394 30.516 54.639 34.382 C 55.4 35.691 56.488 37.998 58.407 38.365 C 60.338 38.734 63.87 36.097 65.5 35.162 C 67.124 34.23 67.876 32.646 69.081 31.379 C 70.102 30.304 70.471 28.372 70.941 27.055 C 71.768 24.742 72.011 22.033 72.011 19.609 C 72.011 17.445 71.742 14.075 70.104 12.263 C 68.106 10.051 61.779 8.706 59.034 10.281 M 38.734 47.758 C 42.621 45.803 46.714 44.734 51.024 44.22 C 58.141 43.371 66.035 42.944 72.896 45.244 M 46.65 52.784 C 49.95 52.416 53.266 50.745 56.648 50.271 C 60.359 49.751 64.15 49.433 67.897 49.433" fill="transparent" stroke-width="5" stroke="rgb(153, 153, 153)" stroke-linecap="round" stroke-miterlimit="10"></path></svg>`,
  },
  {
    id: 'pencil-doodle',
    label: 'Pencil',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="121" height="77" fill="none"><path d="M 116.242 9.284 C 117.456 10.618 117.76 11.814 117.788 13.476 C 117.884 19.126 112.48 23.786 109.19 27.525 C 104.717 32.608 101.723 38.841 97.262 43.911 C 92.22 49.639 87.454 55.621 82.402 61.361 C 80.548 63.468 78.439 65.298 76.59 67.399 C 75.81 68.285 74.397 69.734 73.113 69.902 C 68.86 70.46 65.149 73.042 60.84 73.652 C 59.074 73.902 54.561 75.059 53.92 72.484 C 53.575 71.102 54.074 69.534 53.748 68.148 C 53.6 67.518 53.67 65.46 53.863 64.901 C 54.537 62.957 54.232 60.488 54.731 58.377 C 55.291 56.007 56.682 54.798 57.973 52.837 C 60.073 49.647 62.314 46.505 64.51 43.3 C 66.422 40.51 68.264 37.777 70.504 35.232 C 72.99 32.406 74.901 29.102 77.378 26.288 C 81.508 21.596 85.977 17.415 90.428 13.032 C 92.722 10.775 95.506 9.089 97.61 6.698 C 99.62 4.414 101.568 2.582 105.178 3.511 C 107.305 4.058 109.028 4.778 111.104 5.525 C 112.774 6.126 114.409 8.089 115.769 9.287" fill="transparent" stroke-width="5" stroke="#999999" stroke-linecap="round" stroke-miterlimit="10" stroke-dasharray=""></path><path d="M 110.89 21.9 C 105.358 17.738 97.652 15.982 94.978 9.392 M 77.414 66.463 C 74.884 64.585 71.356 63.535 68.559 62.049 C 66.295 60.845 63.769 58.94 61.846 57.247 C 60.619 56.168 59.066 53.736 58.48 52.292 M 54.319 67.556 C 54.872 67.556 55.269 67.998 55.805 68.165 C 57.156 68.587 58.14 69.125 59.362 69.797 C 59.685 69.975 61.706 71.217 61.092 71.612 C 59.622 72.558 57.394 72.44 55.744 72.806 C 54.028 73.188 55.094 70.831 55.415 70.187" fill="transparent" stroke-width="5" stroke="#999999" stroke-linecap="round" stroke-miterlimit="10" stroke-dasharray=""></path><path d="M 3 69.03 C 5.545 67.421 8.02 65.205 10.866 64.159 C 13.555 63.171 16.709 62.713 19.553 63.189 C 23.013 63.771 25.245 65.881 27.466 68.425 C 28.263 69.338 29.112 70.192 29.969 71.049 C 30.66 71.741 31.405 72.721 32.317 73.142 C 33.08 73.494 33.89 72.606 34.464 72.227 C 36.435 70.921 38.511 69.881 40.829 69.36 C 43.407 68.782 45.921 68.685 48.164 70.296 C 49.499 71.255 50.799 72.332 52.228 73.149 C 53.113 73.655 54.89 72.711 55.686 72.179" fill="transparent" stroke-width="5" stroke="#999999" stroke-linecap="round" stroke-miterlimit="10" stroke-dasharray=""></path></svg>`,
  },
  {
    id: 'sparkle-doodle',
    label: 'Sparkle',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="141" height="149" fill="none"><path d="M 26.981 61.83 L 26.981 74.677 M 44.538 50.696 L 53.103 50.696 M 26.124 33.995 C 27.044 33.88 26.553 28.914 26.553 28 M 3 49.412 L 15.847 49.412 M 18.416 39.562 C 17.65 39.562 15.799 37.754 15.419 36.992 M 39.828 39.562 C 42.301 39.562 42.631 37.946 44.538 36.992 M 39.828 59.69 C 39.954 60.701 43.944 63.889 44.966 64.4 M 15.418 61.402 C 12.318 61.402 11.383 64.062 8.995 65.256" fill="transparent" stroke-width="5" stroke="rgb(153, 153, 153)" stroke-linecap="round" stroke-miterlimit="10" stroke-dasharray=""></path><path d="M 56.298 4.906 C 54.463 4.677 54.879 3.61 53.014 4.853 C 52.862 4.955 53.95 4.924 54.179 4.694 C 55.049 3.826 53.976 3.269 53.439 3" fill="transparent" stroke-width="5" stroke="rgb(153, 153, 153)" stroke-linecap="round" stroke-miterlimit="10" stroke-dasharray=""></path><path d="M 137.883 116.201 C 136.573 114.891 132.496 111.729 130.469 113.553 C 128.841 115.019 131.876 117.73 133.117 115.247" fill="transparent" stroke-width="5" stroke="rgb(153, 153, 153)" stroke-linecap="round" stroke-miterlimit="10" stroke-dasharray=""></path><g transform="translate(62 86)"><path d="M 0.764 29.002 C 1.394 29.002 2.048 29.054 2.674 28.988 C 3.821 28.867 4.544 27.587 5.404 26.965 C 7.914 25.148 9.082 22.544 10.568 19.961 C 12.561 16.5 12.733 12.759 12.733 8.884 L 12.733 4.809 C 12.733 3.699 12.223 2.694 12.223 1.626 C 12.223 0.888 11.969 -1.052 11.969 0.735 L 11.969 11.925 C 11.969 13.81 12.667 15.622 12.733 17.486 C 12.832 20.247 14.349 23.742 16.298 25.691 C 17.118 26.512 17.616 27.518 18.463 28.365 C 19.27 29.172 20.239 29.769 21.25 30.218 C 23.249 31.107 25.843 30.784 28.012 30.784" fill="transparent" stroke-width="5" stroke="rgb(153, 153, 153)" stroke-linecap="round" stroke-miterlimit="10" stroke-dasharray=""></path><path d="M 0 29.766 C 1.07 29.766 1.87 29.702 2.801 30.218 C 3.61 30.668 4.294 31.85 4.838 32.624 C 7.088 35.82 8.835 38.744 9.691 42.598 C 10.598 46.679 10.951 50.832 10.951 55.033 L 10.951 59.815 C 10.951 61.108 11.087 59.616 11.191 59.15 C 11.637 57.141 11.491 55.033 12.111 52.996 C 12.814 50.683 13.211 48.098 14.261 45.922 C 15.775 42.785 16.601 39.458 18.59 36.585 C 19.977 34.581 21.049 33.11 23.556 32.553 C 24.459 32.352 25.405 31.803 26.343 31.803 L 28.267 31.803" fill="transparent" stroke-width="5" stroke="rgb(153, 153, 153)" stroke-linecap="round" stroke-miterlimit="10" stroke-dasharray=""></path></g><g transform="translate(108 27.327)"><path d="M 0 21.025 C 3.968 21.025 6.133 26.782 6.947 30.037 C 7.593 32.621 7.328 35.382 7.784 38.006 C 7.913 38.746 8.023 39.701 8.023 40.441 C 8.023 40.835 8.219 42.131 8.219 41.082 C 8.219 38.345 8.843 35.779 9.871 33.255 C 10.92 30.681 12.557 28.454 14.089 26.156 C 15.899 23.441 18.466 22.982 21.525 22.982" fill="transparent" stroke-width="5" stroke="rgb(153, 153, 153)" stroke-linecap="round" stroke-miterlimit="10" stroke-dasharray=""></path><path d="M 1.565 20.242 C 3.131 20.242 5.004 20.717 6.164 19.557 C 7.001 18.72 7.394 17.444 7.827 16.372 C 8.557 14.566 9.211 12.947 9.686 11.045 C 10.141 9.226 10.204 7.311 10.469 5.457 C 10.689 3.913 10.958 2.385 10.958 0.826 L 10.958 0 C 10.958 1.324 11.355 2.694 11.545 4 C 12.222 8.658 12.735 14.396 15.361 18.48 C 15.945 19.39 20.232 22.531 21.5 22.673" fill="transparent" stroke-width="5" stroke="rgb(153, 153, 153)" stroke-linecap="round" stroke-miterlimit="10" stroke-dasharray=""></path></g></svg>`,
  },
  {
    id: 'zigzag-arrow',
    label: 'Zigzag',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="95" fill="none"><path d="M 3.235 87.929 C 3.736 86.176 5.331 84.534 6.291 83.004 C 8.811 78.989 12.023 75.469 14.932 71.741 C 18.499 67.171 21.776 62.114 26.44 58.534 C 27.438 57.768 28.483 57.254 28.723 58.571 C 28.924 59.682 30.261 60.86 30.968 61.666 C 33.43 64.467 35.583 67.513 38.081 70.288 C 43.2 75.977 48.451 81.573 53.494 87.325 C 54.326 88.274 56.352 91.337 57.739 91.646 C 58.254 91.76 58.418 91.183 58.663 90.835 C 60.538 88.165 62.21 85.456 64.248 82.873 C 76.122 67.816 87.866 52.196 101.452 38.61 C 103.548 36.514 105.758 34.522 107.923 32.497 C 108.25 32.191 109.483 30.912 110.017 30.912 C 110.295 30.912 111.112 31.746 111.3 31.893 C 113.278 33.442 115.225 35.009 116.997 36.799 C 125.15 45.03 132.636 54.037 140.429 62.609 C 146.312 69.082 152.173 75.563 157.559 82.458 C 158.363 83.486 159.588 86.447 160.465 84.193 C 161.808 80.739 164.287 77.549 166.143 74.363 C 170.612 66.694 174.677 58.801 179.086 51.1 C 185.351 40.157 192.161 29.409 200.612 20.007 C 201.932 18.539 204.066 17.023 204.951 15.252" fill="transparent" stroke-width="5" stroke="rgb(153, 153, 153)" stroke-linecap="round" stroke-miterlimit="10"></path><path d="M 186.273 16.611 C 186.272 16.611 188.342 15.375 188.877 15.064 C 194.131 12.009 200.03 10.034 205.611 7.687 C 208.776 6.355 212.065 5.242 215.138 3.705 C 216.115 3.217 217.176 2.198 217.176 3.705 C 217.176 6.332 216.715 8.903 216.497 11.517 C 215.932 18.269 215.528 25.093 214.384 31.78 C 213.628 36.2 213.5 40.884 212.083 45.138" fill="transparent" stroke-width="5" stroke="rgb(153, 153, 153)" stroke-linecap="round" stroke-miterlimit="10"></path></svg>`,
  },
  {
    id: 'wave-line',
    label: 'Wave',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="222" height="113" fill="none"><path d="M 24.28 3.235 C 16.266 3.235 7.828 14.381 5.827 21.69 C 2.547 33.663 3 47.239 3.855 59.546 C 4.732 72.186 9.746 87.764 21.283 94.642 C 30.346 100.045 46.077 101.783 56.377 99.452 C 66.376 97.191 77.185 88.783 80.903 79.263 C 83.464 72.707 83.614 62.757 79.09 57.101 C 75.833 53.031 66.539 52.079 62.765 55.603 C 57.175 60.82 52.409 67.778 51.409 75.556 C 49.837 87.783 52.029 95.602 62.686 102.529 C 76.455 111.479 98.304 111.978 113 105.92 C 129.447 99.14 146.904 85.586 154.955 69.483 C 158.639 62.114 160.47 54.17 161.106 45.981 C 161.471 41.275 162.23 35.165 159.529 30.996 C 155.11 24.177 145.342 22.706 139.261 28.788 C 133.622 34.428 132.841 44.17 135.002 51.58 C 136.719 57.464 143.783 62.118 148.804 64.988 C 155.282 68.69 164.049 69.295 171.358 69.247 C 192.512 69.105 207.567 48 218.754 32.337" fill="transparent" stroke-width="5" stroke="rgb(153, 153, 153)" stroke-linecap="round" stroke-miterlimit="10"></path></svg>`,
  },
  {
    id: 'arrow-curve-2',
    label: 'Arrow 2',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="182" height="51" fill="none"><path d="M 3.28 25.45 C 29.225 13.545 97.142 -1.462 161.257 33.759" fill="transparent" stroke-width="5" stroke="rgb(153, 153, 153)" stroke-linecap="round" stroke-miterlimit="10"></path><path d="M 150.821 48.074 C 155.625 47.696 160.704 47.645 165.522 47.817 C 166.678 47.859 178.861 48.701 178.726 47.922 C 178.075 44.182 175.806 40.453 174.51 36.906 C 171.862 29.653 169.661 22.529 168.904 14.82 C 168.526 10.962 168.554 7.118 168.336 3.29" fill="transparent" stroke-width="5" stroke="rgb(153, 153, 153)" stroke-linecap="round" stroke-miterlimit="10"></path></svg>`,
  },
  {
    id: 'arrow-curve',
    label: 'Arrow',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="184" height="89" fill="none"><path d="M 181.45 83.293 C 158.818 26.585 94.889 -55.994 20.228 67.354" fill="transparent" stroke-width="5" stroke="rgb(153, 153, 153)" stroke-linecap="round" stroke-miterlimit="10"></path><path d="M 42.618 76.592 L 3.403 85.921 L 13.987 42.869" fill="transparent" stroke-width="5" stroke="rgb(153, 153, 153)" stroke-linecap="round" stroke-miterlimit="10"></path></svg>`,
  },
  {
    id: 'oval-stroke',
    label: 'Oval',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="216" height="74" fill="none"><path d="M 50.464 36.283 C 44.762 37.216 35.879 39.347 32.112 44.379 C 31.269 45.505 31.214 46.4 31.535 47.748 C 31.937 49.443 34.258 50.687 35.501 51.545 C 40.321 54.873 45.459 57.066 50.991 58.938 C 70.732 65.62 91.395 69.326 112.224 70.052 C 128.782 70.631 146.077 71.205 162.434 68.192 C 173.696 66.118 184.871 63.432 195.097 58.16 C 200.271 55.491 206.678 52.194 210.06 47.246 C 220.266 32.314 197.46 20.076 186.711 15.185 C 166.322 5.909 144.824 3.486 122.642 2.939 C 110.517 2.64 98.224 2.456 86.139 3.694 C 74.416 4.893 62.836 7.344 51.343 9.878 C 35.344 13.407 19.547 18.671 3.291 20.843" fill="transparent" stroke-width="5" stroke="rgb(153, 153, 153)" stroke-linecap="round" stroke-miterlimit="10"></path></svg>`,
  },
]

function IllustrationsModal({ onClose, onSelect }: { onClose: () => void; onSelect: (svg: string) => void }) {
  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} onClick={onClose} />
      <div style={{
        position: 'relative', background: '#fff', borderRadius: 20, width: 440, maxWidth: '95vw',
        maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: '0 24px 60px rgba(0,0,0,0.25)',
      }}>
        <div style={{ padding: '16px 18px 12px', borderBottom: '1px solid rgba(0,0,0,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 700, fontSize: '1rem', fontFamily: 'var(--font-ui)' }}>Scribbles</span>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', color: '#888' }}>✕</button>
        </div>
        <div style={{ overflowY: 'auto', padding: 16, flex: 1 }}>
          {ILLUSTRATIONS.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#bbb', fontFamily: 'var(--font-ui)', fontSize: '0.85rem', padding: '40px 0' }}>
              No illustrations yet
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {ILLUSTRATIONS.map((ill) => (
                <div
                  key={ill.id}
                  onClick={() => onSelect(ill.svg)}
                  style={{
                    aspectRatio: '1', borderRadius: 12, cursor: 'pointer', border: '1.5px solid rgba(0,0,0,0.07)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    padding: 10, gap: 6, transition: 'background 100ms, transform 100ms',
                  }}
                  onMouseEnter={(e) => { const el = e.currentTarget as HTMLDivElement; el.style.background = 'rgba(0,0,0,0.04)'; el.style.transform = 'scale(1.03)' }}
                  onMouseLeave={(e) => { const el = e.currentTarget as HTMLDivElement; el.style.background = ''; el.style.transform = '' }}
                >
                  <div style={{ width: 56, height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    <div style={{ transform: 'scale(1)', transformOrigin: 'center', lineHeight: 0 }}
                      dangerouslySetInnerHTML={{ __html: (() => {
                        const wMatch = ill.svg.match(/width="(\d+(?:\.\d+)?)"/)
                        const hMatch = ill.svg.match(/height="(\d+(?:\.\d+)?)"/)
                        const w = wMatch ? wMatch[1] : '256'
                        const h = hMatch ? hMatch[1] : '256'
                        let preview = ill.svg
                          .replace(/width="[^"]*"/, 'width="56"')
                          .replace(/height="[^"]*"/, 'height="56"')
                        if (!preview.includes('viewBox')) {
                          preview = preview.replace('<svg ', `<svg viewBox="0 0 ${w} ${h}" `)
                        }
                        return preview
                      })() }}
                    />
                  </div>
                  <span style={{ fontSize: '0.65rem', color: '#888', fontFamily: 'var(--font-ui)' }}>{ill.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

// ── Sticker Modal ──────────────────────────────────────────────────────────

type StickerResult = { id: string; url: string; thumbnailUrl: string }

const STICKER_CATEGORIES: { label: string; icon: string; emojis: string[] }[] = [
  { label: 'Smileys', icon: '😊', emojis: ['😀','😂','🥹','😍','🤩','🥳','😎','🤔','😴','🥺','😅','😇','🤗','😤','🤯','🫠','🥰','😜','🤪','😏'] },
  { label: 'Hearts', icon: '❤️', emojis: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💗','💖','💕','💞','💓','💝','💘','💟','🫀','❣️','💔'] },
  { label: 'Hands', icon: '👋', emojis: ['👋','🤚','✋','🖖','🤙','👍','👎','✊','👏','🙌','🫶','🤲','🙏','✌️','🤞','🤟','🤘','👌','🤌','👈'] },
  { label: 'Party', icon: '🎉', emojis: ['🎉','🎊','🎈','🎁','🎂','🏆','🥇','✨','🌟','⭐','🎗️','🎀','🪅','🎆','🎇','🪄','🎭','🃏','🎯','🎪'] },
  { label: 'Animals', icon: '🐶', emojis: ['🐶','🐱','🐰','🐻','🦊','🐼','🐨','🦁','🐯','🐸','🦆','🐧','🦜','🦋','🐝','🐙','🦄','🐉','🦋','🐬'] },
  { label: 'Nature', icon: '🌸', emojis: ['🌸','🌺','🌻','🌹','🌷','🌿','🍃','🌈','☀️','🌙','⭐','🌊','🔥','🌴','🍀','🌵','🍁','🌾','🌼','🪷'] },
  { label: 'Food', icon: '🍕', emojis: ['🍕','🍔','🌮','🍜','🍣','🍰','🎂','🍩','🍪','🧁','🍫','🍿','🧃','☕','🍵','🥤','🍦','🍡','🫧','🧋'] },
  { label: 'Travel', icon: '✈️', emojis: ['✈️','🚀','🌍','🗼','🏝️','🌊','🏔️','🌃','🎡','🗺️','🧳','⛺','🏕️','🌉','🎢','🏖️','🌋','🗽','🏟️','🛸'] },
  { label: 'Music', icon: '🎵', emojis: ['🎵','🎶','🎸','🎹','🎺','🥁','🎤','🎧','🎼','🎷','🪗','🪘','🎻','📻','🎙️','🔊','🎚️','🎛️','📯','🪈'] },
  { label: 'Sports', icon: '⚽', emojis: ['⚽','🏀','🎾','⚾','🏈','🏐','🎱','🏓','🏸','⛳','🥊','🤸','🏄','🧗','🚴','🏋️','⛷️','🤺','🧘','🤾'] },
]

function emojiToTwemojiUrl(emoji: string): string {
  const codepoints = [...emoji]
    .map(c => c.codePointAt(0)!.toString(16))
    .filter(cp => cp !== 'fe0f')
    .join('-')
  return `https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/${codepoints}.svg`
}

function StickerModal({ onClose, onSelect }: { onClose: () => void; onSelect: (s: StickerResult) => void }) {
  const [activeCategory, setActiveCategory] = useState(0)
  const [search, setSearch] = useState('')

  const _visibleEmojis = search.trim()
    ? STICKER_CATEGORIES.flatMap(c => c.emojis).filter(e =>
        STICKER_CATEGORIES.some(c => c.emojis.includes(e) && c.label.toLowerCase().includes(search.toLowerCase()))
        || e === search
      )
    : STICKER_CATEGORIES[activeCategory].emojis

  // If search doesn't match category names, search across all emojis (show all)
  const emojisToShow = search.trim()
    ? STICKER_CATEGORIES.flatMap(c => c.emojis)
    : STICKER_CATEGORIES[activeCategory].emojis

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} onClick={onClose} />
      <div style={{
        position: 'relative', background: '#fff', borderRadius: 20, width: 420, maxWidth: '95vw',
        maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: '0 24px 60px rgba(0,0,0,0.25)',
      }}>
        {/* Header */}
        <div style={{ padding: '16px 18px 10px', borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontWeight: 700, fontSize: '1rem', fontFamily: 'var(--font-ui)' }}>Emojis</span>
            <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', color: '#888' }}>✕</button>
          </div>
          <input
            autoFocus
            type="text"
            placeholder="Search categories…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%', padding: '8px 12px', borderRadius: 10, border: '1.5px solid rgba(0,0,0,0.14)',
              fontSize: '0.85rem', outline: 'none', fontFamily: 'var(--font-ui)', boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Category tabs */}
        {!search.trim() && (
          <div style={{ display: 'flex', overflowX: 'auto', padding: '8px 12px', gap: 6, borderBottom: '1px solid rgba(0,0,0,0.06)', scrollbarWidth: 'none' }}>
            {STICKER_CATEGORIES.map((cat, i) => (
              <button
                key={cat.label}
                type="button"
                onClick={() => setActiveCategory(i)}
                style={{
                  flexShrink: 0, padding: '5px 12px', borderRadius: 20, border: 'none', cursor: 'pointer',
                  background: activeCategory === i ? '#1a1a1a' : 'rgba(0,0,0,0.05)',
                  color: activeCategory === i ? '#fff' : '#555',
                  fontSize: '0.75rem', fontWeight: 600, fontFamily: 'var(--font-ui)',
                  display: 'flex', alignItems: 'center', gap: 4,
                }}
              >
                <span>{cat.icon}</span> {cat.label}
              </button>
            ))}
          </div>
        )}

        {/* Emoji grid */}
        <div style={{ overflowY: 'auto', padding: 12, flex: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
            {emojisToShow.map((emoji, i) => (
              <div
                key={i}
                onClick={() => onSelect({ id: emoji, url: emojiToTwemojiUrl(emoji), thumbnailUrl: emojiToTwemojiUrl(emoji) })}
                style={{
                  aspectRatio: '1', borderRadius: 10, cursor: 'pointer', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', fontSize: '1.6rem',
                  transition: 'background 100ms, transform 100ms',
                }}
                onMouseEnter={(e) => { const el = e.currentTarget as HTMLDivElement; el.style.background = 'rgba(0,0,0,0.07)'; el.style.transform = 'scale(1.15)' }}
                onMouseLeave={(e) => { const el = e.currentTarget as HTMLDivElement; el.style.background = ''; el.style.transform = '' }}
              >
                {emoji}
              </div>
            ))}
          </div>
        </div>

        <div style={{ padding: '6px 16px', borderTop: '1px solid rgba(0,0,0,0.07)', textAlign: 'right' }}>
          <span style={{ fontSize: '0.7rem', color: '#bbb', fontFamily: 'var(--font-ui)' }}>Powered by Twemoji</span>
        </div>
      </div>
    </div>,
    document.body,
  )
}

const GIPHY_KEY = 'xPbTAzUw25dUOEBXqbiprZfHHw8YU3cb'

type GifItem = { id: string; title: string; previewUrl: string; url: string; width: number; height: number }

function GifModal({ onClose, onSelect }: { onClose: () => void; onSelect: (gif: GifItem) => void }) {
  const [query, setQuery] = useState('')
  const [gifs, setGifs] = useState<GifItem[]>([])
  const [loading, setLoading] = useState(true)

  const fetchGifs = async (q: string) => {
    setLoading(true)
    const endpoint = q.trim()
      ? `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_KEY}&q=${encodeURIComponent(q)}&limit=24&rating=g`
      : `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_KEY}&limit=24&rating=g`
    try {
      const res = await fetch(endpoint)
      const json = await res.json()
      setGifs(json.data.map((g: any) => ({
        id: g.id,
        title: g.title,
        previewUrl: g.images.fixed_height_small.url,
        url: g.images.fixed_height.url,
        width: Number(g.images.fixed_height.width),
        height: Number(g.images.fixed_height.height),
      })))
    } catch { /* ignore */ }
    setLoading(false)
  }

  useEffect(() => { fetchGifs('') }, [])

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} onClick={onClose} />
      <div style={{
        position: 'relative', background: '#fff', borderRadius: 20, width: 480, maxWidth: '95vw',
        maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: '0 24px 60px rgba(0,0,0,0.25)',
      }}>
        {/* Header */}
        <div style={{ padding: '18px 20px 12px', borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontWeight: 700, fontSize: '1rem', fontFamily: 'var(--font-ui)' }}>GIFs</span>
            <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', color: '#888', lineHeight: 1 }}>✕</button>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              autoFocus
              type="text"
              placeholder="Search GIFs…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchGifs(query)}
              style={{
                flex: 1, padding: '9px 14px', borderRadius: 10, border: '1.5px solid rgba(0,0,0,0.14)',
                fontSize: '0.85rem', outline: 'none', fontFamily: 'var(--font-ui)',
              }}
            />
            <button
              type="button"
              onClick={() => fetchGifs(query)}
              style={{
                padding: '9px 18px', borderRadius: 10, border: 'none', background: '#1a1a1a',
                color: '#fff', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
              }}
            >Search</button>
          </div>
        </div>

        {/* Grid */}
        <div style={{ overflowY: 'auto', padding: 12, flex: 1 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#aaa', fontFamily: 'var(--font-ui)', fontSize: '0.9rem' }}>Loading…</div>
          ) : gifs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#aaa', fontFamily: 'var(--font-ui)', fontSize: '0.9rem' }}>No GIFs found</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
              {gifs.map((gif) => (
                <div
                  key={gif.id}
                  onClick={() => onSelect(gif)}
                  style={{
                    borderRadius: 10, overflow: 'hidden', cursor: 'pointer', aspectRatio: '1',
                    background: '#f0f0f0', transition: 'transform 120ms, opacity 120ms',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.transform = 'scale(1.03)' }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.transform = 'scale(1)' }}
                >
                  <img src={gif.previewUrl} alt={gif.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Powered by Giphy */}
        <div style={{ padding: '8px 16px', borderTop: '1px solid rgba(0,0,0,0.07)', textAlign: 'right' }}>
          <span style={{ fontSize: '0.7rem', color: '#bbb', fontFamily: 'var(--font-ui)' }}>Powered by GIPHY</span>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function ToolbarBtn({ onClick, icon, width = 96 }: { onClick: () => void; icon: React.ReactNode; width?: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width, height: 92, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: 14,
        transition: 'background 0.15s',
      }}
    >
      {icon}
    </button>
  )
}

type PhotoModalProps = { onClose: () => void; onAdd: (file: File) => void }

function PhotoModal({ onClose, onAdd }: PhotoModalProps) {
  const [webcamActive, setWebcamActive] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }

  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      streamRef.current = stream
      setWebcamActive(true)
      setTimeout(() => {
        if (videoRef.current) videoRef.current.srcObject = stream
      }, 50)
    } catch {
      alert('Could not access camera. Please allow camera permission.')
    }
  }

  const capture = () => {
    if (!videoRef.current) return
    const canvas = document.createElement('canvas')
    canvas.width = videoRef.current.videoWidth
    canvas.height = videoRef.current.videoHeight
    canvas.getContext('2d')!.drawImage(videoRef.current, 0, 0)
    canvas.toBlob((blob) => {
      if (!blob) return
      const file = new File([blob], 'photo.jpg', { type: 'image/jpeg' })
      stopStream()
      onAdd(file)
      onClose()
    }, 'image/jpeg', 0.9)
  }

  const pickFile = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) { onAdd(file); onClose() }
    }
    input.click()
  }

  const handleClose = () => { stopStream(); onClose() }

  const btnStyle: React.CSSProperties = {
    flex: 1, height: 64, padding: 0, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: 5,
    background: '#f5f5f5', border: '1.5px solid #ebebeb', borderRadius: 14,
    cursor: 'pointer', fontFamily: 'var(--font-note)', fontSize: 9,
    fontWeight: 600, color: '#555',
    transition: 'transform 0.15s, box-shadow 0.15s, border-color 0.15s',
  }
  const onHover = (e: React.MouseEvent<HTMLButtonElement>) => {
    const el = e.currentTarget; el.style.transform = 'scale(1.06)'; el.style.boxShadow = '0 4px 14px rgba(0,0,0,0.10)'; el.style.borderColor = '#d0d0d0'
  }
  const onLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
    const el = e.currentTarget; el.style.transform = 'scale(1)'; el.style.boxShadow = 'none'; el.style.borderColor = '#ebebeb'
  }

  return (
    <div style={{
      background: '#fff', borderRadius: 20, padding: '16px 18px',
      boxShadow: '0 12px 40px rgba(0,0,0,0.16), 0 0 0 1px rgba(0,0,0,0.05)',
      display: 'flex', flexDirection: 'column', gap: 12, width: 240,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: 'var(--font-note)', fontWeight: 700, fontSize: 15 }}>Add a Photo</span>
        <button onClick={handleClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#999', lineHeight: 1, padding: 0 }}>×</button>
      </div>
      <p style={{ fontFamily: 'var(--font-note)', fontSize: 11, color: '#999', margin: 0, fontStyle: 'italic' }}>
        Upload an image or take one with your camera.
      </p>
      {webcamActive ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <video ref={videoRef} autoPlay playsInline style={{ width: '100%', borderRadius: 12, background: '#000' }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={() => { stopStream(); setWebcamActive(false) }}
              style={{ ...btnStyle, flex: 'none', width: 64, fontSize: 18 }}
              onMouseEnter={onHover} onMouseLeave={onLeave}>←</button>
            <button type="button" onClick={capture}
              style={{ ...btnStyle, flex: 1, background: '#222', border: '1.5px solid #222', color: '#fff', fontSize: 9 }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.04)' }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)' }}>
              <span style={{ fontSize: 22 }}>📸</span>Capture
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" onClick={pickFile} style={btnStyle} onMouseEnter={onHover} onMouseLeave={onLeave}>
            <span style={{ fontSize: 22 }}>🖼️</span>Choose photo
          </button>
          <button type="button" onClick={startWebcam} style={btnStyle} onMouseEnter={onHover} onMouseLeave={onLeave}>
            <span style={{ fontSize: 22 }}>📷</span>Take photo
          </button>
        </div>
      )}
    </div>
  )
}

const DOODLE_COLORS = ['#E8635A', '#F5A623', '#1DB954', '#3B82F6', '#A855F7', '#EC4899', '#1A1A1A', '#888']

type DoodleModalProps = { onClose: () => void; onSave: (dataUrl: string) => void }

function DoodleModal({ onClose, onSave }: DoodleModalProps) {
  const cvs = useRef<HTMLCanvasElement | null>(null)
  const drawing = useRef(false)
  const last = useRef<{ x: number; y: number } | null>(null)
  const [color, setColor] = useState('#1A1A1A')
  const [sz, setSz] = useState(4)

  const getXY = (e: React.MouseEvent | React.TouchEvent, el: HTMLCanvasElement) => {
    const r = el.getBoundingClientRect()
    const cx = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX
    const cy = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY
    return { x: cx - r.left, y: cy - r.top }
  }

  const start = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    if (!cvs.current) return
    drawing.current = true
    const p = getXY(e, cvs.current)
    last.current = p
    const ctx = cvs.current.getContext('2d')!
    ctx.beginPath()
    ctx.arc(p.x, p.y, sz / 2, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.fill()
  }

  const move = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    if (!drawing.current || !cvs.current || !last.current) return
    const p = getXY(e, cvs.current)
    const ctx = cvs.current.getContext('2d')!
    ctx.beginPath()
    ctx.moveTo(last.current.x, last.current.y)
    ctx.lineTo(p.x, p.y)
    ctx.strokeStyle = color
    ctx.lineWidth = sz
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke()
    last.current = p
  }

  const stop = () => { drawing.current = false }

  return (
    <div
      style={{
        background: '#fff', borderRadius: 20, padding: '16px 18px',
        boxShadow: '0 12px 40px rgba(0,0,0,0.16), 0 0 0 1px rgba(0,0,0,0.05)',
        display: 'flex', flexDirection: 'column', gap: 12, width: 360,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: 'var(--font-note)', fontWeight: 700, fontSize: 15 }}>Draw a doodle</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#999', lineHeight: 1, padding: 0 }}>×</button>
      </div>
      <p style={{ fontFamily: 'var(--font-note)', fontSize: 11, color: '#999', margin: 0, fontStyle: 'italic' }}>
        Sketch anything and add it to your board.
      </p>

      <canvas
        ref={cvs}
        width={324}
        height={220}
        style={{ border: '1.5px solid #eee', borderRadius: 10, cursor: 'crosshair', display: 'block', background: '#fff', touchAction: 'none', width: '100%' }}
        onMouseDown={start} onMouseMove={move} onMouseUp={stop} onMouseLeave={stop}
        onTouchStart={start} onTouchMove={move} onTouchEnd={stop}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ display: 'flex', gap: 5 }}>
          {DOODLE_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              style={{
                width: 20, height: 20, borderRadius: '50%', background: c, padding: 0,
                border: color === c ? '2.5px solid #1a1a1a' : '2px solid transparent',
                cursor: 'pointer',
              }}
            />
          ))}
        </div>
        <input
          type="range" min={2} max={20} value={sz}
          onChange={(e) => setSz(Number(e.target.value))}
          style={{ flex: 1, accentColor: '#F5A623' }}
        />
        <button
          type="button"
          onClick={() => cvs.current?.getContext('2d')?.clearRect(0, 0, 324, 220)}
          style={{ padding: '5px 12px', borderRadius: 8, border: '1.5px solid #ddd', background: '#fff', fontSize: 11, cursor: 'pointer', color: '#555' }}
        >
          Clear
        </button>
      </div>

      <button
        type="button"
        onClick={() => { if (cvs.current) { onSave(cvs.current.toDataURL('image/png')); onClose() } }}
        style={{ width: '100%', padding: 11, background: '#1A1A1A', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-note)' }}
      >
        Add Doodle
      </button>
    </div>
  )
}


function SpotifyCard({ item, isDragging, isReadonly, isPlaying, onDelete: _onDelete, onStyleChange, onPlay }: {
  item: SpotifyItem
  isDragging: boolean
  isReadonly: boolean
  isPlaying: boolean
  onDelete: () => void
  onStyleChange: (s: SpotifyStyle) => void
  onPlay: () => void
}) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [hovered, setHovered] = useState(false)
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [cardRect, setCardRect] = useState<DOMRect | null>(null)

  const enter = () => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current)
    setHovered(true)
    if (wrapperRef.current) setCardRect(wrapperRef.current.getBoundingClientRect())
  }

  const leave = () => {
    leaveTimer.current = setTimeout(() => {
      setHovered(false)
      setCardRect(null)
    }, 150)
  }

  // Hide switcher while dragging
  const showSwitcher = hovered && !isDragging && !isReadonly && cardRect

  const style = item.style ?? 'disc'
  const dark = item.theme !== 'light'
  const bg = dark ? '#121212' : '#fff'
  const textMain = dark ? '#fff' : '#111'
  const textSub = dark ? 'rgba(255,255,255,0.55)' : '#888'
  const cover = item.albumCover || ''

  const Logo = ({ size = 16 }: { size?: number }) => (
    <svg viewBox="0 0 24 24" width={size} height={size} style={{ flexShrink: 0 }}>
      <circle cx="12" cy="12" r="12" fill="#1DB954"/>
      <path d="M17.9 10.9c-3.2-1.9-8.5-2.1-11.5-1.1-.5.2-1-.1-1.1-.6-.2-.5.1-1 .6-1.1 3.5-1.1 9.3-.9 13 1.3.4.3.6.8.3 1.3-.3.4-.9.5-1.3.2zm-.1 2.8c-.3.4-.8.5-1.2.3-2.7-1.6-6.8-2.1-10-1.1-.4.1-.8-.1-1-.5s.1-.8.5-1c3.7-1.1 8.2-.6 11.3 1.3.4.2.5.7.4 1zm-1.3 2.7c-.2.3-.7.4-1 .2-2.4-1.4-5.3-1.7-8.8-.9-.4.1-.7-.2-.8-.5-.1-.4.2-.7.5-.8 3.8-.9 7.1-.5 9.7 1 .3.2.4.6.4 1z" fill="#fff"/>
    </svg>
  )

  let cardContent: React.ReactNode
  if (style === 'horizontal') {
    cardContent = (
      <div className="sp-h-card" style={{ background: bg, cursor: 'grab', width: '100%', height: '100%' }}>
        {cover ? <img src={cover} alt="" className="sp-h-cover" draggable={false} /> : <div className="sp-h-cover sp-cover-placeholder" />}
        <div className="sp-h-info">
          <div className="sp-h-title" style={{ color: textMain }}>{item.songTitle}</div>
          <div className="sp-h-artist" style={{ color: textSub }}>{item.artist}</div>
        </div>
        <Logo size={16} />
        <div style={{ width: 10 }} />
      </div>
    )
  } else if (style === 'square') {
    cardContent = (
      <div className="sp-sq-card" style={{ background: bg, cursor: 'grab', width: '100%', height: '100%' }}>
        <div className="sp-sq-art">
          {cover ? <img src={cover} alt="" className="sp-sq-img" draggable={false} /> : <div className="sp-sq-img sp-cover-placeholder" />}
        </div>
        <div className="sp-sq-footer">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="sp-sq-title" style={{ color: textMain }}>{item.songTitle}</div>
            <div className="sp-sq-artist" style={{ color: textSub }}>{item.artist}</div>
          </div>
          <Logo size={18} />
        </div>
      </div>
    )
  } else {
    const sz = Math.min(item.width, item.height)
    cardContent = (
      <div className="sp-disc-vinyl" style={{ width: sz, height: sz }}>
        <div className="sp-disc-groove sp-disc-groove-1" />
        <div className="sp-disc-groove sp-disc-groove-2" />
        <div className="sp-disc-groove sp-disc-groove-3" />
        {cover ? <img src={cover} alt="" className="sp-disc-art" draggable={false} /> : <div className="sp-disc-art sp-cover-placeholder" />}
        <div className="sp-disc-hole" />
      </div>
    )
  }

  const styleSwitcher = showSwitcher ? createPortal(
    <div
      style={{ position: 'fixed', left: cardRect!.left + cardRect!.width / 2, top: cardRect!.top - 12, transform: 'translate(-50%, -100%)', zIndex: 9999 }}
      onMouseEnter={enter}
      onMouseLeave={leave}
    >
      <div className="sp-style-switcher">
        <button type="button" className={`sp-thumb sp-thumb-disc${style === 'disc' ? ' active' : ''}`} onMouseDown={(e) => { e.preventDefault(); onStyleChange('disc') }}>
          {cover ? <img src={cover} alt="" draggable={false} /> : <div className="sp-cover-placeholder" style={{ width: '100%', height: '100%' }} />}
        </button>
        <button type="button" className={`sp-thumb sp-thumb-horiz${style === 'horizontal' ? ' active' : ''}`} onMouseDown={(e) => { e.preventDefault(); onStyleChange('horizontal') }}>
          {cover && <img src={cover} alt="" draggable={false} className="sp-thumb-horiz-img" />}
          <div className="sp-thumb-horiz-lines"><div /><div /></div>
        </button>
        <button type="button" className={`sp-thumb sp-thumb-sq${style === 'square' ? ' active' : ''}`} onMouseDown={(e) => { e.preventDefault(); onStyleChange('square') }}>
          {cover ? <img src={cover} alt="" draggable={false} /> : <div className="sp-cover-placeholder" style={{ width: '100%', height: '75%' }} />}
          <div className="sp-thumb-sq-bar" />
        </button>
      </div>
    </div>,
    document.body
  ) : null

  return (
    <>
      <div
        ref={wrapperRef}
        style={{ width: '100%', height: '100%', position: 'relative', overflow: 'visible', cursor: 'grab', display: 'flex', alignItems: 'center', justifyContent: style === 'disc' ? 'center' : 'flex-start' }}
        onMouseEnter={enter}
        onMouseLeave={leave}
      >
        {cardContent}
        {!isDragging && (
          <button
            type="button"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onPlay() }}
            style={{
              position: 'absolute', bottom: 6, right: 6,
              width: 28, height: 28, borderRadius: '50%',
              background: '#1DB954', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
              fontSize: 11, color: '#fff', fontWeight: 700,
              zIndex: 10,
              opacity: hovered || isPlaying ? 1 : 0.55,
              transition: 'opacity 0.15s',
            }}
          >
            {isPlaying ? '■' : '▶'}
          </button>
        )}
      </div>
      {styleSwitcher}
    </>
  )
}

export default App
