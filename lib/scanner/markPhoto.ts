import { inkComponents, classifyMarkComponents } from './markShape.mjs';
import type { ScanImage } from './images';
export type MarkedWord = { text: string; start: number; box: { x: number; y: number; width: number; height: number }; baselineSlope: number };
export async function inspectMarkPhoto(image: ScanImage, word: MarkedWord) {
  const source = await new Promise<HTMLImageElement>((resolve, reject) => {
    const picture = new Image(); picture.onload = () => resolve(picture);
    picture.onerror = () => reject(new Error('The photo detail could not be opened.')); picture.src = image.url;
  });
  const padding = Math.max(4, word.box.height * image.height * .15);
  const x = Math.max(0, Math.floor(word.box.x * image.width - padding));
  const y = Math.max(0, Math.floor(word.box.y * image.height - padding));
  const width = Math.max(1, Math.min(image.width - x, Math.ceil(word.box.width * image.width + padding * 2)));
  const height = Math.max(1, Math.min(image.height - y, Math.ceil(word.box.height * image.height + padding * 2)));
  const canvas = document.createElement('canvas');
  const scale = Math.min(1, 1024 / Math.max(width, height));
  canvas.width = Math.max(1, Math.round(width * scale)); canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Photo inspection is unavailable.');
  context.drawImage(source, x, y, width, height, 0, 0, canvas.width, canvas.height);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const gray = new Uint8Array(canvas.width * canvas.height);
  for (let index = 0; index < gray.length; index++) gray[index] = Math.round(.299 * pixels[index * 4] + .587 * pixels[index * 4 + 1] + .114 * pixels[index * 4 + 2]);
  const result = classifyMarkComponents(inkComponents(gray, canvas.width, canvas.height), word.text, word.baselineSlope);
  const url = canvas.toDataURL('image/png'); canvas.width = canvas.height = 0;
  return { ...result, url };
}
