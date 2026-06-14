/**
 * 顶部导航：Logo + GitHub 链接
 */
const GITHUB_URL = 'https://github.com/';

export default function Header() {
  return (
    <header className="border-b border-white/5 bg-ink-900/80 backdrop-blur sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <a href="/" className="flex items-center gap-3 group">
          <div className="w-9 h-9 rounded-lg bg-gradient-accent flex items-center justify-center font-extrabold text-ink-900 shadow-glow-sm transition group-hover:shadow-glow">
            S
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight leading-none">
              Squeeze<span className="text-accent">Pic</span>
            </h1>
            <p className="text-[11px] text-white/50 mt-0.5">
              极致图片压缩 · 纯客户端
            </p>
          </div>
        </a>

        <nav className="flex items-center gap-2 sm:gap-4">
          <span className="hidden md:inline text-xs text-white/40">
            隐私安全 · 浏览器内处理 · 不上传服务器
          </span>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            className="btn-ghost !py-1.5 !px-3"
            aria-label="GitHub 仓库"
          >
            <svg
              viewBox="0 0 24 24"
              className="w-4 h-4"
              fill="currentColor"
              aria-hidden
            >
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M12 2C6.475 2 2 6.485 2 12.017c0 4.419 2.865 8.166 6.84 9.49.5.09.682-.218.682-.483 0-.237-.009-.866-.014-1.7-2.782.605-3.37-1.343-3.37-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.339-2.221-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.337 4.695-4.565 4.943.359.31.679.92.679 1.855 0 1.338-.012 2.418-.012 2.747 0 .268.18.578.688.48C19.138 20.18 22 16.434 22 12.017 22 6.485 17.523 2 12 2Z"
              />
            </svg>
            <span className="hidden sm:inline">GitHub</span>
          </a>
        </nav>
      </div>
    </header>
  );
}
