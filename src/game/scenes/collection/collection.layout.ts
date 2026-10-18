import { RARITY_INFO } from '../../entities/birds/bird.generator';
import { layout_builder, number_text } from '../../utils/layout';
import { SCENE_BAR_SPACE } from '../../entities/ui/scene_bar';
import { ALL_RARITIES, RARITIES, type CollectionSort } from './collection.state';
import { RARITY_LABELS } from '../profile/profile.labels';
import { CONFIG } from '../../../config';

const TOOLBAR_PAD = CONFIG.toolbar.pad;
const CHIP_HEIGHT = CONFIG.toolbar.chip_height;
const CHIP_PAD_X = CONFIG.toolbar.chip_pad_x;
const CHIP_GAP = CONFIG.toolbar.chip_gap;
const CHIP_FONT_SIZE = CONFIG.toolbar.chip_font_size;
const DOT_SIZE = CONFIG.toolbar.dot_size;
const PICK_LINE_H = CONFIG.toolbar.pick_line_height;

const SORT_LABELS: Record<CollectionSort, string> = {
  age: 'Sort: Age',
  rarity: 'Sort: Rarity',
  name: 'Sort: Name',
  color: 'Sort: Color',
  size: 'Sort: Size',
};

export type ToolbarAction =
  { kind: 'all' } | { kind: 'rarity'; rarity: number } | { kind: 'breedable' } | { kind: 'sort' };

export type ToolbarChip = {
  handle: number;
  slot: number;
  action: ToolbarAction;
  dot: string | null;
};

const L = layout_builder();
const chip = { h: CHIP_HEIGHT, pad_x: CHIP_PAD_X, font_size: CHIP_FONT_SIZE, weight: 600 };
const all_text = number_text(n => `All ${n}`);
const breedable_text = number_text(n => `Breedable ${n}`);
const BREEDABLE_ACTION: ToolbarAction = { kind: 'breedable' };
const breedable_chip = L.text({
  ...chip,
  value: game => breedable_text(game.collection_scene.breedable_count),
});

const slot_of = (handle: number) => ({ handle, slot: handle });

export const TOOLBAR_CHIPS: ToolbarChip[] = [
  {
    ...slot_of(
      L.text({
        ...chip,
        value: game => all_text(game.collection_scene.counts.reduce((sum, n) => sum + n, 0)),
      }),
    ),
    action: { kind: 'all' },
    dot: null,
  },
  ...RARITIES.map((rarity, i): ToolbarChip => {
    const text = number_text(n => `${RARITY_LABELS[rarity]} ${n}`);
    const action: ToolbarAction = { kind: 'rarity', rarity: i };
    const handle = L.text({
      ...chip,
      lead: DOT_SIZE + CHIP_PAD_X / 2,
      value: game => text(game.collection_scene.counts[i]!),
    });

    return {
      handle,
      slot: L.when(game => {
        const scene = game.collection_scene;

        return scene.counts[i]! > 0 || chip_active(scene, action);
      }, handle),
      action,
      dot: RARITY_INFO[rarity].color,
    };
  }),
  {
    handle: breedable_chip,
    slot: L.when(game => {
      const scene = game.collection_scene;

      return scene.breedable_count > 0 || scene.breedable;
    }, breedable_chip),
    action: BREEDABLE_ACTION,
    dot: null,
  },
  {
    ...slot_of(L.text({ ...chip, value: game => SORT_LABELS[game.collection_scene.sort] })),
    action: { kind: 'sort' },
    dot: null,
  },
];

export const chip_active = (scene: BIRD.CollectionScene, action: ToolbarAction) => {
  switch (action.kind) {
    case 'all':
      return scene.rarities === ALL_RARITIES && !scene.breedable;
    case 'rarity':
      return scene.rarities !== ALL_RARITIES && (scene.rarities & (1 << action.rarity)) !== 0;
    case 'breedable':
      return scene.breedable;
    case 'sort':
      return true;
  }
};

const pick_cancel = L.text({ ...chip, value: () => 'Cancel' });
const pick_hint = L.text({
  h: PICK_LINE_H,
  font_size: CHIP_FONT_SIZE,
  weight: 600,
  value: game =>
    game.breeding_scene.picking === 0 ? 'Choose the first parent' : 'Choose the second parent',
});
const pick_note = L.text({
  h: PICK_LINE_H,
  font_size: CHIP_FONT_SIZE,
  weight: 600,
  value: () => '(rested adults only)',
});

const grid = L.box({ w: 0, h: 0, grow: 1, h_of: game => game.collection_scene.grid_height });

export const COLLECTION_LAYOUT_ELEMENTS = {
  pick_cancel,
  pick_hint,
  pick_note,
  grid,
  grid_scroll: L.scroll({ grow: 1 }, L.column({ pad: { bottom: SCENE_BAR_SPACE } }, [grid])),
  pick_bar: L.when(
    game => game.breeding_scene.picking !== -1,
    L.row({ pad: { x: TOOLBAR_PAD, top: TOOLBAR_PAD }, gap: CHIP_GAP }, [
      pick_cancel,
      L.device({
        mobile: L.column({ align: 'start' }, [pick_hint, pick_note]),
        desktop: L.row({ gap: CHIP_GAP / 2 }, [pick_hint, pick_note]),
      }),
      L.box({ w: 0, h: 0, grow: 1 }),
    ]),
  ),
  toolbar: L.wrap(
    { pad: TOOLBAR_PAD, gap: CHIP_GAP },
    TOOLBAR_CHIPS.map(chip => chip.slot),
  ),
};

export const COLLECTION_LAYOUT = L.compile(
  L.column({}, [
    COLLECTION_LAYOUT_ELEMENTS.pick_bar,
    COLLECTION_LAYOUT_ELEMENTS.toolbar,
    COLLECTION_LAYOUT_ELEMENTS.grid_scroll,
  ]),
);
