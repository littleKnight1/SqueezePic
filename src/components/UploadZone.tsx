/**
 * 上传区域
 * - 点击 / 拖拽 / 粘贴三种添加方式
 * - 校验文件大小和数量，通过 useFileUpload 上报错误
 * - 拖拽时高亮视觉反馈
 * - 下方展示隐私提示（30 分钟自动清理 + 关闭页面即删除）
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useImageContext } from '@/context/ImageContext';
import { useFileUpload, MAX_FILE_SIZE, MAX_FILES } from '@/hooks/useFileUpload';
import type { UploadError } from '@/hooks/useFileUpload';

function formatRemaining(ms: number): string {
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function UploadZone() {
  const { upload, remaining } = useFileUpload();
  const { remainingMs, images } = useImageContext();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [errors, setErrors] = useState<UploadError[]>([]);
  const [toastKey, setToastKey] = useState(0);

  // 全局监听粘贴
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (!e.clipboardData) return;
      const files: File[] = [];
      for (const item of Array.from(e.clipboardData.items)) {
        if (item.kind === 'file') {
          const f = item.getAsFile();
          if (f) files.push(f);
        }
      }
      if (files.length) {
        e.preventDefault();
        handleFiles(files);
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFiles = useCallback(
    (rawFiles: File[]) => {
      const errs = upload(rawFiles);
      if (errs.length) {
        setErrors(errs);
        setToastKey((k) => k + 1);
        // 5s 自动消失
        window.setTimeout(() => setErrors([]), 5000);
      }
    },
    [upload],
  );

  const onClick = () => inputRef.current?.click();

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    handleFiles(files);
    e.target.value = ''; // 重置以便重复选择同一文件
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!dragging) setDragging(true);
  };
  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length) handleFiles(files);
  };

  const disabled = remaining <= 0;

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={disabled ? undefined : onClick}
        onKeyDown={(e) => {
          if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            onClick();
          }
        }}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={[
          'relative rounded-2xl border-2 border-dashed p-10 text-center transition select-none cursor-pointer',
          dragging
            ? 'border-accent bg-accent/5 shadow-glow-sm'
            : 'border-white/10 bg-ink-800/40 hover:border-accent/40 hover:bg-ink-800/60',
          disabled ? 'opacity-50 cursor-not-allowed' : '',
        ].join(' ')}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/svg+xml"
          multiple
          hidden
          onChange={onFileChange}
        />

        <div className="flex flex-col items-center gap-3">
          <div
            className={[
              'w-14 h-14 rounded-2xl flex items-center justify-center transition',
              dragging
                ? 'bg-accent/20 text-accent'
                : 'bg-white/5 text-accent/80',
            ].join(' ')}
          >
            <svg viewBox="0 0 24 24" className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M12 16V4M12 4l-4 4M12 4l4 4" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <p className="text-base font-semibold text-white">
              {dragging ? '松开鼠标即可上传' : '点击 / 拖拽 / 粘贴图片'}
            </p>
            <p className="text-xs text-white/50 mt-1">
              支持 PNG · JPG · WebP · SVG · 单文件 ≤ {MAX_FILE_SIZE / 1024 / 1024}MB · 最多 {MAX_FILES} 张
            </p>
          </div>
          <div className="flex items-center gap-2 mt-2 text-[11px] text-white/40">
            <span className="px-2 py-0.5 rounded bg-white/5">⏎ 点击选择</span>
            <span className="px-2 py-0.5 rounded bg-white/5">📂 拖拽到此处</span>
            <span className="px-2 py-0.5 rounded bg-white/5">⌘V 粘贴</span>
          </div>
          {disabled && (
            <p className="text-xs text-amber-400 mt-2">已达 {MAX_FILES} 张上限，请先删除部分图片</p>
          )}
        </div>
      </div>

      {/* 错误提示（toast） */}
      {errors.length > 0 && (
        <div
          key={toastKey}
          className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs animate-scale-in"
        >
          <p className="text-red-300 font-semibold mb-1">
            {errors.length} 个文件被跳过：
          </p>
          <ul className="space-y-0.5 text-red-200/80 max-h-32 overflow-auto">
            {errors.map((e, i) => (
              <li key={i}>
                <span className="text-white/60">{e.fileName}</span> — {e.reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 隐私保护提示 */}
      <div className="mt-3 flex items-center justify-center gap-2 text-[11px] text-white/45 leading-relaxed flex-wrap">
        <svg
          viewBox="0 0 24 24"
          className="w-3.5 h-3.5 text-emerald-400/80 shrink-0"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden
        >
          <path
            d="M12 2 4 6v6c0 5 3.5 9 8 10 4.5-1 8-5 8-10V6l-8-4Z"
            strokeLinejoin="round"
          />
          <path d="m9 12 2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span>
          您的图片仅在浏览器中临时处理，不会上传
          {images.length > 0 && (
            <>
              {' '}
              ·{' '}
              <span className="text-emerald-300/90 font-medium tabular-nums">
                {formatRemaining(remainingMs)} 后自动清除
              </span>
            </>
          )}
          {' '}· 关闭页面即删除
        </span>
      </div>
    </div>
  );
}
