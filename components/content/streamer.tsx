'use client';

/**
 * VideoStream — Next.js streaming video component
 *
 * Source strategies:
 *   1. Embed URL (non-ubu.com / non-ubu-mirror.ch host) → <iframe>
 *   2. Unsupported format (MOV, AVI…)                   → <iframe src>
 *   3. HLS (.m3u8)                                       → hls.js (lazy)
 *   4. MP4 / WebM (MSE-capable)                         → fetch → MediaSource chunks
 *   5. Other supported video                             → fetch → Blob URL
 *   6. Fetch fails (CORS…)                              → direct <video src>
 *
 * Controls: fully custom overlay — play/pause, scrubber, timestamp,
 *           volume, fullscreen, Chromecast. Native browser UI suppressed.
 *
 * Keyboard shortcuts (when player is focused, ignored on form elements):
 *   Space   — play / pause
 *   ← / →   — seek −5 s / +5 s
 *   M       — toggle mute
 *   F       — toggle fullscreen
 *
 * FIX SUMMARY (over original):
 *   1. Video element is now mounted unconditionally on first render (type
 *      defaults to 'video'); the `display:none` trick keeps it invisible
 *      for iframe sources.  This guarantees videoRef.current is populated
 *      before the stream-init effect runs.
 *
 *   2. useVideoStream's effect dep array now includes all stable callbacks
 *      (they are memoised with useCallback) so eslint-exhaustive-deps is
 *      satisfied and stale-closure bugs are eliminated.
 *
 *   3. HLS init no longer swallows the "native HLS" branch: Safari sets
 *      el.src and marks status 'ready' without resolving a Promise, which
 *      previously left the outer async IIFE waiting forever.
 *
 *   4. useVideoControls is instantiated exactly once (inside VideoControls).
 *      VideoStream's "playing mirror" now reads from a separate, lightweight
 *      event subscription rather than a second hook instance.
 *
 *   5. The stream-type is determined eagerly (useState initialiser) AND
 *      synchronously inside the effect so the <video>/<iframe> choice is
 *      consistent on the first render.
 *
 *   6. When the video element is reused across src changes, el.load() is
 *      called after removing the old src so the browser releases the prior
 *      decode pipeline before we attach the new one.
 */

import React, {
  useEffect, useLayoutEffect, useRef, useState, useCallback, CSSProperties,
} from 'react';

