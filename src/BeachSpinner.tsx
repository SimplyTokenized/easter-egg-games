/**
 * The loading animation for the arcade: a stick figure strolls onto the beach,
 * drops onto its towel and sunbathes while the sun turns overhead.
 *
 * Pure SVG + CSS keyframes — no animation library, no timers, nothing to clean
 * up. It lives in the arcade chunk, so the main bundle never pays for it.
 */

const CSS = `
@keyframes ee-stroll {
  0%   { transform: translateX(-72px); }
  46%  { transform: translateX(0); }
  100% { transform: translateX(0); }
}
@keyframes ee-lie-down {
  0%, 46%  { transform: rotate(0deg) translateY(0); }
  58%      { transform: rotate(-86deg) translateY(-1px); }
  62%      { transform: rotate(-78deg) translateY(-1px); }
  66%, 100% { transform: rotate(-82deg) translateY(-1px); }
}
@keyframes ee-bob {
  0%, 46%  { transform: translateY(0); }
  8%       { transform: translateY(-1.6px); }
  15%      { transform: translateY(0); }
  23%      { transform: translateY(-1.6px); }
  30%      { transform: translateY(0); }
  38%      { transform: translateY(-1.6px); }
  /* Sunbathing: the bob becomes a slow breath. */
  70%      { transform: translateY(0); }
  84%      { transform: translateY(-0.7px); }
  100%     { transform: translateY(0); }
}
@keyframes ee-swing-a {
  0%      { transform: rotate(24deg); }
  25%     { transform: rotate(-24deg); }
  50%     { transform: rotate(24deg); }
  75%     { transform: rotate(-24deg); }
  46%, 100% { transform: rotate(0deg); }
}
@keyframes ee-swing-b {
  0%      { transform: rotate(-24deg); }
  25%     { transform: rotate(24deg); }
  50%     { transform: rotate(-24deg); }
  75%     { transform: rotate(24deg); }
  46%, 100% { transform: rotate(0deg); }
}
@keyframes ee-arm-a {
  0%      { transform: rotate(-18deg); }
  25%     { transform: rotate(18deg); }
  50%     { transform: rotate(-18deg); }
  75%     { transform: rotate(18deg); }
  /* Arms fold behind the head once the figure is down. */
  60%, 100% { transform: rotate(-52deg); }
}
@keyframes ee-arm-b {
  0%      { transform: rotate(18deg); }
  25%     { transform: rotate(-18deg); }
  50%     { transform: rotate(18deg); }
  75%     { transform: rotate(-18deg); }
  60%, 100% { transform: rotate(-52deg); }
}
@keyframes ee-sun-spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
@keyframes ee-sun-pulse {
  0%, 100% { transform: scale(1); opacity: 0.35; }
  50%      { transform: scale(1.14); opacity: 0.6; }
}
@keyframes ee-wave {
  0%, 100% { transform: translateX(0); }
  50%      { transform: translateX(6px); }
}
@keyframes ee-bird {
  0%   { transform: translate(0, 0); opacity: 0; }
  10%  { opacity: 0.8; }
  90%  { opacity: 0.8; }
  100% { transform: translate(58px, -10px); opacity: 0; }
}
@keyframes ee-relax-in {
  0%, 62%  { opacity: 0; }
  74%, 100% { opacity: 1; }
}
@keyframes ee-note-float {
  0%   { transform: translate(0, 0) scale(0.6); opacity: 0; }
  30%  { opacity: 0.9; }
  100% { transform: translate(5px, -16px) scale(1); opacity: 0; }
}

/* One trip down the beach. The arcade holds the spinner for at least this long
   so the payoff — lying down in the sun — is always actually seen. */
.ee-beach    { --ee-cycle: 4.2s; }

.ee-stroll   { animation: ee-stroll var(--ee-cycle) cubic-bezier(0.36, 0, 0.3, 1) infinite; }
.ee-pose     { animation: ee-lie-down var(--ee-cycle) ease-in-out infinite;
               transform-box: fill-box; transform-origin: 50% 100%; }
.ee-bob      { animation: ee-bob var(--ee-cycle) ease-in-out infinite;
               transform-box: fill-box; transform-origin: 50% 100%; }
.ee-limb     { transform-box: fill-box; transform-origin: 50% 0%; }
.ee-leg-a    { animation: ee-swing-a var(--ee-cycle) ease-in-out infinite; }
.ee-leg-b    { animation: ee-swing-b var(--ee-cycle) ease-in-out infinite; }
.ee-arm-a    { animation: ee-arm-a var(--ee-cycle) ease-in-out infinite; }
.ee-arm-b    { animation: ee-arm-b var(--ee-cycle) ease-in-out infinite; }
.ee-sun-rays { animation: ee-sun-spin 24s linear infinite;
               transform-box: fill-box; transform-origin: 50% 50%; }
.ee-sun-glow { animation: ee-sun-pulse 3.4s ease-in-out infinite;
               transform-box: fill-box; transform-origin: 50% 50%; }
.ee-wave     { animation: ee-wave 4.5s ease-in-out infinite; }
.ee-wave-2   { animation-delay: -1.6s; }
.ee-bird     { animation: ee-bird 9s linear infinite; }
.ee-bird-2   { animation-delay: -4.5s; }
.ee-relax    { animation: ee-relax-in var(--ee-cycle) ease-out infinite; }
.ee-note     { animation: ee-note-float 2.6s ease-out infinite; }
.ee-note-2   { animation-delay: -1.3s; }

@media (prefers-reduced-motion: reduce) {
  .ee-beach * { animation: none !important; }
  /* Skip straight to the happy ending. */
  .ee-pose  { transform: rotate(-82deg) translateY(-1px); }
  .ee-arm-a, .ee-arm-b { transform: rotate(-52deg); }
  .ee-relax { opacity: 1; }
  .ee-note  { opacity: 0; }
}
`;

