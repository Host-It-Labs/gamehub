'use client';
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

/** One labelled setting: a small label above its control. */
export function SetupRow({
  label,
  Icon,
  note,
  className = '',
  children,
}: {
  label: string;
  Icon?: LucideIcon;
  note?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <fieldset className={`setup-row ${className}`}>
      <legend className="setup-row-label">
        {Icon && <Icon aria-hidden="true" />}
        {label}
      </legend>
      <div className="setup-row-control">
        {children}
        {note && <small className="setup-row-note">{note}</small>}
      </div>
    </fieldset>
  );
}

export type SegmentOption<T> = {
  value: T;
  label: ReactNode;
  /** The accessible name when the label is a picture. */
  name?: string;
  disabled?: boolean;
};

/** One choice from a few, drawn as a single track with a raised thumb. */
export function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
  disabled = false,
  className = '',
}: {
  label: string;
  value: T;
  options: SegmentOption<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <RadioGroup
      aria-label={label}
      disabled={disabled}
      className={`seg ${className}`}
      value={String(value)}
      onValueChange={(v) => {
        const picked = options.find((o) => String(o.value) === v);
        if (picked) onChange(picked.value);
      }}
    >
      {options.map((o) => (
        <label key={String(o.value)} className="seg-option">
          <RadioGroupItem
            value={String(o.value)}
            className="sr-only"
            disabled={o.disabled}
            aria-label={o.name}
          />
          {o.label}
        </label>
      ))}
    </RadioGroup>
  );
}
