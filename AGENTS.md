
---

## 4. AI 代理指令（AGENTS.md）

```markdown
# SqueezePic AI 开发指令 (AGENTS.md)

## 项目概述
SqueezePic 是一个纯客户端的在线图片压缩工具。支持批量上传、质量调节、格式转换、图片裁剪和旋转，最终可单张或批量打包下载。所有处理均在浏览器端完成，保护用户隐私。

## 技术约束
- React 18 + TypeScript + Vite
- Tailwind CSS (暗色主题，`darkMode: 'class'`)
- 状态管理：Context + useReducer
- Canvas API 处理图片变换（旋转/裁剪/缩放/翻转）
- **专业编码器：@jsquash/jpeg（MozJPEG）+ @jsquash/png（OxiPNG）+ @jsquash/webp（libwebp），全部 WASM**
- JSZip 打包
- 无后端，无外部图片处理服务

## 开发规范
- 函数式组件 + Hooks，类型定义完善。
- 所有图片处理逻辑放在 `utils/` 中，独立纯函数。
- Context 提供全局图片列表和操作方法，子组件只调用。
- 上传组件支持点击、拖拽、粘贴，并进行文件类型和大小校验。
- 所有 UI 元素使用 Tailwind 实现，不用第三方 UI 库。

## 功能实现要求
1. **上传**：UploadZone 支持三种添加方式，显示已选图片数量。
2. **列表**：ImageList 展示所有图片缩略图、名称、原始大小，可单选/多选删除。
3. **压缩设置**：CompressionPanel 提供质量滑块、输出格式选择、“应用到全部”复选框。
4. **压缩处理**：选中图片后触发处理，显示 loading 状态，结果更新在对应 item 上。
5. **预览对比**：CompareView 使用双画布或图片对比显示原图与结果，带缩放和拖动。
6. **编辑**：EditorPanel 提供旋转（90° 步进）和裁剪入口。裁剪使用 react-easy-crop 或自建 Canvas 裁剪。
7. **下载**：单张直接下载，多张打包为 ZIP（使用 JSZip 和 file-saver）。
8. **响应式**：移动端适配，上传区域占满宽度，列表变为单列。

## 注意事项
- 确保大图处理时不阻塞 UI，使用异步方式。
- 所有操作可撤销重置，保持原图不变。
- 提供清晰的文件大小对比和压缩率展示。
- 注意内存管理，及时释放 Blob URL。
- 打包体积控制，不要引入大型依赖。

### 编码器与 WASM
- **不要**再加 "无变换且保持原格式时直接返回原文件" 的快路径——v1.1 起所有图片都经过专业编码器重新压缩，避免 Canvas `toBlob` 体积波动。
- **不要**再保留 `preferSmaller` 字段或"智能压缩"开关——已经移除，避免回退到 Canvas 编码。
- **编码器加载状态**：`ImageContext` 暴露 `encoderReady`（初始 false）。所有走编码器的路径应 `await ensureEncodersReady()`（idempotent），UI 在 `CompressionPanel` 顶部显示 "正在加载编码器…" 直至就绪。
- **WASM 资源**：`@jsquash/*` 在 `vite.config.ts` 的 `optimizeDeps.exclude` 中排除，避免 esbuild 预构建破坏 `import.meta.url` 寻址。三个 WASM 文件总 ~700KB，会作为静态资源在 `dist/assets/` 下按需加载。
- **降级路径**：SVG / GIF 等 `encodeImage` 抛 `UNSUPPORTED_FORMAT` 时，`compress.ts` 自动降级到 `canvasToBlobFallback()`。不要在编码器里塞 fallback。
- **保持原格式**：format='original' 时按 `originalFormat` MIME 自动选编码器。JPEG 编码前 `flattenToWhite()` 填白，避免透明变黑底。
- **类型问题**：`@jsquash/*` 子模块的 `init` 不在 index.d.ts 导出，必须从 `@jsquash/jpeg/encode`、`@jsquash/png/encode`、`@jsquash/webp/encode` 子路径 import。

### 临时保留与自动清理（隐私保护，v1.2+）
- **必须**在图片加载后（`buildImageFile` / `useImageProcessing.processOne`）通过 `URL.createObjectURL()` 生成 ObjectURL，并在清理时**逐一**调用 `URL.revokeObjectURL()`（`previewUrl` 与 `processedUrl` 都要）。
- **必须**在 `ImageContext` 维护 30 分钟（`RETENTION_MS`）定时器，到期自动清理所有图片。`beforeunload` 事件也要同步清理。
- **清理对用户透明**：定时器到期时**不要**弹二次确认。下载完成后不立即清理，保留在列表中直至超时或手动删除。
- 清理流程：`revokeAllUrls` → `dispatch({ type: 'CLEAR_ALL' })`。撤销与清空必须成对，否则可能内存泄漏。
- 切勿把任何图片相关数据写入 `localStorage` / `sessionStorage` / `IndexedDB` / `CacheStorage` —— 这违反隐私保证。