interface BeachSpinnerProps {
  /** Shown under the scene, e.g. "Loading Solitaire…". */
  label?: string;
  className?: string;
}

export const BeachSpinner = ({ label, className }: BeachSpinnerProps) => (
  <div
    className={`flex flex-col items-center justify-center gap-4 py-10 ${className ?? ""}`}
    role="status"
    aria-live="polite"
  >
    <svg
      viewBox="0 0 240 140"
      className="ee-beach w-full max-w-[280px]"
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      <style>{CSS}</style>

      <defs>
        <linearGradient id="ee-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7dd3fc" />
          <stop offset="60%" stopColor="#bae6fd" />
          <stop offset="100%" stopColor="#fef3c7" />
        </linearGradient>
        <linearGradient id="ee-sea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#0284c7" />
        </linearGradient>
        <linearGradient id="ee-sand" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fde68a" />
          <stop offset="100%" stopColor="#fbbf24" />
        </linearGradient>
        <clipPath id="ee-frame">
          <rect x="0" y="0" width="240" height="140" rx="14" />
        </clipPath>
      </defs>

      <g clipPath="url(#ee-frame)">
        <rect x="0" y="0" width="240" height="140" fill="url(#ee-sky)" />

        {/* Sun */}
        <g>
          <circle className="ee-sun-glow" cx="196" cy="34" r="26" fill="#fde047" />
          <g className="ee-sun-rays">
            {Array.from({ length: 12 }, (_, i) => (
              <rect
                key={i}
                x="195"
                y="6"
                width="2"
                height="8"
                rx="1"
                fill="#facc15"
                transform={`rotate(${i * 30} 196 34)`}
              />
            ))}
          </g>
          <circle cx="196" cy="34" r="15" fill="#fbbf24" />
          <circle cx="196" cy="34" r="15" fill="#fde047" opacity="0.55" />
          {/* The sun is having a good day too. */}
          <circle cx="191" cy="31" r="1.4" fill="#b45309" />
          <circle cx="201" cy="31" r="1.4" fill="#b45309" />
          <path
            d="M190.5 38 Q196 43 201.5 38"
            fill="none"
            stroke="#b45309"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </g>

        {/* Birds */}
        <g className="ee-bird" opacity="0.8">
          <path d="M40 30 l4 -3 l4 3" fill="none" stroke="#0369a1" strokeWidth="1.4" strokeLinecap="round" />
          <path d="M52 34 l3 -2.4 l3 2.4" fill="none" stroke="#0369a1" strokeWidth="1.2" strokeLinecap="round" />
        </g>
        <g className="ee-bird ee-bird-2" opacity="0.6">
          <path d="M96 22 l3.5 -2.6 l3.5 2.6" fill="none" stroke="#0369a1" strokeWidth="1.2" strokeLinecap="round" />
        </g>

        {/* Sea */}
        <rect x="0" y="74" width="240" height="26" fill="url(#ee-sea)" />
        <g className="ee-wave" opacity="0.7">
          <path d="M-10 82 q10 -4 20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0"
            fill="none" stroke="#e0f2fe" strokeWidth="1.6" strokeLinecap="round" />
        </g>
        <g className="ee-wave ee-wave-2" opacity="0.45">
          <path d="M-10 91 q12 -4 24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0"
            fill="none" stroke="#f0f9ff" strokeWidth="1.4" strokeLinecap="round" />
        </g>

        {/* Sand */}
        <path d="M0 98 q60 -8 120 0 t120 0 v42 H0 Z" fill="url(#ee-sand)" />
        <ellipse cx="34" cy="126" rx="9" ry="2.6" fill="#f59e0b" opacity="0.45" />
        <ellipse cx="212" cy="118" rx="7" ry="2.2" fill="#f59e0b" opacity="0.4" />

        {/* Parasol */}
        <g>
          <rect x="46" y="86" width="2.4" height="34" rx="1.2" fill="#92400e" />
          <path d="M24 88 a23 15 0 0 1 46 0 Z" fill="#f87171" />
          <path d="M47 73 a23 15 0 0 1 23 15 h-11.5 a11.5 15 0 0 0 -11.5 -15 Z" fill="#fca5a5" />
          <path d="M24 88 a23 15 0 0 1 11.5 -13 a11.5 15 0 0 1 11.5 13 Z" fill="#fca5a5" />
        </g>

        {/* Towel — the destination. Offset left of the walker's end point so the
            figure lands centred on it once it rotates down. */}
        <g transform="translate(102 0)">
          <rect x="-30" y="115" width="60" height="11" rx="3" fill="#f472b6" />
          <rect x="-22" y="115" width="6" height="11" fill="#fbcfe8" />
          <rect x="-6" y="115" width="6" height="11" fill="#fbcfe8" />
          <rect x="10" y="115" width="6" height="11" fill="#fbcfe8" />
        </g>

        {/* Strichmännchen. The placement lives on an outer group: a CSS
            `transform` animation replaces the `transform` attribute outright,
            so animating the same element would throw the position away. */}
        <g transform="translate(120 118)">
          <g className="ee-stroll">
            <g className="ee-pose">
              {/* Invisible box keeps the rotation pivot steady while the legs swing. */}
              <rect x="-16" y="-46" width="32" height="46" fill="none" />
              <g className="ee-bob" stroke="#1f2937" strokeWidth="2.4" strokeLinecap="round" fill="none">
                {/* Back arm and leg first, so the front pair overlaps them. */}
                <line className="ee-limb ee-arm-b" x1="0" y1="-30" x2="0" y2="-19" opacity="0.55" />
                <line className="ee-limb ee-leg-b" x1="0" y1="-17" x2="0" y2="-1" opacity="0.55" />

                <line x1="0" y1="-31" x2="0" y2="-17" />
                <line className="ee-limb ee-arm-a" x1="0" y1="-30" x2="0" y2="-19" />
                <line className="ee-limb ee-leg-a" x1="0" y1="-17" x2="0" y2="-1" />

                <circle cx="0" cy="-37" r="5.6" fill="#fde68a" stroke="#1f2937" strokeWidth="2.2" />
                {/* Sunglasses + grin, once the sunbathing starts. */}
                <g className="ee-relax">
                  <rect x="-4.6" y="-39.6" width="9.2" height="3" rx="1.4" fill="#1f2937" stroke="none" />
                  <path d="M-2.4 -34.6 q2.4 2 4.8 0" stroke="#1f2937" strokeWidth="1.3" />
                </g>
              </g>
            </g>
          </g>
        </g>

        {/* Contented little notes drifting up from the towel */}
        <g className="ee-relax">
          <circle className="ee-note" cx="80" cy="106" r="1.8" fill="#fb7185" />
          <circle className="ee-note ee-note-2" cx="87" cy="104" r="1.4" fill="#f472b6" />
        </g>
      </g>
    </svg>

    {label ? (
      <p className="text-sm font-medium opacity-80">{label}</p>
    ) : null}
  </div>
);

export default BeachSpinner;
