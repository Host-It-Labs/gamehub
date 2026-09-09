'use client';
import { useId } from 'react';
import { UsersRound } from 'lucide-react';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverTitle,
} from '@/components/ui/popover';
import type { PublicGame } from '@/lib/games/trio/engine';
export function Passing({ g, viewer = 0 }: { g: PublicGame; viewer?: number }) {
  const n = g.players.length,
    step = g.round % 2 ? 1 : n - 1;
  const to = (viewer + step) % n;
  const marker = useId().replace(/:/g, '');
  if (g.phase === 'over') return null;
  const positions = g.players.map((_, i) => {
    const angle = Math.PI / 2 + ((i - viewer) * Math.PI * 2) / n;
    return { x: 180 + Math.cos(angle) * 128, y: 125 + Math.sin(angle) * 85 };
  });
  return (
    <div className="passing-control">
      <span>
        To <b>{g.players[to].name}</b>
      </span>
      <Popover>
        <PopoverTrigger
          className="icon-button seating-trigger"
          openOnHover
          delay={250}
          aria-label="Show table and passing direction"
        >
          <UsersRound size={18} />
        </PopoverTrigger>
        <PopoverContent
          className="seating-popover"
          side="top"
          align="end"
          sideOffset={10}
        >
          <PopoverTitle>At the table</PopoverTitle>
          <svg
            viewBox="0 0 360 260"
            aria-label={`Cards pass ${g.round % 2 ? 'clockwise' : 'counterclockwise'} to ${g.players[to].name}`}
          >
            <defs>
              <marker
                id={marker}
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
              </marker>
            </defs>
            <ellipse cx="180" cy="132" rx="112" ry="72" fill="#d9c5ac" />
            <ellipse
              cx="180"
              cy="125"
              rx="112"
              ry="72"
              fill="#f2e6d3"
              stroke="#d0bda5"
              strokeWidth="2"
            />
            <ellipse cx="180" cy="125" rx="94" ry="55" fill="#7f9781" />
            <text
              x="180"
              y="128"
              textAnchor="middle"
              fill="#fff8ee"
              fontSize="12"
            >
              Round {g.round}
            </text>
            {positions.map((a, i) => {
              const b = positions[(i + step) % n];
              return (
                <path
                  key={i}
                  d={`M ${a.x} ${a.y} Q 180 125 ${b.x} ${b.y}`}
                  fill="none"
                  stroke={i === viewer ? '#70558b' : '#b4aa9860'}
                  strokeWidth={i === viewer ? 3 : 1.5}
                  markerEnd={`url(#${marker})`}
                  style={{ color: i === viewer ? '#70558b' : '#b4aa98' }}
                />
              );
            })}
            {positions.map((p, i) => (
              <g key={i}>
                <circle cx={p.x} cy={p.y + 3} r="17" fill="#d0bda5" />
                <circle
                  cx={p.x}
                  cy={p.y}
                  r="17"
                  fill={
                    i === viewer ? '#70558b' : i === to ? '#577761' : '#fff9ef'
                  }
                  stroke="#fff9ef"
                  strokeWidth="2"
                />
                <text
                  x={p.x}
                  y={p.y + 5}
                  textAnchor="middle"
                  fontSize="13"
                  fill={i === viewer || i === to ? '#fff' : '#554a43'}
                >
                  {i === viewer ? 'You' : i + 1}
                </text>
                <text
                  x={p.x}
                  y={p.y > 125 ? p.y + 34 : p.y - 25}
                  textAnchor="middle"
                  fontSize="11"
                  fill="#554a43"
                >
                  {i === viewer ? 'Your seat' : g.players[i].name.slice(0, 16)}
                </text>
              </g>
            ))}
          </svg>
          <p>
            {g.id === 'undertow'
              ? 'Exchange cards'
              : 'Pass your remaining hand'}{' '}
            with <b>{g.players[to].name}</b>.
          </p>
        </PopoverContent>
      </Popover>
    </div>
  );
}
