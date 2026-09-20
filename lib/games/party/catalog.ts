/** Original prompts: everyday experiences, nature and imagination; no brands,
 * celebrities, national trivia or purported survey statistics. */
export type Topic = {
  id: number;
  title: string;
  category: string;
  answers: string[];
};
const rows: [string, string, string][] = [
  [
    'Everyday',
    'The best way to spend a free hour',
    'Read a book|Take a walk|Have a nap|Cook something|Call a friend|Draw a picture',
  ],
  [
    'Everyday',
    'Small things that make a morning better',
    'Fresh air|Warm drink|Quiet room|Good music|A long shower|A friendly message',
  ],
  [
    'Everyday',
    'The most annoying little inconvenience',
    'Wet socks|Low battery|A squeaky door|A lost key|A slow queue|A tangled cable',
  ],
  [
    'Everyday',
    'The best sounds to fall asleep to',
    'Rain|Waves|Wind in trees|A fan|A crackling fire|Silence',
  ],
  [
    'Everyday',
    'The nicest surprise to come home to',
    'A clean kitchen|A cooked meal|Fresh flowers|A handwritten note|A happy pet|A parcel',
  ],
  [
    'Everyday',
    'The most satisfying tiny victory',
    'Fixing something|Finding lost money|Catching a train|Finishing a puzzle|Growing a plant|Clearing your inbox',
  ],
  [
    'Everyday',
    'Things worth waking up early for',
    'Sunrise|An empty beach|A trip|Fresh bread|A quiet walk|Time to yourself',
  ],
  [
    'Everyday',
    'The best place to read',
    'In bed|Under a tree|By a window|On a train|In a library|On a balcony',
  ],
  [
    'Everyday',
    'The most useful thing in a pocket',
    'A key|A tissue|A coin|A pen|A small torch|A phone',
  ],
  [
    'Everyday',
    'Chores you mind the least',
    'Washing dishes|Sweeping|Watering plants|Folding clothes|Cooking|Organising shelves',
  ],
  [
    'Everyday',
    'The best rainy-day activity',
    'Bake|Play a game|Watch a film|Make something|Read|Take a nap',
  ],
  [
    'Everyday',
    'The most comforting smell',
    'Fresh bread|Rain on earth|Clean laundry|Citrus peel|Wood smoke|Fresh herbs',
  ],
  [
    'Everyday',
    'The best thing about a day off',
    'No alarm|No schedule|A long breakfast|Seeing friends|Going somewhere new|Doing nothing',
  ],
  [
    'Everyday',
    'The hardest thing to lend someone',
    'A favourite book|Your phone|Your bicycle|A treasured jumper|Your headphones|Your last pen',
  ],
  [
    'Everyday',
    'Things that deserve a bigger button',
    'Undo|Mute|Pause|Find my keys|Skip the queue|Start again',
  ],
  [
    'Everyday',
    'The nicest kind of light',
    'Sunrise|Candlelight|Moonlight|A reading lamp|Firelight|Late afternoon sun',
  ],
  [
    'Food',
    'The best fruit to eat fresh',
    'Apple|Banana|Mango|Strawberry|Orange|Watermelon',
  ],
  [
    'Food',
    'The best texture in a snack',
    'Crunchy|Creamy|Chewy|Fluffy|Crispy|Juicy',
  ],
  [
    'Food',
    'The best thing to share at a picnic',
    'Bread|Fruit|Cheese|Nuts|Cake|Salad',
  ],
  [
    'Food',
    'The best flavour in a dessert',
    'Chocolate|Vanilla|Lemon|Caramel|Coconut|Coffee',
  ],
  [
    'Food',
    'The best food on a cold day',
    'Soup|Baked potatoes|Stew|Warm bread|Noodles|Porridge',
  ],
  [
    'Food',
    'The best breakfast ingredient',
    'Eggs|Bread|Yoghurt|Fruit|Oats|Cheese',
  ],
  [
    'Food',
    'The most useful kitchen tool',
    'Knife|Spoon|Pan|Chopping board|Grater|Colander',
  ],
  [
    'Food',
    'The best thing to grow to eat',
    'Tomatoes|Strawberries|Basil|Carrots|Lettuce|Peas',
  ],
  [
    'Food',
    'The best thing to put on bread',
    'Butter|Cheese|Jam|Honey|Hummus|Chocolate spread',
  ],
  [
    'Food',
    'The best refreshing drink',
    'Cold water|Fruit juice|Iced tea|Lemon water|Sparkling water|Smoothie',
  ],
  ['Food', 'The best cooking method', 'Roast|Steam|Grill|Bake|Stir-fry|Simmer'],
  [
    'Food',
    'The best shape for a biscuit',
    'Circle|Star|Heart|Square|Crescent|Animal',
  ],
  [
    'Food',
    'Foods you would take on a walk',
    'Apple|Nuts|Sandwich|Dried fruit|Crackers|Banana',
  ],
  [
    'Food',
    'The best addition to a salad',
    'Cucumber|Tomato|Avocado|Nuts|Cheese|Olives',
  ],
  [
    'Food',
    'The best way to eat a potato',
    'Roasted|Mashed|Baked|Fried|In soup|In salad',
  ],
  [
    'Food',
    'The most inviting food colour',
    'Golden brown|Bright red|Leaf green|Cream white|Deep purple|Sunny yellow',
  ],
  [
    'Nature',
    'The best view from a window',
    'Mountains|Sea|Forest|Garden|River|Open fields',
  ],
  [
    'Nature',
    'Animals you would like to watch',
    'Otters|Penguins|Elephants|Dolphins|Foxes|Owls',
  ],
  [
    'Nature',
    'The best natural place to explore',
    'Forest|Beach|Cave|Mountain|Lake|Desert',
  ],
  [
    'Nature',
    'The most impressive kind of weather',
    'Thunderstorm|Snowfall|Fog|Rainbow|Heavy rain|Strong wind',
  ],
  [
    'Nature',
    'The best thing to find on a walk',
    'A waterfall|A wildflower|An animal track|A great view|An old tree|A hidden path',
  ],
  [
    'Nature',
    'The most calming movement',
    'Waves rolling|Leaves swaying|Clouds drifting|Snow falling|Fish swimming|A stream flowing',
  ],
  [
    'Nature',
    'Animals that would make good guides',
    'Dog|Owl|Dolphin|Elephant|Horse|Fox',
  ],
  [
    'Nature',
    'The most beautiful thing in the night sky',
    'Full moon|Stars|Meteor shower|Aurora|A comet|A crescent moon',
  ],
  [
    'Nature',
    'The best small garden feature',
    'Pond|Flower bed|Herb pots|Fruit tree|Bird bath|Hammock',
  ],
  [
    'Nature',
    'The best thing about a beach',
    'Swimming|Sand|Waves|Shells|Sea air|Sunset',
  ],
  [
    'Nature',
    'The most fascinating tiny creature',
    'Ant|Bee|Butterfly|Spider|Ladybird|Snail',
  ],
  [
    'Nature',
    'The best place to sit outside',
    'Under a tree|On a rock|By water|On grass|On a bench|In a hammock',
  ],
  [
    'Nature',
    'The best thing to collect on a nature walk',
    'Leaves|Stones|Shells|Pine cones|Photographs|Memories',
  ],
  [
    'Nature',
    'The most inviting landscape colour',
    'Ocean blue|Forest green|Sand gold|Snow white|Clay red|Lavender purple',
  ],
  [
    'Nature',
    'The best animal ability to borrow',
    'Flight|Night vision|Breathing underwater|Camouflage|Echolocation|Regrowing a limb',
  ],
  [
    'Nature',
    'The nicest thing after rain',
    'A rainbow|Fresh air|Puddles|Dripping leaves|Soft light|The smell of earth',
  ],
  [
    'Travel',
    'The best part of a journey',
    'Planning|Leaving|The view|Arriving|Meeting people|Coming home',
  ],
  [
    'Travel',
    'The best way to explore a new place',
    'Walk|Cycle|Take a boat|Ride a train|Join a guide|Wander without a map',
  ],
  [
    'Travel',
    'The best place to stay for a night',
    'Treehouse|Tent|Cabin|Boat|Small hotel|Mountain hut',
  ],
  [
    'Travel',
    'The most useful travel companion item',
    'Map|Water bottle|Notebook|Camera|Raincoat|Comfortable shoes',
  ],
  [
    'Travel',
    'The nicest souvenir',
    'Photograph|Recipe|Stone|Postcard|Handmade object|A new friendship',
  ],
  [
    'Travel',
    'The best activity beside a lake',
    'Swim|Read|Paddle|Picnic|Walk|Watch birds',
  ],
  [
    'Travel',
    'The most tempting path',
    'Through trees|Along cliffs|Beside a river|Up a hill|Across a meadow|Into a village',
  ],
  [
    'Travel',
    'The best thing to do with no timetable',
    'Explore|Eat slowly|Sleep|Talk|People-watch|Make a detour',
  ],
  [
    'Travel',
    'The most important thing on a long journey',
    'Comfort|Good company|Scenery|Snacks|Music|Sleep',
  ],
  [
    'Travel',
    'Places you would like to see from above',
    'Coastline|City|Forest|Desert|Mountains|Islands',
  ],
  [
    'Travel',
    'The best slow adventure',
    'A long walk|A cycle trip|A canoe trip|A train journey|A sailing trip|A camping weekend',
  ],
  [
    'Travel',
    'The best place for a secret hideaway',
    'Tree canopy|Cliffside|Lakeshore|Cave|Rooftop|Small island',
  ],
  [
    'Travel',
    'The worst thing to forget on a trip',
    'Shoes|Toothbrush|Charger|Raincoat|Glasses|A book',
  ],
  [
    'Travel',
    'The best time to explore a city',
    'Early morning|Late morning|Midday|Afternoon|Sunset|After dark',
  ],
  [
    'Travel',
    'The most useful skill when travelling',
    'Reading maps|Learning words|Packing lightly|Staying calm|Making friends|Fixing things',
  ],
  [
    'Travel',
    'The best seat on a journey',
    'By the window|Near the door|In the shade|Beside a friend|At the front|With extra legroom',
  ],
  [
    'Imagination',
    'The best superpower for ordinary life',
    'Teleportation|Flying|Talking to animals|Pausing time|Instant tidying|Perfect memory',
  ],
  [
    'Imagination',
    'The best magical door destination',
    'A floating island|An underwater city|A giant library|A moon garden|An enchanted forest|A cloud palace',
  ],
  [
    'Imagination',
    'The best job for a friendly robot',
    'Cook|Gardener|Cleaner|Translator|Pet sitter|Travel guide',
  ],
  [
    'Imagination',
    'The best tiny dragon talent',
    'Lighting candles|Warming tea|Finding keys|Delivering notes|Singing|Growing flowers',
  ],
  [
    'Imagination',
    'The best impossible pet',
    'Pocket elephant|Tiny dragon|Glowing jellyfish|Cloud cat|Talking turtle|Miniature whale',
  ],
  [
    'Imagination',
    'The best room in a magical house',
    'Library|Greenhouse|Observatory|Pool|Workshop|Kitchen',
  ],
  [
    'Imagination',
    'The best thing to make pocket-sized',
    'Bicycle|Bed|Kitchen|Garden|Boat|Library',
  ],
  [
    'Imagination',
    'The best thing to make enormous',
    'A flower|A treehouse|A bubble|A book|A cushion|A strawberry',
  ],
  [
    'Imagination',
    'The best material for a fantasy bridge',
    'Glass|Vines|Clouds|Ice|Giant leaves|Light',
  ],
  [
    'Imagination',
    'The best way to travel through a dream',
    'Fly|Sail|Float in a bubble|Ride a giant bird|Walk through doors|Surf on clouds',
  ],
  [
    'Imagination',
    'The best gift from a wizard',
    'A healing song|A self-filling cup|A flying carpet|A weather charm|A talking book|An endless pocket',
  ],
  [
    'Imagination',
    'The best imaginary sport',
    'Cloud jumping|Dragon racing|Bubble tennis|Moon football|Flying swimming|Invisible hide-and-seek',
  ],
  [
    'Imagination',
    'The best thing for trees to grow',
    'Books|Lanterns|Biscuits|Musical notes|Blankets|Tiny houses',
  ],
  [
    'Imagination',
    'The best talking object to own',
    'Mirror|Shoes|Kettle|Bicycle|Notebook|Umbrella',
  ],
  [
    'Imagination',
    'The best animal to swap bodies with for a day',
    'Eagle|Dolphin|Cat|Otter|Horse|Butterfly',
  ],
  [
    'Imagination',
    'The best place for a floating home',
    'Above a forest|Above a city|Above the sea|Above mountains|Above a lake|Among clouds',
  ],
  [
    'People',
    'The best quality in a teammate',
    'Patience|Creativity|Honesty|Humour|Courage|Reliability',
  ],
  [
    'People',
    'The best way to help a tired friend',
    'Listen|Make a meal|Give them space|Help with chores|Take them outside|Make them laugh',
  ],
  [
    'People',
    'The best gift that costs nothing',
    'Your time|A kind note|A shared memory|A favour|A song|A good conversation',
  ],
  [
    'People',
    'The best group activity',
    'Cook together|Walk together|Play a game|Make music|Build something|Tell stories',
  ],
  [
    'People',
    'The best compliment to receive',
    'You are kind|You are funny|You are thoughtful|You are creative|You are dependable|You are brave',
  ],
  [
    'People',
    'The best role on an imaginary expedition',
    'Navigator|Cook|Medic|Scout|Inventor|Storyteller',
  ],
  [
    'People',
    'The best way to welcome someone',
    'Offer a drink|Introduce everyone|Show them around|Ask a question|Share food|Give them a comfortable seat',
  ],
  [
    'People',
    'The best thing to teach a friend',
    'A recipe|A language|A craft|A game|A useful repair|A dance',
  ],
  [
    'People',
    'The best reason to celebrate',
    'Finishing a project|Reuniting|Learning something|Helping someone|Trying something scary|An ordinary good day',
  ],
  [
    'People',
    'The best shared challenge',
    'Build a shelter|Solve a puzzle|Cook a feast|Make a short film|Grow a garden|Plan a surprise',
  ],
  [
    'People',
    'The most useful group skill',
    'Listening|Planning|Encouraging|Improvising|Explaining|Noticing details',
  ],
  [
    'People',
    'The best way to keep a memory',
    'Photograph|Diary|Drawing|Voice recording|Keepsake|Story',
  ],
  ['Play', 'The most fun way to move', 'Dance|Swim|Cycle|Climb|Run|Skate'],
  [
    'Play',
    'The best thing to build',
    'Treehouse|Sandcastle|Paper plane|Snow sculpture|Model boat|Blanket fort',
  ],
  [
    'Play',
    'The best puzzle ingredient',
    'Patterns|Words|Numbers|Pictures|Logic|Hidden objects',
  ],
  [
    'Play',
    'The best tool for making art',
    'Pencil|Paintbrush|Clay|Camera|Scissors|Needle and thread',
  ],
  [
    'Play',
    'The best thing to do with an empty box',
    'Make a castle|Make a mask|Store treasures|Make a puppet theatre|Make a robot|Make a maze',
  ],
  [
    'Play',
    'The best toy without batteries',
    'Ball|Kite|Spinning top|Building blocks|Skipping rope|Yo-yo',
  ],
  [
    'Play',
    'The best skill to learn instantly',
    'Play an instrument|Speak a language|Dance|Draw|Juggle|Sing',
  ],
  [
    'Play',
    'The best kind of story',
    'Mystery|Adventure|Comedy|Fantasy|Romance|Science fiction',
  ],
  [
    'Play',
    'The best game-night snack property',
    'Easy to share|Not sticky|Quiet to eat|Crunchy|Sweet|Savoury',
  ],
  [
    'Play',
    'The best harmless competition',
    'Paper-plane flight|Sandcastle building|Puzzle solving|Silly drawing|Stone skipping|Guessing sounds',
  ],
  [
    'Play',
    'The best thing to make from paper',
    'Boat|Flower|Animal|Lantern|Aeroplane|Crown',
  ],
  [
    'Play',
    'The most fun thing to balance',
    'Stones|Books|A spoon|A ball|Blocks|A feather',
  ],
  [
    'Home',
    'The best thing in a cosy room',
    'Soft blanket|Warm lamp|Comfortable chair|Bookshelf|Plants|Thick rug',
  ],
  [
    'Home',
    'The most useful extra room',
    'Workshop|Library|Greenhouse|Music room|Guest room|Exercise room',
  ],
  [
    'Home',
    'The best thing on a balcony',
    'Plants|A chair|A hammock|A little table|Lanterns|A bird feeder',
  ],
  [
    'Home',
    'The best colour for a front door',
    'Red|Blue|Green|Yellow|Purple|Natural wood',
  ],
  [
    'Home',
    'The best place for a nap',
    'Hammock|Sofa|Bed|Shady grass|Window seat|Reclining chair',
  ],
  [
    'Home',
    'The most useful thing to learn to repair',
    'Clothes|Bicycle|Furniture|A leaking tap|A lamp|A bag',
  ],
  [
    'Home',
    'The best shape for a window',
    'Circle|Arch|Square|Tall rectangle|Hexagon|Wide rectangle',
  ],
  [
    'Home',
    'The best thing about a small home',
    'Easy to clean|Everything nearby|Cosy corners|Fewer things|Lower upkeep|Creative storage',
  ],
  [
    'Home',
    'The best thing to hang on a wall',
    'A painting|A map|A mirror|Photographs|A handmade object|A plant',
  ],
  [
    'Home',
    'The best houseplant feature',
    'Big leaves|Flowers|Nice scent|Easy care|Interesting shape|Edible leaves',
  ],
  [
    'Home',
    'The most important feature of a chair',
    'Comfort|Sturdiness|Softness|Light weight|Good looks|Ability to fold',
  ],
  [
    'Home',
    'The best object to inherit',
    'A recipe book|A handmade quilt|A musical instrument|A watch|A photograph album|A tool set',
  ],
];
export const topics: Topic[] = rows.map(([category, title, answers], id) => ({
  id,
  category,
  title,
  answers: answers.split('|'),
}));
