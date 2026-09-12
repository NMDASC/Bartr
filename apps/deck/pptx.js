// Builds Bartr.pptx from the slide stills in .stills/ with the talk track and Q&A prompts as speaker notes.
// Run via ./export.sh (it installs pptxgenjs into .stills/ and renders the stills first).
const pptxgen = require('pptxgenjs');
const path = require('path');
const NOTES = [
  'The laundromat on Murray Avenue is worth 570,768 dollars, give or take 22 percent. Today you can buy 20 shares of it. That is Bartr.',
  'Who here is from CMU? Who has eaten at Grapow? Ever thought about putting money into it? There is no way to. Thirty-six million small businesses in this country.',
  'And when the owner retires, four out of five of the ones that try to sell never find a buyer. They shut down. Most of them are profitable. They close because nobody can write a check for the whole thing, and nobody is allowed to buy part of it.',
  'These places employ half the American workforce. So this is not a niche. It is the economy.',
  'We connect buyers and sellers. Owners sell 30 percent and keep running the place. Investors buy 20 shares with a price and a way out. Acquirers get the owner s ear and a letter of intent.',
  'Type laundromat in Pittsburgh. Places, Querit, Grok. Every number keeps the sentence it came from. 53 real businesses priced.',
  'Our proprietary search helps you discover underground, undervalued companies. Grok reads the brief. Google Places lists every business in the city. Querit finds twelve pages about them and reads the best six. Grok turns pages into profiles where every figure keeps its sentence and its URL.',
  'Squirrel Hill Wash and Fold: 570,768 dollars, range 475 to 686 thousand.',
  'Five ways to value it, each with its own typical miss. Weighted by one over the miss squared. A range, never a bare number.',
  'Every ten seconds, one price: the one where the most shares trade. Watch the scan: at each price, count what buyers would take and sellers would give, clear at the peak. The buyer who bid 60.50 pays 59.50 like everyone else. Our value then listens to what people paid, and the owner requotes from it.',
  'We backed the bidding price and the portfolio construction with industry-tested trading mathematics. On the board and on paper: maximize log wealth, the optimum is pb minus q over b. In the app: half Kelly, capped at 20 percent.',
  'Two rounds, live. Everyone paid 58.67, including Jonas who bid 64.20. Round two: the value moved, the owner requoted, Jonas sold part of his stake at the same price the new buyers paid.',
  'One price, no head start. Price check, no self trades, size limits, a 10 percent band, proportional fills, an audit log.',
  'Every suggestion shows the gap. Kelly sizes the stake. The slider is your risk.',
  'From 20 shares to the whole company: an LOI at the last price and a Pittsburgh checklist with the official forms.',
  'Rules catch it, two models judge it separately, and Grok tries to beat it as red team.',
  'Every company is appraised twice: Grok researches and names a value, K2 names one blind, both go into the price.',
  'Next.js, FastAPI, Atlas, Places, Querit, Grok, K2, iMessage. 176 tests.',
  'Nobody could invest in the laundromat on Murray Avenue until tonight. Buy 20 shares and watch the next round clear.',
];
const TOTAL = 19;
const pptx = new pptxgen();
pptx.defineLayout({ name: 'W', width: 13.333, height: 7.5 });
pptx.layout = 'W';
pptx.title = 'Bartr';
for (let i = 1; i <= TOTAL; i++) {
  const s = pptx.addSlide();
  s.background = { color: i <= 8 ? 'FFFFFF' : '000000' };
  s.addImage({ path: path.join(__dirname, '.stills', `s${i}.png`), x: 0, y: 0, w: 13.333, h: 7.5 });
  s.addNotes(NOTES[i - 1]);
}
pptx.writeFile({ fileName: path.join(__dirname, 'Bartr.pptx') }).then(f => console.log('wrote', f));
