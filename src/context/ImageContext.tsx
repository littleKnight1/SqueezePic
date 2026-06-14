import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type {
  GlobalSettings,
  ImageContextValue,
  ImageFile,
  OutputFormat,
} from '@/types';
import { ensureEncodersReady } from '@/utils/encoders';

/* -------------------------------------------------------------------------- */
/*  初始状态                                                                  */
/* -------------------------------------------------------------------------- */

const DEFAULT_GLOBAL_SETTINGS: GlobalSettings = {
  quality: 80,
  format: 'original',
  applyToAll: false,
};

/** 临时保留时长（30 分钟）— 隐私保护：超过后自动清理所有图片 */
export const RETENTION_MS = 30 * 60 * 1000;

interface State {
  images: ImageFile[];
  selectedId: string | null;
  globalSettings: GlobalSettings;
}

const initialState: State = {
  images: [],
  selectedId: null,
  globalSettings: DEFAULT_GLOBAL_SETTINGS,
};

/* -------------------------------------------------------------------------- */
/*  Reducer                                                                   */
/* -------------------------------------------------------------------------- */

type Action =
  | { type: 'ADD_IMAGES'; payload: ImageFile[] }
  | { type: 'REMOVE_IMAGE'; payload: string }
  | { type: 'REMOVE_IMAGES'; payload: string[] }
  | { type: 'UPDATE_IMAGE'; payload: { id: string; patch: Partial<ImageFile> } }
  | { type: 'SELECT_IMAGE'; payload: string | null }
  | { type: 'SET_GLOBAL'; payload: Partial<GlobalSettings> }
  | { type: 'APPLY_GLOBAL'; payload: { quality: number; format: OutputFormat } }
  | { type: 'CLEAR_ALL' };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'ADD_IMAGES': {
      const images = [...state.images, ...action.payload];
      const selectedId = state.selectedId ?? images[0]?.id ?? null;
      return { ...state, images, selectedId };
    }
    case 'REMOVE_IMAGE': {
      const images = state.images.filter((img) => img.id !== action.payload);
      const selectedId =
        state.selectedId === action.payload
          ? images[0]?.id ?? null
          : state.selectedId;
      return { ...state, images, selectedId };
    }
    case 'REMOVE_IMAGES': {
      const ids = new Set(action.payload);
      const images = state.images.filter((img) => !ids.has(img.id));
      const selectedId =
        state.selectedId && ids.has(state.selectedId)
          ? images[0]?.id ?? null
          : state.selectedId;
      return { ...state, images, selectedId };
    }
    case 'UPDATE_IMAGE': {
      const images = state.images.map((img) =>
        img.id === action.payload.id ? { ...img, ...action.payload.patch } : img,
      );
      return { ...state, images };
    }
    case 'SELECT_IMAGE':
      return { ...state, selectedId: action.payload };
    case 'SET_GLOBAL':
      return {
        ...state,
        globalSettings: { ...state.globalSettings, ...action.payload },
      };
    case 'APPLY_GLOBAL': {
      const { quality, format } = action.payload;
      const images = state.images.map((img) => ({
        ...img,
        quality,
        outputFormat: format,
      }));
      return { ...state, images };
    }
    case 'CLEAR_ALL':
      return { ...state, images: [], selectedId: null };
    default:
      return state;
  }
}

/* -------------------------------------------------------------------------- */
/*  Context                                                                   */
/* -------------------------------------------------------------------------- */

const ImageContext = createContext<ImageContextValue | null>(null);

function genId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatFromMime(mime: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpeg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
    'image/gif': 'gif',
  };
  return map[mime] ?? mime.replace('image/', '');
}

function buildImageFile(file: File): ImageFile {
  return {
    id: genId(),
    file,
    name: file.name,
    originalSize: file.size,
    originalFormat: file.type || `image/${formatFromMime(file.name)}`,
    previewUrl: URL.createObjectURL(file),
    processing: false,
    outputFormat: 'original',
    quality: DEFAULT_GLOBAL_SETTINGS.quality,
    rotation: 0,
    flipHorizontal: false,
    keepAspectRatio: true,
  };
}

/* -------------------------------------------------------------------------- */
/*  Provider                                                                  */
/* -------------------------------------------------------------------------- */

