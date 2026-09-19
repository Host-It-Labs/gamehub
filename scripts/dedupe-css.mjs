// Remove declarations that a later declaration of the same property, in the same
// selector and the same @media context, overrides. The cascade is unchanged.
import postcss from 'postcss';
import fs from 'node:fs';
const [,, file] = process.argv;
const root = postcss.parse(fs.readFileSync(file, 'utf8'));
const last = new Map();
const key = (decl) => {
  const rule = decl.parent;
  const media = rule.parent?.type === 'atrule' ? `@${rule.parent.name} ${rule.parent.params}` : '';
  return `${media}|${rule.selector}|${decl.prop}|${decl.important ? '!' : ''}`;
};
root.walkDecls((d) => { last.set(key(d), d); });
let removed = 0;
root.walkDecls((d) => { if (last.get(key(d)) !== d) { d.remove(); removed++; } });
root.walkRules((r) => { if (!r.nodes.length) r.remove(); });
root.walkAtRules((a) => { if (a.name === 'media' && !a.nodes.length) a.remove(); });
fs.writeFileSync(file, root.toString());
console.log('removed', removed, 'declarations from', file);
