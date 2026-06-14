/**
 * SqueezePic 全局类型定义
 */

/** 支持的输出格式 */
export type OutputFormat = 'original' | 'jpeg' | 'png' | 'webp';

/** 裁剪区域（像素坐标，相对原图） */
export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 单张图片文件 */
export interface ImageFile {
  /** 唯一 id（通常用 crypto.randomUUID） */
  id: string;
  /** 原始 File 对象 */
  file: File;
  /** 原始字节数 */
  originalSize: number;
  /** 原始 MIME 格式 */
  originalFormat: string;
  /** 原始图片名（含扩展名） */
  name: string;
  /** 缩略图预览 URL（createObjectURL 生成） */
  previewUrl: string;
  /** 是否正在处理（压缩中） */
  processing: boolean;
  /** 压缩后 Blob */
  processedBlob?: Blob;
  /** 压缩后预览 URL */
  processedUrl?: string;
  /** 压缩后大小（字节） */
  processedSize?: number;
  /** 输出格式 */
  outputFormat: OutputFormat;
  /** 压缩质量 1-100 */
  quality: number;
  /** 旋转角度（度） */
  rotation: number;
  /** 水平翻转（镜像） */
  flipHorizontal: boolean;
  /** 裁剪区域 */
  crop?: CropArea;
  /** 目标输出宽度（px）—— 调整尺寸 */
  targetWidth?: number;
  /** 目标输出高度（px）—— 调整尺寸 */
  targetHeight?: number;
  /** 是否保持宽高比（默认 true） */
  keepAspectRatio?: boolean;
}

/** 全局设置（默认应用到全部） */
export interface GlobalSettings {
  quality: number;
  format: OutputFormat;
  applyToAll: boolean;
}

/** Context 暴露的方法 */
export interface ImageContextValue {
  images: ImageFile[];
  selectedId: string | null;
  globalSettings: GlobalSettings;
  /** WASM 编码器是否已就绪（@jsquash/jpeg + png + webp 加载完成） */
  encoderReady: boolean;
  /** 编码器初始化失败信息；null 表示没有错误 */
  encoderError: string | null;
  /** 临时保留总时长（ms）— 当前固定 30 分钟 */
  retentionMs: number;
  /** 距离下次自动清理的剩余毫秒数；无图片时等于 retentionMs */
  remainingMs: number;
  addImages: (files: File[]) => void;
  removeImage: (id: string) => void;
  removeImages: (ids: string[]) => void;
  updateImage: (id: string, patch: Partial<ImageFile>) => void;
  selectImage: (id: string | null) => void;
  setGlobalSettings: (patch: Partial<GlobalSettings>) => void;
  applyGlobalToAll: () => void;
  clearAll: () => void;
}
