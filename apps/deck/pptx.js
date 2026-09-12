// Builds Bartr.pptx from the 15 slide stills in .stills/ with the talk track as speaker notes.
// Run via ./export.sh (it installs pptxgenjs into .stills/ and renders the stills first).
const pptxgen = require('pptxgenjs');
const path = require('path');
const NOTES = [
  'The laundromat on Murray Avenue is worth 570,768 dollars, give or take 22 percent. Today you can buy 20 shares of it. That is Bartr.',
  '33 million small businesses. Almost none has a price. Want a laundromat in Squirrel Hill? There is no list, and nothing you find has a number next to it.',
  'Buyers see what a shop is worth, buy 20 shares, or buy all of it. Owners sell 30 percent to the crowd and keep running it.',
  'Type laundromat in Pittsburgh. Places finds them, Querit reads the web, Grok turns the pages into a profile where every number keeps the sentence it came from.',
  'Squirrel Hill Wash and Fold: 570,768 dollars, range 475 to 686 thousand. 57.08 a share.',
  'Five ways to value it, each with its own typical miss. Weighted by one over the miss squared. Each method is a bit off and they disagree; we add both. A range, never a bare number.',
  'The owner is the seller. Five lots just above our value, a buyback bid below it. Every round, one price for everyone. Our value updates from what buyers paid and the owner quotes move with it.',
  'Two rounds. Everyone in the round paid 58.67, including Jonas who bid 64.20. Round two: our value moved, the owner requoted, Jonas sold part of his stake at the same price the new buyers paid.',
  'One price, no head start. Price check, no trading with yourself, size limits, a 10 percent band, proportional fills, an audit log. Being fast buys nothing.',
  'Every suggestion shows the gap between our value and the price. Kelly turns that into a stake. The slider is your risk level; move it and the gain and the possible loss move with it.',
  'From 20 shares to the whole company: a letter of intent at the last price and a Pittsburgh checklist that links to the official forms.',
  'Rules scan every trade. Grok and K2 review every flag separately. Grok also attacks the market as red team so the rules get tested.',
  'Every company is appraised twice: Grok researches and names a value, K2 names one without seeing Grok s, both go into the price.',
  'Next.js, FastAPI, Atlas, Places, Querit, Grok, K2, iMessage. 103 tests.',
  'The laundromat on Murray Avenue has a price. Scan, buy 20 shares, watch the next round.',
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
