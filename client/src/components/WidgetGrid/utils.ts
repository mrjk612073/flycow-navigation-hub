import type { WidgetSize } from '@shared/api.interface';

export function mapSizeToWidgetSize(sizeW: number, sizeH: number): WidgetSize {
  if (sizeW >= 3 && sizeH >= 2) return 'xl';
  if (sizeW >= 2 && sizeH >= 3) return 'xl';
  if ((sizeW >= 2 && sizeH >= 2) || sizeW >= 3 || sizeH >= 3) return 'lg';
  if ((sizeW === 2 && sizeH === 1) || (sizeW === 1 && sizeH === 2)) return 'md';
  return 'sm';
}

export function getSizeLabel(sizeW: number, sizeH: number): string {
  return `${sizeW} × ${sizeH}`;
}

export interface SizePreset {
  label: string;
  w: number;
  h: number;
}

export const SIZE_PRESETS: SizePreset[] = [
  { label: '1×1', w: 1, h: 1 },
  { label: '2×1', w: 2, h: 1 },
  { label: '1×2', w: 1, h: 2 },
  { label: '2×2', w: 2, h: 2 },
  { label: '3×1', w: 3, h: 1 },
  { label: '4×1', w: 4, h: 1 },
];
