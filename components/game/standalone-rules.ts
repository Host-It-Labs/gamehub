import { adventureLessons } from '@/lib/games/adventures/lessons';
import type { StandaloneId } from '@/lib/games/standalone/types';
export type RuleSection = { heading: string; lines: string[] };
export const standaloneRules = Object.fromEntries(
  Object.entries(adventureLessons).map(([id, steps]) => [
    id,
    steps.map((step) => ({ heading: step.title, lines: [step.text] })),
  ]),
) as Record<StandaloneId, RuleSection[]>;
