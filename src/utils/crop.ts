// 占位 - 裁剪逻辑
import type { CropArea } from '@/types';

export function applyCrop(
  source: CanvasImageSource,
  crop: CropArea,
  width: number,
  height: number,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.drawImage(source, crop.x, crop.y, crop.width, crop.height, 0, 0, width, height);
  return canvas;
}
