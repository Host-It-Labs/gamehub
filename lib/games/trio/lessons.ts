import type { GameId } from './engine.ts';
export const lessons: Record<
  GameId,
  { target: string; action: string; title: string; text: string }[]
> = {
  undertow: [
    {
      target: 'hand',
      action: 'pass',
      title: 'Choose your pass',
      text: 'Select the required number of cards, then lock your pass to exchange them with another player.',
    },
    {
      target: 'die',
      action: 'roll',
      title: 'Reveal the hazard',
      text: 'The die rolls automatically. The 8 of the suit shown (4 in Fast mode) is worth 40 points, or 10 points in Fast mode.',
    },
    {
      target: 'hand',
      action: 'play',
      title: 'Play to the trick',
      text: 'Select a card and confirm, or drag it onto the table and confirm. You must match the first card’s suit if you have a card of that suit.',
    },
  ],
  wildgrove: [
    {
      target: 'die',
      action: 'roll',
      title: 'Check the placement die',
      text: 'The die rolls automatically. Its placement rule applies to everyone except the player marked ROLLER.',
    },
    {
      target: 'hand',
      action: 'select',
      title: 'Pick a creature',
      text: 'Tap a creature, or drag it toward the board. Its legal homes will light up.',
    },
    {
      target: 'board',
      action: 'place',
      title: 'Choose a home',
      text: 'Tap a highlighted habitat or drop your creature there, then confirm. Each habitat has its own scoring rule.',
    },
    {
      target: 'region-0',
      action: 'inspect',
      title: 'Explore the scoring',
      text: 'Press and hold a habitat for a closer look. You can also tap its information button.',
    },
    {
      target: 'players',
      action: 'opponent',
      title: 'Read your rivals',
      text: 'Tap a player to see their board. On desktop, hovering also gives a preview.',
    },
  ],
  midnight: [
    {
      target: 'hand',
      action: 'inspect',
      title: 'Read a dish',
      text: 'Press and hold a card to enlarge it and see how it scores.',
    },
    {
      target: 'hand',
      action: 'play',
      title: 'Keep a dish',
      text: 'Select a card and confirm to keep it. After everyone chooses, the remaining cards pass to the next player.',
    },
    {
      target: 'board',
      action: 'inspect',
      title: 'Check your collection',
      text: 'Hold a dish on the board to see its count, points, and scoring rule.',
    },
    {
      target: 'players',
      action: 'opponent',
      title: 'Check the competition',
      text: 'Tap a player to view their collection. Check the scoring rule: different menus reward different collections.',
    },
  ],
};
