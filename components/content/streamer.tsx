'use client';
import "@/styles/video-player.scss";

/**
 * VideoStream — Next.js client component
 *
 * Source routing:
 *   - Non-ubu host            → <iframe> embed (YouTube, Vimeo, etc.)
 *   - ubu domain + .m3u8      → hls.js (Safari: native HLS)
 *   - ubu domain + video ext  → <video src> directly
 *   - ubu domain + unknown    → <iframe> (MOV, AVI, etc.)
 *
 * Pass a direct stream URL (m3u8 or mp4), NOT a ubu.com page URL.
 * Use resolveUbuSrc.ts server-side to extract the stream URL first.
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
type SourceType = 'iframe' | 'hls' | 'video' | 'unsupported';
type CastState  = 'NO_DEVICES_AVAILABLE' | 'NOT_CONNECTED' | 'CONNECTING' | 'CONNECTED';

export interface VideoStreamProps {
  src:          string;
  ubuLink:      string;
  poster?:      string;
  autoPlay?:    boolean;
  muted?:       boolean;
  loop?:        boolean;
  className?:   string;
  aspectRatio?: CSSProperties['aspectRatio'];
}

// ─── constants ────────────────────────────────────────────────────────────────
const MIME_MAP: Record<string, string> = {
  mp4: 'video/mp4', m4v: 'video/mp4', webm: 'video/webm',
  ogg: 'video/ogg', mpg: 'video/mpeg', mpeg: 'video/mpeg',
};
const VIDEO_EXTS  = new Set(['mp4', 'm4v', 'webm', 'ogg', 'ogv', 'mpg', 'mpeg', 'm3u8']);
const CAST_APP_ID = 'CC1AD845';
const CAST_SDK    = 'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1';

// ─── helpers ──────────────────────────────────────────────────────────────────
function getExt(src: string): string {
  try { return (new URL(src).pathname.split('.').pop()?.toLowerCase() ?? '').split('?')[0]; }
  catch { return ''; }
}
function getHost(src: string): string {
  try { return new URL(src).hostname.replace(/^www\./, ''); } catch { return ''; }
}
function plainMime(src: string): string { return MIME_MAP[getExt(src)] ?? 'video/mp4'; }

const UNSUPPORTED_EXTS = new Set(['avi', 'mkv', 'mov', 'wmv', 'flv']);

function detectType(src: string): SourceType {
  if (!src) return 'video';
  const host = getHost(src);
  if (host && !host.endsWith('ubu.com') && !host.endsWith('ubu-mirror.ch')) return 'iframe';
  const ext = getExt(src);
  if (UNSUPPORTED_EXTS.has(ext)) return 'unsupported';
  if (ext === 'm3u8') return 'hls';
  if (VIDEO_EXTS.has(ext)) return 'video';
  return 'iframe';
}

function formatTime(s: number): string {
  if (!isFinite(s) || isNaN(s)) return '0:00';
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
    : `${m}:${String(sec).padStart(2,'0')}`;
}

function toErr(e: unknown): string { return e instanceof Error ? e.message : String(e); }

// ─── useChromecast ────────────────────────────────────────────────────────────
function useChromecast(src: string) {
  const [castState, setCastState] = useState<CastState>('NO_DEVICES_AVAILABLE');
  const [castReady, setCastReady] = useState(false);

  const initCtx = useCallback((fw: CastAny) => {
    const ctx = fw.CastContext.getInstance();
    ctx.setOptions({ receiverApplicationId: CAST_APP_ID,
      autoJoinPolicy: (window as CastAny).chrome?.cast?.AutoJoinPolicy?.ORIGIN_SCOPED });
    setCastState((ctx.getCastState?.() ?? 'NO_DEVICES_AVAILABLE') as CastState);
    setCastReady(true);
    ctx.addEventListener(fw.CastContextEventType.CAST_STATE_CHANGED,
      (e: CastAny) => setCastState((e.castState ?? 'NO_DEVICES_AVAILABLE') as CastState));
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (document.querySelector(`script[src="${CAST_SDK}"]`)) {
      const fw = (window as CastAny).cast?.framework; if (fw) initCtx(fw); return;
    }
    window.__onGCastApiAvailable = (ok: boolean) => {
      if (!ok) return;
      const fw = (window as CastAny).cast?.framework; if (fw) initCtx(fw);
    };
    const s = document.createElement('script'); s.src = CAST_SDK; s.async = true;
    document.head.appendChild(s);
    return () => { window.__onGCastApiAvailable = undefined; };
  }, [initCtx]);

  const requestCast = useCallback(async () => {
    const fw = (window as CastAny).cast?.framework; if (!fw) return;
    const ctx = fw.CastContext.getInstance();
    try {
      if (ctx.getCastState() !== 'CONNECTED') await ctx.requestSession();
      const session = ctx.getCurrentSession(); if (!session) return;
      const cc = (window as CastAny).chrome?.cast; if (!cc) return;
      const mi = new cc.media.MediaInfo(src, plainMime(src));
      mi.streamType = cc.media.StreamType.BUFFERED;
      const meta = new cc.media.GenericMediaMetadata();
      meta.title = src.split('/').pop()?.split('?')[0] ?? 'Video';
      mi.metadata = meta;
      const req = new cc.media.LoadRequest(mi); req.autoplay = true;
      await session.loadMedia(req);
    } catch (e) { console.warn('[VideoStream] Cast error:', toErr(e)); }
  }, [src]);

  return { castState, castReady, requestCast };
}

// ─── useVideoStream ───────────────────────────────────────────────────────────
function useVideoStream(src: string) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef   = useRef<import('hls.js').default | null>(null);

  const [type,  setType]  = useState<SourceType>(() => detectType(src));
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);

  useLayoutEffect(() => {
    if (!src) return;

    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }

    const detected = detectType(src);
    setType(detected);
    setReady(false);
    setError(false);

    if (detected === 'iframe' || detected === 'unsupported') { setReady(true); return; }

    const el = videoRef.current;
    if (!el) { console.warn('[VideoStream] videoRef.current is null'); return; }

    el.pause();
    el.removeAttribute('src');
    el.load();

    let cancelled = false;

    if (detected === 'hls') {
      import('hls.js').then(({ default: Hls }) => {
        if (cancelled) return;

        if (Hls.isSupported()) {
          const hls = new Hls({ enableWorker: true, lowLatencyMode: false });
          hlsRef.current = hls;
          hls.loadSource(src);
          hls.attachMedia(el);
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            if (!cancelled) setReady(true);
          });
          hls.on(Hls.Events.ERROR, (_evt, data) => {
            if (!cancelled && data.fatal) {
              console.warn('[VideoStream] hls.js fatal error', data);
              setError(true);
            }
          });
        } else if (el.canPlayType('application/vnd.apple.mpegurl')) {
          // Safari native HLS
          el.src = src;
          const onCanPlay = () => { if (!cancelled) setReady(true); };
          const onError   = () => { if (!cancelled) { console.warn('[VideoStream] native HLS error', el.error); setError(true); } };
          el.addEventListener('canplay', onCanPlay, { once: true });
          Promise.resolve().then(() => {
            if (!cancelled) el.addEventListener('error', onError, { once: true });
          });
          if (el.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) setReady(true);
        } else {
          if (!cancelled) setError(true);
        }
      });
    } else {
      // ── Native video (MP4, WebM, etc.) ──────────────────────────────────
      el.src = src;
      const onCanPlay = () => { if (!cancelled) setReady(true); };
      const onError   = () => { if (!cancelled) { console.warn('[VideoStream] video error', el.error); setError(true); } };
      el.addEventListener('canplay', onCanPlay, { once: true });
      Promise.resolve().then(() => {
        if (!cancelled) el.addEventListener('error', onError, { once: true });
      });
      if (el.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) setReady(true);
    }

    return () => {
      cancelled = true;
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    };
  }, [src]);

  return { videoRef, type, ready, error };
}

// ─── useVideoControls ─────────────────────────────────────────────────────────
function useVideoControls(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  ready:    boolean,
) {
  const [playing,     setPlaying]     = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration,    setDuration]    = useState(0);
  const [volume,      setVolumeState] = useState(1);
  const [muted,       setMuted]       = useState(false);
  const [buffering,   setBuffering]   = useState(false);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !ready) return;
    const onPlay     = () => setPlaying(true);
    const onPause    = () => setPlaying(false);
    const onTime     = () => setCurrentTime(el.currentTime);
    const onDur      = () => setDuration(isFinite(el.duration) ? el.duration : 0);
    const onVol      = () => { setVolumeState(el.volume); setMuted(el.muted); };
    const onWait     = () => setBuffering(true);
    const onPlaying  = () => setBuffering(false);
    const onSeeked   = () => setBuffering(false);
    el.addEventListener('play',           onPlay);
    el.addEventListener('pause',          onPause);
    el.addEventListener('timeupdate',     onTime);
    el.addEventListener('durationchange', onDur);
    el.addEventListener('loadedmetadata', onDur);
    el.addEventListener('volumechange',   onVol);
    el.addEventListener('waiting',        onWait);
    el.addEventListener('playing',        onPlaying);
    el.addEventListener('seeked',         onSeeked);
    setPlaying(!el.paused);
    setCurrentTime(el.currentTime);
    setDuration(isFinite(el.duration) ? el.duration : 0);
    setVolumeState(el.volume);
    setMuted(el.muted);
    return () => {
      el.removeEventListener('play',           onPlay);
      el.removeEventListener('pause',          onPause);
      el.removeEventListener('timeupdate',     onTime);
      el.removeEventListener('durationchange', onDur);
      el.removeEventListener('loadedmetadata', onDur);
      el.removeEventListener('volumechange',   onVol);
      el.removeEventListener('waiting',        onWait);
      el.removeEventListener('playing',        onPlaying);
      el.removeEventListener('seeked',         onSeeked);
    };
  }, [videoRef, ready]);

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

  return { playing, currentTime, duration, volume, muted, buffering,
           togglePlay, seek, setVolume, toggleMute };
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
    if (playing) arm(); else if (timer.current) clearTimeout(timer.current);
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
const IconCast = ({ on }: { on: boolean }) => (
  <svg {...SV} fill="currentColor" stroke="none">
    <path d="M1 18v3h3c0-1.66-1.34-3-3-3z"/>
    <path d="M1 14v2c2.76 0 5 2.24 5 5h2c0-3.87-3.13-7-7-7z"/>
    <path d="M1 10v2c4.97 0 9 4.03 9 9h2c0-6.08-4.93-11-11-11z"/>
    <path d="M21 3H3c-1.1 0-2 .9-2 2v3h2V5h18v14h-7v2h7c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z" opacity={on ? 1 : 0.85}/>
  </svg>
);

// ─── CtrlBtn ──────────────────────────────────────────────────────────────────
function CtrlBtn({ onClick, label, children, active = false }: {
  onClick: () => void; label: string; children: React.ReactNode; active?: boolean;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button onClick={onClick} aria-label={label} title={label}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 34, height: 34, padding: 0, border: 'none', borderRadius: 7, cursor: 'pointer',
        background: hov ? 'rgba(255,255,255,0.13)' : 'transparent',
        color: active ? '#4fc3f7' : 'rgba(255,255,255,0.9)',
        transition: 'background 0.15s, color 0.15s, transform 0.12s',
        transform: hov ? 'scale(1.1)' : 'scale(1)', flexShrink: 0,
      }}>
      {children}
    </button>
  );
}

// ─── ProgressBar ─────────────────────────────────────────────────────────────
function ProgressBar({ currentTime, duration, onSeek }: {
  currentTime: number; duration: number; onSeek: (t: number) => void;
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
    <div ref={trackRef}
      onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); dragging.current = true; onSeek(toTime(e.clientX)); }}
      onPointerMove={e => { if (dragging.current) onSeek(toTime(e.clientX)); }}
      onPointerUp={() => { dragging.current = false; }}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ position: 'relative', width: '100%', height: hov ? 20 : 14,
               display: 'flex', alignItems: 'center', cursor: 'pointer', transition: 'height 0.15s' }}>
      <div style={{ position: 'absolute', left: 0, right: 0, height: hov ? 5 : 3,
                    borderRadius: 99, background: 'rgba(255,255,255,0.2)',
                    transition: 'height 0.15s', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0,
                      width: `${pct * 100}%`, background: 'white' }} />
      </div>
      <div style={{ position: 'absolute', left: `${pct * 100}%`,
                    width: hov ? 13 : 0, height: hov ? 13 : 0, marginLeft: hov ? -6.5 : 0,
                    background: 'white', borderRadius: '50%',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.5)',
                    transition: 'width 0.15s, height 0.15s, margin 0.15s',
                    pointerEvents: 'none' }} />
    </div>
  );
}

// ─── VolumeControl ────────────────────────────────────────────────────────────
function VolumeControl({ volume, muted, onVolume, onMute }: {
  volume: number; muted: boolean; onVolume: (v: number) => void; onMute: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const dragging = useRef(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const effective = muted ? 0 : volume;
  const toVol = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  };
  const VIcon = effective === 0 ? IconVolMute : effective < 0.5 ? IconVolMid : IconVolHigh;
  return (
    <div style={{ display: 'flex', alignItems: 'center' }}
         onMouseEnter={() => setExpanded(true)} onMouseLeave={() => setExpanded(false)}>
      <CtrlBtn onClick={onMute} label={muted ? 'Unmute' : 'Mute'}><VIcon /></CtrlBtn>
      <div style={{ width: expanded ? 72 : 0, overflow: 'hidden',
                    transition: 'width 0.22s cubic-bezier(0.4,0,0.2,1)',
                    display: 'flex', alignItems: 'center' }}>
        <div ref={trackRef}
             onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); dragging.current = true; onVolume(toVol(e.clientX)); }}
             onPointerMove={e => { if (dragging.current) onVolume(toVol(e.clientX)); }}
             onPointerUp={() => { dragging.current = false; }}
             style={{ width: 68, height: 20, flexShrink: 0, display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
          <div style={{ position: 'relative', width: '100%', height: 3,
                        background: 'rgba(255,255,255,0.2)', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0,
                          width: `${effective * 100}%`, background: 'white' }} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── VideoControls ────────────────────────────────────────────────────────────
function VideoControls({ videoRef, containerRef, ready, visible, castState, castReady, onCast }: {
  videoRef:     React.RefObject<HTMLVideoElement | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  ready:        boolean;
  visible:      boolean;
  castState:    CastState;
  castReady:    boolean;
  onCast:       () => void;
}) {
  const { playing, currentTime, duration, volume, muted, buffering,
          togglePlay, seek, setVolume, toggleMute } = useVideoControls(videoRef, ready);

  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    const h = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', h);
    return () => document.removeEventListener('fullscreenchange', h);
  }, []);

  const toggleFullscreen = () =>
    document.fullscreenElement ? document.exitFullscreen() : containerRef.current?.requestFullscreen();

  const showCast    = castReady && castState !== 'NO_DEVICES_AVAILABLE';
  const castOn      = castState === 'CONNECTED';
  const castPulsing = castState === 'CONNECTING';

  if (!ready) return null;

  return (
    <>
      {buffering && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 4, display: 'flex',
                      alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12,
                        fontFamily: 'monospace', letterSpacing: '0.07em' }}>Buffering…</div>
        </div>
      )}

      <div onClick={togglePlay}
           style={{ position: 'absolute', inset: 0, cursor: 'pointer', zIndex: 1 }}
           aria-hidden />

      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none',
                    display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', zIndex: 2 }}>
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '45%',
                      background: 'linear-gradient(to top, rgba(0,0,0,0.78) 0%, transparent 100%)',
                      opacity: visible ? 1 : 0, transition: 'opacity 0.3s', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', padding: '0 10px 10px',
                      display: 'flex', flexDirection: 'column', gap: 1,
                      opacity: visible ? 1 : 0,
                      transform: visible ? 'translateY(0)' : 'translateY(5px)',
                      transition: 'opacity 0.3s, transform 0.3s',
                      pointerEvents: visible ? 'auto' : 'none' }}>
          <ProgressBar currentTime={currentTime} duration={duration} onSeek={seek} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <CtrlBtn onClick={togglePlay} label={playing ? 'Pause' : 'Play'}>
              {playing ? <IconPause /> : <IconPlay />}
            </CtrlBtn>
            <span style={{ color: 'rgba(255,255,255,0.80)', fontSize: 12,
                           fontVariantNumeric: 'tabular-nums', letterSpacing: '0.02em',
                           userSelect: 'none', paddingLeft: 3, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
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
  src, ubuLink, poster, autoPlay = false, muted = false, loop = false,
  className = '', aspectRatio = '16/9',
}: VideoStreamProps) {
  const { videoRef, type, ready, error } = useVideoStream(src);
  const { castState, castReady, requestCast } = useChromecast(src);

  const isIframe      = type === 'iframe';
  const isUnsupported = type === 'unsupported';  

  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    const el = videoRef.current; if (!el) return;
    const on  = () => setPlaying(true);
    const off = () => setPlaying(false);
    el.addEventListener('play',  on);
    el.addEventListener('pause', off);
    return () => { el.removeEventListener('play', on); el.removeEventListener('pause', off); };
  }, [videoRef, ready]);

  const containerRef      = useRef<HTMLDivElement | null>(null);
  const { visible, show } = useControlsVisibility(playing);

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
        document.fullscreenElement ? document.exitFullscreen() : containerRef.current?.requestFullscreen(); break;
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
      <div ref={containerRef} className={`vs-root ${className}`} tabIndex={0}
           onKeyDown={handleKeyDown} onMouseMove={show} onTouchStart={show}
           aria-label="Video player"
           style={{ aspectRatio, position: 'relative', background: '#000',
                    borderRadius: 'inherit', overflow: 'hidden' }}>

        {(!ready || error) && !isUnsupported && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 5,
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        background: 'rgba(0,0,0,0.55)', color: 'rgba(255,255,255,0.45)',
                        fontSize: 12, letterSpacing: '0.07em', fontFamily: 'monospace',
                        pointerEvents: 'none' }}>
            {error ?
              <div style={{pointerEvents: 'auto'}}>
                <span>Playback error :/</span>
                <a href={`https://ubu.com/film/${ubuLink}`} className='watch-link' target='_blank'>Watch on ubu.com</a>
              </div> :
              'Loading…'
            }
          </div>
        )}

        {isUnsupported && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 5,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 10, background: 'rgba(0,0,0,0.82)',
            color: 'rgba(255,255,255,0.65)', fontSize: 12,
            fontFamily: 'monospace', letterSpacing: '0.07em', textAlign: 'center', padding: '0 20px',
          }}>lock
            <span>This format can't be played in the browser :/</span>
            <a href={src} download
              style={{ color: 'rgba(255,255,255,0.45)', textDecoration: 'none' }}
              onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
              onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
            >
              Download file
            </a>
          </div>
        )}

        <video ref={videoRef}
          style={{
            position: 'absolute', inset: 0,
            width:   isIframe ? 0 : '100%',
            height:  isIframe ? 0 : '100%',
            opacity: 1,
            transition: 'opacity 0.2s',
            visibility: isIframe ? 'hidden' : 'visible',
          }}
          controls={false} autoPlay={autoPlay} muted={muted} loop={loop}
          playsInline poster={poster}
        />

        {isIframe && (
          <iframe src={src}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%',
                     border: 'none', opacity: ready ? 1 : 0, transition: 'opacity 0.2s' }}
            title="Video player" allowFullScreen
            allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
            referrerPolicy="no-referrer-when-downgrade" loading="lazy"
          />
        )}

        {!isIframe && (
          <VideoControls videoRef={videoRef} containerRef={containerRef}
            ready={ready} visible={visible}
            castState={castState} castReady={castReady} onCast={requestCast} />
        )}
      </div>
    </>
  );
}