'use client';

/**
 * VideoStream — Next.js streaming video component
 *
 * Strategy per source type:
 *   1. Embed URL   (Vimeo player, archive.org/embed, YouTube embed) → <iframe>
 *   2. HLS stream  (.m3u8)                                           → hls.js (lazy)
 *   3. MP4 / WebM  (MSE-capable formats)                            → fetch → MediaSource API chunks
 *   4. Other video (MOV, AVI, MPG, M4V …)                          → fetch → single Blob URL
 *   5. Any of the above fails (CORS / codec / browser)              → direct <video src>
 *   6. Native video element emits error                             → <iframe src>
 */

import { useEffect, useRef, useState, useCallback, CSSProperties } from 'react';

// ─── types ───────────────────────────────────────────────────────────────────

type SourceType  = 'iframe' | 'hls' | 'video' | 'unknown';
type StreamStatus = 'idle' | 'loading' | 'ready' | 'error';

interface VideoStreamProps {
  /** Video URL — any supported format */
  src: string;
  /** Optional poster image shown before playback */
  poster?: string;
  /** Auto-play once the source is ready (default: false) */
  autoPlay?: boolean;
  /** Show native browser video controls (default: true) */
  controls?: boolean;
  /** Start muted (default: false) */
  muted?: boolean;
  /** Loop playback (default: false) */
  loop?: boolean;
  /** Extra CSS class applied to the root wrapper */
  className?: string;
  /** CSS aspect-ratio value (default: '16/9') */
  aspectRatio?: CSSProperties['aspectRatio'];
}

interface UseVideoStreamReturn {
  videoRef:    React.RefObject<HTMLVideoElement | null>;
  type:        SourceType | null;
  status:      StreamStatus;
  progress:    number;
  forceIframe: () => void;
}

// ─── constants ───────────────────────────────────────────────────────────────

/** Known MIME types keyed by lowercase file extension */
const MIME_MAP = {
  mp4:  'video/mp4; codecs="avc1.42E01E, mp4a.40.2"',
  m4v:  'video/mp4; codecs="avc1.42E01E, mp4a.40.2"',
  mov:  'video/quicktime',
  webm: 'video/webm; codecs="vp8, vorbis"',
  ogg:  'video/ogg',
  mpg:  'video/mpeg',
  mpeg: 'video/mpeg',
  avi:  'video/x-msvideo',
} as const;

type MimeExt = keyof typeof MIME_MAP;

/** Extensions where MediaSource chunked streaming is reliably supported */
const MSE_EXTS = new Set<string>(['mp4', 'm4v', 'webm']);

/** URL patterns that must always render as <iframe> */
const IFRAME_PATTERNS: RegExp[] = [
  /player\.vimeo\.com/,
  /(?:www\.)?youtube\.com\/embed/,
  /youtu\.be/,
  /archive\.org\/embed/,
  /dailymotion\.com\/embed/,
  /facebook\.com\/plugins\/video/,
];

// ─── helpers ─────────────────────────────────────────────────────────────────

function getExt(src: string): string {
  try {
    const { pathname } = new URL(src);
    const raw = pathname.split('.').pop()?.toLowerCase() ?? '';
    return raw.split('?')[0]; // strip any accidental inline query string
  } catch {
    return '';
  }
}

function isMimeExt(ext: string): ext is MimeExt {
  return ext in MIME_MAP;
}

function detectType(src: string): SourceType {
  if (!src) return 'unknown';
  for (const pattern of IFRAME_PATTERNS) {
    if (pattern.test(src)) return 'iframe';
  }
  const ext = getExt(src);
  if (ext === 'm3u8') return 'hls';
  if (isMimeExt(ext)) return 'video';
  return 'video'; // optimistic — attempt <video> for unrecognised extensions
}

function mseSafe(ext: string): boolean {
  if (typeof window === 'undefined' || !window.MediaSource) return false;
  if (!MSE_EXTS.has(ext) || !isMimeExt(ext)) return false;
  try {
    return MediaSource.isTypeSupported(MIME_MAP[ext]);
  } catch {
    return false;
  }
}

function toErrorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

// ─── hook ─────────────────────────────────────────────────────────────────────