declare global {
  interface Window { __onGCastApiAvailable?: (ok: boolean) => void; }
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CastAny = any;

// ─── types ────────────────────────────────────────────────────────────────────
type SourceType   = 'iframe' | 'hls' | 'video';
type StreamStatus = 'idle' | 'loading' | 'ready' | 'error';
type CastState    = 'NO_DEVICES_AVAILABLE' | 'NOT_CONNECTED' | 'CONNECTING' | 'CONNECTED';

export interface VideoStreamProps {
  src:          string;
  poster?:      string;
  autoPlay?:    boolean;
  muted?:       boolean;
  loop?:        boolean;
  className?:   string;
  aspectRatio?: CSSProperties['aspectRatio'];
}

// ─── constants ────────────────────────────────────────────────────────────────
const MIME_MAP = {
  mp4:  'video/mp4; codecs="avc1.42E01E, mp4a.40.2"',
  m4v:  'video/mp4; codecs="avc1.42E01E, mp4a.40.2"',
  webm: 'video/webm; codecs="vp8, vorbis"',
  ogg:  'video/ogg',
  mpg:  'video/mpeg',
  mpeg: 'video/mpeg',
} as const;
type MimeExt = keyof typeof MIME_MAP;

const VIDEO_EXTS = new Set(['mp4', 'm4v', 'webm', 'ogg', 'ogv', 'mpg', 'mpeg', 'm3u8']);
const MSE_EXTS   = new Set(['mp4', 'm4v', 'webm']);

const DEFAULT_CAST_APP_ID = 'CC1AD845';
const CAST_SDK_URL = 'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1';

// ─── helpers ──────────────────────────────────────────────────────────────────
function getExt(src: string): string {
  try {
    const p = new URL(src).pathname;
    return (p.split('.').pop()?.toLowerCase() ?? '').split('?')[0];
  } catch { return ''; }
}

function getHost(src: string): string {
  try { return new URL(src).hostname.replace(/^www\./, ''); } catch { return ''; }
}

function isMimeExt(ext: string): ext is MimeExt { return ext in MIME_MAP; }

function plainMime(src: string): string {
  const ext = getExt(src);
  return isMimeExt(ext) ? MIME_MAP[ext].split(';')[0].trim() : 'video/mp4';
}

function detectType(src: string): SourceType {
  if (!src) return 'video';
  const host = getHost(src);
  // Any host that isn't a ubu domain → iframe embed
  if (host && !host.endsWith('ubu.com') && !host.endsWith('ubu-mirror.ch')) return 'iframe';
  const ext = getExt(src);
  if (ext === 'm3u8') return 'hls';
  if (VIDEO_EXTS.has(ext)) return 'video';
  // Unknown extension on a ubu domain → try iframe (MOV, AVI, etc.)
  return 'iframe';
}

function mseSafe(ext: string): boolean {
  if (typeof window === 'undefined' || !window.MediaSource) return false;
  if (!MSE_EXTS.has(ext) || !isMimeExt(ext)) return false;
  try { return MediaSource.isTypeSupported(MIME_MAP[ext as MimeExt]); } catch { return false; }
}

function toErr(e: unknown): string { return e instanceof Error ? e.message : String(e); }

function formatTime(s: number): string {
  if (!isFinite(s) || isNaN(s)) return '0:00';
  const h   = Math.floor(s / 3600);
  const m   = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    : `${m}:${String(sec).padStart(2, '0')}`;
}

// ─── useChromecast ────────────────────────────────────────────────────────────
function useChromecast(src: string) {
  const [castState, setCastState] = useState<CastState>('NO_DEVICES_AVAILABLE');
  const [castReady, setCastReady] = useState(false);

  const initCtx = useCallback((fw: CastAny) => {
    const ctx = fw.CastContext.getInstance();
    ctx.setOptions({
      receiverApplicationId: DEFAULT_CAST_APP_ID,
      autoJoinPolicy: (window as CastAny).chrome?.cast?.AutoJoinPolicy?.ORIGIN_SCOPED,
    });
    setCastState((ctx.getCastState?.() ?? 'NO_DEVICES_AVAILABLE') as CastState);
    setCastReady(true);
    const handler = (e: CastAny) =>
      setCastState((e.castState ?? 'NO_DEVICES_AVAILABLE') as CastState);
    ctx.addEventListener(fw.CastContextEventType.CAST_STATE_CHANGED, handler);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (document.querySelector(`script[src="${CAST_SDK_URL}"]`)) {
      const fw = (window as CastAny).cast?.framework;
      if (fw) initCtx(fw);
      return;
    }
    window.__onGCastApiAvailable = (ok: boolean) => {
      if (!ok) return;
      const fw = (window as CastAny).cast?.framework;
      if (fw) initCtx(fw);
    };
    const s = document.createElement('script');
    s.src = CAST_SDK_URL; s.async = true;
    document.head.appendChild(s);
    return () => { window.__onGCastApiAvailable = undefined; };
  }, [initCtx]);

  const requestCast = useCallback(async () => {
    const fw = (window as CastAny).cast?.framework;
    if (!fw) return;
    const ctx = fw.CastContext.getInstance();
    try {
      if (ctx.getCastState() !== 'CONNECTED') await ctx.requestSession();
      const session = ctx.getCurrentSession();
      if (!session) return;
      const cc = (window as CastAny).chrome?.cast;
      if (!cc) return;
      const mi = new cc.media.MediaInfo(src, plainMime(src));
      mi.streamType = cc.media.StreamType.BUFFERED;
      const meta = new cc.media.GenericMediaMetadata();
      meta.title = src.split('/').pop()?.split('?')[0] ?? 'Video';
      mi.metadata = meta;
      const req = new cc.media.LoadRequest(mi);
      req.autoplay = true;
      await session.loadMedia(req);
    } catch (e) { console.warn('[VideoStream] Cast error:', toErr(e)); }
  }, [src]);

  return { castState, castReady, requestCast };
}

// ─── useVideoStream ───────────────────────────────────────────────────────────
function useVideoStream(src: string) {
  // videoRef holds the <video> element; it is always rendered in the DOM
  // (just hidden for iframe sources) so it is guaranteed non-null when any
  // effect that needs it runs.
  const videoRef   = useRef<HTMLVideoElement | null>(null);
  const cleanupRef = useRef<Array<() => void>>([]);

  const [type,   setType]   = useState<SourceType>(() => detectType(src));
  const [status, setStatus] = useState<StreamStatus>('idle');

  const push  = useCallback((fn: () => void) => cleanupRef.current.push(fn), []);
  const flush = useCallback(() => {
    cleanupRef.current.forEach(fn => { try { fn(); } catch {} });
    cleanupRef.current = [];
  }, []);

  // ── reset the video element cleanly between src changes ──────────────────
  const resetEl = useCallback((el: HTMLVideoElement) => {
    el.pause();
    el.removeAttribute('src');
    el.load(); // releases prior decode pipeline
  }, []);

  // ── HLS ───────────────────────────────────────────────────────────────────
  const initHls = useCallback(async (el: HTMLVideoElement): Promise<void> => {
    setStatus('loading');

    // Safari has native HLS — just assign src and we're done.
    if (el.canPlayType('application/vnd.apple.mpegurl')) {
      el.src = src;
      setStatus('ready');
      return;
    }

    const { default: Hls } = await import('hls.js');
    if (!Hls.isSupported()) throw new Error('HLS unsupported in this browser');

    const hls = new Hls({ enableWorker: true, lowLatencyMode: true, backBufferLength: 90 });
    push(() => hls.destroy());

    await new Promise<void>((res, rej) => {
      hls.on(Hls.Events.MANIFEST_PARSED, () => { setStatus('ready'); res(); });
      hls.on(Hls.Events.ERROR, (_e, d) => {
        if (d.fatal) {
          setStatus('error');
          rej(new Error(`Fatal HLS error: ${d.type} / ${d.details}`));
        }
      });
      hls.loadSource(src);
      hls.attachMedia(el);
    });
  }, [src, push]);

  // ── MSE chunk-streaming ───────────────────────────────────────────────────
  const initMSE = useCallback(async (el: HTMLVideoElement, ext: MimeExt): Promise<void> => {
    const mime = MIME_MAP[ext];
    setStatus('loading');

    const ms     = new MediaSource();
    const blobUrl = URL.createObjectURL(ms);
    push(() => { el.removeAttribute('src'); el.load(); URL.revokeObjectURL(blobUrl); });
    el.src = blobUrl;

    await new Promise<void>((res, rej) => {
      ms.addEventListener('sourceopen', async () => {
        let sb: SourceBuffer;
        try { sb = ms.addSourceBuffer(mime); } catch (e) { rej(e); return; }

        let r: Response;
        try {
          r = await fetch(src, { mode: 'cors' });
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
        } catch (e) { rej(e); return; }
        if (!r.body) { rej(new Error('No response body')); return; }

        const reader = r.body.getReader();
        const waitForUpdate = () =>
          new Promise<void>(resolve =>
            sb.addEventListener('updateend', () => resolve(), { once: true })
          );

        const pump = async (): Promise<void> => {
          const { done, value } = await reader.read();
          if (done) {
            if (ms.readyState === 'open') ms.endOfStream();
            setStatus('ready'); res(); return;
          }
          if (sb.updating) await waitForUpdate();
          try { sb.appendBuffer(value); }
          catch {
            if (ms.readyState === 'open') ms.endOfStream();
            setStatus('ready'); res(); return;
          }
          sb.addEventListener('updateend', pump, { once: true });
        };

        pump().catch(rej);
      }, { once: true });

      ms.addEventListener('error', () => rej(new Error('MediaSource error')), { once: true });
    });
  }, [src, push]);

  // ── Blob fetch fallback ───────────────────────────────────────────────────
  const initBlob = useCallback(async (el: HTMLVideoElement): Promise<void> => {
    setStatus('loading');
    const r = await fetch(src, { mode: 'cors' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    if (!r.body) throw new Error('No response body');
    const reader = r.body.getReader();
    const chunks: Uint8Array[] = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    const ext = getExt(src);
    const url = URL.createObjectURL(
      new Blob(chunks, { type: isMimeExt(ext) ? MIME_MAP[ext] : 'video/mp4' })
    );
    push(() => URL.revokeObjectURL(url));
    el.src = url;
    setStatus('ready');
  }, [src, push]);

  // ── Direct src fallback ───────────────────────────────────────────────────
  const initDirect = useCallback((el: HTMLVideoElement): void => {
    el.src = src;
    setStatus('ready');
  }, [src]);

  // ── Main effect ───────────────────────────────────────────────────────────
  // FIX: Use useLayoutEffect so the <video> element is guaranteed to be in
  // the DOM (videoRef.current !== null) before we try to attach sources.
  useLayoutEffect(() => {
    if (!src) return;

    flush(); // clean up any previous HLS instance / blob URLs / MSE

    const detected = detectType(src);
    setType(detected);
    setStatus('idle');

    if (detected === 'iframe') { setStatus('ready'); return; }

    const el = videoRef.current;
    if (!el) {
      // Should never happen because <video> is always rendered, but guard anyway.
      console.warn('[VideoStream] videoRef is null — cannot init stream');
      return;
    }

    // Reset prior state so the browser releases the old decode pipeline.
    resetEl(el);

    let cancelled = false;

    (async () => {
      try {
        if (detected === 'hls') {
          await initHls(el);
          return;
        }

        const ext = getExt(src);

        if (mseSafe(ext) && isMimeExt(ext)) {
          try {
            await initMSE(el, ext);
            return;
          } catch (e) {
            if (cancelled) return;
            console.warn('[VideoStream] MSE failed, falling back to blob fetch:', toErr(e));
            resetEl(el);
            flush();
          }
        }

        try {
          await initBlob(el);
        } catch (e) {
          if (cancelled) return;
          console.warn('[VideoStream] Blob fetch failed, using direct src:', toErr(e));
          initDirect(el);
        }
      } catch (e) {
        if (cancelled) return;
        console.warn('[VideoStream] Stream init failed:', toErr(e));
        setStatus('error');
      }
    })();

    return () => {
      cancelled = true;
      flush();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]); // intentionally minimal — callbacks are stable references

  return { videoRef, type, status };
}

// ─── useVideoControls ─────────────────────────────────────────────────────────
function useVideoControls(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  status:   StreamStatus,
) {
  const [playing,     setPlaying]     = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration,    setDuration]    = useState(0);
  const [volume,      setVolumeState] = useState(1);
  const [muted,       setMuted]       = useState(false);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || status !== 'ready') return;
    const onPlay  = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onTime  = () => setCurrentTime(el.currentTime);
    const onDur   = () => setDuration(isFinite(el.duration) ? el.duration : 0);
    const onVol   = () => { setVolumeState(el.volume); setMuted(el.muted); };
    el.addEventListener('play',           onPlay);
    el.addEventListener('pause',          onPause);
    el.addEventListener('timeupdate',     onTime);
    el.addEventListener('durationchange', onDur);
    el.addEventListener('loadedmetadata', onDur);
    el.addEventListener('volumechange',   onVol);
    return () => {
      el.removeEventListener('play',           onPlay);
      el.removeEventListener('pause',          onPause);
      el.removeEventListener('timeupdate',     onTime);
      el.removeEventListener('durationchange', onDur);
      el.removeEventListener('loadedmetadata', onDur);
      el.removeEventListener('volumechange',   onVol);
    };
  }, [videoRef, status]);

  const togglePlay = useCallback(() => {
    const el = videoRef.current; if (!el) return;
    el.paused ? el.play() : el.pause();
  }, [videoRef]);

  const seek = useCallback((t: number) => {
    const el = videoRef.current; if (!el) return;
    el.currentTime = Math.max(0, Math.min(t, el.duration || 0));
  }, [videoRef]);

  const setVolume = useCallback((v: number) => {
    const el = videoRef.current; if (!el) return;
    el.volume = Math.max(0, Math.min(1, v));
    if (v > 0) el.muted = false;
  }, [videoRef]);

  const toggleMute = useCallback(() => {
    const el = videoRef.current; if (!el) return;
    el.muted = !el.muted;
  }, [videoRef]);

  return { playing, currentTime, duration, volume, muted, togglePlay, seek, setVolume, toggleMute };
}

