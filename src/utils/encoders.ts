/**
 * 专业图片编码器封装（基于 @jsquash/* WASM）
 * - 动态 import 不阻塞首屏
 * - 首次调用时初始化（加载 WASM）
 * - 统一 encodeImage 入口，按 outputFormat 分发
 */
import type { OutputFormat } from '@/types';

/* -------------------------------------------------------------------------- */
/*  WASM 初始化（懒加载 + 缓存）                                              */
/* -------------------------------------------------------------------------- */

type Encoder = (data: ImageData, options?: any) => Promise<ArrayBuffer>;

let _jpegEnc: Encoder | null = null;
let _pngEnc: Encoder | null = null;
let _webpEnc: Encoder | null = null;
let _initPromise: Promise<void> | null = null;
let _initialized = false;

/** 内部：加载模块 + 初始化 WASM（仅一次） */
async function _loadAll(): Promise<void> {
  // 直接 import 内部的 encode 子模块 — 它同时导出 default encode 与 init 函数
  const [jpegMod, pngMod, webpMod] = await Promise.all([
    import('@jsquash/jpeg/encode'),
    import('@jsquash/png/encode'),
    import('@jsquash/webp/encode'),
  ]);
  await Promise.all([jpegMod.init(), pngMod.init(), webpMod.init()]);
  _jpegEnc = jpegMod.default as Encoder;
  _pngEnc = pngMod.default as Encoder;
  _webpEnc = webpMod.default as Encoder;
  _initialized = true;
}

/**
 * 确保编码器已就绪。可被并发调用，多次调用复用同一 Promise。
 * - 已就绪：立即 resolve
 * - 未就绪：触发 init；后续 await 自动共享
 */
export function ensureEncodersReady(): Promise<void> {
  if (_initialized) return Promise.resolve();
  if (_initPromise) return _initPromise;
  _initPromise = _loadAll().catch((err) => {
    // 失败时清空 promise，让下次重试
    _initPromise = null;
    throw err;
  });
  return _initPromise;
}

/** 同步判断是否已就绪（用于 UI 状态展示） */
export function isEncoderReady(): boolean {
  return _initialized;
}

/* -------------------------------------------------------------------------- */
/*  三个具体编码器（接受浏览器原生 ImageData）                                */
/* -------------------------------------------------------------------------- */

/** MozJPEG（JPEG）— quality 0-100 */
export async function compressJPEG(
  imageData: ImageData,
  quality: number,
): Promise<Blob> {
  await ensureEncodersReady();
  if (!_jpegEnc) throw new Error('JPEG encoder 未初始化');
  const q = Math.min(100, Math.max(1, Math.round(quality)));
  const buf = await _jpegEnc(imageData, { quality: q });
  return new Blob([buf], { type: 'image/jpeg' });
}

/** OxiPNG（PNG）— 无损优化，无需 quality */
export async function compressPNG(imageData: ImageData): Promise<Blob> {
  await ensureEncodersReady();
  if (!_pngEnc) throw new Error('PNG encoder 未初始化');
  const buf = await _pngEnc(imageData);
  return new Blob([buf], { type: 'image/png' });
}

/** WebP（有损）— quality 0-100 */
export async function compressWebP(
  imageData: ImageData,
  quality: number,
): Promise<Blob> {
  await ensureEncodersReady();
  if (!_webpEnc) throw new Error('WebP encoder 未初始化');
  const q = Math.min(100, Math.max(1, Math.round(quality)));
  const buf = await _webpEnc(imageData, { quality: q });
  return new Blob([buf], { type: 'image/webp' });
}

/* -------------------------------------------------------------------------- */
/*  统一入口                                                                  */
/* -------------------------------------------------------------------------- */

/** 原图 MIME → 推荐的编码器（用于 format='original'） */
function pickEncoderByMime(
  originalMime: string,
): 'jpeg' | 'png' | 'webp' | null {
  const m = (originalMime || '').toLowerCase();
  if (m === 'image/jpeg' || m === 'image/jpg') return 'jpeg';
  if (m === 'image/png') return 'png';
  if (m === 'image/webp') return 'webp';
  return null; // SVG / GIF / 其他 → 走 Canvas 兜底
}

/**
 * 统一编码入口
 * @param imageData 浏览器原生 ImageData（来自 Canvas.getContext('2d').getImageData）
 * @param outputFormat 目标格式；'original' 时按 originalMime 自动选
 * @param quality 1-100；PNG 忽略
 * @param originalMime 当 outputFormat='original' 时必传，决定走哪个编码器
 */
export async function encodeImage(
  imageData: ImageData,
  outputFormat: OutputFormat,
  quality: number,
  originalMime?: string,
): Promise<Blob> {
  // 1) 决定走哪个编码器
  let encoder: 'jpeg' | 'png' | 'webp' | null;
  if (outputFormat === 'original') {
    encoder = pickEncoderByMime(originalMime || '');
  } else {
    encoder = outputFormat;
  }

  // 2) 调对应编码器
  if (encoder === 'jpeg') return compressJPEG(imageData, quality);
  if (encoder === 'png') return compressPNG(imageData);
  if (encoder === 'webp') return compressWebP(imageData, quality);

  // 3) SVG / GIF / 不支持的格式：抛出错误，让调用方走 Canvas 兜底
  throw new Error(`UNSUPPORTED_FORMAT:${originalMime || 'unknown'}`);
}
