/**
 * Eingebettete Grafik auf heller Fläche in der Breite der Textspalte (#41).
 * Kein Link zur Bilddatei: Transparente Diagramme wären in der Einzelansicht des Browsers vor dunklem Hintergrund kaum lesbar.
 */
export function Diagram({ src, alt, width, height }: { src: string; alt: string; width: number; height: number }) {
  return (
    <figure className="article-figure">
      <img src={src} alt={alt} width={width} height={height} loading="lazy" />
    </figure>
  );
}
