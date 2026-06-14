// 占位 - 旋转逻辑
export function rotateCanvas(
  source: CanvasImageSource,
  width: number,
  height: number,
  angle: number,
): HTMLCanvasElement {
  const rad = (angle * Math.PI) / 180;
  const swap = angle % 180 !== 0;
  const canvas = document.createElement('canvas');
  canvas.width = swap ? height : width;
  canvas.height = swap ? width : height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(rad);
  ctx.drawImage(source, -width / 2, -height / 2);
  return canvas;
}
