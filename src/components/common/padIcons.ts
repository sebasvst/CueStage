import {
  Activity,
  Bell,
  Cloud,
  Drum,
  Droplet,
  Flame,
  Footprints,
  Gavel,
  Ghost,
  Heart,
  Megaphone,
  Rabbit,
  Sparkles,
  Star,
  TriangleAlert,
  Wind,
  Zap,
  type LucideIcon,
} from 'lucide-react';

/**
 * Icons available for the sound pads.
 *
 * The list is explicit on purpose: importing the whole Lucide catalogue would
 * add several hundred kilobytes to the bundle for icons that are never used.
 */
export const PAD_ICONS: Record<string, LucideIcon> = {
  zap: Zap,
  drum: Drum,
  bell: Bell,
  sparkles: Sparkles,
  droplet: Droplet,
  flame: Flame,
  wind: Wind,
  footprints: Footprints,
  gavel: Gavel,
  star: Star,
  heart: Heart,
  megaphone: Megaphone,
  ghost: Ghost,
  rabbit: Rabbit,
  cloud: Cloud,
  alert: TriangleAlert,
};

export const PAD_ICON_NAMES = Object.keys(PAD_ICONS);

export const DEFAULT_PAD_ICON = Activity;
