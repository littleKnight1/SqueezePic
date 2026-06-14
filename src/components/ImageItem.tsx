/**
 * 单张图片项
 * - 缩略图 / 文件名 / 原始大小 / 格式 / 压缩进度
 * - 选中高亮 + 删除 + 单张下载
 */
import { useImageContext } from '@/context/ImageContext';
import { useImageProcessing } from '@/hooks/useImageProcessing';
import { downloadBlob } from '@/utils/download';
import { buildOutputName } from '@/utils/format';
import { formatBytes } from '@/utils/units';
import type { ImageFile } from '@/types';
import Spinner from './Spinner';

interface Props {
  image: ImageFile;
  active?: boolean;
  onClick?: () => void;
}

function formatTag(format: string): string {
  if (!format) return 'IMG';
  const m = format.match(/image\/(.+)/);
  return (m?.[1] ?? format).toUpperCase();
}

export default function ImageItem({ image, active, onClick }: Props) {
  const { removeImage } = useImageContext();
  const { processOne } = useImageProcessing();

  const onDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (image.processedBlob) {
      downloadBlob(image.processedBlob, buildOutputName(image.name, image.outputFormat));
    } else {
      // 还没处理：先压缩再下载
      processOne(image.id).then((blob) => {
        if (blob) downloadBlob(blob, buildOutputName(image.name, image.outputFormat));
      });
    }
  };

  const ratio =
    image.processedSize && image.originalSize
      ? 1 - image.processedSize / image.originalSize
      : null;

  /** 是否经过编辑（旋转/裁剪/翻转/调尺寸） */
  const hasEditing =
    image.rotation !== 0 ||
    !!image.crop ||
    image.flipHorizontal ||
    !!(image.targetWidth && image.targetHeight);

  return (
    <button
      onClick={onClick}
      className={[
        'group relative aspect-square rounded-xl overflow-hidden border text-left transition animate-fade-in',
        active
          ? 'border-accent shadow-glow-sm ring-1 ring-accent/40'
          : 'border-white/10 hover:border-white/30',
      ].join(' ')}
    >
      {/* 缩略图：已处理则优先展示处理结果；即时预览翻转 */}
      <img
        src={image.processedUrl ?? image.previewUrl}
        alt={image.name}
        className="w-full h-full object-cover transition group-hover:scale-105"
        loading="lazy"
        style={{ transform: image.flipHorizontal ? 'scaleX(-1)' : undefined }}
      />

      {/* 格式角标 */}
      <span className="absolute top-1.5 left-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-black/60 text-white/80 backdrop-blur">
        {formatTag(image.originalFormat)}
      </span>

      {/* 压缩率 / 状态徽章 */}
      {ratio !== null && image.processedSize && (
        <span
          className={[
            'absolute top-1.5 right-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded backdrop-blur',
            ratio > 0.005
              ? 'bg-emerald-500/20 text-emerald-300'
              : ratio < -0.005
              ? 'bg-amber-500/20 text-amber-300'
              : 'bg-white/10 text-white/60',
          ].join(' ')}
          title={
            ratio > 0.005
              ? `压缩后减小 ${(ratio * 100).toFixed(1)}%`
              : ratio < -0.005
              ? hasEditing
                ? `编辑后文件变大 ${Math.abs((ratio * 100)).toFixed(1)}%（保留编辑结果）`
                : `重处理后变大 ${Math.abs((ratio * 100)).toFixed(1)}%`
              : '大小基本不变'
          }
        >
          {ratio > 0.005
            ? `↓ ${(ratio * 100).toFixed(0)}%`
            : ratio < -0.005
            ? hasEditing
              ? '编辑后变大'
              : `↑ ${Math.abs((ratio * 100)).toFixed(0)}%`
            : '持平'}
        </span>
      )}

      {/* 处理中遮罩 */}
      {image.processing && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center gap-2">
          <Spinner size={26} />
          <span className="text-[11px] text-white/80">压缩中...</span>
        </div>
      )}

      {/* 底部信息 */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-2">
        <p className="text-[11px] font-medium truncate text-white">{image.name}</p>
        <div className="flex items-center justify-between text-[10px] text-white/60 mt-0.5">
          <span>{formatBytes(image.originalSize)}</span>
          {image.processedSize && (
            <span>→ {formatBytes(image.processedSize)}</span>
          )}
        </div>
      </div>

      {/* 悬浮操作：下载 / 删除 */}
      <div className="absolute bottom-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition">
        <span
          role="button"
          tabIndex={0}
          onClick={onDownload}
          onKeyDown={(e) => (e.key === 'Enter' ? onDownload(e as any) : null)}
          className="w-6 h-6 rounded-full bg-accent/90 text-ink-900 flex items-center justify-center hover:bg-accent"
          title="下载"
        >
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.4">
            <path d="M12 4v12m0 0l-4-4m4 4l4-4M5 20h14" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            removeImage(image.id);
          }}
          className="w-6 h-6 rounded-full bg-black/70 text-white/80 flex items-center justify-center hover:bg-red-500/80"
          title="删除"
        >
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.4">
            <path d="M6 6l12 12M18 6l-12 12" strokeLinecap="round" />
          </svg>
        </span>
      </div>
    </button>
  );
}
