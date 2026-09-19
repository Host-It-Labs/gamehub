'use client';
import { useEffect, useState } from 'react';
import { paperWorldVariants } from '@/lib/games/mora-world';
import { isTableWorldGame, tableWorldVariants } from '@/lib/games/table-world';
import { useArtVariant } from '@/lib/games/art-variant';

/** Floating review control: flips a world between registered artwork
 *  candidates for the current orientation. Keep it out of the way; remove the
 *  <ArtVariantSwitcher/> line from the table when a variant is chosen. */
export function ArtVariantSwitcher({ game = 'wildgrove' }: { game?: string }) {
  const [variant, setVariant] = useArtVariant(game);
  const [portrait, setPortrait] = useState(false);
  useEffect(() => {
    const q = window.matchMedia('(orientation: portrait)');
    const update = () => setPortrait(q.matches);
    update(); q.addEventListener('change', update);
    return () => q.removeEventListener('change', update);
  }, []);
  const options = isTableWorldGame(game) ? tableWorldVariants(game, portrait) : paperWorldVariants(portrait);
  if (options.length < 2) return null;
  const current = options.some((o) => o.id === variant) ? variant : options[0].id;
  return (
    <fieldset className="art-variant-switcher" aria-label="Artwork candidate">
      {options.map((o) => (
        <button key={o.id} type="button" aria-pressed={o.id === current} onClick={() => setVariant(o.id)}>
          {o.label}
        </button>
      ))}
    </fieldset>
  );
}
