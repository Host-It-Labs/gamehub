/** Ten Coins prompts: four things a player shares ten coins between, the way
 * they really are. Each prompt is about the player, every option is
 * something a reasonable person could pile coins on, and none is the
 * obvious right answer, so the split says how much as well as what. Options
 * stay short enough for a phone row. No brands. Ids are row positions, so
 * rows are only ever appended or retired. */
export type CoinPrompt = {
  id: number;
  text: string;
  options: [string, string, string, string];
  retired?: true;
};
const rows: [string, [string, string, string, string]][] = [
  ['A perfect weekend', ['Sleep', 'Friends', 'Adventure', 'Food']],
  ['Your dream holiday', ['Beach', 'City', 'Mountains', 'Road trip']],
  ['What you want from a job', ['Money', 'Meaning', 'Free time', 'Good team']],
  ['A perfect evening in', ['A film', 'Cooking', 'A game', 'Early night']],
  ['What makes a great party', ['Music', 'Food', 'The people', 'Dancing']],
  ['Your ideal home', ['Location', 'Space', 'Light', 'A garden']],
  [
    'How you spend a surprise windfall',
    ['Travel', 'Save it', 'Treat myself', 'Give it away'],
  ],
  [
    'What you look for in a friend',
    ['Funny', 'Loyal', 'Honest', 'Adventurous'],
  ],
  ['A great meal out', ['The food', 'The company', 'The place', 'The price']],
  ['How you unwind', ['Music', 'Exercise', 'A screen', 'Nature']],
  [
    'What you’d bring to a desert island',
    ['Books', 'Music', 'Tools', 'Snacks'],
  ],
  ['A perfect birthday', ['Big party', 'Small dinner', 'A trip', 'Quiet day']],
  ['Your morning', ['Sleeping in', 'Breakfast', 'Exercise', 'Phone']],
  ['What makes a film great', ['Story', 'Actors', 'Music', 'Visuals']],
  [
    'Your superpower wish list',
    ['Flying', 'Invisibility', 'Mind reading', 'Time travel'],
  ],
  [
    'What you’d want to be famous for',
    ['Talent', 'Kindness', 'Inventions', 'Being funny'],
  ],
  ['A good holiday day', ['Exploring', 'Lazing', 'Eating', 'Partying']],
  ['How you show you care', ['Gifts', 'Time', 'Words', 'Help']],
  ['How you like to be shown care', ['Gifts', 'Time', 'Words', 'Help']],
  ['Your perfect pet', ['Dog', 'Cat', 'Something odd', 'No pet']],
  ['What wins an argument', ['Facts', 'Volume', 'Charm', 'Stubbornness']],
  ['Your screen time', ['Videos', 'Messages', 'Games', 'News']],
  ['Where your money goes', ['Food', 'Clothes', 'Going out', 'Hobbies']],
  ['A perfect Sunday lunch', ['Roast', 'Brunch', 'Picnic', 'Takeaway']],
  ['What you’d rather have more of', ['Time', 'Money', 'Energy', 'Friends']],
  ['A great teacher is', ['Funny', 'Strict', 'Kind', 'Brilliant']],
  ['What scares you', ['Heights', 'Spiders', 'The dark', 'Public speaking']],
  ['Your music taste', ['Pop', 'Rock', 'Hip-hop', 'Something old']],
  ['How you travel', ['Plane', 'Train', 'Car', 'Bike']],
  ['A good date', ['Dinner', 'Activity', 'Long walk', 'Cosy night in']],
  ['What makes you laugh', ['Silly', 'Clever', 'Dark', 'Awkward']],
  ['What makes a great city', ['Food', 'Nightlife', 'Culture', 'Parks']],
  ['Your weekly treat', ['Sweets', 'Takeaway', 'Shopping', 'A lie-in']],
  ['What gets you out of bed', ['Coffee', 'Duty', 'Plans', 'Hunger']],
  [
    'Your secret talent pool',
    ['Cooking', 'Singing', 'Fixing things', 'Remembering'],
  ],
  ['How you handle stress', ['Talk it out', 'Keep busy', 'Hide away', 'Snack']],
  ['A perfect summer', ['Sun', 'Festivals', 'Travel', 'Doing nothing']],
  ['A perfect winter', ['Snow', 'Cosy evenings', 'Holidays', 'Hibernating']],
  ['What you notice first in a room', ['People', 'Smell', 'Mess', 'Music']],
  ['Your group role', ['Planner', 'Joker', 'Listener', 'Wildcard']],
  [
    'What you’d save in a fire, people safe',
    ['Photos', 'Laptop', 'Keepsakes', 'Phone'],
  ],
  [
    'What makes a great game night',
    ['Winning', 'Snacks', 'Chatting', 'The game'],
  ],
  [
    'What you’d learn with free time',
    ['A language', 'An instrument', 'A sport', 'To cook'],
  ],
  ['Your ideal car trip', ['Music loud', 'Deep talk', 'Snacks', 'Sleeping']],
  ['How you pick a restaurant', ['Reviews', 'Photos', 'Price', 'Gut feeling']],
  ['What you’d splurge on', ['Shoes', 'Tech', 'Food', 'Experiences']],
  ['A good book needs', ['Plot twists', 'Characters', 'Romance', 'Ideas']],
  [
    'How you’d spend a free year',
    ['Travel', 'Study', 'Build something', 'Rest'],
  ],
  ['Your perfect breakfast', ['Sweet', 'Savoury', 'Fruit', 'Coffee only']],
  ['Where your mind wanders', ['Food', 'Plans', 'Worries', 'Daydreams']],
  ['What you need on a long flight', ['Sleep', 'Films', 'Snacks', 'Legroom']],
  ['A great neighbour', ['Quiet', 'Friendly', 'Helpful', 'Invisible']],
  ['Your shopping style', ['Bargains', 'Quality', 'Impulse', 'Lists']],
  ['What makes a home cosy', ['Blankets', 'Candles', 'Plants', 'People']],
  [
    'How you’d survive a zombie film',
    ['Hiding', 'Fighting', 'Running', 'Talking'],
  ],
  ['Your dream festival', ['Music', 'Food', 'Art', 'Camping']],
  [
    'What a perfect day off needs',
    ['No alarm', 'Sunshine', 'Good food', 'No phone'],
  ],
  ['How you make decisions', ['Lists', 'Gut', 'Ask friends', 'Coin flip']],
  [
    'What you’d bring to a potluck',
    ['Dessert', 'Main dish', 'Drinks', 'Crisps'],
  ],
  ['Your workout', ['Gym', 'Running', 'Team sport', 'Walking']],
];
export const coinPrompts: CoinPrompt[] = rows.map(([text, options], id) => ({
  id,
  text,
  options,
}));
export const liveCoinIds = coinPrompts.flatMap((p) =>
  p.retired ? [] : [p.id],
);
