'use client';
import { ArrowRightLeft, Users } from 'lucide-react';
import { groups, teamNames, validTeams } from '@/lib/games/party/groups';

export function TeamPicker({ names, teams, onChange, disabled = false, labels = teamNames }: {
  names: string[]; teams?: number[]; onChange: (teams: number[]) => void;
  disabled?: boolean; labels?: string[];
}) {
  const assigned = validTeams(teams, names.length) ? teams : groups(names.length, 'teams');
  function transfer(seat: number) {
    const next = [...assigned], previous = next[seat], team = 1 - previous;
    if (next.filter(t => t === previous).length === 1) next[next.findIndex(t => t === team)] = previous;
    next[seat] = team;
    onChange(next);
  }
  return <fieldset className="compartment team-picker" disabled={disabled}>
    <legend>Choose teams</legend>
    <div className="team-picker-columns">{labels.map((label, team) => <section className={`team-picker-side team-${team}`} key={team}>
      <header><Users size={18} /><strong>{label}</strong><span>{assigned.filter(t => t === team).length}</span></header>
      <div>{names.map((name, seat) => assigned[seat] === team && <button type="button" key={seat} onClick={() => transfer(seat)} aria-label={`Move ${name} to ${labels[1 - team]}`}>
        <span className="team-picker-avatar" aria-hidden="true">{name.slice(0, 1)}</span><b>{name}</b><ArrowRightLeft size={16} aria-hidden="true" />
      </button>)}</div>
    </section>)}</div>
    <small>{disabled ? 'The host chooses the teams.' : 'Tap a player to switch teams. The last player swaps sides with another player.'}</small>
  </fieldset>;
}
