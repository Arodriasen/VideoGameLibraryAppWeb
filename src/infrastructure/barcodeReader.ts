import { prepareZXingModule, readBarcodes, type ReaderOptions } from 'zxing-wasm/reader';
import wasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url';

// Safari no trae lector de códigos, así que se usa ZXing compilado a WebAssembly. El .wasm va con la
// app (por defecto la librería lo descargaría de un CDN).
prepareZXingModule({
  overrides: { locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? wasmUrl : prefix + path) },
});

const OPTIONS: ReaderOptions = {
  formats: ['EAN13', 'EAN8', 'UPCA', 'UPCE'],
  tryHarder: true,
  tryRotate: true,
  maxNumberOfSymbols: 1,
};

export interface BarcodeResult {
  code: string;
  format: string;
}

export async function readBarcode(image: ImageData): Promise<BarcodeResult | null> {
  const [result] = await readBarcodes(image, OPTIONS);
  return result?.isValid ? { code: result.text, format: result.format } : null;
}

const MAX_PHOTO_SIDE = 2400;

/** Lee el código de una foto. Pasa por el canvas porque el iPhone puede dar fotos HEIC. */
export async function readBarcodeFromPhoto(photo: File): Promise<BarcodeResult | null> {
  const bitmap = await createImageBitmap(photo);
  const scale = Math.min(1, MAX_PHOTO_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);

  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return null;
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return readBarcode(context.getImageData(0, 0, canvas.width, canvas.height));
}
