'use client';
import { useId, useState } from 'react';
import type { PublicGame } from '@/lib/games/trio/engine';
export function Passing({ g, viewer = 0 }: { g: PublicGame; viewer?: number }) {
  const n = g.players.length,
    step = g.round % 2 ? 1 : n - 1;
  const to = (viewer + step) % n;
  const event = [...g.events]
    .reverse()
    .find((e) => e.type === 'pass' && e.player === -1);
  const [initial] = useState(event?.id);
  const marker = useId().replace(/:/g, '');
  if (g.phase === 'over') return null;
  const positions = g.players.map((_, i) => {
    const angle = Math.PI / 2 + ((i - viewer) * Math.PI * 2) / n;
    return { x: 130 + Math.cos(angle) * 95, y: 44 + Math.sin(angle) * 27 };
  });
  const route = (i: number) => {
    const a = positions[i],
      b = positions[(i + step) % n];
    return `M ${a.x} ${a.y} Q 130 44 ${b.x} ${b.y}`;
  };
  return (
    <div
      className="passing-diagram"
      aria-label={`You are ${g.players[viewer].name}. Cards pass to ${g.players[to].name}.`}
    >
      <svg viewBox="0 0 260 91" aria-label="Seats and passing direction">
        <defs>
          <marker
            id={marker}
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
          </marker>
        </defs>
        <ellipse cx="130" cy="44" rx="69" ry="19" fill="#e6dfd3" />
        {positions.map((_, i) => (
          <path
            key={i}
            d={route(i)}
            fill="none"
            stroke={i === viewer ? '#76509c' : '#c9c0b2'}
            strokeWidth={i === viewer ? 2.5 : 1}
            markerEnd={`url(#${marker})`}
          />
        ))}
        {positions.map((p, i) => (
          <g key={i}>
            <circle
              cx={p.x}
              cy={p.y}
              r="8"
              fill={i === viewer ? '#76509c' : i === to ? '#628366' : '#faf6ee'}
              stroke={i === to ? '#628366' : '#a69a89'}
            />
            <text
              x={p.x}
              y={p.y + 3}
              textAnchor="middle"
              fontSize="8"
              fill={i === viewer || i === to ? 'white' : '#554a43'}
            >
              {i === viewer ? '●' : i + 1}
            </text>
            <text
              x={p.x}
              y={p.y > 44 ? p.y + 18 : p.y - 12}
              textAnchor="middle"
              fontSize="9"
              fill="#554a43"
            >
              {i === viewer ? 'You' : g.players[i].name.slice(0, 14)}
            </text>
          </g>
        ))}
        {event &&
          event.id !== initial &&
          positions.map((_, i) => (
            <rect
              className="moving-packet"
              key={`${event.id}-${i}`}
              x="-4"
              y="-5"
              width="8"
              height="10"
              rx="2"
              fill={i === viewer ? '#76509c' : '#628366'}
              stroke="white"
            >
              <animateMotion path={route(i)} dur="1.1s" fill="freeze" />
              <animate
                attributeName="opacity"
                values="0;1;1;0"
                keyTimes="0;0.1;0.8;1"
                dur="1.1s"
                fill="freeze"
              />
            </rect>
          ))}
      </svg>
      <span>
        You <b>→ {g.players[to].name}</b>
        <small>
          {g.id === 'undertow' ? 'Card exchange' : 'Pass your remaining hand'}
        </small>
      </span>
    </div>
  );
}
