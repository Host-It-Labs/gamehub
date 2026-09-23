import { pick, requireThat, rng, type KindModule } from '../kind.ts';
import { COUNTRY_DATA, type CountryRecord } from '../country-data.ts';

export const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;
export type Compass = (typeof COMPASS)[number];
export type CountryGuess = {
  name: string;
  /** Great-circle distance between the two countries' label points, km. */
  km: number;
  /** Compass direction from the guess toward the answer; null when correct. */
  dir: Compass | null;
  /** Worldle's proximity: 100% at the answer, 0% at 20 000 km or more. */
  pct: number;
};
export type CountryView = {
  /** The answer's silhouette in a 200×200 box. Public, as in Worldle. */
  shape: string;
  /** Degrees the silhouette is turned (Far corners); 0 otherwise. */
  rotate: number;
  rows: number;
  guesses: CountryGuess[];
  answer?: string;
};
type CountrySecret = { answer: string };

const BY_NAME = new Map(COUNTRY_DATA.map((c) => [c.name.toLowerCase(), c]));
export const findCountry = (name: string) =>
  BY_NAME.get(name.trim().toLowerCase());

/**
 * Answer pools: famous distinctive shapes first, rarely seen corners last.
 * Countries whose 1:110m outline is only a handful of points are left out of
 * the answer pools (they stay guessable).
 */
export const POOLS: Record<'1' | '2' | '3' | 'boss', string[]> = {
  1: [
    'Australia',
    'Brazil',
    'Canada',
    'Chile',
    'China',
    'Egypt',
    'France',
    'Germany',
    'Greenland',
    'Iceland',
    'India',
    'Italy',
    'Japan',
    'Madagascar',
    'Mexico',
    'New Zealand',
    'Norway',
    'Russia',
    'Saudi Arabia',
    'South Africa',
    'Spain',
    'Sweden',
    'Turkey',
    'United Kingdom',
    'United States',
    'Argentina',
    'Indonesia',
    'Philippines',
    'Cuba',
    'Ireland',
    'Sri Lanka',
    'Portugal',
  ],
  2: [
    'Afghanistan',
    'Algeria',
    'Austria',
    'Bolivia',
    'Colombia',
    'Denmark',
    'Ethiopia',
    'Finland',
    'Greece',
    'Iran',
    'Iraq',
    'Kazakhstan',
    'Kenya',
    'Libya',
    'Malaysia',
    'Mongolia',
    'Morocco',
    'Myanmar',
    'Nigeria',
    'North Korea',
    'South Korea',
    'Pakistan',
    'Peru',
    'Poland',
    'Somalia',
    'Switzerland',
    'Thailand',
    'Ukraine',
    'Venezuela',
    'Vietnam',
    'Taiwan',
    'Netherlands',
    'Belgium',
    'Czechia',
    'Hungary',
    'Romania',
    'Israel',
    'Panama',
    'Papua New Guinea',
    'Nepal',
    'Bangladesh',
    'Syria',
    'Yemen',
    'Tanzania',
    'Angola',
    'Ecuador',
    'Uruguay',
    'Paraguay',
    'Croatia',
  ],
  3: [
    'Albania',
    'Azerbaijan',
    'Belarus',
    'Benin',
    'Botswana',
    'Bulgaria',
    'Burkina Faso',
    'Cambodia',
    'Cameroon',
    'Central African Republic',
    'Chad',
    'Democratic Republic of the Congo',
    'Republic of the Congo',
    'Estonia',
    'Gabon',
    'Georgia',
    'Ghana',
    'Guatemala',
    'Guinea',
    'Guyana',
    'Honduras',
    'Ivory Coast',
    'Jordan',
    'Kyrgyzstan',
    'Laos',
    'Latvia',
    'Liberia',
    'Lithuania',
    'Malawi',
    'Mali',
    'Mauritania',
    'Mozambique',
    'Namibia',
    'Nicaragua',
    'Niger',
    'Oman',
    'Senegal',
    'Serbia',
    'Sierra Leone',
    'Slovakia',
    'South Sudan',
    'Sudan',
    'Suriname',
    'Tajikistan',
    'Tunisia',
    'Turkmenistan',
    'Uganda',
    'Uzbekistan',
    'Zambia',
    'Zimbabwe',
    'Bosnia and Herzegovina',
    'Dominican Republic',
    'Haiti',
    'Costa Rica',
  ],
  boss: [
    'Armenia',
    'Bahamas',
    'Belize',
    'Bhutan',
    'Burundi',
    'Cyprus',
    'Djibouti',
    'East Timor',
    'El Salvador',
    'Eritrea',
    'Eswatini',
    'Falkland Islands',
    'Fiji',
    'Gambia',
    'Guinea-Bissau',
    'Jamaica',
    'Kosovo',
    'Kuwait',
    'Lebanon',
    'Lesotho',
    'Moldova',
    'Montenegro',
    'New Caledonia',
    'North Macedonia',
    'Palestine',
    'Puerto Rico',
    'Qatar',
    'Rwanda',
    'Slovenia',
    'Solomon Islands',
    'Togo',
    'United Arab Emirates',
    'Vanuatu',
    'Western Sahara',
  ],
};

const rad = (d: number) => (d * Math.PI) / 180;
export function distanceKm(a: CountryRecord, b: CountryRecord) {
  const dLat = rad(b.lat - a.lat),
    dLon = rad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h))));
}
/** Initial great-circle bearing from `a` toward `b`, snapped to 8 points. */
export function direction(a: CountryRecord, b: CountryRecord): Compass {
  const y = Math.sin(rad(b.lon - a.lon)) * Math.cos(rad(b.lat));
  const x =
    Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) -
    Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lon - a.lon));
  const deg = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  return COMPASS[Math.round(deg / 45) % 8];
}
export const proximity = (km: number) =>
  Math.round((Math.max(0, 20000 - km) / 20000) * 100);

export const country: KindModule<CountryView, CountrySecret> = {
  make({ seed, level, boss }) {
    const random = rng(seed);
    const answer = findCountry(
      pick(POOLS[boss || level === 4 ? 'boss' : level], random),
    )!;
    // Very hard draws the rare countries upright; Far corners also turns the outline by a clear, deterministic angle.
    const rotate = boss ? 45 + 15 * Math.floor(random() * 19) : 0;
    return {
      view: { shape: answer.path, rotate, rows: 6, guesses: [] },
      secret: { answer: answer.name },
      allowance: 6,
      budget: 'guesses',
    };
  },
  move(view, secret, move) {
    requireThat(typeof move.guess === 'string', 'Pick a country');
    const guess = findCountry(move.guess as string);
    requireThat(guess, 'Unknown country!');
    requireThat(
      !view.guesses.some((g) => g.name === guess.name),
      'Country already guessed!',
    );
    const answer = findCountry(secret.answer)!;
    const solved = guess.name === answer.name;
    const km = solved ? 0 : distanceKm(guess, answer);
    view.guesses.push({
      name: guess.name,
      km,
      dir: solved ? null : direction(guess, answer),
      pct: solved ? 100 : proximity(km),
    });
    return { cost: 1, solved };
  },
  reveal(view, secret) {
    view.answer = secret.answer;
    return secret.answer;
  },
  win: (_view, secret) => ({ guess: secret.answer }),
  lose(view, secret) {
    const next = COUNTRY_DATA.find(
      (c) =>
        c.name !== secret.answer &&
        !view.guesses.some((g) => g.name === c.name),
    )!;
    return { guess: next.name };
  },
};
