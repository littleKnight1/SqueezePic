/**
 * 裁剪模态框（v2）
 * - 选区可拖动移动（鼠标按在选区内部）
 * - 选区可调整大小（8 个 handle：四角 + 四边中点）
 * - 比例预设带中文标签；选中比例时若已有选区则按比例重塑，否则按比例初始化居中默认框
 * - 输出尺寸(px) 两个 input 默认带可见边框
 */
import { useEffect, useRef, useState } from 'react';
import { useImageContext } from '@/context/ImageContext';
import { useImageProcessing } from '@/hooks/useImageProcessing';
import type { ImageFile } from '@/types';
import Spinner from './Spinner';

interface Props {
  image: ImageFile | null;
  onClose: () => void;
}

type RatioKey = 'free' | '1:1' | '4:3' | '16:9';
const RATIO_VALUE: Record<Exclude<RatioKey, 'free'>, number> = {
  '1:1': 1,
  '4:3': 4 / 3,
  '16:9': 16 / 9,
};
const RATIO_LABEL: Record<RatioKey, { name: string; sub: string }> = {
  free: { name: '自由', sub: '任意比例' },
  '1:1': { name: '正方形', sub: '1:1' },
  '4:3': { name: '照片', sub: '4:3' },
  '16:9': { name: '宽屏', sub: '16:9' },
};

type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

interface SelRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

type DragMode =
  | { kind: 'create'; startX: number; startY: number }
  | { kind: 'move'; startX: number; startY: number; orig: SelRect }
  | { kind: 'resize'; handle: Handle; startX: number; startY: number; orig: SelRect };

