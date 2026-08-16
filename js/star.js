/* ==========================================================================
   star.js — generates the 14-point Bintang star, the app's signature motif
   (echoing the star on Jalur Gemilang). Used as logo, loading spinner and
   result badge so the motif recurs consistently across the app.
   ========================================================================== */

const Star = (() => {
  function points(cx, cy, outerR, innerR, count) {
    const pts = [];
    const step = Math.PI / count;
    for (let i = 0; i < count * 2; i++) {
      const r = i % 2 === 0 ? outerR : innerR;
      const angle = i * step - Math.PI / 2;
      pts.push(`${(cx + r * Math.cos(angle)).toFixed(2)},${(cy + r * Math.sin(angle)).toFixed(2)}`);
    }
    return pts.join(" ");
  }

  // Returns inner SVG markup (defs + shapes) to place inside an <svg viewBox="0 0 100 100">
  function svgInner() {
    const star = points(50, 50, 46, 30, 14);
    return `
      <defs>
        <linearGradient id="starGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#FFC93C"/>
          <stop offset="100%" stop-color="#D91C2B"/>
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="48" fill="#122A52" stroke="rgba(255,255,255,0.12)" stroke-width="1.5"/>
      <polygon points="${star}" fill="url(#starGrad)"/>
    `;
  }

  function markup(sizeClass) {
    return `<svg class="${sizeClass || ''}" viewBox="0 0 100 100" aria-hidden="true">${svgInner()}</svg>`;
  }

  return { svgInner, markup };
})();
