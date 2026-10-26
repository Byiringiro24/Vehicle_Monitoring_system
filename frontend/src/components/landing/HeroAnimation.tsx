'use client';
import { useEffect, useRef } from 'react';

// ── Routes: pre-drawn SVG paths vehicles follow ───────────────────────────────
const ROUTES = [
  { id: 'r1', d: 'M40,380 C160,340 300,240 480,180 S620,120 720,80',    dur: 14, delay: 0,   color: 'cyan' },
  { id: 'r2', d: 'M80,120 C220,180 320,300 480,360 S640,420 720,400',   dur: 18, delay: -4,  color: 'blue' },
  { id: 'r3', d: 'M20,260 C180,260 300,200 460,200 S660,200 720,240',   dur: 12, delay: -8,  color: 'cyan' },
  { id: 'r4', d: 'M120,60 C200,180 340,200 480,280 S600,360 700,340',   dur: 20, delay: -2,  color: 'blue' },
  { id: 'r5', d: 'M60,440 C220,400 340,320 520,300 S680,280 720,280',   dur: 16, delay: -10, color: 'cyan' },
  { id: 'r6', d: 'M200,40  C260,160 400,220 560,260 S680,300 720,320',  dur: 22, delay: -6,  color: 'blue' },
];

// ── Pulse dots (radar pings) ──────────────────────────────────────────────────
const PULSES = [
  { cx: 180, cy: 240, delay: 0 },
  { cx: 420, cy: 180, delay: 0.8 },
  { cx: 560, cy: 340, delay: 1.6 },
  { cx: 320, cy: 380, delay: 2.4 },
];

// ── Geofence rings ────────────────────────────────────────────────────────────
const GEOFENCES = [
  { cx: 180, cy: 240 },
  { cx: 560, cy: 340 },
];

export function HeroAnimation() {
  const svgRef = useRef<SVGSVGElement>(null);

  // Pause animation when scrolled out of view — saves battery
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) {
        el.pauseAnimations?.();
      } else {
        el.unpauseAnimations?.();
      }
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Check reduced-motion preference — SVG SMIL respects it but we also
  // set playbackRate=0 as a belt-and-suspenders approach
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mq.matches) {
      svgRef.current?.pauseAnimations?.();
    }
    const handler = (e: MediaQueryListEvent) => {
      if (e.matches) svgRef.current?.pauseAnimations?.();
      else           svgRef.current?.unpauseAnimations?.();
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 760 480"
      className="w-full h-full"
      aria-hidden="true"
      style={{ background: 'linear-gradient(165deg,#0A1228 0%,#101B36 45%,#17264A 100%)' }}
    >
      <defs>
        {/* Grid pattern */}
        <pattern id="hero-grid" width="48" height="48" patternUnits="userSpaceOnUse">
          <path d="M 48 0 L 0 0 0 48" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
        </pattern>

        {/* Glow filters */}
        <radialGradient id="glow-cyan" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#22D3EE" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#22D3EE" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="glow-blue" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#60A5FA" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#60A5FA" stopOpacity="0" />
        </radialGradient>

        {/* Soft blur for vehicle glow halos */}
        <filter id="soft-blur" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Subtle vignette at the edges */}
        <radialGradient id="vignette" cx="50%" cy="50%" r="70%">
          <stop offset="0%"   stopColor="transparent" />
          <stop offset="100%" stopColor="rgba(6,11,26,0.65)" />
        </radialGradient>
      </defs>

      {/* ── Background grid ──────────────────────────────────────────── */}
      <rect width="760" height="480" fill="url(#hero-grid)" />

      {/* ── Geofence rings (static circle + animated pulse) ─────────── */}
      {GEOFENCES.map((g, i) => (
        <g key={`geo-${i}`}>
          {/* Static zone boundary */}
          <circle
            cx={g.cx} cy={g.cy} r={42}
            fill="none"
            stroke="rgba(37,99,235,0.3)"
            strokeWidth="1.5"
            strokeDasharray="5 5"
          />
          {/* Animated pulse ring */}
          <circle cx={g.cx} cy={g.cy} r={20} fill="none" stroke="rgba(96,165,250,0.45)" strokeWidth="1.5">
            <animate attributeName="r"       from="20" to="64" dur="3.2s" repeatCount="indefinite" />
            <animate attributeName="opacity" from="0.5" to="0" dur="3.2s" repeatCount="indefinite" />
          </circle>
        </g>
      ))}

      {/* ── Route paths ──────────────────────────────────────────────── */}
      {ROUTES.map(r => (
        <path
          key={`path-${r.id}`}
          d={r.d}
          fill="none"
          stroke={r.color === 'cyan' ? 'rgba(34,211,238,0.22)' : 'rgba(96,165,250,0.22)'}
          strokeWidth="1.5"
          strokeDasharray="4 7"
        />
      ))}

      {/* ── Moving vehicles ──────────────────────────────────────────── */}
      {ROUTES.map(r => {
        const fill = r.color === 'cyan' ? '#22D3EE' : '#60A5FA';
        const grad = r.color === 'cyan' ? 'url(#glow-cyan)' : 'url(#glow-blue)';
        return (
          <g key={`veh-${r.id}`}>
            {/* Glow halo behind vehicle */}
            <ellipse rx="18" ry="10" fill={grad} opacity="0.5">
              <animateMotion
                dur={`${r.dur}s`}
                begin={`${r.delay}s`}
                repeatCount="indefinite"
                rotate="auto"
                path={r.d}
              />
            </ellipse>
            {/* Vehicle body — small rounded rectangle */}
            <rect x="-7" y="-3.5" width="14" height="7" rx="2.5"
              fill={fill}
              filter="url(#soft-blur)"
            >
              <animateMotion
                dur={`${r.dur}s`}
                begin={`${r.delay}s`}
                repeatCount="indefinite"
                rotate="auto"
                path={r.d}
              />
            </rect>
          </g>
        );
      })}

      {/* ── Radar ping dots ──────────────────────────────────────────── */}
      {PULSES.map((p, i) => (
        <g key={`pulse-${i}`}>
          {/* Static center dot */}
          <circle cx={p.cx} cy={p.cy} r="3" fill="#22D3EE" opacity="0.9" />
          {/* Expanding ring */}
          <circle cx={p.cx} cy={p.cy} r="3" fill="none" stroke="#22D3EE" strokeWidth="1.5">
            <animate attributeName="r"       from="3"  to="28" dur="2.4s" begin={`${p.delay}s`} repeatCount="indefinite" />
            <animate attributeName="opacity" from="0.8" to="0" dur="2.4s" begin={`${p.delay}s`} repeatCount="indefinite" />
          </circle>
        </g>
      ))}

      {/* ── Station dots (fixed waypoints on routes) ─────────────────── */}
      {[
        { cx: 480, cy: 180 }, { cx: 320, cy: 300 },
        { cx: 560, cy: 200 }, { cx: 200, cy: 340 },
      ].map((pt, i) => (
        <circle key={`station-${i}`} cx={pt.cx} cy={pt.cy} r="3.5"
          fill="none" stroke="rgba(96,165,250,0.5)" strokeWidth="1.5" />
      ))}

      {/* ── Edge vignette (keeps edges dark, focuses attention center) ─ */}
      <rect width="760" height="480" fill="url(#vignette)" />
    </svg>
  );
}
