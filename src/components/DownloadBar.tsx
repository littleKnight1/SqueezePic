/**
 * 下载操作栏
 * - 选中：下载选中项
 * - 全部：批量下载（默认 ZIP）
 * - 当未选中时，"下载选中"自动指向全部
 */
import { useState } from 'react';
import { useImageContext } from '@/context/ImageContext';
import { useImageProcessing } from '@/hooks/useImageProcessing';
import { downloadSelected, downloadAsZip } from '@/utils/zip';
import { formatBytes } from '@/utils/units';
import Spinner from './Spinner';

export default function DownloadBar() {
  const { images, selectedId, clearAll } = useImageContext();
  const { processAll } = useImageProcessing();
  const [busy, setBusy] = useState<null | 'zip' | 'all'>(null);
  const [err, setErr] = useState<string | null>(null);

  if (images.length === 0) return null;

  const readyCount = images.filter((i) => i.processedBlob).length;
  const target = selectedId ? images.filter((i) => i.id === selectedId) : images;
  const totalOriginal = images.reduce((s, i) => s + i.originalSize, 0);
  const totalProcessed = images.reduce((s, i) => s + (i.processedSize ?? 0), 0);
  const saved = totalOriginal - totalProcessed;

  const onDownloadZip = async () => {
    setErr(null);
    setBusy('zip');
    try {
      // 若存在未处理项，先批量处理
      if (readyCount < images.length) {
        await processAll();
      }
      // 重新拉取处理后的列表
      const refreshed = images.map((img) => {
        // 若 processAll 已就绪，list 中应有 processedBlob
        // 这里直接传原 list，因为 processAll 后会更新 Context
        return img;
      });
      // 二次确认：可能因异步未就绪，传入前再尝试一次
      if (refreshed.every((i) => i.processedBlob)) {
        await downloadAsZip(refreshed);
      } else {
        // 触发一次并重试（让 processOne 同步生效）
        await processAll();
        await downloadAsZip(images);
      }
    } catch (e) {
      setErr((e as Error).message || '打包失败');
    } finally {
      setBusy(null);
    }
  };

  const onDownloadSelected = () => {
    setErr(null);
    setBusy('all');
    if (readyCount < target.length) {
      processAll().then(() => downloadSelected(target));
    } else {
      downloadSelected(target);
    }
    setTimeout(() => setBusy(null), 800);
  };

  return (
    <div className="panel">
      <h4 className="panel-title">
        <span className="w-1.5 h-1.5 rounded-full bg-accent" />
        下载
        {saved > 0 && (
          <span className="text-[11px] text-emerald-300 font-normal ml-auto">
            预计节省 {formatBytes(saved)}
          </span>
        )}
      </h4>

      <div className="grid grid-cols-2 gap-2">
        <button
          disabled={!target.length || busy !== null}
          onClick={onDownloadSelected}
          className="btn-ghost !py-2 text-xs disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {busy === 'all' ? <Spinner size={12} /> : null}
          {busy === 'all' ? '处理中…' : `下载${selectedId ? '选中' : '全部'} (${target.length})`}
        </button>
        <button
          disabled={!images.length || busy !== null}
          onClick={onDownloadZip}
          className="btn-accent !py-2 text-xs"
        >
          {busy === 'zip' ? <Spinner size={12} /> : null}
          {busy === 'zip' ? '打包中…' : '打包 ZIP'}
        </button>
      </div>

      {err && (
        <p className="mt-2 text-[11px] text-red-300">{err}</p>
      )}

      <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-[10px] text-white/40">
        <span>
          {readyCount} / {images.length} 已就绪
        </span>
        <button
          onClick={() => {
            if (window.confirm('清空所有图片？')) clearAll();
          }}
          className="hover:text-red-300 transition"
        >
          清空列表
        </button>
      </div>
    </div>
  );
}
