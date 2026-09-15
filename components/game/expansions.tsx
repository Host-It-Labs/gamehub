'use client';
import { useRef, useState, type ReactNode } from 'react';
import { Piece } from './interactions';
import { FestivalRules } from './yatai-festival';
import { AbilityRules } from './extension-rules';
import { Popover, PopoverContent, PopoverTitle } from '@/components/ui/popover';

function ExtensionEmblem({ festival }: { festival: boolean }) {
  return <svg className="extension-emblem" viewBox="0 0 96 96" fill="none" aria-hidden="true">
    <circle cx="48" cy="48" r="43" fill={festival ? '#fff0cf' : '#e8eef4'} />
    {festival ? <g stroke="#8c4938" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><path d="M32 25h32M48 17v8M34 71h28M48 71v10"/><path d="M32 28Q20 48 34 68h28Q76 48 64 28Z" fill="#edb45d"/><path d="M42 29q-8 19 0 37m12-37q8 19 0 37M29 47h38"/><path d="m17 23 3 5 5 2-5 2-3 5-2-5-5-2 5-2Z" fill="#8c4938" strokeWidth="1"/></g> : <g stroke="#37566e" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><path d="m29 25 19-7 19 7v22c0 15-19 27-19 27S29 62 29 47Z" fill="#c0d1e0"/><path d="M21 54c9-20 29-20 48-12m-8-12 10 13-15 6" stroke="#37566e"/><path d="M20 78q14-8 28 0t28 0"/></g>}
  </svg>;
}
function ExtensionChoice({ title, enabled, onChange, disabled = false, festival = false, children }: { title: string; enabled: boolean; onChange: (value: boolean) => void; disabled?: boolean; festival?: boolean; children: ReactNode }) {
  const [helpOpen, setHelpOpen] = useState(false);
  const anchor = useRef<HTMLDivElement>(null);
  return <fieldset className="expansion-option expansion-picker" aria-label="Extensions"><legend>Extensions</legend><div className="expansion-entry" ref={anchor}>
    <Piece className={`expansion-choice ${enabled ? 'enabled' : ''}`} label={`${title} expansion. Hold or press I for rules.`} selected={enabled} unavailable={disabled} onTap={disabled ? undefined : () => onChange(!enabled)} inspect={() => setHelpOpen(true)}><ExtensionEmblem festival={festival}/><span>{title}</span>{enabled && <span className="expansion-check" aria-hidden="true">✓</span>}</Piece>
    <Popover open={helpOpen} onOpenChange={setHelpOpen}><PopoverContent anchor={anchor} className="expansion-help" align="start"><PopoverTitle>{title}</PopoverTitle>{children}</PopoverContent></Popover>
  </div></fieldset>;
}
export function ExpansionChoice(props: { enabled: boolean; onChange: (value: boolean) => void; fastMode?: boolean; disabled?: boolean }) {
  return <ExtensionChoice {...props} title="Change of Tack"><h3>Shield</h3><AbilityRules kind="shield"/><h3>Tack</h3><AbilityRules kind="tack"/></ExtensionChoice>;
}
export function FestivalExpansionChoice(props: { enabled: boolean; onChange: (value: boolean) => void; disabled?: boolean }) {
  return <ExtensionChoice {...props} title="Lantern Festival" festival><FestivalRules/></ExtensionChoice>;
}
