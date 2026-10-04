/** Years: players place a marker on the timeline for the year something
 * happened. Each event has one undisputed year; nothing "circa". A third of
 * the events fall in each era, drawn from around the world. The fact adds
 * something at the reveal without repeating the year.
 * Ids are row positions, so rows are only ever appended or retired. */
export type YearEra = 'old' | 'modern' | 'recent';
export type YearEvent = {
  id: number;
  text: string;
  year: number;
  era: YearEra;
  fact: string;
  retired?: true;
};
const rows: [string, number, string][] = [
  // Old: 1000–1799
  [
    'William of Normandy wins the Battle of Hastings',
    1066,
    'The Bayeux Tapestry tells the story on a cloth nearly 70 m long.',
  ],
  [
    'Genghis Khan is proclaimed ruler of the Mongols',
    1206,
    'The Mongol Empire became the largest connected land empire ever.',
  ],
  [
    'King John agrees to the Magna Carta',
    1215,
    'He sealed it in a meadow at Runnymede, near London.',
  ],
  [
    'Mansa Musa of Mali makes his pilgrimage to Mecca',
    1324,
    'He carried so much gold that its price fell in Cairo.',
  ],
  [
    'The Ming dynasty begins in China',
    1368,
    'Ming emperors built most of the Great Wall that stands today.',
  ],
  [
    'Zheng He sets off on his first great voyage',
    1405,
    'He led seven voyages across the Indian Ocean, as far as East Africa.',
  ],
  [
    'Constantinople falls to the Ottomans',
    1453,
    'Sultan Mehmed II, who took the city, was only 21.',
  ],
  [
    'Columbus reaches the Americas',
    1492,
    'He landed in the Bahamas, believing he had reached Asia.',
  ],
  [
    'Vasco da Gama reaches India by sea',
    1498,
    'He sailed from Portugal around the southern tip of Africa.',
  ],
  [
    'Michelangelo finishes the Sistine Chapel ceiling',
    1512,
    'He painted it standing on scaffolding, not lying on his back.',
  ],
  [
    'Cortés reaches the Aztec capital, Tenochtitlan',
    1519,
    'The city stood on an island in a lake, where Mexico City is now.',
  ],
  [
    'The first voyage around the world is completed',
    1522,
    'Magellan led it but died on the way, in the Philippines.',
  ],
  [
    'William Shakespeare is born',
    1564,
    'Besides his plays, he wrote 154 sonnets.',
  ],
  [
    'Tokugawa Ieyasu becomes shogun of Japan',
    1603,
    'His family went on to rule Japan for over 250 years.',
  ],
  [
    "Galileo discovers Jupiter's four largest moons",
    1610,
    'They are still called the Galilean moons.',
  ],
  [
    'The Mayflower reaches America',
    1620,
    'About 100 passengers spent 66 days crossing the Atlantic.',
  ],
  [
    'The Great Fire of London',
    1666,
    'It burned for four days and destroyed over 13,000 houses.',
  ],
  [
    'Isaac Newton publishes his laws of motion',
    1687,
    'The same book, the Principia, explained gravity.',
  ],
  [
    'Peter the Great founds Saint Petersburg',
    1703,
    "It was Russia's capital for about 200 years.",
  ],
  [
    'A great earthquake destroys Lisbon',
    1755,
    'It was followed by a tsunami and fires that burned for days.',
  ],
  [
    'Wolfgang Amadeus Mozart is born',
    1756,
    'He was writing his own music by the age of five.',
  ],
  [
    "Captain Cook reaches Australia's east coast",
    1770,
    'He landed at Botany Bay, now part of Sydney.',
  ],
  [
    'The American Declaration of Independence',
    1776,
    'It was adopted on the 4th of July, still the national holiday.',
  ],
  [
    'People fly in a hot-air balloon for the first time',
    1783,
    'Two men drifted over Paris in a balloon built by the Montgolfiers.',
  ],
  [
    'Crowds storm the Bastille in Paris',
    1789,
    "The day, the 14th of July, is now France's national holiday.",
  ],
  // Modern: 1800–1949
  [
    'Napoleon is defeated at Waterloo',
    1815,
    'The battle took place in what is now Belgium.',
  ],
  [
    'The first public steam railway opens in England',
    1825,
    'It ran between Stockton and Darlington, carrying coal and people.',
  ],
  [
    'Darwin publishes On the Origin of Species',
    1859,
    'The first print run sold out on the day it went on sale.',
  ],
  [
    "Japan's Meiji era begins",
    1868,
    'The city of Edo was renamed Tokyo and became the capital.',
  ],
  [
    'The Suez Canal opens',
    1869,
    'It links the Mediterranean Sea to the Red Sea.',
  ],
  [
    'Alexander Graham Bell patents the telephone',
    1876,
    'His first words on it were to his assistant, Mr Watson.',
  ],
  [
    'The Statue of Liberty is unveiled in New York',
    1886,
    'It was a gift from the people of France.',
  ],
  [
    'Brazil abolishes slavery',
    1888,
    'It was the last country in the Americas to do so.',
  ],
  [
    'The Eiffel Tower opens in Paris',
    1889,
    'It was only meant to stand for 20 years.',
  ],
  [
    'New Zealand gives women the vote',
    1893,
    'It was the first self-governing country to do so.',
  ],
  [
    'The first modern Olympic Games open in Athens',
    1896,
    'Only men competed at those first Games.',
  ],
  [
    'The Wright brothers make the first powered flight',
    1903,
    'The first flight lasted just 12 seconds.',
  ],
  [
    'Einstein publishes his theory of special relativity',
    1905,
    'He published four major papers that same year.',
  ],
  [
    'Amundsen reaches the South Pole',
    1911,
    "His team beat Robert Scott's by about five weeks.",
  ],
  [
    'The Titanic sinks',
    1912,
    'It sank on its first voyage, from Southampton to New York.',
  ],
  [
    'The Panama Canal opens',
    1914,
    'Ships no longer had to sail around the tip of South America.',
  ],
  [
    'The Russian Revolution',
    1917,
    'The October Revolution fell in November by our calendar.',
  ],
  [
    'The First World War ends',
    1918,
    "The guns fell silent at 11 o'clock on the 11th of November.",
  ],
  [
    "Tutankhamun's tomb is found in Egypt",
    1922,
    "It was the most complete pharaoh's tomb ever found.",
  ],
  [
    'Alexander Fleming discovers penicillin',
    1928,
    'He noticed mould killing bacteria on a dish he had left out.',
  ],
  [
    'The first football World Cup is played',
    1930,
    'Uruguay hosted it and won it.',
  ],
  [
    'The Empire State Building opens',
    1931,
    'It was built in just over a year.',
  ],
  [
    'India becomes independent',
    1947,
    'Pakistan became independent the day before.',
  ],
  [
    "The People's Republic of China is founded",
    1949,
    "Mao Zedong declared it in Beijing's Tiananmen Square.",
  ],
  // Recent: 1950–2024
  [
    'Hillary and Tenzing reach the top of Everest',
    1953,
    'Edmund Hillary was a beekeeper from New Zealand.',
  ],
  [
    'Sputnik becomes the first satellite in orbit',
    1957,
    'It sent out beeps that radio fans around the world could hear.',
  ],
  [
    'Brazil wins its first football World Cup',
    1958,
    'A 17-year-old Pelé scored twice in the final.',
  ],
  [
    'Yuri Gagarin becomes the first person in space',
    1961,
    'His flight around the Earth lasted 108 minutes.',
  ],
  [
    'Tokyo hosts the first Olympics held in Asia',
    1964,
    "Japan's first bullet train opened just before the Games.",
  ],
  [
    'Singapore becomes an independent country',
    1965,
    'It separated from Malaysia.',
  ],
  [
    'People walk on the Moon for the first time',
    1969,
    'Neil Armstrong and Buzz Aldrin spent about 21 hours there.',
  ],
  [
    'Concorde makes its first passenger flight',
    1976,
    'It crossed the Atlantic in about three and a half hours.',
  ],
  [
    'Voyager 1 is launched',
    1977,
    'It is now the most distant object ever made by people.',
  ],
  [
    'The first baby conceived by IVF is born',
    1978,
    'Louise Brown was born in Oldham, England.',
  ],
  [
    'The Chernobyl nuclear disaster',
    1986,
    'The nearby town of Pripyat has stood empty ever since.',
  ],
  ['The Berlin Wall falls', 1989, 'It had divided the city for 28 years.'],
  [
    'Nelson Mandela walks free from prison',
    1990,
    'He had spent 27 years behind bars.',
  ],
  ['The Soviet Union breaks up', 1991, 'It split into 15 separate countries.'],
  ['The Channel Tunnel opens', 1994, 'About 38 km of it runs under the sea.'],
  [
    'Dolly the sheep is born',
    1996,
    'She was the first mammal cloned from an adult cell.',
  ],
  [
    'Hong Kong is handed back to China',
    1997,
    'Britain had governed it for over 150 years.',
  ],
  [
    'Wikipedia goes online',
    2001,
    "Its name starts with 'wiki', a Hawaiian word for quick.",
  ],
  [
    'Euro coins and notes come into use',
    2002,
    'Twelve countries switched to them on the same day.',
  ],
  ['The first iPhone goes on sale', 2007, 'It had no app store at first.'],
  [
    'Usain Bolt runs 100 m in 9.58 seconds',
    2009,
    'He set the record at the World Championships in Berlin.',
  ],
  [
    'Scientists announce they have found the Higgs boson',
    2012,
    "It was found at CERN's particle collider near Geneva.",
  ],
  [
    'The first photo of a black hole is shown',
    2019,
    'The black hole sits in a galaxy called M87.',
  ],
  [
    'The James Webb Space Telescope is launched',
    2021,
    'It works about 1.5 million km from Earth.',
  ],
  [
    'Argentina wins the football World Cup in Qatar',
    2022,
    'The final against France was settled on penalties.',
  ],
];
export const yearEvents: YearEvent[] = rows.map(([text, year, fact], id) => ({
  id,
  text,
  year,
  era: year < 1800 ? 'old' : year < 1950 ? 'modern' : 'recent',
  fact,
}));
export const timeline = [1000, 2025] as const;
