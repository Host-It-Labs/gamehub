/** Order: players sort five things by a measure. Items are listed in the
 * correct order, and neighbours sit far enough apart (roughly 15% or ten
 * years) that sources never disagree on the answer. The value shows at the
 * reveal. Ids are row positions, so rows are only ever appended or retired. */
export type OrderItem = { name: string; value: string };
export type OrderSet = {
  id: number;
  title: string;
  items: OrderItem[];
  fact: string;
  retired?: true;
};
const rows: [string, [string, string][], string][] = [
  [
    'Tallest first',
    [
      ['Burj Khalifa', '828 m'],
      ['Shanghai Tower', '632 m'],
      ['Petronas Towers', '452 m'],
      ['Eiffel Tower', '330 m'],
      ['Statue of Liberty', '93 m'],
    ],
    'The Burj Khalifa is two and a half times as tall as the Eiffel Tower.',
  ],
  [
    'Highest first',
    [
      ['Everest', '8,849 m'],
      ['Aconcagua', '6,961 m'],
      ['Kilimanjaro', '5,895 m'],
      ['Mont Blanc', '4,806 m'],
      ['Mount Fuji', '3,776 m'],
    ],
    'Aconcagua, in Argentina, is the highest mountain outside Asia.',
  ],
  [
    'Longest first',
    [
      ['Yangtze', '6,300 km'],
      ['Congo', '4,700 km'],
      ['Danube', '2,850 km'],
      ['Rhine', '1,230 km'],
      ['Thames', '346 km'],
    ],
    'The Danube flows through ten countries, more than any other river.',
  ],
  [
    'Most people first',
    [
      ['United States', '340 million'],
      ['Brazil', '212 million'],
      ['Japan', '124 million'],
      ['Germany', '84 million'],
      ['Canada', '41 million'],
    ],
    "Japan's population has been shrinking for more than a decade.",
  ],
  [
    'Biggest first',
    [
      ['Russia', '17.1 million km²'],
      ['Canada', '10.0 million km²'],
      ['Australia', '7.7 million km²'],
      ['India', '3.3 million km²'],
      ['Egypt', '1.0 million km²'],
    ],
    'Russia is so wide that it spans eleven time zones.',
  ],
  [
    'Furthest north first',
    [
      ['Reykjavik', '64.1° N'],
      ['Moscow', '55.8° N'],
      ['Beijing', '39.9° N'],
      ['Mumbai', '19.1° N'],
      ['Singapore', '1.3° N'],
    ],
    'Reykjavik is the most northerly capital of any independent country.',
  ],
  [
    'Furthest south first',
    [
      ['Wellington', '41.3° S'],
      ['Buenos Aires', '34.6° S'],
      ['Johannesburg', '26.2° S'],
      ['Lima', '12.0° S'],
      ['Nairobi', '1.3° S'],
    ],
    'Wellington is the most southerly capital of any independent country.',
  ],
  [
    'Furthest west first',
    [
      ['Lisbon', '9.1° W'],
      ['Madrid', '3.7° W'],
      ['Paris', '2.4° E'],
      ['Berlin', '13.4° E'],
      ['Moscow', '37.6° E'],
    ],
    'Lisbon is the most westerly capital on mainland Europe.',
  ],
  [
    'Furthest west first',
    [
      ['Los Angeles', '118.2° W'],
      ['New York', '74.0° W'],
      ['London', '0.1° W'],
      ['Dubai', '55.3° E'],
      ['Tokyo', '139.7° E'],
    ],
    'London sits almost exactly on the Prime Meridian, the line of 0°.',
  ],
  [
    'Closest to the Sun first',
    [
      ['Mercury', '58 million km'],
      ['Venus', '108 million km'],
      ['Earth', '150 million km'],
      ['Mars', '228 million km'],
      ['Jupiter', '778 million km'],
    ],
    'Jupiter is about five times further from the Sun than Earth is.',
  ],
  [
    'Widest first',
    [
      ['Jupiter', '142,984 km'],
      ['Saturn', '120,536 km'],
      ['Neptune', '49,528 km'],
      ['Earth', '12,756 km'],
      ['Mars', '6,792 km'],
    ],
    'About 1,300 Earths could fit inside Jupiter.',
  ],
  [
    'Heaviest first',
    [
      ['Blue whale', 'over 100 t'],
      ['African elephant', 'about 6 t'],
      ['Hippopotamus', 'about 1.5 t'],
      ['Polar bear', 'about 450 kg'],
      ['Lion', 'about 190 kg'],
    ],
    'A newborn blue whale already weighs more than two tonnes.',
  ],
  [
    'Fastest first',
    [
      ['Peregrine falcon', 'over 300 km/h'],
      ['Cheetah', 'about 110 km/h'],
      ['Greyhound', 'about 70 km/h'],
      ['Usain Bolt', 'about 44 km/h'],
      ['A walking person', 'about 5 km/h'],
    ],
    'The falcon reaches its top speed diving through the air after prey.',
  ],
  [
    'Longest life first',
    [
      ['Greenland shark', '250+ years'],
      ['Giant tortoise', '100+ years'],
      ['African elephant', '60–70 years'],
      ['Horse', '25–30 years'],
      ['House mouse', '1–2 years'],
    ],
    'Greenland sharks grow only about a centimetre a year.',
  ],
  [
    'Oldest first',
    [
      ['Telescope', '1608'],
      ['Public steam railway', '1825'],
      ['Telephone', '1876'],
      ['Powered aeroplane', '1903'],
      ['Mobile phone call', '1973'],
    ],
    'The first mobile phone call was made on a street in New York.',
  ],
  [
    'Born first',
    [
      ['Leonardo da Vinci', '1452'],
      ['William Shakespeare', '1564'],
      ['Mozart', '1756'],
      ['Albert Einstein', '1879'],
      ['Frida Kahlo', '1907'],
    ],
    'Frida Kahlo liked to say she was born in 1910, the year of a revolution.',
  ],
  [
    'Born first',
    [
      ['Galileo Galilei', '1564'],
      ['Ludwig van Beethoven', '1770'],
      ['Charles Darwin', '1809'],
      ['Marie Curie', '1867'],
      ['Nelson Mandela', '1918'],
    ],
    'Charles Darwin and Abraham Lincoln were born on the very same day.',
  ],
  [
    'Born first',
    [
      ['Julius Caesar', '100 BC'],
      ['Genghis Khan', 'about 1162'],
      ['Joan of Arc', 'about 1412'],
      ['Napoleon', '1769'],
      ['Mahatma Gandhi', '1869'],
    ],
    'Gandhi was born exactly 100 years after Napoleon.',
  ],
  [
    'Oldest first',
    [
      ['Great Pyramid of Giza', 'about 2560 BC'],
      ['Colosseum', 'AD 80'],
      ['Angkor Wat', '1100s'],
      ['Taj Mahal', '1600s'],
      ['Eiffel Tower', '1889'],
    ],
    'The Great Pyramid was the tallest structure on Earth for over 3,800 years.',
  ],
  [
    'Oldest first',
    [
      ['Big Ben', '1859'],
      ['Eiffel Tower', '1889'],
      ['Golden Gate Bridge', '1937'],
      ['Sydney Opera House', '1973'],
      ['Burj Khalifa', '2010'],
    ],
    'Big Ben is the name of the great bell, not the tower.',
  ],
  [
    'Released first',
    [
      ['The Wizard of Oz', '1939'],
      ['Jaws', '1975'],
      ['Jurassic Park', '1993'],
      ['Avatar', '2009'],
      ['Oppenheimer', '2023'],
    ],
    'Jaws is often called the first summer blockbuster.',
  ],
  [
    'Released first',
    [
      ['Rock Around the Clock', '1954'],
      ['Hey Jude', '1968'],
      ['Billie Jean', '1983'],
      ['Wonderwall', '1995'],
      ['Despacito', '2017'],
    ],
    'Hey Jude runs for more than seven minutes.',
  ],
  [
    'Biggest first',
    [
      ['Pacific Ocean', '165 million km²'],
      ['Atlantic Ocean', '106 million km²'],
      ['Indian Ocean', '70 million km²'],
      ['Southern Ocean', '20 million km²'],
      ['Arctic Ocean', '14 million km²'],
    ],
    'The Pacific is bigger than all the land on Earth put together.',
  ],
  [
    'Biggest first',
    [
      ['Greenland', '2.13 million km²'],
      ['New Guinea', '786,000 km²'],
      ['Madagascar', '587,000 km²'],
      ['Great Britain', '209,000 km²'],
      ['Iceland', '103,000 km²'],
    ],
    'Australia counts as a continent, so Greenland is the biggest island.',
  ],
  [
    'Biggest first',
    [
      ['Asia', '44.6 million km²'],
      ['Africa', '30.4 million km²'],
      ['North America', '24.7 million km²'],
      ['South America', '17.8 million km²'],
      ['Europe', '10.2 million km²'],
    ],
    'Asia is home to about six in every ten people on Earth.',
  ],
  [
    'Most people first',
    [
      ['Asia', '4.8 billion'],
      ['Africa', '1.5 billion'],
      ['Europe', '740 million'],
      ['South America', '430 million'],
      ['Oceania', '45 million'],
    ],
    'Africa has the youngest population of any continent.',
  ],
  [
    'Most people first',
    [
      ['Indonesia', '283 million'],
      ['Nigeria', '230 million'],
      ['Mexico', '131 million'],
      ['United Kingdom', '69 million'],
      ['Australia', '27 million'],
    ],
    'Nigeria has more people than any other country in Africa.',
  ],
  [
    'Heaviest first',
    [
      ['Jupiter', '318 Earths'],
      ['Saturn', '95 Earths'],
      ['Neptune', '17 Earths'],
      ['Uranus', '14.5 Earths'],
      ['Earth', '1 Earth'],
    ],
    'Uranus is wider than Neptune but lighter.',
  ],
  [
    'Hottest first',
    [
      ['Venus', '464 °C'],
      ['Mercury', '167 °C'],
      ['Earth', '15 °C'],
      ['Mars', '−65 °C'],
      ['Jupiter', '−110 °C'],
    ],
    'Venus is hotter than Mercury, though it is further from the Sun.',
  ],
  [
    'Biggest first',
    [
      ['Sahara', '9.2 million km²'],
      ['Arabian Desert', '2.3 million km²'],
      ['Gobi', '1.3 million km²'],
      ['Great Victoria Desert', '350,000 km²'],
      ['Atacama', '105,000 km²'],
    ],
    'The Sahara is almost as big as the United States.',
  ],
  [
    'Deepest first',
    [
      ['Lake Baikal', '1,642 m'],
      ['Crater Lake', '594 m'],
      ['Lake Geneva', '310 m'],
      ['Loch Ness', 'about 230 m'],
      ['Lake Victoria', 'about 80 m'],
    ],
    "Lake Baikal holds about a fifth of the world's unfrozen fresh surface water.",
  ],
  [
    'Tallest first',
    [
      ['Angel Falls', '979 m'],
      ['Yosemite Falls', '739 m'],
      ['Victoria Falls', '108 m'],
      ['Iguazu Falls', '82 m'],
      ['Niagara Falls', '51 m'],
    ],
    'Angel Falls, in Venezuela, is named after an American pilot.',
  ],
  [
    'Earliest first',
    [
      ['Sputnik launch', '1957'],
      ['First Moon landing', '1969'],
      ['First shuttle flight', '1981'],
      ['First rover on Mars', '1997'],
      ['Webb telescope launch', '2021'],
    ],
    'Sojourner, the first Mars rover, was about the size of a microwave.',
  ],
  [
    'First held first',
    [
      ['Wimbledon', '1877'],
      ['Modern Olympics', '1896'],
      ['Football World Cup', '1930'],
      ['Super Bowl', '1967'],
      ['Rugby World Cup', '1987'],
    ],
    'Wimbledon is the oldest tennis tournament in the world.',
  ],
  [
    'Highest first',
    [
      ['Quito', 'about 2,850 m'],
      ['Addis Ababa', 'about 2,350 m'],
      ['Nairobi', 'about 1,800 m'],
      ['Madrid', 'about 650 m'],
      ['Amsterdam', 'about 0 m'],
    ],
    'Madrid is the highest capital city in the European Union.',
  ],
  [
    'Biggest first',
    [
      ['Brazil', '8.5 million km²'],
      ['Argentina', '2.8 million km²'],
      ['Mexico', '2.0 million km²'],
      ['Japan', '378,000 km²'],
      ['United Kingdom', '243,000 km²'],
    ],
    'Japan is made up of more than 14,000 islands.',
  ],
  [
    'Longest first',
    [
      ['Yellow River', '5,464 km'],
      ['Volga', '3,530 km'],
      ['Ganges', '2,525 km'],
      ['Loire', 'about 1,000 km'],
      ['Seine', '777 km'],
    ],
    'The Volga is the longest river in Europe.',
  ],
  [
    'Most people first',
    [
      ['Germany', '84 million'],
      ['United Kingdom', '69 million'],
      ['Spain', '49 million'],
      ['Netherlands', '18 million'],
      ['Portugal', '10.6 million'],
    ],
    'Germany has the most people of any country in the European Union.',
  ],
  [
    'Furthest east first',
    [
      ['Tokyo', '139.7° E'],
      ['Beijing', '116.4° E'],
      ['Bangkok', '100.5° E'],
      ['Delhi', '77.2° E'],
      ['Cairo', '31.2° E'],
    ],
    'China is very wide, yet the whole country runs on one time zone.',
  ],
  [
    'Most legs first',
    [
      ['Crab', '10'],
      ['Spider', '8'],
      ['Ant', '6'],
      ['Dog', '4'],
      ['Chicken', '2'],
    ],
    'Every insect has six legs, so a spider is not an insect.',
  ],
  [
    'Oldest first',
    [
      ['Printing press', 'about 1440'],
      ['Light bulb', 'about 1880'],
      ['Television', '1920s'],
      ['World Wide Web', '1991'],
      ['iPhone', '2007'],
    ],
    'Gutenberg printed about 180 copies of his famous Bible.',
  ],
  [
    'Released first',
    [
      ['Pong', '1972'],
      ['Tetris', '1984'],
      ['Pokémon Red and Green', '1996'],
      ['Wii Sports', '2006'],
      ['Fortnite', '2017'],
    ],
    'Tetris was made by a Soviet engineer working on a computer in Moscow.',
  ],
  [
    'Founded first',
    [
      ['Coca-Cola', '1886'],
      ['Ford', '1903'],
      ['Disney', '1923'],
      ['Apple', '1976'],
      ['Google', '1998'],
    ],
    'Apple was started in a garage in California.',
  ],
  [
    'Hottest first',
    [
      ['Surface of the Sun', 'about 5,500 °C'],
      ['Lava', 'about 1,100 °C'],
      ['Pizza oven', 'about 450 °C'],
      ['Boiling water', '100 °C'],
      ['Human body', '37 °C'],
    ],
    'Lightning is about five times hotter than the surface of the Sun.',
  ],
  [
    'Longest pregnancy first',
    [
      ['Elephant', 'about 22 months'],
      ['Giraffe', 'about 15 months'],
      ['Human', 'about 9 months'],
      ['Dog', 'about 2 months'],
      ['Hamster', 'about 16 days'],
    ],
    'A baby giraffe falls more than a metre and a half to the ground at birth.',
  ],
  [
    'Most players first',
    [
      ['Rugby union', '15 a side'],
      ['Football', '11 a side'],
      ['Baseball', '9 a side'],
      ['Volleyball', '6 a side'],
      ['Basketball', '5 a side'],
    ],
    'Rugby union is named after Rugby School, in England.',
  ],
  [
    'Fastest first',
    [
      ['Concorde', 'about 2,180 km/h'],
      ['Passenger jet', 'about 900 km/h'],
      ['High-speed train', 'about 300 km/h'],
      ['Racehorse', 'about 65 km/h'],
      ['Bicycle', 'about 20 km/h'],
    ],
    'Concorde flew from London to New York in about three and a half hours.',
  ],
];
/** Sets that asked for knowledge few players have (planet masses, lake
 * depths, waterfall heights, desert sizes, capitals' altitudes); retired so
 * every set can be reasoned about. */
const retired = new Set([6, 23, 27, 29, 30, 31, 34, 36]);
export const orderSets: OrderSet[] = rows.map(([title, items, fact], id) => ({
  id,
  title,
  items: items.map(([name, value]) => ({ name, value })),
  fact,
  ...(retired.has(id) ? { retired: true as const } : {}),
}));
export const liveOrderIds = orderSets.flatMap((s) => (s.retired ? [] : [s.id]));
