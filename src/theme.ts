import { useColorScheme } from 'react-native';

import type { CareTask, LightLevel } from '@/lib/types';

const light = {
  bg: '#F5F1E8',
  surface: '#FFFDF8',
  surfaceAlt: '#ECE6D8',
  border: '#DDD5C3',
  text: '#1F2A1F',
  textMuted: '#5E6A5C',
  primary: '#2F6B45',
  primaryText: '#FFFFFF',
  primarySoft: '#DCEBDD',
  accent: '#B5562E',
  accentSoft: '#F4DFD3',
  danger: '#A3361F',
};

const dark: typeof light = {
  bg: '#121712',
  surface: '#1B221B',
  surfaceAlt: '#253025',
  border: '#2F3B2F',
  text: '#EEF2EA',
  textMuted: '#A3AF9F',
  primary: '#7CC08F',
  primaryText: '#0E1A11',
  primarySoft: '#21392A',
  accent: '#E58D63',
  accentSoft: '#3A2419',
  danger: '#F08A6E',
};

export type Palette = typeof light;

export function usePalette(): Palette {
  return useColorScheme() === 'dark' ? dark : light;
}

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 14, lg: 20, pill: 999 } as const;

export const TASK_META: Record<CareTask, { label: string; verb: string; color: string }> = {
  water: { label: 'Water', verb: 'Watered', color: '#3B82B8' },
  fertilize: { label: 'Fertilize', verb: 'Fed', color: '#8A6D2E' },
  mist: { label: 'Mist', verb: 'Misted', color: '#4FA3A0' },
  rotate: { label: 'Rotate', verb: 'Rotated', color: '#7A6BB0' },
  clean: { label: 'Wipe leaves', verb: 'Cleaned', color: '#6C8F4E' },
  repot: { label: 'Repot', verb: 'Repotted', color: '#B5562E' },
};

export const LIGHT_LABEL: Record<LightLevel, { label: string; hint: string }> = {
  low: { label: 'Low light', hint: 'Far from windows, north-facing' },
  medium: { label: 'Medium', hint: 'A few steps from a window' },
  bright: { label: 'Bright indirect', hint: 'Near a window, no harsh sun' },
  direct: { label: 'Direct sun', hint: 'Sunny sill, several hours of sun' },
};