export function ImageProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [encoderReady, setEncoderReady] = useState(false);
  const [encoderError, setEncoderError] = useState<string | null>(null);
  const [remainingMs, setRemainingMs] = useState<number>(RETENTION_MS);

  // 挂载时初始化 WASM 编码器（动态加载，不阻塞首屏）
  useEffect(() => {
    let mounted = true;
    ensureEncodersReady()
      .then(() => {
        if (mounted) setEncoderReady(true);
      })
      .catch((e) => {
        if (mounted) {
          setEncoderError(
            e instanceof Error ? e.message : '编码器初始化失败',
          );
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  /* ---------------------------------------------------------------- */
  /*  隐私保护：30 分钟自动清理 + beforeunload 立即清理               */
  /* ---------------------------------------------------------------- */

  // 最新图片列表的 ref — 给 beforeunload 与 setTimeout 回调使用
  const imagesRef = useRef<ImageFile[]>(state.images);
  useEffect(() => {
    imagesRef.current = state.images;
  }, [state.images]);

  /** 释放列表中所有 Blob URL（不修改 state） */
  const revokeAllUrls = useCallback((list: ImageFile[]) => {
    list.forEach((img) => {
      try {
        URL.revokeObjectURL(img.previewUrl);
      } catch {
        /* noop */
      }
      if (img.processedUrl) {
        try {
          URL.revokeObjectURL(img.processedUrl);
        } catch {
          /* noop */
        }
      }
    });
  }, []);

  /** 撤销所有 URL + 清空 state —— 唯一清理入口（被定时器、卸载、手动 clearAll 复用） */
  const clearAll = useCallback(() => {
    revokeAllUrls(imagesRef.current);
    dispatch({ type: 'CLEAR_ALL' });
  }, [revokeAllUrls]);

  // 把 clearAll 暴露给 ref，以便 setTimeout / beforeunload 拿到最新版本
  const clearAllRef = useRef(clearAll);
  useEffect(() => {
    clearAllRef.current = clearAll;
  }, [clearAll]);

  // 定时器引用
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 计时起点（performance.now()）
  const startRef = useRef<number | null>(null);
  // 倒计时 tick 引用
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /** 启动 30 分钟清理定时器（幂等：已有 timer 不重复启动） */
  const startRetentionTimer = useCallback(() => {
    if (timerRef.current) return;
    startRef.current =
      typeof performance !== 'undefined' ? performance.now() : Date.now();
    setRemainingMs(RETENTION_MS);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      startRef.current = null;
      clearAllRef.current();
    }, RETENTION_MS);
    // 每秒更新一次剩余时间
    if (!tickRef.current) {
      tickRef.current = setInterval(() => {
        if (startRef.current == null) return;
        const now =
          typeof performance !== 'undefined' ? performance.now() : Date.now();
        const remain = Math.max(0, RETENTION_MS - (now - startRef.current));
        setRemainingMs(remain);
      }, 1000);
    }
  }, []);

  /** 停止定时器与倒计时 */
  const stopRetentionTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    startRef.current = null;
    setRemainingMs(RETENTION_MS);
  }, []);

  // 根据图片数量启停定时器
  // - 从 0 → N：启动
  // - 从 N → 0（用户手动清空）：停止并重置
  // - 其它变化：不动
  useEffect(() => {
    if (state.images.length === 0) {
      stopRetentionTimer();
    } else {
      startRetentionTimer();
    }
  }, [state.images.length, startRetentionTimer, stopRetentionTimer]);

  // 监听页面关闭 / 刷新，立即清理
  useEffect(() => {
    const onBeforeUnload = () => {
      // 同步撤销 — 不依赖 React 状态
      revokeAllUrls(imagesRef.current);
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [revokeAllUrls]);

  // Provider 卸载时（极端情况）也兜底清理
  useEffect(() => {
    return () => {
      revokeAllUrls(imagesRef.current);
      if (timerRef.current) clearTimeout(timerRef.current);
      if (tickRef.current) clearInterval(tickRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addImages = useCallback((files: File[]) => {
    const payload = files
      .filter((f) => f.type.startsWith('image/'))
      .map(buildImageFile);
    if (payload.length) dispatch({ type: 'ADD_IMAGES', payload });
  }, []);

  const removeImage = useCallback(
    (id: string) => {
      const target = imagesRef.current.find((img) => img.id === id);
      if (target) revokeAllUrls([target]);
      dispatch({ type: 'REMOVE_IMAGE', payload: id });
    },
    [revokeAllUrls],
  );

  const removeImages = useCallback(
    (ids: string[]) => {
      const idSet = new Set(ids);
      const targets = imagesRef.current.filter((img) => idSet.has(img.id));
      if (targets.length) revokeAllUrls(targets);
      dispatch({ type: 'REMOVE_IMAGES', payload: ids });
    },
    [revokeAllUrls],
  );

  const updateImage = useCallback((id: string, patch: Partial<ImageFile>) => {
    dispatch({ type: 'UPDATE_IMAGE', payload: { id, patch } });
  }, []);

  const selectImage = useCallback((id: string | null) => {
    dispatch({ type: 'SELECT_IMAGE', payload: id });
  }, []);

  const setGlobalSettings = useCallback((patch: Partial<GlobalSettings>) => {
    dispatch({ type: 'SET_GLOBAL', payload: patch });
  }, []);

  const applyGlobalToAll = useCallback(() => {
    dispatch({
      type: 'APPLY_GLOBAL',
      payload: {
        quality: state.globalSettings.quality,
        format: state.globalSettings.format,
      },
    });
  }, [state.globalSettings.quality, state.globalSettings.format]);

  const value = useMemo<ImageContextValue>(
    () => ({
      images: state.images,
      selectedId: state.selectedId,
      globalSettings: state.globalSettings,
      encoderReady,
      encoderError,
      retentionMs: RETENTION_MS,
      remainingMs,
      addImages,
      removeImage,
      removeImages,
      updateImage,
      selectImage,
      setGlobalSettings,
      applyGlobalToAll,
      clearAll,
    }),
    [
      state.images,
      state.selectedId,
      state.globalSettings,
      encoderReady,
      encoderError,
      remainingMs,
      addImages,
      removeImage,
      removeImages,
      updateImage,
      selectImage,
      setGlobalSettings,
      applyGlobalToAll,
      clearAll,
    ],
  );

  return <ImageContext.Provider value={value}>{children}</ImageContext.Provider>;
}

/* -------------------------------------------------------------------------- */
/*  Hook                                                                      */
/* -------------------------------------------------------------------------- */

export function useImageContext(): ImageContextValue {
  const ctx = useContext(ImageContext);
  if (!ctx) {
    throw new Error('useImageContext 必须在 <ImageProvider> 内部使用');
  }
  return ctx;
}
