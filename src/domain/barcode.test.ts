import { describe, expect, it } from 'vitest';
import { barcodeVariants, canonicalBarcode, extractYear, normalizeBarcode } from './barcode';

describe('normalizeBarcode', () => {
  it.each([
    ['045496590048', '045496590048'],
    ['0454-9659-0048', '045496590048'],
    ['045 496 590 048', '045496590048'],
    ['abc123def456', '123456'],
  ])('%s', (raw, expected) => {
    expect(normalizeBarcode(raw)).toBe(expected);
  });
});

describe('barcodeVariants', () => {
  it('añade el 0 a un UPC', () => {
    expect(barcodeVariants('045496590048')).toEqual(['045496590048', '0045496590048']);
  });

  it('quita el 0 a un EAN que empieza por 0', () => {
    expect(barcodeVariants('0045496590048')).toEqual(['0045496590048', '045496590048']);
  });

  it('deja igual cualquier otra longitud', () => {
    expect(barcodeVariants('1234567890123456')).toEqual(['1234567890123456']);
  });
});

describe('canonicalBarcode', () => {
  it('pasa a 12 cifras un UPC leído como EAN-13', () => {
    expect(canonicalBarcode('0045496590048')).toBe('045496590048');
  });

  it('respeta un EAN europeo', () => {
    expect(canonicalBarcode('5030917285066')).toBe('5030917285066');
  });
});

describe('extractYear', () => {
  it.each([
    ['Released 2017-10-27', 2017],
    ['2017', 2017],
    ['sin fecha', null],
    ['', null],
    ['1969-01-01', null],
  ])('%s', (text, expected) => {
    expect(extractYear(text)).toBe(expected);
  });
});
