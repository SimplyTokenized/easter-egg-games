/**
 * Cover art for the arcade tiles — one small inline SVG scene per game.
 *
 * Emoji look like placeholders at tile size; these read as artwork, scale
 * cleanly to any tile width and cost nothing extra to load.
 */

import type { ReactElement, ReactNode } from "react";

const Frame = ({ children }: { children: ReactNode }) => (
  <svg
    viewBox="0 0 200 150"
    className="h-full w-full"
    preserveAspectRatio="xMidYMid slice"
    aria-hidden="true"
    xmlns="http://www.w3.org/2000/svg"
  >
    {children}
  </svg>
);

const Card = ({
  x,
  y,
  rotate,
  rank,
  suit,
  red,
}: {
  x: number;
  y: number;
  rotate: number;
  rank: string;
  suit: string;
  red?: boolean;
}) => (
  <g transform={`translate(${x} ${y}) rotate(${rotate})`}>
    <rect x="-26" y="-37" width="52" height="74" rx="7" fill="#ffffff" />
    <rect
      x="-26"
      y="-37"
      width="52"
      height="74"
      rx="7"
      fill="none"
      stroke="#0f172a"
      strokeOpacity="0.15"
      strokeWidth="1.5"
    />
    <text
      x="-19"
      y="-20"
      fontSize="15"
      fontWeight="700"
      fill={red ? "#e11d48" : "#0f172a"}
    >
      {rank}
    </text>
    <text
      x="0"
      y="14"
      fontSize="30"
      textAnchor="middle"
      fill={red ? "#e11d48" : "#0f172a"}
    >
      {suit}
    </text>
  </g>
);

const SolitaireArt = () => (
  <Frame>
    {/* Felt with a soft spotlight, so the cards sit on something. */}
    <rect width="200" height="150" fill="#065f46" />
    <ellipse cx="100" cy="75" rx="110" ry="80" fill="#10b981" opacity="0.25" />
    <Card x={64} y={82} rotate={-16} rank="A" suit="♠" />
    <Card x={100} y={74} rotate={-1} rank="K" suit="♥" red />
    <Card x={136} y={82} rotate={16} rank="Q" suit="♦" red />
  </Frame>
);

const SnakeArt = () => {
  const cell = 18;
  const body = [
    [2, 4],
    [3, 4],
    [4, 4],
    [4, 3],
    [4, 2],
    [5, 2],
    [6, 2],
  ];
  return (
    <Frame>
      <rect width="200" height="150" fill="#14532d" />
      {/* Play grid */}
      {Array.from({ length: 11 }, (_, i) => (
        <line
          key={`v${i}`}
          x1={i * cell + 4}
          y1="0"
          x2={i * cell + 4}
          y2="150"
          stroke="#ffffff"
          strokeOpacity="0.06"
        />
      ))}
      {Array.from({ length: 9 }, (_, i) => (
        <line
          key={`h${i}`}
          x1="0"
          y1={i * cell + 6}
          x2="200"
          y2={i * cell + 6}
          stroke="#ffffff"
          strokeOpacity="0.06"
        />
      ))}

      {body.map(([cx, cy], i) => (
        <rect
          key={i}
          x={cx * cell + 6}
          y={cy * cell + 8}
          width={cell - 4}
          height={cell - 4}
          rx="5"
          fill="#4ade80"
          opacity={0.55 + (i / body.length) * 0.45}
        />
      ))}
      {/* Head with eyes */}
      <circle cx={6 * cell + 11} cy={2 * cell + 14} r="2.2" fill="#052e16" />
      <circle cx={6 * cell + 17} cy={2 * cell + 14} r="2.2" fill="#052e16" />
      {/* Apple */}
      <circle cx={7 * cell + 11} cy={5 * cell + 15} r="7" fill="#ef4444" />
      <path
        d={`M${7 * cell + 11} ${5 * cell + 8} q4 -5 8 -3 q-3 4 -8 3 Z`}
        fill="#22c55e"
      />
    </Frame>
  );
};

const MemoryArt = () => {
  const tiles = [
    { x: 62, y: 40, up: true, symbol: "★", fill: "#fbbf24" },
    { x: 100, y: 40, up: false },
    { x: 138, y: 40, up: false },
    { x: 62, y: 100, up: false },
    { x: 100, y: 100, up: true, symbol: "★", fill: "#fbbf24" },
    { x: 138, y: 100, up: false },
  ];
  return (
    <Frame>
      <rect width="200" height="150" fill="#3b0764" />
      <ellipse cx="100" cy="75" rx="110" ry="80" fill="#a855f7" opacity="0.28" />
      {tiles.map((tile, i) => (
        <g key={i} transform={`translate(${tile.x} ${tile.y})`}>
          <rect
            x="-21"
            y="-24"
            width="42"
            height="48"
            rx="7"
            fill={tile.up ? "#ffffff" : "#6d28d9"}
            stroke="#ffffff"
            strokeOpacity={tile.up ? 0 : 0.22}
            strokeWidth="1.5"
          />
          {tile.up ? (
            <text
              x="0"
              y="10"
              fontSize="26"
              textAnchor="middle"
              fill={tile.fill}
            >
              {tile.symbol}
            </text>
          ) : (
            <circle cx="0" cy="0" r="9" fill="#ffffff" opacity="0.16" />
          )}
        </g>
      ))}
    </Frame>
  );
};

