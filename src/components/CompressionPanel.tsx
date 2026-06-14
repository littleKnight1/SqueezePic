/**
 * 压缩设置面板
 * - 质量滑块 1-100
 * - 输出格式：保持原格式 / JPEG / PNG / WebP
 * - 应用到全部
 * - 有选中图片时改选中项；无选中时改全局设置
 * - 设置变更 300ms 防抖后自动触发重新压缩
 * - 显示编码器加载状态
 */
import { useEffect, useRef, useState } from 'react';
import { useImageContext } from '@/context/ImageContext';
import { useImageProcessing } from '@/hooks/useImageProcessing';
import type { OutputFormat } from '@/types';
import Spinner from './Spinner';

const FORMAT_OPTIONS: { value: OutputFormat; label: string; hint: string; kind: 'lossless' | 'lossy' }[] = [
  { value: 'original', label: '保持原格式', hint: '按文件原 MIME 输出', kind: 'lossless' },
  { value: 'jpeg', label: 'JPEG', hint: '体积最小 · 适合照片', kind: 'lossy' },
  { value: 'png', label: 'PNG', hint: '支持透明 · 适合图标', kind: 'lossless' },
  { value: 'webp', label: 'WebP', hint: '现代格式 · 综合最优', kind: 'lossy' },
];

const FORMAT_LABEL: Record<OutputFormat, string> = {
  original: '保持原格式',
  jpeg: 'JPEG',
  png: 'PNG',
  webp: 'WebP',
};

type Feedback = { type: 'success' | 'error'; message: string };

