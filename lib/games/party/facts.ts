import data from './facts.json' with { type: 'json' };
export const facts = data;
export type FactCard = (typeof facts)[number];
