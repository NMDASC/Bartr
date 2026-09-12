// Builds Bartr.pptx from the 15 slide stills in .stills/ with the talk track as speaker notes.
// Run via ./export.sh (it installs pptxgenjs into .stills/ and renders the stills first).
const pptxgen = require('pptxgenjs');
const path = require('path');
const NOTES = [
  'Bartr. Discover, exchange, acquire. A price and a market for the businesses nobody lists.',
  '33 million small businesses. Almost none has a price. If you wanted to buy a laundromat in Squirrel Hill tonight you could not even find the list.',
  'For a buyer: a price with an error bar, then 20 shares, then the keys. For an owner: sell 30 percent to the crowd, keep the keys.',
  'Type laundromat in Pittsburgh. Places finds them, Querit reads the web, Grok extracts a profile where every number carries its quote. The ensemble prices it with a range.',
  'Squirrel Hill Wash and Fold. 571 thousand, plus or minus 22 percent. Live book, countdown, order ticket.',
  'Five methods, each with a measured miss. Blend them, trusting the tighter ones. Doubt has two parts: the methods own error and how much they disagree. A range, never a bare number.',
  'The owner is the seller. An ask ladder for 30 percent just above the model value, a buyback floor at P20. Every round, one price for everyone. Between rounds the owner requotes.',
  'Scan the QR and bid. Three rounds: one price per round, the owner requotes, in round three a holder sells to new buyers at the same price.',
  'One price, no head start. Clamp, self trade check, limits, a ten percent band, pro rata fills, an append only audit log. Speed buys nothing.',
  'Find the edge, size it, keep an exit. Model value next to market price, your own Kelly dial, the owner buyback bid standing in every book.',
  'From a share to the whole company. An LOI at the last clearing price and a Pittsburgh checklist that links to official sources.',
  'Rules scan every trade. Every flag goes to Grok and to K2 separately. If they disagree, we show it.',
  'Two tier appraisal: Grok researches with web search and appraises, K2 gives an independent number, both are clamped and go into the ensemble with their own doubt. Grok also reviews flags, red teams the market, and runs the agent.',
  'Next.js, FastAPI, MongoDB Atlas, Places, Querit, Grok, K2, an iMessage bridge to the same agent.',
  'Bartr. Discover. Exchange. Acquire.',
];
const pptx = new pptxgen();
pptx.defineLayout({ name: 'W', width: 13.333, height: 7.5 });
pptx.layout = 'W';
pptx.title = 'Bartr';
for (let i = 1; i <= 15; i++) {
  const s = pptx.addSlide();
  s.background = { color: i <= 5 ? 'FFFFFF' : '000000' };
  s.addImage({ path: path.join(__dirname, '.stills', `s${i}.png`), x: 0, y: 0, w: 13.333, h: 7.5 });
  s.addNotes(NOTES[i - 1]);
}
pptx.writeFile({ fileName: path.join(__dirname, 'Bartr.pptx') }).then(f => console.log('wrote', f));
