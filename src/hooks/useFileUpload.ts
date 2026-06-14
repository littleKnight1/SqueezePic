/**
 * 文件上传 Hook
 * - 校验：MIME / 单文件 ≤ 20MB / 总数 ≤ 30
 * - 调用 Context.addImages 注入列表
 * - 返回 errors 数组由 UI 自行展示
 */
import { useCallback, useMemo } from 'react';
import { useImageContext } from '@/context/ImageContext';

export const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
export const MAX_FILES = 30;
export const ACCEPT_MIME = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/svg+xml',
];

export interface UploadError {
  fileName: string;
  reason: string;
}

export function useFileUpload() {
  const { addImages, images } = useImageContext();

  const remaining = useMemo(() => MAX_FILES - images.length, [images.length]);

  const validate = useCallback(
    (files: File[]): { valid: File[]; errors: UploadError[] } => {
      const valid: File[] = [];
      const errors: UploadError[] = [];
      let slots = Math.max(0, MAX_FILES - images.length);
      for (const f of files) {
        if (!ACCEPT_MIME.includes(f.type)) {
          errors.push({ fileName: f.name, reason: `不支持的格式（${f.type || '未知'}）` });
          continue;
        }
        if (f.size > MAX_FILE_SIZE) {
          errors.push({
            fileName: f.name,
            reason: `超过 20MB（实际 ${(f.size / 1024 / 1024).toFixed(1)}MB）`,
          });
          continue;
        }
        if (slots <= 0) {
          errors.push({ fileName: f.name, reason: `已达 ${MAX_FILES} 张上限` });
          continue;
        }
        valid.push(f);
        slots -= 1;
      }
      return { valid, errors };
    },
    [images.length],
  );

  const upload = useCallback(
    (files: File[]): UploadError[] => {
      const { valid, errors } = validate(files);
      if (valid.length) addImages(valid);
      return errors;
    },
    [addImages, validate],
  );

  return { upload, validate, remaining, maxFiles: MAX_FILES, maxSize: MAX_FILE_SIZE };
}
