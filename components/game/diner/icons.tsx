import type { ReactNode } from 'react';
import { dinerIconUrl, type DinerIconArt } from '@/lib/games/diner/art';
import type { DishId } from '@/lib/games/diner/content';

/**
 * Diner's pictures: illustrated stickers for most (see `ART`), and chunky
 * enamel-sign drawings with a dark ink outline for the rest.
 */
const INK = '#2a1620';
export type IconName =
  | DishId
  | 'burnt'
  | 'dirty'
  | 'bell'
  | 'seat'
  | 'order'
  | 'mop'
  | 'wash'
  | 'bin'
  | 'hand'
  | 'out'
  | 'coin'
  | 'star'
  | 'follow'
  | 'back'
  | 'eat'
  | 'repair'
  | 'dots'
  | 'coffee'
  | 'music'
  | 'skate'
  | 'token'
  | 'heart'
  | 'fuel'
  | 'bolt'
  | 'tray'
  | 'tire'
  | 'dice'
  | 'map'
  | 'neon'
  | 'crate'
  | 'bed'
  | 'pin'
  | 'clock';

const paths: Record<IconName, ReactNode> = {
  clock: (
    <>
      <circle cx="24" cy="25" r="16" fill="#fff4de" />
      <path d="M24 15v10l7 5" fill="none" />
    </>
  ),
  repair: (
    <>
      <path
        d="M35 7a11 11 0 0 0-14 13L7 34a5 5 0 0 0 7 7l14-14A11 11 0 0 0 41 13l-8 8-6-6z"
        fill="#dfe6ea"
      />
      <circle cx="11" cy="37" r="1.7" fill="#89959f" stroke="none" />
    </>
  ),
  burger: (
    <>
      <path d="M8 22c0-8 7-13 16-13s16 5 16 13z" fill="#f0a64a" />
      <circle cx="17" cy="15" r="1.3" fill="#fff3d2" stroke="none" />
      <circle cx="24" cy="13" r="1.3" fill="#fff3d2" stroke="none" />
      <circle cx="31" cy="15" r="1.3" fill="#fff3d2" stroke="none" />
      <path
        d="M7 25.5c3-2.5 6 1 9-1s6 1.5 9 0 6-2 9 0 4 0 7-1v3H7z"
        fill="#5cc04f"
      />
      <path d="M8 28h32l-3 5H11z" fill="#ffd23f" />
      <rect x="7" y="30" width="34" height="6" rx="3" fill="#7a3f22" />
      <path d="M9 37h30c0 3-2 5-5 5H14c-3 0-5-2-5-5z" fill="#f0a64a" />
    </>
  ),
  shake: (
    <>
      <path d="M31 4l-4 14" stroke="#e3313f" strokeWidth="3" />
      <path d="M13 17h22l-4 22H17z" fill="#ff8fbf" />
      <path d="M12 17c0-5 5-8 12-8s12 3 12 8z" fill="#fff8ee" />
      <circle cx="24" cy="7.5" r="3.2" fill="#d1102c" />
      <rect x="15" y="39" width="18" height="5" rx="2" fill="#dfe6ea" />
      <path d="M17 22h14" stroke="#fff" strokeWidth="2" opacity=".6" />
    </>
  ),
  pie: (
    <>
      <path d="M6 34l34-15c2 4 2 10 0 15z" fill="#e6a64e" />
      <path d="M8 33l30-13c1 3 1 7 0 10z" fill="#c4122e" />
      <path
        d="M14 30l5 3M21 27l5 4M28 24l5 5"
        stroke="#f6c477"
        strokeWidth="2.6"
      />
      <ellipse cx="24" cy="38" rx="18" ry="4" fill="#fff8ee" />
    </>
  ),
  fries: (
    <>
      <path
        d="M15 14l2 16M20 10l1 20M25 9v21M30 11l-1 19M34 15l-2 15"
        stroke="#f7c948"
        strokeWidth="4"
      />
      <path d="M12 22h24l-3 21H15z" fill="#d81f37" />
      <path d="M17 22c2 4 12 4 14 0" fill="#fff" />
    </>
  ),
  burnt: (
    <>
      <ellipse cx="24" cy="36" rx="18" ry="5" fill="#fff8ee" />
      <path d="M11 33c0-7 6-11 13-11s13 4 13 11z" fill="#2b221d" />
      <path
        d="M18 18c-2-4 2-6 0-10M26 17c-2-4 2-6 0-10M33 19c-2-3 1-5 0-8"
        stroke="#7d7682"
        strokeWidth="2.4"
        fill="none"
      />
    </>
  ),
  dirty: (
    <>
      <ellipse cx="24" cy="36" rx="18" ry="5" fill="#fff8ee" />
      <ellipse cx="24" cy="30" rx="16" ry="4.5" fill="#fff8ee" />
      <ellipse cx="24" cy="24" rx="14" ry="4" fill="#fff8ee" />
      <circle cx="20" cy="24" r="2" fill="#b07a3a" stroke="none" />
      <circle cx="29" cy="30" r="2.2" fill="#c0562f" stroke="none" />
      <path d="M33 10l-4 13" stroke="#cfd8dc" strokeWidth="3" />
    </>
  ),
  bell: (
    <>
      <path d="M10 34c0-9 6-16 14-16s14 7 14 16z" fill="#f2c94c" />
      <path d="M6 34h36v5H6z" fill="#dfe6ea" />
      <circle cx="24" cy="15" r="3" fill="#f2c94c" />
      <path
        d="M16 26c1-3 3-5 6-6"
        stroke="#fff6cc"
        strokeWidth="2.4"
        fill="none"
      />
    </>
  ),
  seat: (
    <>
      <rect x="9" y="10" width="9" height="30" rx="4" fill="#7fd6c2" />
      <rect x="30" y="10" width="9" height="30" rx="4" fill="#7fd6c2" />
      <rect x="17" y="20" width="14" height="6" rx="2" fill="#fff8ee" />
      <path d="M24 26v14" stroke={INK} strokeWidth="3" />
    </>
  ),
  order: (
    <>
      <rect x="11" y="7" width="26" height="34" rx="3" fill="#fff8ee" />
      <rect x="11" y="7" width="26" height="7" rx="3" fill="#d81f37" />
      <path d="M16 21h16M16 27h16M16 33h10" stroke={INK} strokeWidth="2.4" />
      <path d="M36 30l6-12" stroke="#f2c94c" strokeWidth="4" />
    </>
  ),
  mop: (
    <>
      <path d="M30 6L20 30" stroke="#8b5a2b" strokeWidth="4" />
      <path d="M10 30h20l4 12H6z" fill="#f2c94c" />
      <path
        d="M12 42l2-8M18 42v-8M24 42l-1-8M30 42l-2-8"
        stroke={INK}
        strokeWidth="2"
      />
      <circle cx="38" cy="38" r="3" fill="#b38bff" />
    </>
  ),
  wash: (
    <>
      <path d="M8 26h32v6c0 6-5 10-11 10H19c-6 0-11-4-11-10z" fill="#dfe6ea" />
      <circle cx="17" cy="20" r="5" fill="#d8f3ff" />
      <circle cx="28" cy="16" r="6.5" fill="#d8f3ff" />
      <circle cx="35" cy="22" r="4" fill="#d8f3ff" />
    </>
  ),
  bin: (
    <>
      <path d="M12 16h24l-3 27H15z" fill="#d81f37" />
      <path d="M9 11h30v6H9z" fill="#dfe6ea" />
      <path d="M20 7h8v4h-8z" fill="#dfe6ea" />
      <path
        d="M19 22v16M24 22v16M29 22v16"
        stroke="#8f0d22"
        strokeWidth="2.2"
      />
    </>
  ),
  hand: (
    <>
      <path
        d="M14 26V14a3 3 0 016 0v9-12a3 3 0 016 0v12-10a3 3 0 016 0v11-6a3 3 0 016 0v13c0 9-6 15-14 15s-11-5-14-10l-4-7a3 3 0 015-3z"
        fill="#ffd9b8"
      />
    </>
  ),
  out: (
    <>
      <path d="M8 20h14l-4-8 18 12-18 12 4-8H8z" fill="#fff8ee" />
    </>
  ),
  coin: (
    <>
      <circle cx="24" cy="24" r="18" fill="#f4c542" />
      <circle cx="24" cy="24" r="12.5" fill="#ffd96a" />
      <path
        d="M24 15v18M20 19.5c0-2 2-3 4-3s4 1 4 3-2 3-4 3.5-4 1.5-4 3.5 2 3 4 3 4-1 4-3"
        stroke="#a7741a"
        strokeWidth="2.4"
        fill="none"
      />
    </>
  ),
  star: (
    <path
      d="M24 5l5.6 12.4 13.4 1.4-10 9.2 2.8 13.3L24 34.6 12.2 41.3 15 28 5 18.8l13.4-1.4z"
      fill="#ffd23f"
    />
  ),
  follow: (
    <>
      <circle cx="16" cy="16" r="6" fill="#ffd9b8" />
      <path d="M6 40c0-8 4-14 10-14s10 6 10 14z" fill="#7fd6c2" />
      <circle cx="32" cy="18" r="5" fill="#ffd9b8" />
      <path d="M24 40c0-7 3-12 8-12s8 5 8 12z" fill="#f0a64a" />
    </>
  ),
  back: (
    <>
      <path
        d="M38 24H14M22 14L12 24l10 10"
        stroke={INK}
        strokeWidth="4"
        fill="none"
      />
    </>
  ),
  eat: (
    <>
      <path
        d="M15 6v14c0 3 2 5 4 5v17"
        stroke={INK}
        strokeWidth="3"
        fill="none"
      />
      <path d="M11 6v12M19 6v12" stroke={INK} strokeWidth="2.4" />
      <path d="M33 42V6c-5 2-7 8-7 14 0 4 3 6 7 6" fill="#dfe6ea" />
    </>
  ),
  coffee: (
    <>
      <path d="M12 16h20v16c0 6-4 10-10 10s-10-4-10-10z" fill="#fff8ee" />
      <path d="M32 20h3a5 5 0 010 10h-3" fill="none" />
      <path d="M12 16h20v6H12z" fill="#7a3f22" />
      <path
        d="M18 4c-2 3 2 5 0 8M25 4c-2 3 2 5 0 8"
        fill="none"
        stroke="#c9b7a8"
      />
    </>
  ),
  music: (
    <>
      <path d="M18 34V10l20-4v24" fill="none" strokeWidth="3" />
      <ellipse cx="13" cy="35" rx="6" ry="5" fill="#ff4fa3" />
      <ellipse cx="33" cy="31" rx="6" ry="5" fill="#ff4fa3" />
    </>
  ),
  skate: (
    <>
      <path d="M12 8h12v18h12c3 0 5 2 5 5v3H9V12c0-2 1-4 3-4z" fill="#ff6b8a" />
      <circle cx="15" cy="39" r="4" fill="#f4c542" />
      <circle cx="33" cy="39" r="4" fill="#f4c542" />
      <path d="M14 15h8M14 20h8" stroke="#fff" strokeWidth="2" />
    </>
  ),
  token: (
    <>
      <circle cx="24" cy="24" r="18" fill="#9fe3d2" />
      <circle cx="24" cy="24" r="12" fill="#e8fbf5" />
      <path
        d="M24 15l3 6 6 1-4.5 4 1 6-5.5-3-5.5 3 1-6-4.5-4 6-1z"
        fill="#2f8f7d"
      />
    </>
  ),
  heart: (
    <path
      d="M24 41s-15-9-15-20a8 8 0 0115-4 8 8 0 0115 4c0 11-15 20-15 20z"
      fill="#ff4f6d"
    />
  ),
  fuel: (
    <>
      <rect x="10" y="10" width="20" height="30" rx="3" fill="#d81f37" />
      <rect x="14" y="14" width="12" height="8" rx="1" fill="#fff8ee" />
      <path d="M30 18h4l4 4v14a3 3 0 01-6 0v-8h-2" fill="none" />
    </>
  ),
  bolt: <path d="M27 4L11 27h11l-3 17 18-24H26z" fill="#ffd23f" />,
  tray: (
    <>
      <ellipse cx="24" cy="30" rx="20" ry="7" fill="#dfe6ea" />
      <ellipse cx="24" cy="28" rx="16" ry="5" fill="#f4f7f8" />
      <path d="M14 26c0-6 4-9 10-9s10 3 10 9z" fill="#f0a64a" />
    </>
  ),
  tire: (
    <>
      <circle cx="24" cy="24" r="18" fill="#2b2b33" />
      <circle cx="24" cy="24" r="10" fill="#fff8ee" />
      <circle cx="24" cy="24" r="5" fill="#dfe6ea" />
    </>
  ),
  dice: (
    <>
      <rect x="8" y="8" width="32" height="32" rx="7" fill="#fff8ee" />
      <circle cx="17" cy="17" r="3" fill="#d81f37" stroke="none" />
      <circle cx="24" cy="24" r="3" fill="#d81f37" stroke="none" />
      <circle cx="31" cy="31" r="3" fill="#d81f37" stroke="none" />
    </>
  ),
  map: (
    <>
      <path d="M6 12l12-4 12 4 12-4v28l-12 4-12-4-12 4z" fill="#fff8ee" />
      <path d="M18 8v28M30 12v28" />
      <path d="M10 28c6-2 8-10 14-8s8 6 14 2" stroke="#d81f37" fill="none" />
    </>
  ),
  neon: (
    <>
      <rect x="6" y="12" width="36" height="22" rx="5" fill="#2a1620" />
      <path
        d="M12 28V18l6 10V18M23 18v10M28 18h6M28 23h5M28 28h6"
        stroke="#ff4fa3"
        strokeWidth="2.6"
        fill="none"
      />
    </>
  ),
  bed: (
    <>
      <rect x="6" y="22" width="36" height="12" rx="3" fill="#fff8ee" />
      <rect x="9" y="17" width="11" height="7" rx="3" fill="#7fd6c2" />
      <path d="M6 34v6M42 34v6" />
    </>
  ),
  pin: (
    <>
      <path
        d="M24 44S10 28 10 19a14 14 0 0128 0c0 9-14 25-14 25z"
        fill="#d81f37"
      />
      <circle cx="24" cy="19" r="5" fill="#fff8ee" />
    </>
  ),
  crate: (
    <>
      <path d="M8 16l16-8 16 8v18l-16 8-16-8z" fill="#e0a65a" />
      <path d="M8 16l16 8 16-8M24 24v18" fill="none" />
      <path d="M16 12l16 8" stroke="#a8742e" strokeWidth="3" />
    </>
  ),
  dots: (
    <>
      <circle cx="13" cy="24" r="4" fill="#fff8ee" />
      <circle cx="24" cy="24" r="4" fill="#fff8ee" />
      <circle cx="35" cy="24" r="4" fill="#fff8ee" />
    </>
  ),
};