export default function CompressionPanel() {
  const {
    images,
    selectedId,
    globalSettings,
    encoderReady,
    encoderError,
    setGlobalSettings,
    applyGlobalToAll,
    updateImage,
  } = useImageContext();
  const { processOne, processAll } = useImageProcessing();

  const selected = images.find((i) => i.id === selectedId);

  // 当前编辑对象：有选中项用选中项，否则用全局
  const current = selected ?? {
    quality: globalSettings.quality,
    outputFormat: globalSettings.format,
  } as { quality: number; outputFormat: OutputFormat };

  const [quality, setQuality] = useState<number>(current.quality);
  const [format, setFormat] = useState<OutputFormat>(current.outputFormat);
  const [applying, setApplying] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const feedbackTimerRef = useRef<number | null>(null);

  // 反馈自动消失（成功 3s，错误 5s）
  useEffect(() => {
    if (!feedback) return;
    if (feedbackTimerRef.current) window.clearTimeout(feedbackTimerRef.current);
    const delay = feedback.type === 'success' ? 3000 : 5000;
    feedbackTimerRef.current = window.setTimeout(() => setFeedback(null), delay);
    return () => {
      if (feedbackTimerRef.current) window.clearTimeout(feedbackTimerRef.current);
    };
  }, [feedback]);

  // 选中项变更时同步 UI
  useEffect(() => {
    setQuality(current.quality);
    setFormat(current.outputFormat);
  }, [selectedId, current.quality, current.outputFormat]);

  // 防抖触发重处理
  const debounceRef = useRef<number | null>(null);
  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      // 应用设置：选中项 vs 全局
      if (selected) {
        if (selected.quality !== quality || selected.outputFormat !== format) {
          updateImage(selected.id, { quality, outputFormat: format });
          // 等 settings 写入 Context 再异步压缩
          window.setTimeout(() => processOne(selected.id), 0);
        }
      } else {
        setGlobalSettings({ quality, format });
        if (images.length > 0) processAll();
      }
    }, 300);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quality, format]);

  const onApplyAll = async () => {
    if (images.length === 0) {
      setFeedback({ type: 'error', message: '暂无图片可应用' });
      return;
    }
    setApplying(true);
    setFeedback(null);
    try {
      setGlobalSettings({ quality, format });
      applyGlobalToAll();
      await processAll();
      setFeedback({
        type: 'success',
        message: `已应用至 ${images.length} 张图片 · 质量 ${quality} · ${FORMAT_LABEL[format]}`,
      });
    } catch (e) {
      setFeedback({
        type: 'error',
        message: `应用失败：${e instanceof Error ? e.message : '未知错误'}`,
      });
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="panel">
      <h4 className="panel-title">
        <span className="w-1.5 h-1.5 rounded-full bg-accent" />
        压缩设置
        {selected ? (
          <span className="text-[11px] text-white/40 font-normal ml-auto">
            编辑：{selected.name.slice(0, 14)}
            {selected.name.length > 14 ? '…' : ''}
          </span>
        ) : (
          <span className="text-[11px] text-white/40 font-normal ml-auto">全局默认</span>
        )}
      </h4>

      {/* 编码器加载状态 */}
      {!encoderReady && !encoderError && (
        <div className="mb-3 px-2.5 py-2 rounded-lg border border-white/10 bg-ink-700/30 flex items-center gap-2">
          <Spinner size={12} />
          <span className="text-[11px] text-white/70">正在加载编码器（WASM）…</span>
        </div>
      )}
      {encoderError && (
        <div className="mb-3 px-2.5 py-2 rounded-lg border border-rose-400/40 bg-rose-400/10 text-[11px] text-rose-200">
          编码器加载失败：{encoderError}
        </div>
      )}

      {/* 质量滑块 */}
      <div className="mb-4">
        <div className="flex items-baseline justify-between mb-1.5">
          <label className="field-label !mb-0">质量</label>
          <span className="text-sm font-semibold text-accent">{quality}</span>
        </div>
        <input
          type="range"
          min={1}
          max={100}
          value={quality}
          onChange={(e) => setQuality(Number(e.target.value))}
          className="w-full accent-cyan-400 cursor-pointer"
        />
        <div className="flex justify-between text-[10px] text-white/40 mt-1">
          <span>1（极致压缩）</span>
          <span>80（推荐）</span>
          <span>100（无损）</span>
        </div>
      </div>

      {/* 格式选择 */}
      <div className="mb-4">
        <label className="field-label">输出格式</label>
        <div className="grid grid-cols-2 gap-1.5">
          {FORMAT_OPTIONS.map((opt) => {
            const active = format === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => setFormat(opt.value)}
                className={[
                  'rounded-lg px-2.5 py-2 text-left text-xs transition border relative',
                  active
                    ? 'border-accent/60 bg-accent/10 text-white'
                    : 'border-white/5 bg-ink-700/40 text-white/60 hover:border-white/20',
                ].join(' ')}
                title={opt.hint}
              >
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold">{opt.label}</span>
                  <span
                    className={[
                      'text-[9px] px-1 py-px rounded font-medium',
                      opt.kind === 'lossless'
                        ? 'bg-emerald-400/15 text-emerald-300/80'
                        : 'bg-amber-400/15 text-amber-300/80',
                    ].join(' ')}
                  >
                    {opt.kind === 'lossless' ? '无损' : '有损'}
                  </span>
                </div>
                <div className="text-[10px] text-white/40 mt-0.5">{opt.hint}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 应用到全部 */}
      <button
        onClick={onApplyAll}
        disabled={applying || images.length === 0 || !encoderReady}
        className="btn-accent w-full disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {applying ? (
          <span className="inline-flex items-center gap-2">
            <Spinner size={14} />
            正在应用…
          </span>
        ) : (
          '应用到所有图片'
        )}
      </button>
      {feedback && (
        <div
          role="status"
          aria-live="polite"
          className={[
            'mt-2 px-2.5 py-1.5 rounded-md text-[11px] leading-snug border animate-fade-in',
            feedback.type === 'success'
              ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200'
              : 'border-rose-400/40 bg-rose-400/10 text-rose-200',
          ].join(' ')}
        >
          <span className="font-semibold mr-1">
            {feedback.type === 'success' ? '✓ 成功' : '✕ 失败'}
          </span>
          {feedback.message}
        </div>
      )}
      {!feedback && encoderReady && (
        <p className="text-[10px] text-white/40 mt-2 text-center">
          变更后 300ms 自动重新压缩 · 编码器已就绪
        </p>
      )}
    </div>
  );
}
