// components/exportPng.ts
import { toPng } from "html-to-image";

export async function exportPng(node: HTMLElement | null, filename: string) {
  if (!node) return;
  const url = await toPng(node, { pixelRatio: 2, cacheBust: true });
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
}
