/**
 * 字节数人性化展示
 */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

/** 压缩率百分比（保留 1 位小数） */
export function ratioPercent(original: number, processed: number): string {
  if (!original || !processed) return '—';
  const r = (1 - processed / original) * 100;
  return `${r >= 0 ? '-' : '+'}${Math.abs(r).toFixed(1)}%`;
}
