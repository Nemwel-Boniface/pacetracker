const BIG_FIVE = ['🦁', '🐘', '🐆', '🦬', '🦏'];
const FANTASY  = ['🧙', '🧚', '🦸', '🧜', '🧝', '🧛', '🥷', '🤴', '👸', '🧞', '🧌', '🧟', '🐲', '🦄', '🐉'];
const SPACE    = ['👾', '🚀', '🛸'];

export const STICKER_LABELS: Record<string, string> = {
  '🦁': 'Lion', '🐘': 'Elephant', '🐆': 'Leopard', '🦬': 'Buffalo', '🦏': 'Rhino',
  '🧙': 'Wizard', '🧚': 'Fairy', '🦸': 'Superhero', '🧜': 'Mermaid', '🧝': 'Elf',
  '🧛': 'Vampire', '🥷': 'Ninja', '🤴': 'Prince', '👸': 'Princess', '🧞': 'Genie',
  '🧌': 'Troll', '🧟': 'Zombie', '🐲': 'Dragon', '🦄': 'Unicorn', '🐉': 'Eastern Dragon',
  '👾': 'Space Invader', '🚀': 'Rocket Pilot', '🛸': 'UFO Captain',
};

export type StickerTier = 'big_five' | 'fantasy' | 'space';

export const STICKER_BG: Record<StickerTier, { bg: string; border: string }> = {
  big_five: { bg: '#fef3c7', border: '#fde68a' },
  fantasy:  { bg: '#f3e8ff', border: '#e9d5ff' },
  space:    { bg: '#e0e7ff', border: '#c7d2fe' },
};

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function getStickerTier(rank: number, total: number): StickerTier {
  if (rank <= 5) return 'big_five';
  if (total > 5 && rank >= total - 2) return 'space';
  return 'fantasy';
}

export function getSticker(rank: number, total: number, seed: string): string {
  if (rank <= 5) return BIG_FIVE[rank - 1];
  if (total > 5 && rank >= total - 2) {
    return SPACE[Math.min(rank - (total - 2), 2)];
  }
  return FANTASY[hashStr(seed) % FANTASY.length];
}

export function getStickerByName(name: string): string {
  return FANTASY[hashStr(name) % FANTASY.length];
}
