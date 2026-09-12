# Prompt: build the JB demo deck

Paste everything below this line into a fresh agent session (Claude Code or Cursor) opened in the JB repo root.

---

You are building the presentation for **JB**, a HackCMU 2026 project, presented live in a 3 minute judged demo on Saturday Sep 12, 2026 at 4 PM. Read `Plan.md` (especially sections 2, 3, 8, 13) and `docs/DECISIONS.md` before you start. Do not modify anything outside `apps/deck/`.

## What JB is

A discovery engine and exchange for businesses that will never be listed: laundromats, car washes, machine shops, family manufacturers. Search them like Google, price them like a stock, buy a fraction like Robinhood, acquire them like a PE firm.

Two phases:
1. **Discover.** "Laundromat in Oklahoma" -> Google Places finds real businesses, Querit (web search API) reads the web about each one, Grok (xAI, `grok-4.6`) extracts a structured profile with cited sources, and a Bayesian valuation ensemble prices it with an honest uncertainty.
2. **Trade and acquire.** Each business is 10,000 shares. A frequent batch auction clears every 10 seconds at the single price that maximizes executed volume. The owner provides liquidity (ask ladder for the float, buyback floor). The platform never trades. A portfolio builder sizes stakes with half Kelly. Grok and IFM K2 review every round's tape for wash trades, spoofing, and pumps. "Acquire" drafts an LOI and a state specific diligence checklist with citations.

Track: **Optimization**. Judging criteria: originality, technical difficulty ("real technical challenges vs ChatGPT wrapper"), demo quality (under 3 minutes), usefulness, track relevance.

Sponsors to name on the stack slide, in this order: **Grok (xAI)**, **IFM K2 Horizon**, **Querit**, **MongoDB Atlas (Vector Search)**, **Auth0**, **Vultr**, **Vercel**, built in **Cursor**. Stack: Next.js 15, FastAPI, Python.

## Deliverable

A self contained HTML slide deck at `apps/deck/index.html` (single file, inline CSS and JS, KaTeX from cdnjs for equations, no build step) that runs full screen in Chrome with arrow key navigation and a presenter clock. Also export a PDF of the deck (`apps/deck/JB.pdf`) using headless Chrome (`--print-to-pdf`) so we have a fallback if the browser dies on stage. If you can also produce a `.pptx` with the same content via `pptxgenjs`, do it, but the HTML deck is the one we present.

## Design brief