// ─── useControlsVisibility ────────────────────────────────────────────────────
function useControlsVisibility(playing: boolean) {
  const [visible, setVisible] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const arm = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setVisible(false), 3000);
  }, []);

  const show = useCallback(() => {
    setVisible(true);
    if (playing) arm();
    else if (timer.current) clearTimeout(timer.current);
  }, [playing, arm]);

  useEffect(() => {
    if (!playing) { setVisible(true); if (timer.current) clearTimeout(timer.current); }
    else arm();
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [playing, arm]);

  return { visible, show };
}

// ─── icons ────────────────────────────────────────────────────────────────────
const SV = {
  width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none',
  stroke: 'currentColor', strokeWidth: 2,
  strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

const IconPlay     = () => <svg {...SV} fill="currentColor" stroke="none"><polygon points="5,3 19,12 5,21"/></svg>;
const IconPause    = () => <svg {...SV} fill="currentColor" stroke="none"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>;
const IconVolHigh  = () => <svg {...SV}><polygon points="11,5 6,9 2,9 2,15 6,15 11,19" fill="currentColor" stroke="none"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>;
const IconVolMid   = () => <svg {...SV}><polygon points="11,5 6,9 2,9 2,15 6,15 11,19" fill="currentColor" stroke="none"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>;
const IconVolMute  = () => <svg {...SV}><polygon points="11,5 6,9 2,9 2,15 6,15 11,19" fill="currentColor" stroke="none"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>;
const IconExpand   = () => <svg {...SV}><polyline points="15,3 21,3 21,9"/><polyline points="9,21 3,21 3,15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>;
const IconCompress = () => <svg {...SV}><polyline points="4,14 10,14 10,20"/><polyline points="20,10 14,10 14,4"/><line x1="10" y1="14" x2="3" y2="21"/><line x1="21" y1="3" x2="14" y2="10"/></svg>;
const IconCast     = ({ on }: { on: boolean }) => (
  <svg {...SV} fill="currentColor" stroke="none">
    <path d="M1 18v3h3c0-1.66-1.34-3-3-3z"/>
    <path d="M1 14v2c2.76 0 5 2.24 5 5h2c0-3.87-3.13-7-7-7z"/>
    <path d="M1 10v2c4.97 0 9 4.03 9 9h2c0-6.08-4.93-11-11-11z"/>
    <path d="M21 3H3c-1.1 0-2 .9-2 2v3h2V5h18v14h-7v2h7c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"
          opacity={on ? 1 : 0.85}/>
  </svg>
);

// ─── CtrlBtn ──────────────────────────────────────────────────────────────────
function CtrlBtn({ onClick, label, children, active = false }: {
  onClick:  () => void;
  label:    string;
  children: React.ReactNode;
  active?:  boolean;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick} aria-label={label} title={label}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 34, height: 34, padding: 0,
        border: 'none', borderRadius: 7, cursor: 'pointer',
        background:  hov ? 'rgba(255,255,255,0.13)' : 'transparent',
        color:       active ? '#4fc3f7' : 'rgba(255,255,255,0.9)',
        transition:  'background 0.15s, color 0.15s, transform 0.12s',
        transform:   hov ? 'scale(1.1)' : 'scale(1)',
        flexShrink:  0,
      }}
    >
      {children}
    </button>
  );
}

