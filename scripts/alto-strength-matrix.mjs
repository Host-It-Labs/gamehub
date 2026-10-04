// Runs scripts/alto-strength.mjs for every upgrade at several table sizes in
// parallel and prints one matrix: for each size, the points above the table
// average when one bot leans hard toward the upgrade and when it never builds
// it. Both near zero means the upgrade is fair at that size.
//   node scripts/alto-strength-matrix.mjs [games] [sizes] [options json]
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { cpus } from 'node:os';
const run = promisify(execFile);
const games = process.argv[2] ?? '400';
const sizes = (process.argv[3] ?? '2,3,4,6').split(',');
const opts = process.argv[4] ?? '{}';
const { stdout } = await run(process.execPath, [
  '--experimental-strip-types',
  '-e',
  "import('./lib/games/alto/content.ts').then(m=>console.log(JSON.stringify(m.plans.map(p=>[p.id,p.name,p.season]))))",
]);
const ids = JSON.parse(stdout);
const jobs = [];
for (const n of sizes) for (const [id] of ids) jobs.push({ n, id });
const out = {};
let next = 0;
async function worker() {
  while (next < jobs.length) {
    const { n, id } = jobs[next++];
    const { stdout } = await run(
      process.execPath,
      [
        '--experimental-strip-types',
        'scripts/alto-strength.mjs',
        games,
        n,
        opts,
        id,
      ],
      { maxBuffer: 1 << 20 },
    );
    const row = stdout.trim().split('\n').at(-1);
    const m = row.match(/(-?[\d.]+)\s+(-?[\d.]+)\s*$/);
    const built = row.match(/\(\s*(\d+)%\)/);
    out[`${n}:${id}`] =
      m && !row.startsWith('upgrade')
        ? { lean: +m[1], avoid: +m[2], built: built ? +built[1] : 0 }
        : null;
  }
}
await Promise.all(
  Array.from({ length: Math.max(1, cpus().length - 1) }, worker),
);
const f = (v) => (v >= 0 ? '+' : '') + v.toFixed(1);
console.log(
  `${games} games per cell; lean/avoid = points above the table average (fair ≈ 0)`,
);
console.log(
  'upgrade       yr ' + sizes.map((n) => `   ${n}p lean/avoid`).join(''),
);
for (const [id, name, year] of ids) {
  const cells = sizes.map((n) => {
    const c = out[`${n}:${id}`];
    if (!c) return '         -        ';
    const flag =
      c.lean > 1.5 || c.avoid < -1.5
        ? '!'
        : c.lean < -2 && c.avoid > -0.5
          ? '?'
          : ' ';
    return `   ${f(c.lean).padStart(5)}/${f(c.avoid).padStart(5)} ${flag}`;
  });
  console.log(
    `${(name + '             ').slice(0, 13)} ${year} ${cells.join('')}`,
  );
}
console.log(
  '! strong (worth too much or hard to skip)   ? weak (forcing it costs, skipping it is free)',
);
