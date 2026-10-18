import type { EngineContext as EngineContextBase } from '../engine/engine';
import type { IdleScheduler } from '../engine/idle';
import type { LazySprite } from '../engine/lazy_sprite';
import type { PersistentCache } from '../engine/persistent';
import type { Workers } from '../engine/worker';
import type { AtlasSprite } from '../game/entities/birds/bird.atlas';
import type { BirdBehaviour, CacheEntry, GeneGroup } from '../game/entities/birds/bird.generator';
import type { BirdSpriteWarmer } from '../game/entities/birds/bird.warmer';
import type { Flight } from '../game/entities/birds/birds.flight';
import type { Play } from '../game/entities/birds/birds.play';
import type { Bath } from '../game/entities/birds/birds.bath';
import type { Gift, Temper } from '../game/entities/birds/birds.character';
import type { Camera, Rect } from '../game/entities/camera/camera';
import type { CameraFollow } from '../game/entities/camera/camera.follow';
import type { CameraGlide } from '../game/entities/camera/camera.glide';
import type { AutoFollow } from '../game/entities/camera/camera.auto_follow';
import type { Cloud } from '../game/entities/sky/clouds';
import type { DayCycle } from '../game/entities/sky/sky';
import type { BirdHover } from '../game/entities/birds/birds.hover';
import type { DebugHud } from '../game/entities/debug_hud/debug_hud';
import type { UiFade } from '../game/entities/ui/ui_fade';
import type { Notice } from '../game/entities/notices/notices';
import type { AchievementsState } from '../game/entities/achievements/achievements';
import type { Tree } from '../game/entities/tree/tree';
import type { CollectionSort } from '../game/scenes/collection/collection.state';

declare global {
  namespace BIRD {
    type EngineResources = {
      workers: Workers;
      persistent: PersistentCache;
      bird_sprite_warmer: BirdSpriteWarmer;
      sun: LazySprite;
      moon: LazySprite;
      stars: LazySprite;
      clouds: LazySprite[];
      tree: LazySprite;
      next_tree: LazySprite;
    };

    type EngineContext = EngineContextBase<EngineResources>;

    type Bird = {
      behaviour: BirdBehaviour;
      drawn: CacheEntry<AtlasSprite> | null;
      drawn_code: number;
      name: string;
      x: number;
      y: number;
      platform: number;
      walk_target: number | null;
      walk_pause: number;
      flight: Flight | null;
      fly_pause: number;
      playing: boolean;
      bathing: boolean;
      age: number;
      adult_age: number;
      rest_until: number;
      breeds: number;
      joy: number;
      suppressed: GeneGroup | null;
      dominant: GeneGroup | null;
      temper: Temper;
      gift: Gift;
    };

    type LoadingScene = {
      started_at: number;
    };

    type PrimaryScene = {
      bounds: Rect;
      camera: Camera;
      camera_follow: CameraFollow;
      camera_glide: CameraGlide;
      auto_follow: AutoFollow;
      bird_hover: BirdHover;
      tree: Tree;
      next_tree: Tree | null;
      day: DayCycle;
      clouds: Cloud[];
      plays: Play[];
      play_pause: number;
      baths: Bath[];
      sand_pause: number;
      water_pause: number;
    };

    type CollectionScene = {
      camera: Camera;
      columns: number;
      rarities: number;
      breedable: boolean;
      sort: CollectionSort;
      shown: Bird[];
      of_rarity: Bird[];
      shown_for: number;
      counts: number[];
      breedable_count: number;
      grid_height: number;
      hover: BirdHover;
    };

    type ProfileScene = {
      bird: Bird | null;
      release_armed: boolean;
      gene_dialog: GeneRole | null;
      gene_choice: GeneGroup | null;
      gene_armed: boolean;
    };

    type BreedingScene = {
      parents: [Bird | null, Bird | null];
      picking: number;
      no_room: boolean;
    };

    type HatchScene = {
      bird: Bird | null;
      elapsed: number;
      hatch_at: number;
      hatched: boolean;
    };

    type SaveState = {
      since: number;
      dirty: boolean;
      stopped: boolean;
    };

    type GeneRole = 'suppress' | 'dominant';

    type SceneName =
      'loading' | 'primary' | 'collection' | 'profile' | 'breeding' | 'hatch' | 'achievements';

    type AchievementsScene = {
      content_height: number;
      card_top: Float64Array;
    };

    type GameState = {
      birds: Bird[];
      idle: IdleScheduler;
      debug_hud: DebugHud;
      ui_fade: UiFade;
      notices: Notice[];
      notices_scene: SceneName;
      achievements: AchievementsState;

      current_scene: SceneName;
      loading_scene: LoadingScene;
      primary_scene: PrimaryScene;
      collection_scene: CollectionScene;
      profile_scene: ProfileScene;
      breeding_scene: BreedingScene;
      hatch_scene: HatchScene;
      achievements_scene: AchievementsScene;

      save: SaveState;

      is_in_screenshot_mode: boolean;
    };
  }

  interface Window {
    __ENGINE__?: { engine: EngineContextBase<BIRD.EngineResources>; game: unknown };
  }
}

declare module 'bun:bundle' {
  interface Registry {
    features: 'DEV';
  }
}
