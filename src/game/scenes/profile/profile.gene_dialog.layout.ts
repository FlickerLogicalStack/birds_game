import { GENE_GROUPS } from '../../entities/birds/bird.generator';
import { layout_builder } from '../../utils/layout';
import { GENE_GROUP_LABELS } from './profile.labels';
import { can_choose_gene } from './profile.state';
import { CONFIG } from '../../../config';

const MARGIN = CONFIG.profile.margin;
const W = CONFIG.profile.gene_dialog.width;
const PAD = CONFIG.profile.gene_dialog.pad;
const GAP = CONFIG.profile.gene_dialog.gap;
const TITLE_H = CONFIG.profile.gene_dialog.title_height;
const TITLE_FONT_SIZE = CONFIG.profile.gene_dialog.title_font_size;
const NOTE_H = CONFIG.profile.gene_dialog.note_height;
const NOTE_FONT_SIZE = CONFIG.profile.gene_dialog.note_font_size;
const ROW_H = CONFIG.profile.gene_dialog.row_height;
const ROW_GAP = CONFIG.profile.gene_dialog.row_gap;
const ROW_PAD_X = CONFIG.profile.gene_dialog.row_pad_x;
const ROW_FONT_SIZE = CONFIG.profile.gene_dialog.row_font_size;
const BUTTON_H = CONFIG.profile.gene_dialog.button_height;
const BUTTON_FONT_SIZE = CONFIG.profile.gene_dialog.button_font_size;

const INNER_W = W - PAD * 2;

const suppressing = (game: BIRD.GameState) => game.profile_scene.gene_dialog === 'suppress';

const L = layout_builder();

const title = L.text({
  w: INNER_W,
  h: TITLE_H,
  font_size: TITLE_FONT_SIZE,
  weight: 700,
  value: game => (suppressing(game) ? 'Suppress a gene' : 'Make a gene dominant'),
});
const note = L.text({
  w: INNER_W,
  h: NOTE_H,
  font_size: NOTE_FONT_SIZE,
  value: game =>
    suppressing(game)
      ? 'It always loses in breeding. Forever.'
      : 'It always wins in breeding. Forever.',
});
const rows = GENE_GROUPS.map(group =>
  L.text({
    w: INNER_W,
    h: ROW_H,
    pad_x: ROW_PAD_X,
    font_size: ROW_FONT_SIZE,
    weight: 600,
    value: () => GENE_GROUP_LABELS[group],
  }),
);
const row_slots = GENE_GROUPS.map((group, i) =>
  L.when(game => {
    const { bird, gene_dialog } = game.profile_scene;

    return bird !== null && gene_dialog !== null && can_choose_gene(bird, gene_dialog, group);
  }, rows[i]!),
);
const button = { w: (INNER_W - GAP) / 2, h: BUTTON_H, font_size: BUTTON_FONT_SIZE, weight: 600 };
const cancel = L.text({ ...button, value: () => 'Cancel' });
const confirm = L.text({
  ...button,
  value: game =>
    game.profile_scene.gene_armed ? 'Confirm' : suppressing(game) ? 'Suppress' : 'Dominate',
});
const dialog = L.column({ pad: PAD, gap: GAP }, [
  title,
  note,
  L.column({ gap: ROW_GAP }, row_slots),
  L.row({ gap: GAP }, [cancel, confirm]),
]);

export const GENE_DIALOG_LAYOUT_ELEMENTS = { dialog, title, note, rows, cancel, confirm };

export const GENE_DIALOG_LAYOUT = L.compile(
  L.column({ pad: MARGIN }, [L.fit({ grow: 1 }, dialog)]),
);
