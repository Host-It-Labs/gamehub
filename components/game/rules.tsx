import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Every How to play and every rule inspection on the site follows Arena's
 * pattern: a few short sections, each a two-to-four word heading and one or
 * two short paragraphs with the key words in bold. Limits and exceptions go
 * in one purple note at the end of a section. Games tint it with the
 * `--rules-*` tokens (see `app/globals.css`); they never restyle its rhythm.
 */
export function Rules({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn('rules', className)}>{children}</div>;
}

/** One idea: a short heading, a short paragraph or two, an optional note. */
export function RuleSection({
  title,
  children,
  note,
  className,
}: {
  /** Left out where the dialog title already names it, as in an inspection. */
  title?: ReactNode;
  children?: ReactNode;
  note?: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('rule-section', className)}>
      {title && <h3>{title}</h3>}
      {children}
      {note && <p className="rule-note">{note}</p>}
    </section>
  );
}

export type RuleListItem = {
  key?: string;
  /** A small picture or symbol shown beside the name. */
  mark?: ReactNode;
  name: ReactNode;
  text: ReactNode;
};

/** A compact reference list (cards, dishes, habitats, puzzles): a name and one line each. */
export function RuleList({
  items,
  className,
}: {
  items: RuleListItem[];
  className?: string;
}) {
  return (
    <ul className={cn('rule-list', className)}>
      {items.map((item, i) => (
        <li key={item.key ?? i} data-marked={item.mark ? '' : undefined}>
          {item.mark && <span className="rule-list-mark">{item.mark}</span>}
          <b>{item.name}</b>
          <small>{item.text}</small>
        </li>
      ))}
    </ul>
  );
}
