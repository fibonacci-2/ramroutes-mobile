import { IconName } from '../components/Icon';
import { color } from '../theme';
import { Tag } from './tags';

// Extends design/Quad Campus Events.html's CATS table (icon + bg + tint + ink
// per category) to our real 11-tag taxonomy instead of the mockup's invented
// 6 categories - same visual mechanism (colored pin, tinted chip), real tags.
// Alternates the accent (terracotta) and accent2 (sage) ramps like the mockup.
type TagStyle = { icon: IconName; pinBg: string; tint: string; ink: string };

export const TAG_STYLES: Record<Tag, TagStyle> = {
  academic: { icon: 'book', pinBg: color.accent600, tint: color.accent200, ink: color.accent800 },
  sports: { icon: 'trophy', pinBg: color.accent2_600, tint: color.accent2_200, ink: color.accent2_800 },
  arts: { icon: 'music', pinBg: color.accent500, tint: color.accent200, ink: color.accent800 },
  social: { icon: 'users', pinBg: color.accent2_500, tint: color.accent2_200, ink: color.accent2_800 },
  food: { icon: 'food', pinBg: color.accent700, tint: color.accent200, ink: color.accent800 },
  career: { icon: 'brief', pinBg: color.accent800, tint: color.accent200, ink: color.accent800 },
  cultural: { icon: 'cultural', pinBg: color.accent2_700, tint: color.accent2_200, ink: color.accent2_800 },
  spiritual: { icon: 'spiritual', pinBg: color.accent400, tint: color.accent200, ink: color.accent800 },
  tech: { icon: 'tech', pinBg: color.accent2_800, tint: color.accent2_200, ink: color.accent2_800 },
  fitness: { icon: 'fitness', pinBg: color.accent2_400, tint: color.accent2_200, ink: color.accent2_800 },
  'mental-health': { icon: 'heart', pinBg: color.accent2_900, tint: color.accent2_200, ink: color.accent2_800 },
  'greek life': { icon: 'greekLife', pinBg: color.accent900, tint: color.accent2_200, ink: color.accent2_800 },
};

// An event's "primary" tag for pin/icon purposes - our schema allows several
// tags per event (unlike the mockup's one exclusive category), so pick the
// first in taxonomy order for a stable, deterministic choice.
export function primaryTagStyle(tags: string[] | undefined): TagStyle {
  const first = tags?.find((t): t is Tag => t in TAG_STYLES);
  return first ? TAG_STYLES[first] : TAG_STYLES.social;
}
