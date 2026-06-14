// 占位 - 格式转换辅助（MIME / 扩展名映射）
import type { OutputFormat } from '@/types';

const MIME_MAP: Record<Exclude<OutputFormat, 'original'>, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

const EXT_MAP: Record<Exclude<OutputFormat, 'original'>, string> = {
  jpeg: 'jpg',
  png: 'png',
  webp: 'webp',
};

export function formatToMime(format: OutputFormat, originalMime = 'image/png'): string {
  return format === 'original' ? originalMime : MIME_MAP[format];
}

export function formatToExt(format: OutputFormat, originalName: string): string {
  if (format === 'original') {
    const idx = originalName.lastIndexOf('.');
    return idx >= 0 ? originalName.slice(idx + 1) : 'png';
  }
  return EXT_MAP[format];
}

export function buildOutputName(originalName: string, format: OutputFormat): string {
  const dot = originalName.lastIndexOf('.');
  const base = dot >= 0 ? originalName.slice(0, dot) : originalName;
  const ext = formatToExt(format, originalName);
  return `${base}_compressed.${ext}`;
}
