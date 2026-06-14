/**
 * App 主入口
 * - 顶部：Header
 * - 上传区
 * - 主区：左侧图片列表 / 右侧设置面板
 * - 对比与裁剪模态框
 */
import { useState } from 'react';
import Layout from './components/Layout';
import Header from './components/Header';
import UploadZone from './components/UploadZone';
import ImageList from './components/ImageList';
import CompressionPanel from './components/CompressionPanel';
import EditorPanel from './components/EditorPanel';
import CompareView from './components/CompareView';
import CropModal from './components/CropModal';
import ResizeModal from './components/ResizeModal';
import DownloadBar from './components/DownloadBar';
import { useImageContext } from './context/ImageContext';

export default function App() {
  const { images, selectedId } = useImageContext();
  const [compareOpen, setCompareOpen] = useState(false);
  const [cropOpen, setCropOpen] = useState(false);
  const [resizeOpen, setResizeOpen] = useState(false);

  const selected = images.find((i) => i.id === selectedId) ?? null;

  return (
    <Layout>
      <Header />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8">
        {/* 上传区 */}
        <section>
          <div className="mb-4 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold">
                上传图片 ·{' '}
                <span className="text-gradient-accent">开始压缩</span>
              </h2>
              <p className="text-xs sm:text-sm text-white/50 mt-1">
                支持 PNG / JPG / WebP / SVG · 单文件 ≤ 20MB · 最多 30 张
              </p>
            </div>
            {selected && (
              <button
                onClick={() => setCompareOpen(true)}
                className="btn-ghost !py-2 !px-4 text-xs self-start sm:self-auto"
              >
                🔍 对比选中
              </button>
            )}
          </div>
          <UploadZone />
        </section>

        {/* 列表 + 侧栏（移动端：列表在上、面板置底；桌面：左右分栏） */}
        <section className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
          <div className="order-1">
            <ImageList />
          </div>
          <aside className="order-2 space-y-6">
            <CompressionPanel />
            <EditorPanel
              onOpenCrop={() => setCropOpen(true)}
              onOpenResize={() => setResizeOpen(true)}
            />
            <DownloadBar />
          </aside>
        </section>

        <footer className="text-center text-xs text-white/30 py-6">
          © SqueezePic · 纯客户端图片压缩工具 · 所有计算在你的浏览器内完成
        </footer>
      </main>

      {/* 模态框 */}
      <CompareView image={compareOpen ? selected : null} onClose={() => setCompareOpen(false)} />
      <CropModal image={cropOpen ? selected : null} onClose={() => setCropOpen(false)} />
      <ResizeModal image={resizeOpen ? selected : null} onClose={() => setResizeOpen(false)} />
    </Layout>
  );
}