Apple keynote aesthetic, executed properly:
- Black background (#000) for the exchange half of the story, white (#fff) for the discovery half. Switch once, at the "now we price it" moment, with a full screen crossfade.
- One accent color only: a warm green (#30D158) for bids and gains, with red (#FF453A) used exactly once, on the anti manipulation slide.
- Type: SF Pro if available, else Inter from Google Fonts; display sizes 96 to 160px for the single line slides, 28 to 36px body. Tabular numerals everywhere numbers appear.
- Every slide has one idea. Most slides have under 12 words. The equation slides are the exception and they should look dense on purpose.
- Motion: fade up on enter (12px translate, 600ms, cubic-bezier(0.22, 1, 0.36, 1)), staggered 80ms per element. Numbers count up. The order book slide animates a live batch: orders slide in, a countdown hits zero, the demand and supply curves draw, the clearing price line snaps into place, fills flash green. Build this as real DOM animation, not a video.
- No stock photos, no icons from icon packs, no gradients except a single subtle radial vignette. Screenshots of the real app go in device frames (browser chrome drawn in CSS). Use placeholders with the exact aspect ratio (1440x900) and a `<!-- SCREENSHOT: route -->` comment where a screenshot goes; we will drop in real ones at 1 PM Saturday.
- 16:9. Test at 1920x1080 and 1440x900.

## Slide list (target 12 slides, 3 minutes, 15 seconds per slide average)

1. **Title.** "JB" huge. Subline: "A stock market for the businesses that will never be listed." Team names small at the bottom: Nico, Vir, Aditya, Zhiyuan.
2. **The problem.** "33 million small businesses. None of them has a price." Second beat: "If you wanted to buy a laundromat in Tulsa tonight, you could not even find the list."
3. **Discover.** Screenshot placeholder of the search results streaming in. Three words under it: Places, Querit, Grok.
4. **One company.** Screenshot placeholder of the company page: profile, sources, the five estimators, the valuation range bar.
5. **How we price it.** The intimidating slide. Black background, white equations, KaTeX, dense, every symbol defined in a small legend along the bottom. Content below in "Equations".
6. **How the market clears.** Second intimidating slide: the batch auction, band, rationing, interval, belief update. Content below in "Equations".
7. **Live.** The animated order book: countdown, curves, clearing price, fills. This is where the presenter says "scan the QR and bid" and a QR placeholder sits in the corner.
8. **Portfolio.** Kelly. One equation, one screenshot placeholder, one sentence: "Sized by half Kelly on the gap between model value and market price."
9. **Acquire.** LOI and Oklahoma diligence checklist screenshot placeholder. "From a share to the whole company."
10. **Surveillance.** The one red slide. "Every round, two model families read the tape." Grok flag, K2 concurs. Show the wash trade detection rule in one line.
11. **Stack.** Sponsor names as plain text logos in a single row, plus "built in Cursor". No logo images unless they are in `apps/deck/assets/` already.
12. **Close.** "JB. Price everything." QR to the live site.

## Equations (render exactly these; define every symbol in a legend)

**Slide 5, initial pricing (a precision weighted Bayesian ensemble in log space).**

Each estimator $k$ produces a belief about log value:
$$\ln V \mid k \sim \mathcal{N}(\mu_k,\ \sigma_k^2)$$

Estimators:
$$\mu_{\text{list}} = \ln(h \cdot P_{\text{ask}}), \quad \sigma_{\text{list}} = 0.15$$
$$\mu_{\text{inc}} = \ln\!\Big(m_c \cdot h \cdot \mathrm{SDE} \cdot \prod_j q_j\Big), \quad \mathrm{SDE} = R \cdot \phi_c \ \text{if unobserved}, \quad \sigma_{\text{inc}} \in \{0.25, 0.40\}$$
$$\mu_{\text{proxy}} = \ln\!\Big(m_c \cdot h \cdot \phi_c \cdot \hat R\Big), \quad \hat R = \tfrac{1}{|J|}\sum_{j \in J} n_j \rho_j, \quad \sigma_{\text{proxy}} = 0.60$$
$$\mu_{\text{llm}} = \tfrac{1}{M}\sum_{m=1}^{M} \ln \hat V_m, \quad \sigma_{\text{llm}} = \max\!\Big(0.35 + 0.35(1-c),\ \tfrac{1}{2}\,|\ln \hat V_1 - \ln \hat V_2|\Big)$$
$$\mu_{\text{base}} = \ln\!\Big(\tilde P_c \cdot h \cdot \kappa_s \cdot \prod_j q_j\Big), \quad \sigma_{\text{base}} = 0.70$$

Posterior:
$$w_k = \sigma_k^{-2}, \qquad \mu = \frac{\sum_k w_k \mu_k}{\sum_k w_k}, \qquad \sigma^2 = \frac{1}{\sum_k w_k} + \frac{\sum_k w_k (\mu_k - \mu)^2}{\sum_k w_k}$$
$$\sigma \leftarrow \mathrm{clip}(\sigma,\ 0.12,\ 0.90), \qquad V_0 = e^{\mu}, \qquad V_q = \exp\!\big(\mu + \sigma\,\Phi^{-1}(q)\big)$$

Owner quotes from the posterior (per share, $N = 10{,}000$):
$$\text{floor bid} = \frac{V_{0.20}}{N}, \qquad \text{ask ladder} = \Big\{\frac{V_q}{N} : q \in \{0.55, 0.6125, 0.675, 0.7375, 0.80\}\Big\}$$

Calibration on scraped listings (hide the price, score each estimator):
$$\hat\sigma_k = \mathrm{std}_i\big(\mu_k^{(i)} - \ln(h \cdot P^{(i)}_{\text{ask}})\big)$$

Legend: $h = 0.88$ sold to asking haircut; $m_c$ category SDE multiple (BizBuySell 2026); $\phi_c$ category SDE margin; $q_j$ quality multipliers (reviews, tenure, owner operated); $\tilde P_c$ category median asking price; $\kappa_s$ state price index; $n_j, \rho_j$ observable counts and revenue per unit (employees, machines, reviews); $\hat V_m$ model opinions (Grok, K2); $c$ model confidence; $\Phi^{-1}$ inverse normal CDF.

**Slide 6, market clearing (frequent batch auction with owner liquidity).**

Demand and supply from the resting book at candidate price $p$:
$$D(p) = \sum_{b:\ \ell_b \ge p} q_b, \qquad S(p) = \sum_{s:\ \ell_s \le p} q_s$$

Clearing price maximizes executed volume, with lexicographic tiebreaks:
$$p^\star = \arg\max_{p \in \mathcal{L}} \min\{D(p), S(p)\} \quad \text{then } \arg\min |D(p) - S(p)| \quad \text{then } \arg\min |p - p_{t-1}|$$

Price band and halt:
$$p^\star \leftarrow \mathrm{clip}\big(p^\star,\ (1-\beta)\,p_{t-1},\ (1+\beta)\,p_{t-1}\big), \quad \beta = 0.10$$

Pro rata rationing on the long side:
$$x_i = q_i \cdot \frac{\min\{D(p^\star), S(p^\star)\}}{D(p^\star)} \ \text{(buyers, if } D > S\text{)}, \qquad \text{everyone trades at } p^\star$$

Adaptive round length:
$$T = \mathrm{clip}\!\Big(\frac{200}{n_{\text{open}}},\ 10,\ 60\Big)\ \text{seconds}$$

Belief update after each round (normal-normal, volume weighted):
$$w_t = \frac{v_t}{\bar v}, \qquad \mu_{\text{post}} = \frac{\mu/\sigma^2 + \sum_t w_t \ln(N p^\star_t)/s_m^2}{1/\sigma^2 + \sum_t w_t / s_m^2}, \qquad \sigma_{\text{post}}^2 = \frac{1}{1/\sigma^2 + \sum_t w_t/s_m^2}$$

Self trade prevention, position limits, immutable audit log:
$$\forall u:\ \{b \in B_u,\ s \in S_u,\ \ell_b \ge \ell_s\} \Rightarrow \text{cancel } \arg\max(\text{seq}), \qquad q \le 0.05N, \qquad \text{notional}_u \le 0.25\,\text{cash}_u$$

Legend: $\ell$ limit price, $q$ quantity, $\mathcal{L}$ set of limit prices in the book, $p_{t-1}$ last clearing price, $v_t$ round volume, $s_m$ per round price noise (0.10, then realized), $N = 10{,}000$ shares.

**Slide 8, Kelly.**
$$\mu = \ln\frac{v}{p}, \qquad f^\star = \frac{\mu}{\sigma^2}, \qquad f = \mathrm{clip}\!\big(\tfrac{1}{2} f^\star,\ 0,\ 0.20\big), \qquad \$ = f \cdot B$$
Legend: $v$ model value per share, $p$ market price, $\sigma$ posterior uncertainty, $B$ bankroll. Half Kelly because the edge is estimated.

**Slide 10, one line.** Wash trade: same user on both sides within 3 rounds, or two accounts that only ever trade with each other. Pump: $|\Delta \ln p^\star| > 2\sigma_p$ with more than 60% of buy volume from one account.

## Numbers you can put on slides (real output from `python scripts/demo_pricing.py`)

- Documented laundromat, Tulsa OK, SDE $140k, 4.6 stars, 180 reviews: **$525,900**, sigma 0.22, P20 $437k, P80 $633k. Per share $52.59. Owner floor $43.70, ask ladder $54.06 to $63.28.
- Same business actually listed at $575k: **$512,114**, sigma 0.13.
- A laundromat that is only a Google Places pin, 23 reviews: **$184,487**, sigma 0.78 (the model refuses to be confident).
- Car wash where Grok says $1.9M and K2 says $0.9M: model opinion sigma widens to 0.52, posterior **$1,391,313**, sigma 0.35.
- 6 round auction sim, 8 Kelly sized bots: 54.06 -> 56.00 -> 56.00 -> 56.00 -> 58.04 -> 55.02 against a model price of 52.59.
- BizBuySell 2026: median small business sells at 2.7x cash flow, laundromats at about 4.0x, car washes 5.8x asking.

## Do not

- Do not mention a market maker, Avellaneda Stoikov, LMSR, or Black Scholes anywhere. The platform never trades. Liquidity is the owner's ask ladder and buyback floor.
- Do not use em dashes anywhere in the deck. No filler words. Sentences short.
- Do not add slides beyond 12. If something does not fit, cut it.
- Do not use Grok or K2 to write the deck. They are used inside the product only.

## Done means

- `apps/deck/index.html` opens in Chrome, arrows navigate, `P` toggles presenter clock, `F` goes full screen, all equations render, the live auction animation on slide 7 plays on Enter and can be replayed with `R`.
- `apps/deck/JB.pdf` exists.
- A `apps/deck/README.md` with: how to present, where the screenshot placeholders are, and the 3 minute talk track (one or two lines per slide, taken from Plan.md section 13).
- Commit on branch `a/deck`, push, and add a line to `docs/DECISIONS.md` saying the deck exists and where.
