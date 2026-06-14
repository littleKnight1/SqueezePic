/**
 * 调整尺寸模态框
 * - 与"裁剪"完全独立：只缩放像素，不切画面
 * - 支持保持宽高比（默认）
 * - 6 个常用预设
 * - 确认后写入 ImageFile.targetWidth/targetHeight/keepAspectRatio
 *   并触发 processOne 重新压缩
 */
import { useEffect, useRef, useState } from 'react';
import { useImageContext } from '@/context/ImageContext';
import { useImageProcessing } from '@/hooks/useImageProcessing';
import Spinner from './Spinner';
import type { ImageFile } from '@/types';

interface Props {
  image: ImageFile | null;
  onClose: () => void;
}

interface PresetSize {
  label: string;
  w: number;
  h: number;
}

const PRESETS: PresetSize[] = [
  { label: '1920×1080', w: 1920, h: 1080 },
  { label: '1280×720', w: 1280, h: 720 },
  { label: '800×600', w: 800, h: 600 },
  { label: '512×512', w: 512, h: 512 },
  { label: '256×256', w: 256, h: 256 },
  { label: '128×128', w: 128, h: 128 },
];

const MIN_DIM = 1;
const MAX_DIM = 4096;

export default function ResizeModal({ image, onClose }: Props) {
  const { updateImage } = useImageContext();
  const { processOne } = useImageProcessing();

  // 原始尺寸（打开时从 File 中读取）
  const [origin, setOrigin] = useState<{ w: number; h: number } | null>(null);
  const [wInput, setWInput] = useState<string>('');
  const [hInput, setHInput] = useState<string>('');
  const [keep, setKeep] = useState<boolean>(true);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 记录 backdrop mousedown 来源，避免拖出内容时误关
  const backdropDownRef = useRef<boolean>(false);

  // 打开时读取原图尺寸 & 回填当前值
  useEffect(() => {
    if (!image) return;
    setError(null);
    setKeep(image.keepAspectRatio ?? true);
    // 从 File 读取原始宽高
    const url = image.previewUrl;
    const probe = new Image();
    probe.onload = () => {
      const nat = { w: probe.naturalWidth, h: probe.naturalHeight };
      setOrigin(nat);
      setWInput(
        image.targetWidth ? String(image.targetWidth) : String(nat.w),
      );
      setHInput(
        image.targetHeight ? String(image.targetHeight) : String(nat.h),
      );
    };
    probe.src = url;
  }, [image?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ESC 关闭
  useEffect(() => {
    if (!image) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [image, onClose]);

  // 输入清洗：1-4096 的正整数
  const sanitize = (raw: string): string => {
    return raw.replace(/[^\d]/g, '').slice(0, 4);
  };

  const wNum = parseInt(wInput, 10);
  const hNum = parseInt(hInput, 10);
  const wValid = Number.isFinite(wNum) && wNum >= MIN_DIM && wNum <= MAX_DIM;
  const hValid = Number.isFinite(hNum) && hNum >= MIN_DIM && hNum <= MAX_DIM;
  const canApply = !!image && !!origin && wValid && hValid && !applying;

  // 宽 → 高 自动联动（保持比例）
  const onWChange = (raw: string) => {
    const v = sanitize(raw);
    setWInput(v);
    if (keep && origin) {
      const n = parseInt(v, 10);
      if (Number.isFinite(n) && n > 0) {
        const newH = Math.round((n * origin.h) / origin.w);
        setHInput(String(Math.min(MAX_DIM, Math.max(MIN_DIM, newH))));
      }
    }
  };

  // 高 → 宽 自动联动（保持比例）
  const onHChange = (raw: string) => {
    const v = sanitize(raw);
    setHInput(v);
    if (keep && origin) {
      const n = parseInt(v, 10);
      if (Number.isFinite(n) && n > 0) {
        const newW = Math.round((n * origin.w) / origin.h);
        setWInput(String(Math.min(MAX_DIM, Math.max(MIN_DIM, newW))));
      }
    }
  };

  // 点击预设：填入宽高
  const applyPreset = (p: PresetSize) => {
    setWInput(String(p.w));
    setHInput(String(p.h));
  };

  // 重置为原图
  const onReset = () => {
    if (!origin) return;
    setWInput(String(origin.w));
    setHInput(String(origin.h));
  };

  // 清除尺寸调整（恢复原图分辨率）
  const onClear = async () => {
    if (!image) return;
    setApplying(true);
    try {
      updateImage(image.id, {
        targetWidth: undefined,
        targetHeight: undefined,
        keepAspectRatio: keep,
      });
      window.setTimeout(() => processOne(image.id), 0);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : '清除失败');
      setApplying(false);
    }
  };

  // 确认应用
  const onApply = async () => {
    if (!image || !canApply) {
      // 给出友好提示
      if (!wValid) setError(`宽度需在 ${MIN_DIM}-${MAX_DIM} 之间`);
      else if (!hValid) setError(`高度需在 ${MIN_DIM}-${MAX_DIM} 之间`);
      return;
    }
    setError(null);
    setApplying(true);
    try {
      updateImage(image.id, {
        targetWidth: wNum,
        targetHeight: hNum,
        keepAspectRatio: keep,
      });
      window.setTimeout(() => processOne(image.id), 0);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : '应用失败');
      setApplying(false);
    }
  };

  // 不渲染直到 image 准备好
  if (!image) return null;

  // 缩放比例提示
  const ratio =
    wValid && hValid && origin
      ? ((wNum * hNum) / (origin.w * origin.h)) * 100
      : null;
  const scaleText = ratio !== null ? `${ratio.toFixed(0)}%` : '—';

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
      onMouseDown={(e) => {
        backdropDownRef.current = e.target === e.currentTarget;
      }}
      onClick={() => {
        if (backdropDownRef.current) onClose();
      }}
    >
      <div
        className="panel !p-0 w-full max-w-md shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="调整尺寸"
      >
        {/* Header */}
        <header className="relative z-10 flex items-center justify-between gap-3 px-5 py-3 border-b border-white/5 bg-ink-800">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-accent" />
            调整尺寸 · {image.name}
          </h3>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white text-lg leading-none"
            aria-label="关闭"
            title="关闭"
          >
            ×
          </button>
        </header>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* 原图信息 */}
          {origin && (
            <div className="flex items-center justify-between px-3 py-2 rounded-md bg-ink-700/50 border border-white/5">
              <span className="text-[11px] text-white/50">原图</span>
              <span className="text-xs text-white/90 tabular-nums">
                {origin.w} × {origin.h} px
              </span>
            </div>
          )}

          {/* 宽高输入 */}
          <div>
            <label className="field-label">目标尺寸 (px)</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                inputMode="numeric"
                value={wInput}
                onChange={(e) => onWChange(e.target.value)}
                placeholder="宽"
                className="flex-1 px-3 py-2 rounded-md bg-ink-900 border border-white/20 text-sm text-white outline-none focus:border-accent focus:ring-1 focus:ring-accent/40 transition"
              />
              <span className="text-white/40 text-sm">×</span>
              <input
                type="text"
                inputMode="numeric"
                value={hInput}
                onChange={(e) => onHChange(e.target.value)}
                placeholder="高"
                className="flex-1 px-3 py-2 rounded-md bg-ink-900 border border-white/20 text-sm text-white outline-none focus:border-accent focus:ring-1 focus:ring-accent/40 transition"
              />
            </div>
            <div className="flex items-center justify-between mt-2">
              <p className="text-[10px] text-white/40">
                范围 1-4096 · 超过会失败
              </p>
              <p className="text-[10px] text-white/60">
                缩放后面积 ≈ <span className="text-accent tabular-nums">{scaleText}</span>
              </p>
            </div>
          </div>

          {/* 保持宽高比 */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={keep}
              onChange={(e) => setKeep(e.target.checked)}
              className="w-3.5 h-3.5 accent-cyan-400"
            />
            <span className="text-xs text-white/80">保持宽高比</span>
            <span className="text-[10px] text-white/40">
              （勾选后改宽自动算高，反之亦然）
            </span>
          </label>

          {/* 预设 */}
          <div>
            <label className="field-label">常用预设</label>
            <div className="grid grid-cols-3 gap-1.5">
              {PRESETS.map((p) => {
                const active = wInput === String(p.w) && hInput === String(p.h);
                return (
                  <button
                    key={p.label}
                    onClick={() => applyPreset(p)}
                    className={[
                      'rounded-md px-2 py-1.5 text-[11px] leading-none border transition',
                      active
                        ? 'border-accent bg-accent text-ink-900 font-semibold shadow-glow-sm'
                        : 'border-accent/40 bg-accent/10 text-accent hover:bg-accent/25 hover:border-accent',
                    ].join(' ')}
                    title={`设为 ${p.w}×${p.h}`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 错误 */}
          {error && (
            <p className="text-[11px] text-rose-300 px-2 py-1.5 rounded-md border border-rose-400/30 bg-rose-400/10">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <footer className="relative z-10 flex flex-wrap items-center justify-end gap-2 px-5 py-3 border-t border-white/5 bg-ink-800">
          <button
            onClick={onReset}
            disabled={!origin || applying}
            className="btn-ghost !py-1.5 !px-3 text-xs disabled:opacity-40 disabled:cursor-not-allowed"
            title="恢复为原图尺寸"
          >
            重置为原图
          </button>
          <button
            onClick={onClear}
            disabled={applying || (!image.targetWidth && !image.targetHeight)}
            className="btn-ghost !py-1.5 !px-3 text-xs disabled:opacity-40 disabled:cursor-not-allowed"
            title="清除尺寸调整，恢复原图分辨率"
          >
            清除尺寸
          </button>
          <button
            onClick={onClose}
            disabled={applying}
            className="btn-ghost !py-1.5 !px-3 text-xs disabled:opacity-40"
          >
            取消
          </button>
          <button
            onClick={onApply}
            disabled={!canApply}
            className="btn-accent !py-1.5 !px-4 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {applying ? (
              <span className="inline-flex items-center gap-2">
                <Spinner size={12} />
                应用中…
              </span>
            ) : (
              '应用调整'
            )}
          </button>
        </footer>
      </div>
    </div>
  );
}
