/**
 * 图片处理核心 Hook
 * - processImage: 对单张 ImageFile 执行压缩/旋转/裁剪/格式转换
 * - processOne / processAll: 便捷方法，自动更新 Context 状态
 * - 依赖 @jsquash/* WASM 编码器（见 utils/encoders.ts）
 */
import { useCallback } from 'react';
import { compressImage } from '@/utils/compress';
import { ensureEncodersReady } from '@/utils/encoders';
import { useImageContext } from '@/context/ImageContext';
import type { ImageFile } from '@/types';

export function useImageProcessing() {
  const { images, updateImage } = useImageContext();

  /**
   * 纯函数式处理：读取 file，按参数压缩，返回 Blob。
   * 不修改任何 Context 状态，便于复用。
   * 若编码器未就绪，会先 await init（idempotent）。
   */
  const processImage = useCallback(
    async (image: ImageFile): Promise<Blob> => {
      await ensureEncodersReady();
      return compressImage(image.file, {
        quality: image.quality,
        format: image.outputFormat,
        originalFormat: image.originalFormat,
        rotation: image.rotation,
        flipHorizontal: image.flipHorizontal,
        crop: image.crop,
        targetWidth: image.targetWidth,
        targetHeight: image.targetHeight,
      });
    },
    [],
  );

  /** 处理单张并写回 Context */
  const processOne = useCallback(
    async (id: string): Promise<Blob | null> => {
      const img = images.find((i) => i.id === id);
      if (!img) return null;
      await ensureEncodersReady();
      updateImage(id, { processing: true });
      try {
        const blob = await compressImage(img.file, {
          quality: img.quality,
          format: img.outputFormat,
          originalFormat: img.originalFormat,
          rotation: img.rotation,
          flipHorizontal: img.flipHorizontal,
          crop: img.crop,
          targetWidth: img.targetWidth,
          targetHeight: img.targetHeight,
        });
        const prevUrl = img.processedUrl;
        const url = URL.createObjectURL(blob);
        updateImage(id, {
          processedBlob: blob,
          processedSize: blob.size,
          processedUrl: url,
          processing: false,
        });
        // 释放旧 URL
        if (prevUrl) URL.revokeObjectURL(prevUrl);
        return blob;
      } catch (e) {
        updateImage(id, { processing: false });
        throw e;
      }
    },
    [images, updateImage],
  );

  /** 批量处理所有图片（带并发限制） */
  const processAll = useCallback(async () => {
    const pending = images.filter((i) => !i.processing);
    const CONCURRENCY = 2;
    const queue = [...pending];
    const workers = Array.from({ length: CONCURRENCY }, async () => {
      while (queue.length) {
        const item = queue.shift();
        if (!item) break;
        // eslint-disable-next-line no-await-in-loop
        try {
          await processOne(item.id);
        } catch {
          /* 忽略单张失败 */
        }
      }
    });
    await Promise.all(workers);
  }, [images, processOne]);

  return { processImage, processOne, processAll };
}
