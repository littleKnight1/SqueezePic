/**
 * 图片列表：响应式网格，支持选中、清空
 */
import { useImageContext } from '@/context/ImageContext';
import ImageItem from './ImageItem';

export default function ImageList() {
  const { images, selectedId, selectImage, clearAll, removeImage } = useImageContext();

  if (images.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 bg-ink-800/30 p-10 sm:p-14 text-center transition hover:border-accent/30 hover:bg-ink-800/50">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-accent-soft flex items-center justify-center text-2xl text-accent mb-4 animate-float">
          <svg viewBox="0 0 24 24" className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="1.6">
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <circle cx="9" cy="11" r="1.6" />
            <path d="M21 17l-5-6-4 5-3-3-6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <p className="text-base font-semibold text-white/80">还没有图片</p>
        <p className="text-sm text-white/45 mt-1.5 max-w-xs mx-auto">
          拖拽图片到上方上传区，或点击 / 粘贴 (Ctrl+V) 即可批量添加
        </p>
      </div>
    );
  }

  const totalOriginal = images.reduce((s, i) => s + i.originalSize, 0);
  const totalProcessed = images.reduce((s, i) => s + (i.processedSize ?? 0), 0);
  const allProcessed = images.every((i) => i.processedBlob);

  return (
    <section>
      {/* 列表头 */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-white/80">
            图片列表{' '}
            <span className="text-white/40 font-normal">· {images.length} 张</span>
          </h3>
          <p className="text-[11px] text-white/40 mt-0.5">
            总大小：{Math.round(totalOriginal / 1024)} KB
            {allProcessed && totalProcessed > 0 && (
              <> → {Math.round(totalProcessed / 1024)} KB</>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          {selectedId && (
            <button
              onClick={() => removeImage(selectedId)}
              className="btn-ghost !py-1 !px-2 text-[11px]"
            >
              删除选中
            </button>
          )}
          <button
            onClick={() => {
              if (window.confirm('确定清空所有图片？')) clearAll();
            }}
            className="btn-ghost !py-1 !px-2 text-[11px] hover:!border-red-500/50 hover:!text-red-300"
          >
            清空
          </button>
        </div>
      </div>

      {/* 网格 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {images.map((img) => (
          <ImageItem
            key={img.id}
            image={img}
            active={img.id === selectedId}
            onClick={() => selectImage(img.id)}
          />
        ))}
      </div>
    </section>
  );
}