const PuzzleArt = () => {
  const tiles = [
    { x: 64, y: 42, value: "2", bg: "#fde68a", fg: "#78350f" },
    { x: 126, y: 42, value: "4", bg: "#fcd34d", fg: "#78350f" },
    { x: 64, y: 104, value: "8", bg: "#fb923c", fg: "#ffffff" },
    { x: 126, y: 104, value: "16", bg: "#f97316", fg: "#ffffff" },
  ];
  return (
    <Frame>
      <rect width="200" height="150" fill="#7c2d12" />
      <rect
        x="20"
        y="8"
        width="160"
        height="134"
        rx="12"
        fill="#000000"
        opacity="0.22"
      />
      {tiles.map((tile) => (
        <g key={tile.value} transform={`translate(${tile.x} ${tile.y})`}>
          <rect x="-26" y="-26" width="52" height="52" rx="9" fill={tile.bg} />
          <text
            x="0"
            y="10"
            fontSize={tile.value.length > 1 ? 24 : 28}
            fontWeight="800"
            textAnchor="middle"
            fill={tile.fg}
          >
            {tile.value}
          </text>
        </g>
      ))}
    </Frame>
  );
};

/**
 * Ladder's cover is the game itself: phosphor characters on black, the way it
 * looked on a Kaypro. Kept inside the central safe area so the phone thumbnail,
 * which crops the 4:3 art to roughly a square, does not clip the scene.
 */
const LadderArt = () => {
  const row = (y: number, text: string, x = 38) => (
    <text
      key={y}
      x={x}
      y={y}
      fontFamily="ui-monospace, monospace"
      fontSize="13"
      letterSpacing="1.5"
      fill="#34d399"
    >
      {text}
    </text>
  );
  return (
    <Frame>
      <rect width="200" height="150" fill="#04120c" />
      {row(24, "======= H =======")}
      {row(48, "   H       ")}
      {row(62, "======  H  ======")}
      {row(86, "   H       ")}
      {row(110, "=================")}
      {/* The cast: exit, player, a rock and some treasure. */}
      <text x="150" y="20" fontFamily="ui-monospace, monospace" fontSize="14" fill="#a5f3fc">
        $
      </text>
      <text x="60" y="58" fontFamily="ui-monospace, monospace" fontSize="14" fill="#fb923c">
        o
      </text>
      <text x="120" y="106" fontFamily="ui-monospace, monospace" fontSize="14" fill="#fcd34d">
        *
      </text>
      <text
        x="44"
        y="106"
        fontFamily="ui-monospace, monospace"
        fontSize="15"
        fontWeight="700"
        fill="#ffffff"
      >
        &amp;
      </text>
    </Frame>
  );
};

/**
 * Space Invaders' cover is the moment the game is about: the fleet overhead,
 * the cannon underneath, one shot in the air.
 *
 * The sprites are drawn here rather than imported from `games/invaders/sprites`
 * on purpose — this file lives in the arcade chunk, and the game's art has no
 * business loading for someone who only ever looks at the picker.
 */
const InvadersArt = () => {
  /** Lit pixels as one path, runs merged along each row. */
  const pixels = (rows: string[]): string => {
    let path = "";
    rows.forEach((row, y) => {
      let x = 0;
      while (x < row.length) {
        if (row[x] !== "X") {
          x += 1;
          continue;
        }
        let run = 0;
        while (x + run < row.length && row[x + run] === "X") run += 1;
        path += `M${x} ${y}h${run}v1h${-run}z`;
        x += run;
      }
    });
    return path;
  };

  const crab = pixels([
    "..X.....X..",
    "...X...X...",
    "..XXXXXXX..",
    ".XX.XXX.XX.",
    "XXXXXXXXXXX",
    "X.XXXXXXX.X",
    "X.X.....X.X",
    "...XX.XX...",
  ]);
  const squid = pixels([
    "...XX...",
    "..XXXX..",
    ".XXXXXX.",
    "XX.XX.XX",
    "XXXXXXXX",
    "..X..X..",
    ".X.XX.X.",
    "X.X..X.X",
  ]);
  const cannon = pixels([
    "......X......",
    ".....XXX.....",
    ".XXXXXXXXXXX.",
    "XXXXXXXXXXXXX",
    "XXXXXXXXXXXXX",
    "XXX.......XXX",
  ]);

  const alien = (x: number, y: number, path: string, w: number, color: string) => (
    <g key={`${x}-${y}`} transform={`translate(${x} ${y}) scale(2)`}>
      <path d={path} fill={color} transform={`translate(${-w / 2} -4)`} />
    </g>
  );

  return (
    <Frame>
      <rect width="200" height="150" fill="#020617" />
      {/* A few stars, placed by hand so they never sit on a sprite. */}
      {[
        [18, 20],
        [176, 30],
        [40, 128],
        [150, 118],
        [96, 16],
        [8, 92],
      ].map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.2" fill="#e2e8f0" opacity="0.55" />
      ))}

      {/* Two ranks of the fleet */}
      {[46, 100, 154].map((x) => alien(x, 38, squid, 8, "#f9a8d4"))}
      {[46, 100, 154].map((x) => alien(x, 64, crab, 11, "#67e8f9"))}

      {/* The shot, mid-flight */}
      <rect x="99" y="88" width="2" height="10" fill="#ffffff" />

      {/* A bunker and the cannon */}
      <rect x="60" y="108" width="24" height="10" rx="2" fill="#34d399" opacity="0.85" />
      <rect x="116" y="108" width="24" height="10" rx="2" fill="#34d399" opacity="0.85" />
      <g transform="translate(100 128) scale(2.2)">
        <path d={cannon} fill="#e2e8f0" transform="translate(-6.5 -3)" />
      </g>
    </Frame>
  );
};

const ART: Record<string, () => ReactElement> = {
  solitaire: SolitaireArt,
  ladder: LadderArt,
  invaders: InvadersArt,
  snake: SnakeArt,
  memory: MemoryArt,
  "2048": PuzzleArt,
};

export const GameArt = ({ gameId }: { gameId: string }) => {
  const Art = ART[gameId];
  return Art ? <Art /> : null;
};
