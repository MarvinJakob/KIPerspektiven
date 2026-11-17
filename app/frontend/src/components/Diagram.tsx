/** Grafik mit Link zur Originalgröße in einem neuen Tab, wie in den Mocks der Themenseiten. */
export function Diagram({ src, alt, open, width, height }: { src: string; alt: string; open: string; width: number; height: number }) {
  return (
    <figure className="article-figure">
      <a href={src} target="_blank" rel="noopener" aria-label={open}>
        <img src={src} alt={alt} width={width} height={height} loading="lazy" />
      </a>
    </figure>
  );
}
