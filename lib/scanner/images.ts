export type ScanImage = { url: string; width: number; height: number };
export type Box = { x: number; y: number; width: number; height: number };

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('This photo could not be opened. Try a JPEG or PNG image.'));
    image.src = url;
  });
}

function finish(canvas: HTMLCanvasElement): ScanImage {
  const image = { url: canvas.toDataURL('image/jpeg', 0.95), width: canvas.width, height: canvas.height };
  canvas.width = canvas.height = 0;
  return image;
}

export async function prepareImage(url: string): Promise<ScanImage> {
  const image = await loadImage(url);
  if (!image.naturalWidth || !image.naturalHeight) throw new Error('The image is empty.');
  const scale = Math.min(1, 2048 / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Photo processing is unavailable.');
  context.fillStyle = '#fff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return finish(canvas);
}

export async function editImage(image: ScanImage, crop?: Box): Promise<ScanImage> {
  const source = await loadImage(image.url);
  const canvas = document.createElement('canvas');
  canvas.width = crop ? Math.max(1, Math.round(crop.width * image.width)) : image.height;
  canvas.height = crop ? Math.max(1, Math.round(crop.height * image.height)) : image.width;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Photo processing is unavailable.');
  if (crop) {
    context.drawImage(source, crop.x * image.width, crop.y * image.height,
      crop.width * image.width, crop.height * image.height, 0, 0, canvas.width, canvas.height);
  } else {
    context.translate(canvas.width, 0);
    context.rotate(Math.PI / 2);
    context.drawImage(source, 0, 0);
  }
  return finish(canvas);
}
