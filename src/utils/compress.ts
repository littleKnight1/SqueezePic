/**
 * 核心图片压缩工具
 * 流程：File → Image → Canvas（旋转/裁剪/翻转/缩放）→ ImageData → 专业 WASM 编码器
 * - JPEG/PNG/WebP 全部走 @jsquash/* (MozJPEG / OxiPNG / WebP)
 * - SVG / GIF 等不支持的格式降级到 Canvas.toBlob
 */
import type { CropArea, OutputFormat } from '@/types';
import { encodeImage, ensureEncodersReady } from './encoders';

export interface CompressOptions {
  quality: number; // 1-100
  format: OutputFormat;
  /** 原始 MIME（由扩展名回退推断，比 file.type 更稳） */
  originalFormat?: string;
  rotation?: number; // 0/90/180/270
  flipHorizontal?: boolean;
  crop?: CropArea;
  /** 目标输出宽度（px） */
  targetWidth?: number;
  /** 目标输出高度（px） */
  targetHeight?: number;
  /** 旧字段：maxSize 长边限制（向后兼容） */
  maxSize?: number;
}

const FORMAT_MIME: Record<Exclude<OutputFormat, 'original'>, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

/** 把 File 解析为 HTMLImageElement（避开 createImageBitmap 的浏览器兼容性） */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

/** 解析目标 MIME：original 取原文件 type；SVG 降级 PNG */
function resolveMime(format: OutputFormat, originalType: string): string {
  if (format === 'original') {
    if (originalType === 'image/svg+xml') return 'image/png';
    return originalType || 'image/png';
  }
  return FORMAT_MIME[format];
}

/**
 * 在新 Canvas 中绘制并按 rotation/裁剪/翻转 变换图像
 */
function drawTransformed(
  img: HTMLImageElement,
  rotation: number,
  crop: CropArea | undefined,
  flipHorizontal: boolean,
): HTMLCanvasElement {
  const rot = ((rotation % 360) + 360) % 360;
  const swap = rot === 90 || rot === 270;

  // 1. 决定"源"区域
  const srcX = crop?.x ?? 0;
  const srcY = crop?.y ?? 0;
  const srcW = crop?.width ?? img.naturalWidth;
  const srcH = crop?.height ?? img.naturalHeight;

  // 2. 输出画布尺寸：旋转 90/270 时宽高对调
  const w = swap ? srcH : srcW;
  const h = swap ? srcW : srcH;

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w));
  canvas.height = Math.max(1, Math.round(h));
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // 3. 应用旋转变换
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((rot * Math.PI) / 180);
  if (flipHorizontal) {
    ctx.scale(-1, 1);
  }
  ctx.drawImage(
    img,
    srcX,
    srcY,
    srcW,
    srcH,
    -srcW / 2,
    -srcH / 2,
    srcW,
    srcH,
  );

  return canvas;
}

/** Canvas 缩放到目标宽高 */
function resizeCanvas(
  source: HTMLCanvasElement,
  targetW: number,
  targetH: number,
): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = Math.max(1, Math.round(targetW));
  out.height = Math.max(1, Math.round(targetH));
  const ctx = out.getContext('2d');
  if (!ctx) return out;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, out.width, out.height);
  return out;
}

/**
 * JPEG 编码前填充白色背景（避免黑底）
 */
function flattenToWhite(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const buf = document.createElement('canvas');
  buf.width = canvas.width;
  buf.height = canvas.height;
  const bctx = buf.getContext('2d');
  if (!bctx) return canvas;
  bctx.fillStyle = '#ffffff';
  bctx.fillRect(0, 0, buf.width, buf.height);
  bctx.drawImage(canvas, 0, 0);
  return buf;
}

/** Canvas 兜底编码（仅 SVG / GIF 等不支持的格式走这里） */
function canvasToBlobFallback(
  canvas: HTMLCanvasElement,
  mime: string,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Canvas toBlob 返回空'));
      },
      mime,
      Math.min(1, Math.max(0.01, quality / 100)),
    );
  });
}

/**
 * 压缩入口
 * - 编码器未就绪时先 await ensureEncodersReady（来自 encoders.ts）
 * - JPEG/PNG/WebP 走 @jsquash/* WASM
 * - SVG / GIF 等不支持的格式降级 Canvas
 */
export async function compressImage(
  file: File,
  options: CompressOptions,
): Promise<Blob> {
  const {
    quality,
    format,
    rotation = 0,
    crop,
    flipHorizontal = false,
    targetWidth,
    targetHeight,
    maxSize,
    originalFormat,
  } = options;

  const originalMime = originalFormat || file.type || '';
  const targetMime = resolveMime(format, originalMime);

  // 1. 加载并变换
  const img = await loadImage(file);
  let canvas = drawTransformed(img, rotation, crop, flipHorizontal);

  // 2. 调尺寸
  if (targetWidth && targetHeight && targetWidth > 0 && targetHeight > 0) {
    canvas = resizeCanvas(canvas, targetWidth, targetHeight);
  } else if (
    !targetWidth && !targetHeight &&
    maxSize && (canvas.width > maxSize || canvas.height > maxSize)
  ) {
    const scale = Math.min(maxSize / canvas.width, maxSize / canvas.height);
    const w = Math.max(1, Math.round(canvas.width * scale));
    const h = Math.max(1, Math.round(canvas.height * scale));
    canvas = resizeCanvas(canvas, w, h);
  }

  // 3. 编码
  // 3a) JPEG：先填白再编码
  const isJpeg = targetMime === 'image/jpeg';
  const sourceCanvas = isJpeg ? flattenToWhite(canvas) : canvas;

  // 3b) 提取 ImageData
  const ctx = sourceCanvas.getContext('2d');
  if (!ctx) throw new Error('无法获取 Canvas 2D 上下文');
  const imageData = ctx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);

  // 3c) 调专业编码器（保证已 init）
  await ensureEncodersReady();
  try {
    return await encodeImage(imageData, format, quality, originalMime);
  } catch (e) {
    // UNSUPPORTED_FORMAT（SVG / GIF / 其他）→ Canvas 兜底
    if (e instanceof Error && e.message.startsWith('UNSUPPORTED_FORMAT')) {
      return canvasToBlobFallback(sourceCanvas, targetMime, quality);
    }
    throw e;
  }
}
