// Las apps de escritorio y Android muestran la portada guardada, no la URL: por eso, al guardar un
// juego, también se descarga aquí. Si falla, el juego se guarda igual, solo con la URL.

const TIMEOUT_MS = 12_000;
const MAX_BYTES = 3 * 1024 * 1024;

export async function downloadCover(url: string): Promise<Uint8Array | null> {
  if (!/^https?:\/\//i.test(url)) return null;

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!response.ok || !response.headers.get('Content-Type')?.startsWith('image/')) return null;

    const bytes = new Uint8Array(await response.arrayBuffer());
    return bytes.length > 0 && bytes.length <= MAX_BYTES ? bytes : null;
  } catch {
    return null;
  }
}
