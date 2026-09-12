import "./landing.css";

const W = 1400;
const H = 560;
const BASE = H - 46;
const TOP = 70;

/**
 * The hero backdrop: every business the engine has an opinion about, drawn as
 * the shape of that opinion. Each hairline is one lognormal value posterior,
 * narrow and tall where the evidence is good, wide and flat where it is thin.
 * It is the same object the valuation section later lets you drag a mark across,
 * so the page opens on the thing it goes on to explain.
 *
 * Structural, not decorative: no gradient, no glow, no grain. Hairlines in the
 * one accent at low opacity, drawn once on arrival and then still.
 */
const CURVES = 26;

function curvePath(medianAt: number, sigma: number, peak: number) {
  // sample in log space so the bell is smooth on a value axis
  const lo = Math.log(0.02);
  const hi = Math.log(1.6);
  const mu = Math.log(medianAt);
  const pts: string[] = [];
  for (let i = 0; i <= 96; i++) {
    const t = i / 96;
    const lx = lo + t * (hi - lo);
    const z = (lx - mu) / sigma;
    const d = Math.exp(-0.5 * z * z);
    const x = t * W;
    const y = BASE - d * peak;
    pts.push(`${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return pts.join(" ");
}

export function LandingHeroField() {
  const curves = Array.from({ length: CURVES }, (_, i) => {
    const t = i / (CURVES - 1);
    // medians evenly spaced in log space so the fan reads across the whole axis
    // instead of piling up at one end, and sigma falls monotonically: thin
    // evidence on the left, well covered businesses on the right
    const median = Math.exp(Math.log(0.05) + t * (Math.log(0.95) - Math.log(0.05)));
    const sigma = 0.34 - t * 0.2;
    // narrower posteriors peak higher, the way a density has to, but the range is
    // bounded so nothing spikes off the top
    const peak = (BASE - TOP) * (0.35 + 0.35 * (1 - sigma / 0.34));
    return { d: curvePath(median, sigma, peak), delay: 120 + i * 46 };
  });

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMax slice"
        className="absolute inset-x-0 bottom-0 h-[78%] w-full"
      >
        {/* the value axis the family sits on */}
        <line x1="0" x2={W} y1={BASE} y2={BASE} stroke="#755CFE" strokeWidth="0.75" opacity="0.16" />
        {[0.14, 0.32, 0.5, 0.68, 0.86].map((f) => (
          <line key={f} x1={f * W} x2={f * W} y1={BASE} y2={BASE + 9} stroke="#755CFE" strokeWidth="0.75" opacity="0.14" />
        ))}
        <g fill="none" stroke="#755CFE" strokeWidth="0.9" opacity="0.17">
          {curves.map((c) => (
            <path key={c.delay} d={c.d} pathLength={1} className="bl-hero-curve" style={{ animationDelay: `${c.delay}ms` }} />
          ))}
        </g>
      </svg>
    </div>
  );
}
