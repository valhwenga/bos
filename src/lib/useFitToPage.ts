import { useCallback, useEffect, useState } from "react";
import { A4_HEIGHT_MM } from "./printStyles";

const PX_PER_MM = 96 / 25.4;
const PAGE_HEIGHT_PX = A4_HEIGHT_MM * PX_PER_MM;

/**
 * Beyond this much overflow, shrinking the document would make it unreadable,
 * so it is allowed to paginate instead. A 12-line invoice that runs a
 * centimetre over gets scaled; a 30-line one gets a second sheet.
 */
const MAX_SHRINK = 0.78;

/**
 * Scales a document down just enough to land on a single A4 sheet when it only
 * marginally overflows.
 *
 * The codebase previously tried to express this with a `print:fit-to-a4` class
 * applied when an invoice had five or fewer items, but that class was never
 * defined, so nothing happened — and the item count is the wrong signal anyway,
 * since a long description makes a five-item invoice taller than a terse
 * ten-item one. This measures the rendered height instead.
 */
export function useFitToPage(ref: React.RefObject<HTMLElement>, deps: unknown[] = []) {
  const [scale, setScale] = useState(1);

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;

    // Measure unscaled, otherwise each pass compounds the previous one.
    el.style.setProperty("--fit-scale", "1");
    const natural = el.scrollHeight;
    if (natural <= PAGE_HEIGHT_PX) {
      setScale(1);
      return;
    }

    const needed = PAGE_HEIGHT_PX / natural;
    setScale(needed >= MAX_SHRINK ? needed : 1);
  }, [ref]);

  useEffect(() => {
    // Fonts change metrics after they load, so re-measure once they settle.
    measure();
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    fonts?.ready?.then(measure).catch(() => undefined);

    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measure, ...deps]);

  return scale;
}
