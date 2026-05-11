/** URLs de vista previa alojadas en storage (WebM/Mp4 se muestran como video en bucle). */
export function routePreviewIsVideo(url: string): boolean {
  return /\.(webm|mp4)(\?|#|$)/i.test(url)
}