function useVideoStream(src: string): UseVideoStreamReturn {
  const videoRef   = useRef<HTMLVideoElement | null>(null);
  const cleanupRef = useRef<Array<() => void>>([]);

  const [type,     setType]     = useState<SourceType | null>(null);
  const [status,   setStatus]   = useState<StreamStatus>('idle');
  const [progress, setProgress] = useState<number>(0);

  /** Lets the component escalate a failed <video> element to an <iframe> */
  const forceIframe = useCallback((): void => {
    setType('iframe');
    setStatus('ready');
  }, []);

  const pushCleanup = (fn: () => void): void => {
    cleanupRef.current.push(fn);
  };

  const flushCleanup = useCallback((): void => {
    cleanupRef.current.forEach((fn) => {
      try { fn(); } catch { /* ignore errors during teardown */ }
    });
    cleanupRef.current = [];
  }, []);

  // ── Strategy 1: HLS ────────────────────────────────────────────────────────
  const initHls = useCallback(async (el: HTMLVideoElement): Promise<void> => {
    setStatus('loading');

    // Safari (and iOS) support HLS natively — no library needed
    if (el.canPlayType('application/vnd.apple.mpegurl')) {
      el.src = src;
      setStatus('ready');
      return;
    }

    const { default: Hls } = await import('hls.js');
    if (!Hls.isSupported()) {
      throw new Error('HLS is not supported in this browser');
    }

    const hls = new Hls({
      enableWorker:     true,
      lowLatencyMode:   true,
      backBufferLength: 90,
    });
    pushCleanup(() => hls.destroy());

    return new Promise<void>((resolve, reject) => {
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setStatus('ready');
        resolve();
      });
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          setStatus('error');
          reject(new Error('Fatal HLS error'));
        }
      });
      hls.loadSource(src);
      hls.attachMedia(el);
    });
  }, [src]);

  // ── Strategy 2: MediaSource chunked streaming ──────────────────────────────
  const initMSE = useCallback(async (
    el:  HTMLVideoElement,
    ext: MimeExt,
  ): Promise<void> => {
    const mime = MIME_MAP[ext];
    setStatus('loading');
    setProgress(0);

    const ms     = new MediaSource();
    const blobUrl = URL.createObjectURL(ms);
    pushCleanup(() => URL.revokeObjectURL(blobUrl));
    el.src = blobUrl;

    await new Promise<void>((resolve, reject) => {
      ms.addEventListener('sourceopen', async () => {
        let sb: SourceBuffer;
        try {
          sb = ms.addSourceBuffer(mime);
        } catch (e) {
          reject(e);
          return;
        }

        let res: Response;
        try {
          res = await fetch(src, { mode: 'cors' });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
        } catch (e) {
          reject(e);
          return;
        }

        if (!res.body) {
          reject(new Error('Response body is null'));
          return;
        }

        const total  = parseInt(res.headers.get('content-length') ?? '0', 10);
        const reader = res.body.getReader();
        let loaded = 0;

        const waitForUpdate = (): Promise<void> =>
          new Promise((r) => sb.addEventListener('updateend', () => r(), { once: true }));

        const pump = async (): Promise<void> => {
          const { done, value } = await reader.read();
          if (done) {
            if (ms.readyState === 'open') ms.endOfStream();
            setStatus('ready');
            resolve();
            return;
          }

          loaded += value.byteLength;
          if (total > 0) setProgress(Math.round((loaded / total) * 100));

          if (sb.updating) await waitForUpdate();

          try {
            sb.appendBuffer(value);
          } catch {
            // QuotaExceededError or similar — end stream gracefully
            if (ms.readyState === 'open') ms.endOfStream();
            setStatus('ready');
            resolve();
            return;
          }

          sb.addEventListener('updateend', pump, { once: true });
        };

        pump().catch(reject);
      }, { once: true });

      ms.addEventListener('error', () => reject(new Error('MediaSource error')), { once: true });
    });
  }, [src]);

  // ── Strategy 3: Blob (full download then play) ─────────────────────────────
  const initBlob = useCallback(async (el: HTMLVideoElement): Promise<void> => {
    setStatus('loading');
    setProgress(0);

    const res = await fetch(src, { mode: 'cors' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    if (!res.body) throw new Error('Response body is null');

    const total  = parseInt(res.headers.get('content-length') ?? '0', 10);
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let loaded = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      loaded += value.byteLength;
      if (total > 0) setProgress(Math.round((loaded / total) * 100));
    }

    const ext      = getExt(src);
    const mimeType = isMimeExt(ext) ? MIME_MAP[ext] : 'video/mp4';
    const blob     = new Blob(chunks, { type: mimeType });
    const url      = URL.createObjectURL(blob);
    pushCleanup(() => URL.revokeObjectURL(url));
    el.src = url;
    setStatus('ready');
  }, [src]);

  // ── Strategy 4: Direct src (no fetch, last resort) ─────────────────────────
  const initDirect = useCallback((el: HTMLVideoElement): void => {
    el.src = src;
    setStatus('ready');
  }, [src]);

  // ── Orchestration ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!src) return;

    flushCleanup();
    const detected = detectType(src);
    setType(detected);
    setStatus('idle');
    setProgress(0);

    if (detected === 'iframe') {
      setStatus('ready');
      return;
    }

    const el = videoRef.current;
    if (!el) return;

    const run = async (): Promise<void> => {
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
          console.warn('[VideoStream] MSE failed, falling back to blob:', toErrorMessage(e));
          flushCleanup(); // revoke any partial MediaSource blob URL
        }
      }

      try {
        await initBlob(el);
      } catch (e) {
        console.warn('[VideoStream] Blob fetch failed, falling back to direct src:', toErrorMessage(e));
        initDirect(el);
      }
    };

    run().catch((e: unknown) => {
      console.warn('[VideoStream] All strategies failed, falling back to iframe:', toErrorMessage(e));
      setType('iframe');
      setStatus('ready');
    });

    return flushCleanup;
  }, [src]);

  return { videoRef, type, status, progress, forceIframe };
}

