/**
 * Abre el menú Compartir del sistema; donde no exista, copia el texto.
 * Devuelve el aviso que hay que mostrar, o null si no hace falta ninguno.
 */
export async function shareOrCopy(title: string, text: string): Promise<string | null> {
  try {
    if (navigator.share) {
      await navigator.share({ title, text });
      return null;
    }
    await navigator.clipboard.writeText(text);
    return 'Texto copiado.';
  } catch (e) {
    // Cerrar el menú sin elegir nada también llega aquí, y no es un error.
    return e instanceof DOMException && e.name === 'AbortError' ? null : 'No se ha podido compartir.';
  }
}