export default function CropModal({ image, onClose }: Props) {
  const { updateImage } = useImageContext();
  const { processOne } = useImageProcessing();

  const wrapRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  /** 记录 backdrop 上的 mousedown 是否就是 backdrop 自身；防止从 modal 内容拖出再松开时误关弹窗 */
  const backdropDownRef = useRef<boolean>(false);
  /** 预览用原图（独立加载，避免和主图加载状态耦合） */
  const previewImgRef = useRef<HTMLImageElement | null>(null);
  const [previewTick, setPreviewTick] = useState(0);

  const [imgRect, setImgRect] = useState<SelRect | null>(null);
  const [imgReady, setImgReady] = useState(false);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [sel, setSel] = useState<SelRect | null>(null);
  const [ratio, setRatio] = useState<RatioKey>('free');
  const dragRef = useRef<DragMode | null>(null);

  // 打开时初始化
  useEffect(() => {
    if (!image) return;
    setSel(null);
    setRatio('free');
    setImgReady(false);
  }, [image?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // 计算图片在容器内的可见尺寸
  const computeRect = () => {
    const wrap = wrapRef.current;
    const img = imgRef.current;
    if (!wrap || !img || !img.naturalWidth) return;
    const cw = wrap.clientWidth;
    const ch = wrap.clientHeight;
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    const scale = Math.min(cw / iw, ch / ih);
    const w = iw * scale;
    const h = ih * scale;
    setImgRect({ x: (cw - w) / 2, y: (ch - h) / 2, w, h });
  };

  useEffect(() => {
    if (!image) return;
    computeRect();
    window.addEventListener('resize', computeRect);
    return () => window.removeEventListener('resize', computeRect);
  }, [image?.id, imgReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // 图片就绪后，给"自由"模式也初始化一个 80% 大小的居中默认选区，避免空白
  useEffect(() => {
    if (!imgReady || !imgRect) return;
    if (sel) return;
    const w = imgRect.w * 0.8;
    const h = imgRect.h * 0.8;
    setSel({ x: imgRect.x + (imgRect.w - w) / 2, y: imgRect.y + (imgRect.h - h) / 2, w, h });
  }, [imgReady, imgRect]); // eslint-disable-line react-hooks/exhaustive-deps

  // 加载预览用原图（独立 Image 实例，避免依赖主图渲染）
  useEffect(() => {
    if (!image) return;
    const img = new Image();
    img.onload = () => {
      previewImgRef.current = img;
      setPreviewTick((t) => t + 1);
    };
    img.onerror = () => {
      previewImgRef.current = null;
    };
    img.src = image.previewUrl;
    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [image?.previewUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  // 实时裁剪预览：监听 sel 变化重绘 canvas
  useEffect(() => {
    const cvs = previewCanvasRef.current;
    const src = previewImgRef.current;
    if (!cvs || !src || !sel || !imgRect) return;
    const iw = src.naturalWidth;
    const ih = src.naturalHeight;
    if (!iw || !ih) return;
    // 选区 → 图片像素坐标
    const sx = ((sel.x - imgRect.x) / imgRect.w) * iw;
    const sy = ((sel.y - imgRect.y) / imgRect.h) * ih;
    const sw = (sel.w / imgRect.w) * iw;
    const sh = (sel.h / imgRect.h) * ih;
    // 缩放到预览最大边 180
    const PREVIEW_MAX = 180;
    const scale = Math.min(PREVIEW_MAX / sw, PREVIEW_MAX / sh, 1);
    const dw = Math.max(1, Math.round(sw * scale));
    const dh = Math.max(1, Math.round(sh * scale));
    cvs.width = dw;
    cvs.height = dh;
    const ctx = cvs.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingQuality = 'high';
    ctx.clearRect(0, 0, dw, dh);
    ctx.drawImage(src, sx, sy, sw, sh, 0, 0, dw, dh);
  }, [sel, imgRect, previewTick]);

  // ESC 关闭
  useEffect(() => {
    if (!image) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [image, onClose]);

  // 鼠标拖拽全局监听
  useEffect(() => {
    if (!image) return;
    // ---- 以下闭包内使用的辅助函数（依赖最新 imgRect/sel/ratio） ----
    const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
    const localPoint = (e: MouseEvent) => {
      const wrap = wrapRef.current;
      if (!wrap) return { x: 0, y: 0 };
      const rect = wrap.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const clampFree = (r: SelRect): SelRect => {
      if (!imgRect) return r;
      const w = clamp(r.w, 8, imgRect.w);
      const h = clamp(r.h, 8, imgRect.h);
      const x = clamp(r.x, imgRect.x, imgRect.x + imgRect.w - w);
      const y = clamp(r.y, imgRect.y, imgRect.y + imgRect.h - h);
      return { x, y, w, h };
    };
    const reshapeByRatio = (r: SelRect, handle: Handle): SelRect => {
      if (ratio === 'free' || !imgRect) return r;
      const target = RATIO_VALUE[ratio];
      let { x, y, w, h } = r;
      // 默认以 w 为基准
      const useWidthAsBase = true;
      if (useWidthAsBase) {
        const maxW =
          handle === 'nw' || handle === 'w' || handle === 'sw'
            ? x + w - imgRect.x
            : imgRect.x + imgRect.w - x;
        w = clamp(w, 8, maxW);
        h = w / target;
        if (handle === 'sw' || handle === 's' || handle === 'se') {
          y = clamp(y + (r.h - h), imgRect.y, imgRect.y + imgRect.h - h);
        } else if (handle === 'w' || handle === 'e') {
          y = y + (r.h - h) / 2;
        }
      } else {
        const maxH =
          handle === 'nw' || handle === 'n' || handle === 'ne'
            ? y + h - imgRect.y
            : imgRect.y + imgRect.h - y;
        h = clamp(h, 8, maxH);
        w = h * target;
        if (handle === 'nw' || handle === 'w' || handle === 'sw') {
          x = clamp(x + (r.w - w), imgRect.x, imgRect.x + imgRect.w - w);
        } else if (handle === 'n' || handle === 's') {
          x = x + (r.w - w) / 2;
        }
      }
      w = clamp(w, 8, imgRect.w);
      h = clamp(h, 8, imgRect.h);
      x = clamp(x, imgRect.x, imgRect.x + imgRect.w - w);
      y = clamp(y, imgRect.y, imgRect.y + imgRect.h - h);
      return { x, y, w, h };
    };
    // ----------------------------------------------------------------

    const onMove = (e: MouseEvent) => {
      if (!dragRef.current || !imgRect) return;
      const p = localPoint(e);
      const mode = dragRef.current;
      if (mode.kind === 'create') {
        const x = clamp(Math.min(mode.startX, p.x), imgRect.x, imgRect.x + imgRect.w);
        const y = clamp(Math.min(mode.startY, p.y), imgRect.y, imgRect.y + imgRect.h);
        const w = clamp(Math.abs(p.x - mode.startX), 0, imgRect.x + imgRect.w - x);
        const h = clamp(Math.abs(p.y - mode.startY), 0, imgRect.y + imgRect.h - y);
        let next = { x, y, w, h };
        if (ratio !== 'free' && (w > 8 || h > 8)) {
          const target = RATIO_VALUE[ratio];
          if (w / h > target) next = { ...next, w: h * target };
          else next = { ...next, h: w / target };
        }
        setSel(next);
      } else if (mode.kind === 'move') {
        const dx = p.x - mode.startX;
        const dy = p.y - mode.startY;
        const next = clampFree({ ...mode.orig, x: mode.orig.x + dx, y: mode.orig.y + dy });
        setSel(next);
      } else if (mode.kind === 'resize') {
        const o = mode.orig;
        const dx = p.x - mode.startX;
        const dy = p.y - mode.startY;
        let x = o.x;
        let y = o.y;
        let w = o.w;
        let h = o.h;
        switch (mode.handle) {
          case 'nw': x = o.x + dx; y = o.y + dy; w = o.w - dx; h = o.h - dy; break;
          case 'n':  y = o.y + dy; h = o.h - dy; break;
          case 'ne': y = o.y + dy; w = o.w + dx; h = o.h - dy; break;
          case 'e':  w = o.w + dx; break;
          case 'se': w = o.w + dx; h = o.h + dy; break;
          case 's':  h = o.h + dy; break;
          case 'sw': x = o.x + dx; w = o.w - dx; h = o.h + dy; break;
          case 'w':  x = o.x + dx; w = o.w - dx; break;
        }
        let next = clampFree({ x, y, w, h });
        if (ratio !== 'free') next = reshapeByRatio(next, mode.handle);
        setSel(next);
      }
    };
    const onUp = () => {
      dragRef.current = null;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [image, imgRect, ratio]);

  // 所有 hooks 已声明完毕，可以提前 return
  if (!image) return null;

  // 容器坐标 → 鼠标位置
  const localPointUI = (e: React.MouseEvent) => {
    const wrap = wrapRef.current;
    if (!wrap) return { x: 0, y: 0 };
    const rect = wrap.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  /** 选区内部的 mousedown：进入 move 模式 */
  const onSelMouseDown = (e: React.MouseEvent) => {
    if (!sel || !imgRect) return;
    e.stopPropagation();
    e.preventDefault();
    const p = localPointUI(e);
    dragRef.current = { kind: 'move', startX: p.x, startY: p.y, orig: { ...sel } };
  };

  /** 8 个 handle 的 mousedown：进入 resize 模式 */
  const onHandleMouseDown = (handle: Handle) => (e: React.MouseEvent) => {
    if (!sel) return;
    e.stopPropagation();
    e.preventDefault();
    const p = localPointUI(e);
    dragRef.current = { kind: 'resize', handle, startX: p.x, startY: p.y, orig: { ...sel } };
  };

  const onWrapMouseDown = (e: React.MouseEvent) => {
    if (!imgRect) return;
    const p = localPointUI(e);
    dragRef.current = { kind: 'create', startX: p.x, startY: p.y };
    setSel({ x: p.x, y: p.y, w: 0, h: 0 });
  };

  // 切换比例：每次独立重新生成默认选区（居中、占图 80% 宽），不基于现有选区
  const applyRatio = (r: RatioKey) => {
    setRatio(r);
    if (!imgRect) return;
    if (r === 'free') {
      // 自由模式：未选过就创建 80% 居中默认；有选区则保持现状
      if (sel) return;
      const w = imgRect.w * 0.8;
      const h = imgRect.h * 0.8;
      setSel({ x: imgRect.x + (imgRect.w - w) / 2, y: imgRect.y + (imgRect.h - h) / 2, w, h });
      return;
    }
    const target = RATIO_VALUE[r];
    let w = imgRect.w * 0.8;
    let h = w / target;
    if (h > imgRect.h * 0.9) {
      h = imgRect.h * 0.9;
      w = h * target;
    }
    setSel({
      x: imgRect.x + (imgRect.w - w) / 2,
      y: imgRect.y + (imgRect.h - h) / 2,
      w,
      h,
    });
  };

  /** 容器坐标 → 图片像素坐标 */
  const toImageCoords = (s: SelRect) => {
    if (!imgRect) return { x: 0, y: 0, width: 1, height: 1 };
    const iw = imgRef.current?.naturalWidth ?? 0;
    const ih = imgRef.current?.naturalHeight ?? 0;
    const sx = (s.x - imgRect.x) / imgRect.w;
    const sy = (s.y - imgRect.y) / imgRect.h;
    const sw = s.w / imgRect.w;
    const sh = s.h / imgRect.h;
    return {
      x: Math.max(0, Math.round(sx * iw)),
      y: Math.max(0, Math.round(sy * ih)),
      width: Math.max(1, Math.round(sw * iw)),
      height: Math.max(1, Math.round(sh * ih)),
    };
  };

  const onApply = () => {
    if (!sel) return;
    const crop = toImageCoords(sel);
    updateImage(image.id, { crop });
    window.setTimeout(() => processOne(image.id), 0);
    onClose();
  };

  const onClear = () => {
    updateImage(image.id, { crop: undefined });
    window.setTimeout(() => processOne(image.id), 0);
    onClose();
  };

  const handles: { key: Handle; style: React.CSSProperties; cursor: string }[] = sel
    ? [
        { key: 'nw', style: { left: -4, top: -4 }, cursor: 'nwse-resize' },
        { key: 'n',  style: { left: sel.w / 2 - 4, top: -4 }, cursor: 'ns-resize' },
        { key: 'ne', style: { left: sel.w - 4, top: -4 }, cursor: 'nesw-resize' },
        { key: 'e',  style: { left: sel.w - 4, top: sel.h / 2 - 4 }, cursor: 'ew-resize' },
        { key: 'se', style: { left: sel.w - 4, top: sel.h - 4 }, cursor: 'nwse-resize' },
        { key: 's',  style: { left: sel.w / 2 - 4, top: sel.h - 4 }, cursor: 'ns-resize' },
        { key: 'sw', style: { left: -4, top: sel.h - 4 }, cursor: 'nesw-resize' },
        { key: 'w',  style: { left: -4, top: sel.h / 2 - 4 }, cursor: 'ew-resize' },
      ]
    : [];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
      onMouseDown={(e) => {
        // 只有 mousedown 落在 backdrop 自身才视为"点击空白处"
        backdropDownRef.current = e.target === e.currentTarget;
      }}
      onClick={() => {
        if (backdropDownRef.current) onClose();
        backdropDownRef.current = false;
      }}
    >
      <div
        className="relative w-full max-w-4xl max-h-[92vh] rounded-2xl bg-ink-800 border border-white/10 shadow-2xl overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="relative z-10 flex flex-wrap items-center justify-between gap-2 px-5 py-3 border-b border-white/5 bg-ink-800">
          <h3 className="text-sm font-semibold text-white truncate">
            裁剪 · {image.name}
          </h3>
          <div className="flex items-center gap-1.5 flex-wrap">
            {(['free', '1:1', '4:3', '16:9'] as RatioKey[]).map((r) => {
              const active = ratio === r;
              const { name, sub } = RATIO_LABEL[r];
              return (
                <button
                  key={r}
                  onClick={() => applyRatio(r)}
                  className={[
                    'rounded-md border px-3 py-1.5 text-[11px] leading-none transition flex flex-col items-center gap-0.5',
                    active
                      ? 'border-accent bg-accent text-ink-900 font-bold shadow-glow-sm'
                      : 'border-accent/50 bg-accent/10 text-accent hover:bg-accent/25 hover:border-accent',
                  ].join(' ')}
                  title={sub}
                >
                  <span className="font-semibold">{name}</span>
                  <span className="text-[9px] opacity-80">{sub}</span>
                </button>
              );
            })}
            <button
              onClick={onClose}
              className="btn-ghost !py-1 !px-2 text-[11px] ml-1"
              title="关闭"
            >
              ✕
            </button>
          </div>
        </header>

        <div
          ref={wrapRef}
          className="relative bg-ink-900 select-none"
          style={{ height: 'min(58vh, 460px)', cursor: dragRef.current ? 'crosshair' : 'crosshair' }}
          onMouseDown={onWrapMouseDown}
        >
          <img
            ref={imgRef}
            src={image.previewUrl}
            alt={image.name}
            onLoad={(e) => {
              setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight });
              setImgReady(true);
            }}
            onError={() => setImgReady(true)}
            draggable={false}
            className="absolute pointer-events-none"
            style={{
              left: imgRect?.x ?? 0,
              top: imgRect?.y ?? 0,
              width: imgRect?.w ?? 'auto',
              height: imgRect?.h ?? 'auto',
              opacity: imgReady ? 1 : 0,
              transition: 'opacity 0.2s',
            }}
          />
          {!imgReady && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/60 pointer-events-none">
              <Spinner size={26} />
              <span className="text-xs">图片加载中...</span>
            </div>
          )}

          {/* 选区 */}
          {sel && imgReady && (
            <div
              className="absolute border-2 border-accent animate-fade-in"
              style={{
                left: sel.x,
                top: sel.y,
                width: sel.w,
                height: sel.h,
                boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)',
                cursor: dragRef.current?.kind === 'move' ? 'grabbing' : 'grab',
              }}
              onMouseDown={onSelMouseDown}
            >
              {/* 比例尺标（顶部中央） */}
              <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[11px] text-accent bg-black/70 px-2 py-0.5 rounded whitespace-nowrap pointer-events-none">
                {Math.round(sel.w)} × {Math.round(sel.h)}
              </span>
              {/* 三等分九宫格参考线 */}
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-0 left-1/3 h-full w-px bg-white/30" />
                <div className="absolute top-0 left-2/3 h-full w-px bg-white/30" />
                <div className="absolute left-0 top-1/3 w-full h-px bg-white/30" />
                <div className="absolute left-0 top-2/3 w-full h-px bg-white/30" />
              </div>
              {/* 8 个 resize handle */}
              {handles.map(({ key, style, cursor }) => (
                <span
                  key={key}
                  onMouseDown={onHandleMouseDown(key)}
                  className="absolute w-2.5 h-2.5 bg-accent border border-white rounded-sm"
                  style={{ ...style, cursor }}
                />
              ))}
            </div>
          )}
          {!sel && imgReady && (
            <p className="absolute inset-0 flex items-center justify-center text-white/40 text-xs pointer-events-none">
              拖拽以框选裁剪区域
            </p>
          )}

          {/* 实时裁剪预览浮窗（独立加载原图，不影响主图渲染） */}
          {sel && imgReady && imgRect && natural && (
            <div className="absolute bottom-3 right-3 z-20 pointer-events-none animate-fade-in">
              <div className="bg-black/85 border border-accent/50 rounded-md p-2 shadow-lg backdrop-blur-sm">
                <p className="text-[10px] text-accent mb-1 flex items-center gap-1">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent" />
                  实时预览
                </p>
                <canvas
                  ref={previewCanvasRef}
                  className="rounded border border-white/10 max-w-[180px] max-h-[140px]"
                  style={{ display: 'block' }}
                />
                <p className="text-[9px] text-white/40 mt-1 tabular-nums">
                  原始 {Math.round((sel.w / imgRect.w) * natural.w)} × {Math.round((sel.h / imgRect.h) * natural.h)} px
                </p>
              </div>
            </div>
          )}
        </div>

        <footer className="relative z-10 flex flex-wrap items-center justify-end gap-2 px-5 py-3 border-t border-white/5 bg-ink-800">
          <button onClick={onClear} className="btn-ghost !py-1.5 !px-3 text-xs">
            清除裁剪
          </button>
          <button onClick={onClose} className="btn-ghost !py-1.5 !px-3 text-xs">
            取消
          </button>
          <button
            onClick={onApply}
            disabled={!sel}
            className="btn-accent !py-1.5 !px-4 text-xs"
          >
            应用裁剪
          </button>
        </footer>
      </div>
    </div>
  );
}
