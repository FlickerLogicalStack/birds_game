# Birds

A tiny low-cortisol game about a tree full of pixel birds. No timers, no fail states, no pressure:
the birds live their little lives, and you breed them, name them and watch the flock grow.

**Play it here:** https://flickerlogicalstack.github.io/birds_game/

## What's inside

- **A living tree.** Birds hop along the branches, fly between them, play tag above the crown and
  take dust baths in the beach sand or splash in the shallows. The tree grows with the flock.
- **Day and night.** A full sky cycle with a sun, a moon, drifting clouds and twinkling stars. You
  can rewind to day or night, speed time up or pause it.
- **Breeding.** Every bird is generated from continuous genes: size, build, tail, beak, crest,
  hue, saturation, brightness and more. Chicks blend their parents' genes, with a few random
  mutations so no two are alike.
- **Rare traits.** Color mutations, patterns, ornaments, auras, odd or glowing eyes and particle
  trails make birds rarer, from Common to Legendary. Happy parents are a bit luckier.
- **Gene control.** Suppress a gene so it always loses in breeding, or make one dominant so it
  always wins. It's a way to steer the flock toward the birds you want.
- **Collection and profiles.** Browse the whole flock, filter by rarity, open any bird to see its
  genes and character, rename it or set it free.
- **Achievements.** Collect every tail shape, every hue, every aura color, and breed your way up
  the tiers.
- **Time away counts.** Close the tab and come back later: birds have grown up, and a pair may
  have had a chick while you were gone.
- **Works offline.** It's a single page with no backend. Progress is saved in your browser, and
  it can be installed to the home screen as an app.

Plays with a mouse, a trackpad or touch.

## Running locally

Requires [Bun](https://bun.sh).

```sh
bun install
bun run dev          # dev build + watch, served on http://localhost:3000
bun run build        # production build into dist/
bun run check-types
```
