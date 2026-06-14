# SqueezePic

> 🖼️ 一款**纯客户端**的在线图片压缩工具 —— 您的图片**永远不会离开浏览器**。

支持批量上传、质量调节、格式转换、图片裁剪 / 旋转，单张或打包 ZIP 下载。所有处理均在浏览器端通过 WebAssembly 完成，**零上传、零后端、零持久化**。

---

## ✨ 核心特性

- 🔒 **隐私优先** — 全部计算在浏览器本地完成，30 分钟自动清理，关闭页面立即释放
- 🚀 **专业编码器** — 内置 MozJPEG / OxiPNG / libwebp（WASM），压缩率优于 Canvas `toBlob`
- 📦 **批量处理** — 一次性处理多张图片，可打包 ZIP 下载
- 🎨 **图片编辑** — 90° 旋转、裁剪、翻转、缩放
- 🎚️ **细粒度控制** — 质量滑块、输出格式、应用到全部
- 🌓 **暗色主题** — 响应式布局，移动端友好

---

## 🚀 快速开始

### 环境要求

- Node.js ≥ 18
- 现代浏览器（支持 `WebAssembly` 和 `ImageData`，如 Chrome / Edge / Firefox / Safari 最新两个版本）

### 安装

```bash
npm install
```

### 开发

```bash
npm run dev
```

打开 [http://localhost:5173](http://localhost:5173) 即可。

### 生产构建

```bash
npm run build
```

产物在 `dist/` 目录，可直接部署到任意静态托管（GitHub Pages、Vercel、Netlify、Nginx 等）。

### 预览构建

```bash
npm run preview
```

### 代码检查

```bash
npm run lint
```

---

## 🛠️ 技术栈

| 类别 | 选型 |
|------|------|
| 框架 | React 18 + TypeScript |
| 构建 | Vite 5 |
| 样式 | Tailwind CSS（暗色主题） |
| 状态管理 | Context + useReducer |
| 编码器 | `@jsquash/jpeg` (MozJPEG) / `@jsquash/png` (OxiPNG) / `@jsquash/webp` (libwebp) — 全部 WASM |
| 图片变换 | Canvas 2D API |
| 打包下载 | JSZip + file-saver |

---

## 📖 使用说明

1. **上传图片** — 点击、拖拽到上传区，或使用 `Ctrl/Cmd + V` 粘贴。支持 PNG / JPG / WebP / SVG，单文件 ≤ 20MB，最多 30 张。
2. **调整参数** — 在右侧 `压缩设置` 面板调整质量（1–100）和输出格式，勾选「应用到全部」可批量覆盖。
3. **处理图片** — 点击列表中单张图片，应用自动压缩并显示结果。也可点击「压缩全部」批量处理。
4. **编辑图片** — 选中图片后使用 `编辑` 面板做 90° 旋转、裁剪、翻转。
5. **下载** — 单张直接下载，多张可打包 ZIP。

---

## 🔐 隐私保护

SqueezePic 严格遵守 **「图片不出浏览器」** 原则：

- ✅ **无后端** — 没有任何服务器参与图片处理
- ✅ **无上传** — 文件不会发送到任何远程 API
- ✅ **无持久化** — 不使用 `localStorage` / `sessionStorage` / `IndexedDB` / `CacheStorage`
- ⏱️ **30 分钟自动清理** — 图片最多在内存中保留 30 分钟，到期自动撤销 Blob URL 并清空
- 🚪 **关闭即销毁** — 监听 `beforeunload` 事件，关闭页面/标签时立即释放所有 Blob URL

所有编码器 WASM 文件（总计 ~700KB）作为静态资源按需加载，仍在浏览器端执行。

---

## 🗂️ 项目结构

```
SqueezePic/
├── public/                    # 静态资源
├── src/
│   ├── components/            # UI 组件
│   │   ├── UploadZone.tsx     # 上传区
│   │   ├── ImageList.tsx      # 图片列表
│   │   ├── ImageItem.tsx      # 单张图片项
│   │   ├── CompressionPanel.tsx
│   │   ├── CompareView.tsx    # 原图/结果对比
│   │   ├── EditorPanel.tsx    # 旋转/裁剪/翻转
│   │   └── Footer.tsx
│   ├── context/
│   │   └── ImageContext.tsx   # 全局图片状态 + 30min 清理
│   ├── hooks/
│   │   ├── useFileUpload.ts
│   │   └── useImageProcessing.ts
│   ├── types/
│   │   └── index.ts
│   ├── utils/
│   │   ├── encoders.ts        # @jsquash/* WASM 封装
│   │   ├── compress.ts        # 核心压缩流程
│   │   ├── crop.ts            # 裁剪工具
│   │   ├── download.ts        # 单张/批量下载
│   │   └── format.ts
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── index.html
├── vite.config.ts             # @jsquash/* 排除在 optimizeDeps 之外
├── tailwind.config.js
├── postcss.config.js
├── tsconfig.json
├── package.json
├── PRD.md                     # 产品需求文档
├── Tech_Design.md             # 技术设计文档
├── AGENTS.md                  # AI 开发指令
└── README.md
```

---

## ⚠️ 关于 WASM 编码器

`@jsquash/*` 在 [vite.config.ts](./vite.config.ts) 中被 `optimizeDeps.exclude` 排除，避免 esbuild 预构建破坏 `import.meta.url` 寻址。三个 WASM 文件总 ~700KB，会作为静态资源在 `dist/assets/` 下按需加载。

降级策略：SVG / GIF 等不支持的格式会**自动**回退到 Canvas `toBlob`，错误处理集中在 `compress.ts` 的 `encodeImage` 调用处。

---

## 📜 许可证

MIT
