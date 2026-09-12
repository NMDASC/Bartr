// Builds Bartr.pptx from the 16 slide stills in .stills/ with the talk track as speaker notes.
// Run via ./export.sh (it installs pptxgenjs into .stills/ and renders the stills first).
const pptxgen = require('pptxgenjs');
const path = require('path');
const NOTES = [
  'The laundromat on Murray Avenue is worth 570,768 dollars, give or take 22 percent. Today you can buy 20 shares of it. That is Bartr.',
  '33 million small businesses. Almost none has a price. Want a laundromat in Squirrel Hill? There is no list.',
  'We connect buyers and sellers. Owners get cash for 30 percent and keep the keys. Investors get 20 shares with a price and a way out. Acquirers get the owner s ear and a letter of intent.',
  'Six things, all running: connect buyers and sellers, find businesses, appraise with a range, run the market, keep it fair, watch every trade.',
  'Type laundromat in Pittsburgh. Places, Querit, Grok. Every number keeps the sentence it came from. 53 real businesses priced.',
  'Squirrel Hill Wash and Fold: 570,768 dollars, range 475 to 686 thousand.',
  'Five ways to value it, each with its own typical miss. Weighted by one over the miss squared. Each method is a bit off and they disagree; we add both. A range, never a bare number.',
  'The owner is the seller. Five lots above our value, a buyback below. Every round, one price for everyone, and the owner requotes from the updated value.',
  'Two rounds. Everyone paid 58.67, including Jonas who bid 64.20. Round two: the value moved, the owner requoted, Jonas sold part of his stake at the same price the new buyers paid.',
  'One price, no head start. Price check, no self trades, size limits, a 10 percent band, proportional fills, an audit log.',
  'Every suggestion shows the gap. Kelly sizes the stake. The slider is your risk: move it and the gain and the possible loss move with it.',
  'From 20 shares to the whole company: an LOI at the last price and a Pittsburgh checklist with the official forms.',
  'Rules catch it, two models judge it separately, and Grok tries to beat it as red team.',
  'Every company is appraised twice: Grok researches and names a value, K2 names one blind, both go into the price.',
  'Next.js, FastAPI, Atlas, Places, Querit, Grok, K2, iMessage. 103 tests.',
  'The laundromat on Murray Avenue has a price. Scan, buy 20 shares, watch the next round.',
];
const pptx = new pptxgen();
pptx.defineLayout({ name: 'W', width: 13.333, height: 7.5 });
pptx.layout = 'W';
pptx.title = 'Bartr';
for (let i = 1; i <= 16; i++) {
  const s = pptx.addSlide();
  s.background = { color: i <= 6 ? 'FFFFFF' : '000000' };
  s.addImage({ path: path.join(__dirname, '.stills', `s${i}.png`), x: 0, y: 0, w: 13.333, h: 7.5 });
  s.addNotes(NOTES[i - 1]);
}
pptx.writeFile({ fileName: path.join(__dirname, 'Bartr.pptx') }).then(f => console.log('wrote', f));