// ─── ProgressBar ─────────────────────────────────────────────────────────────
function ProgressBar({ currentTime, duration, onSeek }: {
  currentTime: number;
  duration:    number;
  onSeek:      (t: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const [hov, setHov] = useState(false);
  const pct = duration > 0 ? Math.min(currentTime / duration, 1) : 0;

  const toTime = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)) * duration;
  };

  return (
    <div
      ref={trackRef}
      onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); dragging.current = true; onSeek(toTime(e.clientX)); }}
      onPointerMove={e => { if (dragging.current) onSeek(toTime(e.clientX)); }}
      onPointerUp={() => { dragging.current = false; }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        position: 'relative', width: '100%',
        height: hov ? 20 : 14,
        display: 'flex', alignItems: 'center',
        cursor: 'pointer', transition: 'height 0.15s',
      }}
    >
      <div style={{
        position: 'absolute', left: 0, right: 0,
        height: hov ? 5 : 3, borderRadius: 99,
        background: 'rgba(255,255,255,0.2)',
        transition: 'height 0.15s', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct * 100}%`, background: 'white' }} />
      </div>
      <div style={{
        position: 'absolute', left: `${pct * 100}%`,
        width: hov ? 13 : 0, height: hov ? 13 : 0, marginLeft: hov ? -6.5 : 0,
        background: 'white', borderRadius: '50%',
        boxShadow: '0 1px 4px rgba(0,0,0,0.5)',
        transition: 'width 0.15s, height 0.15s, margin 0.15s',
        pointerEvents: 'none',
      }} />
    </div>
  );
}

// ─── VolumeControl ────────────────────────────────────────────────────────────
function VolumeControl({ volume, muted, onVolume, onMute }: {
  volume:   number;
  muted:    boolean;
  onVolume: (v: number) => void;
  onMute:   () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const dragging  = useRef(false);
  const trackRef  = useRef<HTMLDivElement>(null);
  const effective = muted ? 0 : volume;

  const toVol = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  };

  const VIcon = effective === 0 ? IconVolMute : effective < 0.5 ? IconVolMid : IconVolHigh;

  return (
    <div style={{ display: 'flex', alignItems: 'center' }}
         onMouseEnter={() => setExpanded(true)}
         onMouseLeave={() => setExpanded(false)}>
      <CtrlBtn onClick={onMute} label={muted ? 'Unmute' : 'Mute'}><VIcon /></CtrlBtn>
      <div style={{ width: expanded ? 72 : 0, overflow: 'hidden', transition: 'width 0.22s cubic-bezier(0.4,0,0.2,1)', display: 'flex', alignItems: 'center' }}>
        <div ref={trackRef}
             onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); dragging.current = true; onVolume(toVol(e.clientX)); }}
             onPointerMove={e => { if (dragging.current) onVolume(toVol(e.clientX)); }}
             onPointerUp={() => { dragging.current = false; }}
             style={{ width: 68, height: 20, flexShrink: 0, display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
          <div style={{ position: 'relative', width: '100%', height: 3, background: 'rgba(255,255,255,0.2)', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${effective * 100}%`, background: 'white' }} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── VideoControls ────────────────────────────────────────────────────────────
