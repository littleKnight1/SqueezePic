/**
 * 对比视图模态框
 * - 左右分屏：原图 vs 压缩后
 * - 两侧图片同步缩放和拖动（共享 transform 状态）
 * - 显示压缩前后大小和压缩率
 */
import { useEffect, useRef, useState } from 'react';
import { formatBytes, ratioPercent } from '@/utils/units';
import type { ImageFile } from '@/types';

interface Props {
  image: ImageFile | null;
  onClose: () => void;
}

export default function CompareView({ image, onClose }: Props) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  // 切换图片时复位
  useEffect(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, [image?.id]);

  // ESC 关闭 + body 滚动锁
  useEffect(() => {
    if (!image) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [image, onClose]);

  if (!image) return null;

  const processedSrc = image.processedUrl ?? image.previewUrl;

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.0015;
    setScale((s) => Math.min(8, Math.max(0.2, s + delta)));
  };
  const onMouseDown = (e: React.MouseEvent) => {
    dragRef.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragRef.current) return;
    setOffset({
      x: dragRef.current.ox + (e.clientX - dragRef.current.x),
      y: dragRef.current.oy + (e.clientY - dragRef.current.y),
    });
  };
  const onMouseUp = () => {
    dragRef.current = null;
  };
  const reset = () => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-6xl max-h-[92vh] rounded-2xl bg-ink-800 border border-white/10 shadow-2xl overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <header className="flex items-center justify-between px-5 h-14 border-b border-white/5">
          <div className="flex items-center gap-3 min-w-0">
            <h3 className="text-sm font-semibold text-white truncate">{image.name}</h3>
            <span className="text-[11px] text-white/40 hidden sm:inline">
              {formatBytes(image.originalSize)}
              {image.processedSize ? ` → ${formatBytes(image.processedSize)}` : ''}
              {image.processedSize ? `（${ratioPercent(image.originalSize, image.processedSize)}）` : '· 尚未压缩'}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={reset} className="btn-ghost !py-1 !px-2 text-[11px]">
              重置视图
            </button>
            <button onClick={onClose} className="btn-ghost !py-1 !px-2 text-[11px]">
              ✕ 关闭
            </button>
          </div>
        </header>

        {/* 对比区 */}
        <div className="grid grid-cols-2 gap-px bg-white/5">
          {[
            { label: '原图', src: image.previewUrl, size: image.originalSize },
            {
              label: image.processedBlob ? '压缩后' : '未压缩',
              src: processedSrc,
              size: image.processedSize,
            },
          ].map((pane, i) => (
            <div
              key={i}
              className="relative bg-ink-900 select-none"
              style={{ height: 'min(70vh, 560px)' }}
              onWheel={onWheel}
              onMouseDown={onMouseDown}
              onMouseMove={onMouseMove}
              onMouseUp={onMouseUp}
              onMouseLeave={onMouseUp}
            >
              <span className="absolute top-3 left-3 z-10 text-[11px] font-semibold px-2 py-0.5 rounded bg-black/60 text-white/80">
                {pane.label} · {pane.size ? formatBytes(pane.size) : '—'}
              </span>
              <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
                <img
                  src={pane.src}
                  alt={pane.label}
                  draggable={false}
                  className="max-w-full max-h-full transition-transform duration-75"
                  style={{
                    transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                    transformOrigin: 'center',
                    cursor: dragRef.current ? 'grabbing' : 'grab',
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* 底部工具栏 */}
        <footer className="flex items-center justify-between px-5 h-12 border-t border-white/5 text-[11px] text-white/50">
          <span>滚轮缩放 · 拖拽平移 · ESC 关闭</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setScale((s) => Math.max(0.2, s - 0.2))}
              className="btn-ghost !py-0.5 !px-2 text-[11px]"
            >
              −
            </button>
            <span className="text-white/70 w-12 text-center">{Math.round(scale * 100)}%</span>
            <button
              onClick={() => setScale((s) => Math.min(8, s + 0.2))}
              className="btn-ghost !py-0.5 !px-2 text-[11px]"
            >
              +
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