/**
 * The illustrated sticker pictures (8 October 2026), cut from generated
 * sheets (docs/concepts/2026-10-08-diner-car/art). Pictures without a
 * sticker keep their drawing above.
 */
const ART: Partial<Record<IconName, DinerIconArt>> = {
  burger: 'burger',
  shake: 'shake',
  fries: 'fries',
  pie: 'pie',
  burnt: 'burnt',
  dirty: 'dirty',
  coffee: 'coffee',
  bell: 'bell',
  order: 'menu',
  dots: 'menu',
  eat: 'eat',
  coin: 'coin',
  heart: 'heart',
  token: 'token',
  fuel: 'fuel',
  repair: 'repair',
  mop: 'mop',
  wash: 'wash',
  bin: 'bin',
  music: 'music',
  skate: 'skate',
  tray: 'tray',
  tire: 'tire',
  dice: 'dice',
  map: 'map',
  neon: 'neon',
  crate: 'crate',
  bolt: 'bolt',
  out: 'eye',
  star: 'star',
  hand: 'hand',
  clock: 'clock',
};
export const dinerArt = (name: IconName) => {
  const art = ART[name];
  return art ? dinerIconUrl(art) : null;
};

export function DinerIcon({
  name,
  className,
}: {
  name: IconName;
  className?: string;
}) {
  const art = dinerArt(name);
  if (art)
    return (
      <svg
        className={`diner-icon ${className ?? ''}`}
        viewBox="0 0 48 48"
        aria-hidden="true"
        data-art={name}
      >
        <image
          href={art}
          width="48"
          height="48"
          preserveAspectRatio="xMidYMid meet"
        />
      </svg>
    );
  return (
    <svg
      className={`diner-icon ${className ?? ''}`}
      viewBox="0 0 48 48"
      aria-hidden="true"
      stroke={INK}
      strokeWidth="2.4"
      strokeLinejoin="round"
      strokeLinecap="round"
    >
      {paths[name]}
    </svg>
  );
}