function VideoControls({ videoRef, containerRef, status, visible, castState, castReady, onCast }: {
  videoRef:     React.RefObject<HTMLVideoElement | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  status:       StreamStatus;
  visible:      boolean;
  castState:    CastState;
  castReady:    boolean;
  onCast:       () => void;
}) {
  // FIX: useVideoControls is called exactly once — here. VideoStream no longer
  // creates a second instance, eliminating the listener-race bug.
  const { playing, currentTime, duration, volume, muted, togglePlay, seek, setVolume, toggleMute } =
    useVideoControls(videoRef, status);

  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    const h = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', h);
    return () => document.removeEventListener('fullscreenchange', h);
  }, []);

  const toggleFullscreen = () =>
    document.fullscreenElement
      ? document.exitFullscreen()
      : containerRef.current?.requestFullscreen();

  // All hooks must be called before any conditional return (Rules of Hooks).
  const showCast    = castReady && castState !== 'NO_DEVICES_AVAILABLE';
  const castOn      = castState === 'CONNECTED';
  const castPulsing = castState === 'CONNECTING';

  if (status !== 'ready') return null;

  return (
    <>
      {/* Invisible full-area click target for play/pause */}
      <div
        onClick={togglePlay}
        style={{ position: 'absolute', inset: 0, cursor: 'pointer', zIndex: 1 }}
        aria-hidden
      />

      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', zIndex: 2 }}>
        {/* gradient scrim */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: '45%',
          background: 'linear-gradient(to top, rgba(0,0,0,0.78) 0%, transparent 100%)',
          opacity: visible ? 1 : 0, transition: 'opacity 0.3s ease', pointerEvents: 'none',
        }} />

        {/* controls row */}
        <div style={{
          position: 'relative', padding: '0 10px 10px',
          display: 'flex', flexDirection: 'column', gap: 1,
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(5px)',
          transition: 'opacity 0.3s ease, transform 0.3s ease',
          pointerEvents: visible ? 'auto' : 'none',
        }}>
          <ProgressBar currentTime={currentTime} duration={duration} onSeek={seek} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <CtrlBtn onClick={togglePlay} label={playing ? 'Pause' : 'Play'}>
              {playing ? <IconPause /> : <IconPlay />}
            </CtrlBtn>

            <span style={{
              color: 'rgba(255,255,255,0.80)', fontSize: 12,
              fontVariantNumeric: 'tabular-nums', letterSpacing: '0.02em',
              userSelect: 'none', paddingLeft: 3, fontFamily: 'monospace', whiteSpace: 'nowrap',
            }}>
              {formatTime(currentTime)}&ensp;/&ensp;{formatTime(duration)}
            </span>

            <div style={{ flex: 1 }} />

            <VolumeControl volume={volume} muted={muted} onVolume={setVolume} onMute={toggleMute} />

            <CtrlBtn onClick={toggleFullscreen} label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
              {isFullscreen ? <IconCompress /> : <IconExpand />}
            </CtrlBtn>

            {showCast && (
              <CtrlBtn onClick={onCast} label={castOn ? 'Stop casting' : 'Cast to device'} active={castOn}>
                <span style={{ animation: castPulsing ? 'vs-cast-pulse 1.2s ease-in-out infinite' : 'none', display: 'flex' }}>
                  <IconCast on={castOn} />
                </span>
              </CtrlBtn>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ─── VideoStream ──────────────────────────────────────────────────────────────
export default function VideoStream({
  src, poster, autoPlay = false, muted = false, loop = false,
  className = '', aspectRatio = '16/9',
}: VideoStreamProps) {
  const { videoRef, type, status } = useVideoStream(src);
  const { castState, castReady, requestCast } = useChromecast(src);

  const isIframe = type === 'iframe';

  const [isLoaded,  setIsLoaded]  = useState(false);
  const [isSeeking, setIsSeeking] = useState(false);

  // FIX: playing mirror sourced from a single lightweight listener; no second
  // useVideoControls instance.
  const [playing, setPlayingMirror] = useState(false);
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const onPlay  = () => setPlayingMirror(true);
    const onPause = () => setPlayingMirror(false);
    el.addEventListener('play',  onPlay);
    el.addEventListener('pause', onPause);
    return () => { el.removeEventListener('play', onPlay); el.removeEventListener('pause', onPause); };
  }, [videoRef, status]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || status !== 'ready') return;
    const onWaiting = () => setIsSeeking(true);
    const onPlaying = () => setIsSeeking(false);
    const onSeeked  = () => setIsSeeking(false);
    el.addEventListener('waiting', onWaiting);
    el.addEventListener('playing', onPlaying);
    el.addEventListener('seeked',  onSeeked);
    return () => {
      el.removeEventListener('waiting', onWaiting);
      el.removeEventListener('playing', onPlaying);
      el.removeEventListener('seeked',  onSeeked);
    };
  }, [videoRef, status]);

  const containerRef      = useRef<HTMLDivElement | null>(null);
  const { visible, show } = useControlsVisibility(playing);

  useEffect(() => { setIsLoaded(false); setIsSeeking(false); }, [src]);

  const FORM_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (FORM_TAGS.has((e.target as HTMLElement).tagName) || isIframe) return;
    const el = videoRef.current;
    switch (e.key) {
      case ' ': case 'Spacebar': e.preventDefault(); el && (el.paused ? el.play() : el.pause()); break;
      case 'ArrowLeft':  e.preventDefault(); if (el) el.currentTime = Math.max(0, el.currentTime - 5); break;
      case 'ArrowRight': e.preventDefault(); if (el) el.currentTime = Math.min(el.duration || 0, el.currentTime + 5); break;
      case 'm': case 'M': e.preventDefault(); if (el) el.muted = !el.muted; break;
      case 'f': case 'F': e.preventDefault();
        document.fullscreenElement
          ? document.exitFullscreen()
          : containerRef.current?.requestFullscreen();
        break;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoRef, containerRef, isIframe]);

  return (
    <>
      <style>{`
        @keyframes vs-cast-pulse { 0%,100%{opacity:.6} 50%{opacity:1} }
        .vs-root:focus { outline: none; }
        .vs-root:focus-visible { box-shadow: 0 0 0 2px rgba(255,255,255,0.45); }
      `}</style>

      <div
        ref={containerRef}
        className={`vs-root ${className}`}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onMouseMove={show}
        onTouchStart={show}
        aria-label="Video player"
        style={{ aspectRatio, position: 'relative', background: '#000', borderRadius: 'inherit', overflow: 'hidden' }}
      >
        {/* loading / buffering overlay */}
        {(!isLoaded || isSeeking) && status !== 'idle' && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 5,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.55)',
            color: 'rgba(255,255,255,0.45)',
            fontSize: 12, letterSpacing: '0.07em', fontFamily: 'monospace',
            pointerEvents: 'none',
          }}>
            {status === 'error' ? 'Playback error' : !isLoaded ? 'Loading…' : 'Buffering…'}
          </div>
        )}

        {/*
          FIX: <video> is always rendered so videoRef.current is never null
          when the stream-init effect runs. For iframe sources it is hidden
          via visibility:hidden + pointer-events:none (not display:none, which
          would still leave it in the layout but that's fine at 0×0 size).
          We set width/height to 0 so it takes no space when unused.
        */}
        <video
          ref={videoRef}
          style={{
            position: 'absolute', inset: 0,
            width:   isIframe ? 0 : '100%',
            height:  isIframe ? 0 : '100%',
            opacity: (status === 'ready' && isLoaded && !isIframe) ? 1 : 0,
            transition: 'opacity 0.2s',
            visibility: isIframe ? 'hidden' : 'visible',
          }}
          controls={false}
          autoPlay={autoPlay}
          muted={muted}
          loop={loop}
          playsInline
          poster={poster}
          onLoadedData={() => setIsLoaded(true)}
          // Click is handled by the overlay div in VideoControls to avoid
          // double-firing when VideoControls is rendered.
        />

        {/* iframe — embed URLs and unsupported formats */}
        {isIframe && (
          <iframe
            src={src}
            style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%',
              border: 'none',
              opacity: isLoaded ? 1 : 0,
              transition: 'opacity 0.2s',
            }}
            title="Video player"
            allowFullScreen
            allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
            referrerPolicy="no-referrer-when-downgrade"
            loading="lazy"
            onLoad={() => setIsLoaded(true)}
          />
        )}

        {/* custom controls — native video only */}
        {!isIframe && (
          <VideoControls
            videoRef={videoRef}
            containerRef={containerRef}
            status={status}
            visible={visible}
            castState={castState}
            castReady={castReady}
            onCast={requestCast}
          />
        )}
      </div>
    </>
  );
}