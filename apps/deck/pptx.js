// Builds Bartr.pptx from the 14 slide stills in .stills/ with the talk track as speaker notes.
// Run via ./export.sh (it installs pptxgenjs into .stills/ and renders the stills first).
const pptxgen = require('pptxgenjs');
const path = require('path');
const NOTES = [
  'Bartr. Discover, exchange, acquire. The first stock market for the businesses that will never be listed.',
  'There are 33 million small businesses in the US and none of them has a price. If you wanted to buy a laundromat in Squirrel Hill tonight you could not even find the list.',
  'Discover a business, own a piece of it, buy the whole thing. One place. Nobody has built that exchange before.',
  'Type "laundromat in Pittsburgh". Places finds real businesses, Querit reads the web about each one, Grok extracts a cited profile, the ensemble prices it with a range.',
  'Squirrel Hill Wash and Fold. Sources, estimators, a range not a number, the live book and the countdown.',
  'Every piece of evidence is its own estimate with its own uncertainty. Precision weighted, wider when they disagree, calibrated on real listings.',
  'The owner is the other side. An ask ladder for 30 percent of the shares at P55 to P80, a buyback floor at P20. Every ten seconds the book clears at one price. The platform never trades.',
  'Scan the QR and bid. Watch the batch: people quote, the countdown hits zero, demand meets supply, one price for everyone.',
  'Fair by construction. Price clamp, self trade prevention, position limits, one uniform price per round, a ten percent band, pro rata fills, an append only audit log. Speed buys nothing.',
  'Built for you to make money. Edge shown on every suggestion, your own Kelly multiplier, always an exit at the owner floor. We are never your counterparty.',
  'Acquire. A drafted LOI and a Pittsburgh specific diligence checklist with citations. From a share to the whole company.',
  'Every trade is reviewed by a panel of AI agents: a rules agent, Grok, and K2 as an independent second model. A planted wash trade gets flagged, explained, and frozen.',
  'How it runs: Next.js on Vercel, FastAPI on Vultr, MongoDB Atlas with Vector Search, Auth0, Places, Querit, Grok, K2. Built in Cursor.',
  'Bartr. Discover. Exchange. Acquire.',
];
const pptx = new pptxgen();
pptx.defineLayout({ name: 'W', width: 13.333, height: 7.5 });
pptx.layout = 'W';
pptx.title = 'Bartr';
for (let i = 1; i <= 14; i++) {
  const s = pptx.addSlide();
  s.background = { color: i <= 5 ? 'FFFFFF' : '000000' };
  s.addImage({ path: path.join(__dirname, '.stills', `s${i}.png`), x: 0, y: 0, w: 13.333, h: 7.5 });
  s.addNotes(NOTES[i - 1]);
}
pptx.writeFile({ fileName: path.join(__dirname, 'Bartr.pptx') }).then(f => console.log('wrote', f));
