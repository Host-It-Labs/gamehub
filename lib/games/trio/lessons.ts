import type { GameId } from './engine.ts';
export const lessons: Record<
  GameId,
  { target: string; action: string; title: string; text: string }[]
> = {
  undertow: [
    {
      target: 'hand',
      action: 'pass',
      title: 'Pass cards',
      text: 'Tap the cards you want to pass, then press Pass to lock them.',
    },
    {
      target: 'die',
      action: 'roll',
      title: 'Read the die',
      text: 'The die picks a suit for this round. Its 8 is worth 40 penalty points, or its 4 is worth 20 with the Fast deck.',
    },
    {
      target: 'hand',
      action: 'play',
      title: 'Play a card',
      text: 'Tap a card to play it, or drag it to the table. Follow the led suit if you can.',
    },
  ],
  wildgrove: [
    {
      target: 'die',
      action: 'roll',
      title: 'Read the die',
      text: 'The die limits where you may place this pick. The roller may use any habitat.',
    },
    {
      target: 'hand',
      action: 'select',
      title: 'Pick a creature',
      text: 'Tap a creature or start dragging it. The habitats you may use light up.',
    },
    {
      target: 'board',
      action: 'place',
      title: 'Place it',
      text: 'Tap a lit habitat or drop the creature there. Each habitat scores in its own way.',
    },
    {
      target: 'region-0',
      action: 'inspect',
      title: 'Read a habitat',
      text: 'Press and hold a habitat to see how it scores.',
    },
    {
      target: 'players',
      action: 'opponent',
      title: 'Watch your rivals',
      text: 'Tap a player to see their board.',
    },
  ],
  midnight: [
    {
      target: 'hand',
      action: 'inspect',
      title: 'Read a dish',
      text: 'Press and hold a dish to see how it scores.',
    },
    {
      target: 'hand',
      action: 'play',
      title: 'Keep a dish',
      text: 'Tap a dish to keep it. When everyone has picked, the rest of your hand passes on.',
    },
    {
      target: 'board',
      action: 'inspect',
      title: 'Check your collection',
      text: 'Hold a dish on your board to see its count and points.',
    },
    {
      target: 'players',
      action: 'opponent',
      title: 'Watch the others',
      text: 'Tap a player to see what they collected.',
    },
  ],
};