// ─── component ───────────────────────────────────────────────────────────────

export default function VideoStream({
  src,
  poster,
  autoPlay    = false,
  controls    = true,
  muted       = false,
  loop        = false,
  className   = '',
  aspectRatio = '16/9',
}: VideoStreamProps) {
  const { videoRef, type, status, progress, forceIframe } = useVideoStream(src);

  const isLoading    = status === 'loading';
  const showProgress = isLoading && progress > 0;
  const showVideo    = type !== 'iframe' && status === 'ready';
  const showIframe   = type === 'iframe'  && status === 'ready';

  return (
    <div
      className={`vs-root ${className}`}
      style={{ aspectRatio }}
      aria-label="Video player"
    >
      {/* ── Loading overlay ──────────────────────────────────────────── */}
      {isLoading && (
        <div className="vs-overlay">
          <div className="vs-spinner" aria-hidden="true" />
          <span className="vs-label">
            {showProgress ? `${progress}%` : 'Streaming…'}
          </span>
          <div
            className="vs-bar-track"
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="vs-bar-fill"
              style={{ width: showProgress ? `${progress}%` : '0%' }}
            />
          </div>
        </div>
      )}

      {/* ── Idle overlay ─────────────────────────────────────────────── */}
      {status === 'idle' && (
        <div className="vs-overlay">
          <div className="vs-idle-dot" aria-hidden="true" />
        </div>
      )}

      {/* ── Native video ─────────────────────────────────────────────── */}
      <video
        ref={videoRef}
        className="vs-media"
        style={{
          opacity:       showVideo ? 1 : 0,
          pointerEvents: showVideo ? 'auto' : 'none',
        }}
        controls={controls}
        autoPlay={autoPlay}
        muted={muted}
        loop={loop}
        playsInline
        poster={poster}
        onError={forceIframe}
        aria-hidden={!showVideo}
      />

      {/* ── iframe fallback ──────────────────────────────────────────── */}
      {showIframe && (
        <iframe
          src={src}
          className="vs-media"
          title="Video player"
          allowFullScreen
          allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
          referrerPolicy="no-referrer-when-downgrade"
          loading="lazy"
        />
      )}
    </div>
  );
}