'use client';
import type { PublicGame } from '@/lib/games/trio/engine';
const description =
  'Two shields per round halve a captured trick (round up). One Calm cancels its highest Storm card. Arm before playing; tokens are spent even if you lose. Calm applies before the shield and never cancels the dangerous 9.';
export function ExpansionChoice({
  enabled,
  onChange,
  disabled = false,
}: {
  enabled: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset className="expansion-picker">
      <legend>Expansions</legend>
      <div className="expansion-option">
        <label
          aria-label="Enable Safe Harbour expansion"
          className={`expansion-choice ${enabled ? 'enabled' : ''}`}
        >
          <input
            type="checkbox"
            checked={enabled}
            disabled={disabled}
            onChange={(e) => onChange(e.target.checked)}
          />
          <img src="/art/safe-harbour-v6.png" alt="" />
          <span>
            <strong>Safe Harbour</strong>
            <small>{enabled ? 'Enabled' : 'Add expansion'}</small>
          </span>
        </label>
        <details
          className="expansion-info"
          onPointerEnter={(e) => {
            if (e.pointerType === 'mouse') e.currentTarget.open = true;
          }}
          onPointerLeave={(e) => {
            if (e.pointerType === 'mouse') e.currentTarget.open = false;
          }}
        >
          <summary aria-label="About Safe Harbour">i</summary>
          <p>{description}</p>
        </details>
      </div>
    </fieldset>
  );
}
export function ExpansionBadge({ g }: { g: PublicGame }) {
  if (g.id !== 'undertow') return null;
  if (!g.starter)
    return (
      <span className="expansion-badge">
        {g.starter === undefined ? 'Legacy shields' : 'Base game'}
      </span>
    );
  return (
    <details
      className="expansion-info expansion-badge"
      onPointerEnter={(e) => {
        if (e.pointerType === 'mouse') e.currentTarget.open = true;
      }}
      onPointerLeave={(e) => {
        if (e.pointerType === 'mouse') e.currentTarget.open = false;
      }}
    >
      <summary>
        <img src="/art/safe-harbour-v6.png" alt="" />
        Safe Harbour <span>i</span>
      </summary>
      <p>{description}</p>
    </details>
  );
}
