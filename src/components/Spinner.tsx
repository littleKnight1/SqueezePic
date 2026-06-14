/**
 * 加载指示器
 * - size: px
 * - label: 可选辅助文字（屏幕阅读器）
 */
type Props = {
  size?: number;
  className?: string;
  label?: string;
};

export default function Spinner({ size = 16, className = '', label = '加载中' }: Props) {
  return (
    <span
      role="status"
      aria-label={label}
      className={`inline-block animate-spin rounded-full border-2 border-white/15 border-t-accent-400 ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
