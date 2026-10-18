import { can_release_bird, release_bird } from '../../entities/birds/birds';
import { clear_bird_hover } from '../../entities/birds/birds.hover';
import { start_follow } from '../../entities/camera/camera.follow';
import { request_save } from '../../entities/save/save';
import { offer_parent } from '../breeding/breeding.state';
import { update_shown } from '../collection/collection.gameplay';
import { show_collection_row } from '../collection/collection.grid';
import { reset_scroll } from '../../utils/layout';
import { can_suppress, type GeneGroup } from '../../entities/birds/bird.generator';
import { PROFILE_LAYOUT, PROFILE_LAYOUT_ELEMENTS } from './profile.layout';
import { count_achievement, DOMINANT, SUPPRESSED } from '../../entities/achievements/achievements';
import { CONFIG } from '../../../config';
import { __opt_prepare_mutations, __opt_remember_shape } from '../../../engine/shape';

const NAME_MAX_LENGTH = CONFIG.profile.name_max_length;

const profile_scene_of = (
  gene_dialog: BIRD.GeneRole | null,
  gene_choice: GeneGroup | null,
): BIRD.ProfileScene => ({
  bird: null,
  release_armed: false,
  gene_dialog,
  gene_choice,
  gene_armed: false,
});

export const create_profile_scene = () => profile_scene_of(null, null);

__opt_prepare_mutations(__opt_remember_shape(profile_scene_of('suppress', 'size')), [
  'bird',
  'release_armed',
  'gene_dialog',
  'gene_choice',
  'gene_armed',
]);

export const gene_of_role = (bird: BIRD.Bird, role: BIRD.GeneRole) =>
  role === 'suppress' ? bird.suppressed : bird.dominant;

export const can_choose_gene = (bird: BIRD.Bird, role: BIRD.GeneRole, group: GeneGroup) =>
  can_suppress(bird.behaviour.genes, group) &&
  group !== gene_of_role(bird, role === 'suppress' ? 'dominant' : 'suppress');

export const close_gene_dialog = (scene: BIRD.ProfileScene) => {
  scene.gene_dialog = null;
  scene.gene_choice = null;
  scene.gene_armed = false;
};

export const open_gene_dialog = (scene: BIRD.ProfileScene, role: BIRD.GeneRole) => {
  close_gene_dialog(scene);

  if (scene.bird !== null && gene_of_role(scene.bird, role) === null) {
    scene.gene_dialog = role;
  }
};

export const choose_gene = (scene: BIRD.ProfileScene, group: GeneGroup) => {
  scene.gene_choice = group;
  scene.gene_armed = false;
};

export const confirm_gene = (game: BIRD.GameState) => {
  const scene = game.profile_scene;
  const bird = scene.bird;
  const role = scene.gene_dialog;
  const group = scene.gene_choice;

  close_gene_dialog(scene);

  if (
    bird === null ||
    role === null ||
    group === null ||
    gene_of_role(bird, role) !== null ||
    !can_choose_gene(bird, role, group)
  ) {
    return;
  }

  if (role === 'suppress') {
    bird.suppressed = group;
    count_achievement(game, SUPPRESSED);
  } else {
    bird.dominant = group;
    count_achievement(game, DOMINANT);
  }

  request_save(game);
};

export const open_profile = (game: BIRD.GameState, bird: BIRD.Bird) => {
  game.profile_scene.bird = bird;
  game.profile_scene.release_armed = false;
  close_gene_dialog(game.profile_scene);
  game.current_scene = 'profile';
  reset_scroll(PROFILE_LAYOUT, PROFILE_LAYOUT_ELEMENTS.body);
};

export const show_bird_on_tree = (game: BIRD.GameState, bird: BIRD.Bird) => {
  const primary = game.primary_scene;

  start_follow(primary.camera_follow, primary.camera, bird);
  game.current_scene = 'primary';
};

export const show_profile_bird = (game: BIRD.GameState) => {
  const bird = game.profile_scene.bird;

  if (bird === null) {
    return;
  }

  show_bird_on_tree(game, bird);
};

export const breed_profile_bird = (game: BIRD.GameState) => {
  const bird = game.profile_scene.bird;

  if (bird === null) {
    return;
  }

  offer_parent(game, bird);
};

export const rename_profile_bird = (game: BIRD.GameState) => {
  const bird = game.profile_scene.bird;

  if (bird === null) {
    return;
  }

  const name = window.prompt('New name', bird.name)?.trim().slice(0, NAME_MAX_LENGTH) ?? '';

  if (name === '' || name === bird.name) {
    return;
  }

  bird.name = name;
  update_shown(game, game.collection_scene);
  request_save(game);
};

export const release_profile_bird = (engine: BIRD.EngineContext, game: BIRD.GameState) => {
  const scene = game.profile_scene;
  const bird = scene.bird;

  scene.release_armed = false;

  if (bird === null || !can_release_bird(game)) {
    return;
  }

  const collection = game.collection_scene;
  const index = collection.shown.indexOf(bird);

  release_bird(engine, game, bird);
  update_shown(game, collection);

  const shown = collection.shown;

  scene.bird = index === -1 ? null : (shown[Math.min(index, shown.length - 1)] ?? null);
};

export const close_profile = (game: BIRD.GameState) => {
  const collection = game.collection_scene;
  const index =
    game.profile_scene.bird === null ? -1 : collection.shown.indexOf(game.profile_scene.bird);

  game.current_scene = 'collection';
  game.profile_scene.bird = null;
  clear_bird_hover(collection.hover);

  if (index === -1 || collection.columns === 0) {
    return;
  }

  show_collection_row(collection, index);
};
