# SqueezePic 技术设计文档

## 1. 技术栈选型
| 类别 | 技术 | 说明 |
| ---- | ---- | ---- |
| 前端框架 | React 18 + TypeScript | 类型安全，组件化 |
| 构建工具 | Vite | 快速开发 |
| 样式 | Tailwind CSS | 暗色主题适配方便 |
| 状态管理 | React Context + useReducer | 管理全局图片列表和压缩参数 |
| 图片处理 | Canvas API（变换层） + **@jsquash/* WASM 编码器** | 旋转/裁剪/缩放交给 Canvas；编码交给专业编码器 |
| 专业编码器 | **@jsquash/jpeg（MozJPEG）** / **@jsquash/png（OxiPNG）** / **@jsquash/webp（libwebp）** | 基于 WASM 编译到浏览器，体积稳定小于 Canvas `toBlob` |
| 打包 | JSZip | 批量下载生成 ZIP |
| 文件保存 | FileSaver.js (可选) | 触发浏览器下载 |
| 部署 | Vercel / Netlify | 静态站点，无后端 |

## 2. 项目结构
```text
squeezepic/
├── public/
│   └── favicon.svg
├── src/
│   ├── components/
│   │   ├── Layout.tsx
│   │   ├── Header.tsx
│   │   ├── UploadZone.tsx       # 上传区域（点击、拖拽、粘贴）
│   │   ├── ImageList.tsx        # 图片缩略图列表
│   │   ├── ImageItem.tsx        # 单个图片项（缩略图、信息、操作）
│   │   ├── CompressionPanel.tsx # 压缩设置面板（质量滑块、格式选择、应用到全部）
│   │   ├── CompareView.tsx      # 原图与压缩结果对比模态框
│   │   ├── EditorPanel.tsx      # 编辑功能（裁剪、旋转）
│   │   ├── CropModal.tsx        # 裁剪模态框
│   │   └── DownloadBar.tsx      # 批量下载操作栏
│   ├── context/
│   │   └── ImageContext.tsx     # 全局状态：图片数组、压缩设置、选中项
│   ├── hooks/
│   │   ├── useImageProcessing.ts # 核心图片处理逻辑（压缩、格式转换、编辑）
│   │   └── useFileUpload.ts      # 上传处理与验证
│   ├── utils/
│   │   ├── compress.ts   # 压缩主流程（Canvas 变换 + WASM 编码）
│   │   ├── encoders.ts   # @jsquash/* 编码器懒加载与分发
│   │   ├── format.ts     # 格式转换辅助
│   │   ├── crop.ts       # 裁剪逻辑
│   │   ├── rotate.ts     # 旋转逻辑
│   │   └── zip.ts        # JSZip 打包
│   ├── types/
│   │   └── index.ts
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── package.json
└── tailwind.config.js
```

## 3. 数据模型
```ts
export interface ImageFile {
  id: string;
  file: File;                     // 原始文件对象
  originalSize: number;           // 字节
  originalFormat: string;
  previewUrl: string;             // 用于缩略图显示
  processing: boolean;
  processedBlob?: Blob;           // 压缩后的 Blob
  processedSize?: number;
  outputFormat: 'original' | 'jpeg' | 'png' | 'webp';
  quality: number;                // 1-100
  crop?: { x: number; y: number; width: number; height: number };
  rotation: number;               // 角度
}
```

## 3.1 临时保留与自动清理（v1.2+）

`ImageContext` 维护三段与清理相关的状态：

```ts
RETENTION_MS = 30 * 60 * 1000;     // 总保留时长（30 分钟）
remainingMs: number;               // 距离下次自动清理的剩余毫秒数
imagesRef: Ref<ImageFile[]>;       // 最新图片列表（给 beforeunload 用）
```

清理策略（[`src/context/ImageContext.tsx`](file:///e:/code/SqueezePic/src/context/ImageContext.tsx)）：

- **30 分钟定时器**：`useEffect` 监听 `state.images.length`——
  - 从 `0 → N`（用户添加了首张图片）：启动 `setTimeout(RETENTION_MS)` + 1 秒一次的倒计时 `setInterval`。
  - 从 `N → 0`（用户手动清空）：停掉定时器，重置 `remainingMs = RETENTION_MS`。
  - 其它变化（增删单张）：不影响 timer。
- **定时器到期**：`cleanup()` 顺序执行 `URL.revokeObjectURL(previewUrl/processedUrl)` → `dispatch({ type: 'CLEAR_ALL' })`，无二次确认弹窗。
- **`beforeunload`**：单独挂一个 `window.addEventListener('beforeunload', …)`，在页面关闭/刷新时同步调用 `revokeAllUrls(imagesRef.current)`，不依赖 React 状态。
- **Provider 卸载**：`useEffect` 兜底清理（防止被包裹组件意外卸载时内存泄漏）。
- **下载**：完全不受清理逻辑影响——下载走 `URL.createObjectURL` 触发浏览器原生下载，浏览器下载完即释放，新下载不修改 `images` 列表，列表自然受 30 分钟定时器管理。
- **暴露字段**：`ImageContextValue.retentionMs` / `remainingMs`；UI 在 [UploadZone](file:///e:/code/SqueezePic/src/components/UploadZone.tsx) 下方显示小盾牌 + 倒计时提示。

## 4. 核心功能实现

### 4.1 压缩流程（v1.1+）

```
File → Image → Canvas 变换（旋转/裁剪/翻转/缩放）
                  → ImageData
                  → @jsquash/* WASM 编码器（MozJPEG / OxiPNG / libwebp）
                  → Blob
```

- **Canvas 变换层**：`drawTransformed()` 负责把原图按 rotation/裁剪/翻转 绘到新画布；`resizeCanvas()` 处理目标尺寸；JPEG 目标会先用 `flattenToWhite()` 填白避免黑底。
- **编码层**（`utils/encoders.ts`）：
  - `compressJPEG(imageData, quality)` → @jsquash/jpeg（MozJPEG）
  - `compressPNG(imageData)` → @jsquash/png（OxiPNG 无损）
  - `compressWebP(imageData, quality)` → @jsquash/webp（libwebp 有损）
  - `encodeImage(imageData, outputFormat, quality, originalMime)` 统一入口：format='original' 时按原 MIME 自动选编码器。
- **降级**：SVG / GIF 等不支持的格式走 `canvasToBlobFallback()`（Canvas.toBlob）。
- **关键约束**：v1.1 起**不再有"无变换且保持原格式时直接返回原文件"的快路径**——所有图片都经过专业编码器重新压缩，确保体积稳定。

### 4.2 WASM 编码器动态加载

- `utils/encoders.ts` 内部维护 `_initPromise` 单例，并发调用 `ensureEncodersReady()` 复用同一 Promise。
- 首次调用触发 `import('@jsquash/jpeg/encode')` 等动态加载 + 三个模块并行 `init()`（加载 ~700KB 总量 WASM）。
- `vite.config.ts` 把 `@jsquash/*` 加入 `optimizeDeps.exclude`，避免 esbuild 预构建打散 WASM 相对路径。
- `ImageContext` 暴露 `encoderReady` / `encoderError`，UI 在 `CompressionPanel` 顶部显示"正在加载编码器…"直至就绪。

### 4.3 其它

- 格式转换：在 `encodeImage` 中按 `outputFormat` 选对应编码器；'original' 按原图 MIME 推断。
- 裁剪：原图绘制至 Canvas，根据裁剪区域二次绘制。
- 旋转：通过设置 Canvas 变换矩阵完成旋转后再绘制图像。
- 批量 ZIP：遍历处理后的 Blob，借助 JSZip 打包，生成 ZIP 文件并触发下载。
- 全局状态：Context 统一管理图片数组、选中 ID、全局压缩配置、编码器就绪状态。
- 预览对比：双 Canvas 分别展示原图与压缩图，同步缩放与位置。

## 5. 性能考量
- 大图处理：使用 `requestAnimationFrame` / `setTimeout` 分片处理，或 Web Worker 传递 `ImageData` 优化
- 预览图：基于 `URL.createObjectURL` 生成预览，减少重复转换
- 防抖处理：压缩质量滑块变更后延迟 300ms 再执行压缩逻辑

## 6. 部署
执行 `npm run build` 生成静态资源，部署至 Vercel，支持配置自定义域名。