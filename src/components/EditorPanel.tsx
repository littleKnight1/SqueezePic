/**
 * 编辑面板
 * - 旋转：顺时针 90° / 逆时针 90° / 重置
 * - 水平翻转（再次点击恢复）
 * - 调整尺寸（独立模态框，仅缩放像素，不切画面）
 * - 裁剪入口（打开 CropModal）
 * - 撤销所有编辑
 */
import { useImageContext } from '@/context/ImageContext';
import { useImageProcessing } from '@/hooks/useImageProcessing';

interface Props {
  onOpenCrop: () => void;
  onOpenResize: () => void;
}

export default function EditorPanel({ onOpenCrop, onOpenResize }: Props) {
  const { images, selectedId, updateImage } = useImageContext();
  const { processOne } = useImageProcessing();
  const selected = images.find((i) => i.id === selectedId);

  const rotate = (delta: number) => {
    if (!selected) return;
    const next = ((selected.rotation + delta) % 360 + 360) % 360;
    updateImage(selected.id, { rotation: next });
    window.setTimeout(() => processOne(selected.id), 0);
  };

  const toggleFlip = () => {
    if (!selected) return;
    updateImage(selected.id, { flipHorizontal: !selected.flipHorizontal });
    window.setTimeout(() => processOne(selected.id), 0);
  };

  const resetEdit = () => {
    if (!selected) return;
    updateImage(selected.id, {
      rotation: 0,
      crop: undefined,
      flipHorizontal: false,
    });
    window.setTimeout(() => processOne(selected.id), 0);
  };

  return (
    <div className="panel">
      <h4 className="panel-title">
        <span className="w-1.5 h-1.5 rounded-full bg-accent" />
        编辑
        {!selected && (
          <span className="text-[11px] text-white/40 font-normal ml-auto">先选中图片</span>
        )}
      </h4>

      <div className="grid grid-cols-2 gap-1.5 mb-1.5">
        <button
          disabled={!selected}
          onClick={() => rotate(-90)}
          className="btn-ghost !py-2 text-xs disabled:opacity-40 disabled:cursor-not-allowed"
          title="逆时针 90°"
        >
          ↺ 左旋
        </button>
        <button
          disabled={!selected}
          onClick={() => rotate(90)}
          className="btn-ghost !py-2 text-xs disabled:opacity-40 disabled:cursor-not-allowed"
          title="顺时针 90°"
        >
          ↻ 右旋
        </button>
      </div>

      <div className="grid grid-cols-2 gap-1.5 mb-3">
        <button
          disabled={!selected}
          onClick={toggleFlip}
          className={[
            'btn-ghost !py-2 text-xs disabled:opacity-40 disabled:cursor-not-allowed transition',
            selected?.flipHorizontal
              ? '!border-accent !text-accent !bg-accent/10'
              : '',
          ].join(' ')}
          title="水平翻转（再次点击恢复）"
          aria-pressed={selected?.flipHorizontal}
        >
          ⇄ 水平翻转
        </button>
        <button
          disabled={!selected}
          onClick={resetEdit}
          className="btn-ghost !py-2 text-xs disabled:opacity-40 disabled:cursor-not-allowed"
          title="重置所有编辑"
        >
          ⟲ 重置
        </button>
      </div>

      {(() => {
        const multiImg = images.length > 1;
        const cropDisabled = !selected || multiImg;
        const cropTitle = !selected
          ? '请先选中图片'
          : multiImg
          ? '裁剪暂不支持批量操作，请保留单张图片时再使用'
          : '裁剪此图片';
        const resizeTitle = !selected
          ? '请先选中图片'
          : multiImg
          ? '调整尺寸暂不支持批量操作'
          : '调整此图片尺寸';
        return (
          <>
            <button
              disabled={cropDisabled}
              onClick={onOpenCrop}
              className="btn-ghost w-full !py-2 text-xs disabled:opacity-40 disabled:cursor-not-allowed"
              title={cropTitle}
              aria-label={cropTitle}
            >
              ✂ 裁剪图片
            </button>
            {multiImg && (
              <p className="text-[10px] text-amber-300/80 mt-1.5 leading-snug">
                裁剪仅对单张图片开放，批量裁剪暂未提供
              </p>
            )}
            <button
              disabled={!selected || multiImg}
              onClick={onOpenResize}
              className={[
                'btn-ghost w-full !py-2 text-xs mt-1.5 disabled:opacity-40 disabled:cursor-not-allowed transition',
                selected?.targetWidth && selected?.targetHeight
                  ? '!border-accent !text-accent !bg-accent/10'
                  : '',
              ].join(' ')}
              title={resizeTitle}
              aria-label={resizeTitle}
            >
              📐 调整尺寸
              {selected?.targetWidth && selected?.targetHeight && (
                <span className="ml-1.5 opacity-80">
                  {selected.targetWidth}×{selected.targetHeight}
                </span>
              )}
            </button>
          </>
        );
      })()}

      {selected && (
        <p className="text-[10px] text-white/40 mt-3 text-center">
          当前：旋转 {selected.rotation}°
          {selected.flipHorizontal && ' · 已镜像'}
          {selected.crop && ' · 已裁剪'}
          {selected.targetWidth && selected.targetHeight &&
            ` · ${selected.targetWidth}×${selected.targetHeight}`}
        </p>
      )}
    </div>
  );
}
