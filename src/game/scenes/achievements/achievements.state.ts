import { CARD_COUNT } from '../../entities/achievements/achievements';

export const create_achievements_scene = (): BIRD.AchievementsScene => ({
  content_height: 0,
  card_top: new Float64Array(CARD_COUNT + 1),
});
