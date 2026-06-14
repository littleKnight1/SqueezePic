/**
 * JSZip 批量打包
 */
import JSZip from 'jszip';
import { downloadBlob } from './download';
import { buildOutputName } from './format';
import type { ImageFile } from '@/types';

/** 单张/多张逐个下载（不走 ZIP） */
export function downloadSelected(images: ImageFile[]): void {
  images.forEach((img, idx) => {
    if (!img.processedBlob) return;
    // 错开触发，避免浏览器把多个下载合并拦截
    setTimeout(() => {
      downloadBlob(img.processedBlob!, buildOutputName(img.name, img.outputFormat));
    }, idx * 120);
  });
}

/** 打包 ZIP 下载 */
export async function downloadAsZip(images: ImageFile[]): Promise<void> {
  const zip = new JSZip();
  let count = 0;
  for (const img of images) {
    if (!img.processedBlob) continue;
    zip.file(buildOutputName(img.name, img.outputFormat), img.processedBlob);
    count += 1;
  }
  if (count === 0) throw new Error('没有可打包的图片，请先处理后再下载');
  const blob = await zip.generateAsync({ type: 'blob' });
  downloadBlob(blob, 'squeezepic-images.zip');
}
