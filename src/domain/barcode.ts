// Mismas reglas que BarcodeUtils de las apps de escritorio y Android.

export function normalizeBarcode(raw: string): string {
  return raw.replace(/\D/g, '');
}

/** UPC-A (12 cifras) y EAN-13 con un 0 delante son el mismo código: se prueban las dos formas. */
export function barcodeVariants(barcode: string): string[] {
  if (barcode.length === 12) return [barcode, `0${barcode}`];
  if (barcode.length === 13 && barcode.startsWith('0')) return [barcode, barcode.slice(1)];
  return [barcode];
}

/**
 * El lector web da los UPC-A como EAN-13 con un 0 delante, mientras que las otras apps los guardan
 * con 12 cifras: se guardan igual para que todas vean el mismo código.
 */
export function canonicalBarcode(raw: string): string {
  const barcode = normalizeBarcode(raw);
  return barcode.length === 13 && barcode.startsWith('0') ? barcode.slice(1) : barcode;
}

export function extractYear(text: string): number | null {
  const digits = normalizeBarcode(text);
  const maxYear = new Date().getFullYear() + 1;
  for (let index = 0; index <= digits.length - 4; index += 1) {
    const year = Number(digits.slice(index, index + 4));
    if (year >= 1970 && year <= maxYear) return year;
  }
  return null;
}
