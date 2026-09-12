// Builds JB.pptx from the 12 slide stills in .stills/ with the talk track as speaker notes.
// Run via ./export.sh (it installs pptxgenjs into .stills/ and renders the stills first).
const pptxgen = require('pptxgenjs');
const path = require('path');
const NOTES = [
  'JB. A stock market for the businesses that will never be listed.',
  'There are 33 million small businesses in the US and none of them has a price. If you wanted to buy a laundromat in Squirrel Hill tonight you could not even find the list.',
  'Type "laundromat in Pittsburgh". Results stream in with bid, ask, confidence. Places finds them, Querit reads the web about each one, Grok extracts a cited profile.',
  'Click one. Profile with sources, five independent estimators and their spread, a valuation range, the live book and the countdown.',
  'Every estimator is a belief about log value with its own sigma. Precision weighted, inflated by disagreement, calibrated on real listings. The owner quotes come from the same posterior.',
  'Every ten seconds we run a uniform price auction and clear at the volume maximizing price. Price band, pro rata rationing, belief update after each round. The platform never trades.',
  'Scan the QR and bid. Watch the batch clear: bids arrive, the countdown hits zero, demand meets supply, one price for everyone.',
  'Portfolio. Given your profile, here are four stakes sized by half Kelly on the gap between model value and market price.',
  'Acquire. A drafted LOI and a Pittsburgh specific diligence checklist with citations. From a share to the whole company.',
  'Surveillance. Every round two model families read the tape. Grok flags a planted wash trade, K2 concurs. Independent review.',
  'Grok, IFM K2, Querit, MongoDB Atlas Vector Search, Auth0, Vultr, Vercel. Next.js and FastAPI, built in Cursor. Track: Optimization.',
  'JB. Price everything.',
];
const pptx = new pptxgen();
pptx.defineLayout({ name: 'W', width: 13.333, height: 7.5 });
pptx.layout = 'W';
pptx.title = 'JB';
for (let i = 1; i <= 12; i++) {
  const s = pptx.addSlide();
  s.background = { color: i <= 4 ? 'FFFFFF' : '000000' };
  s.addImage({ path: path.join(__dirname, '.stills', `s${i}.png`), x: 0, y: 0, w: 13.333, h: 7.5 });
  s.addNotes(NOTES[i - 1]);
}
pptx.writeFile({ fileName: path.join(__dirname, 'JB.pptx') }).then(f => console.log('wrote', f));
