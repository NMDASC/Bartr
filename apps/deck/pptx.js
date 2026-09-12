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
  'Our proprietary search helps you discover underground, undervalued companies. Grok reads the brief. Google Places lists every business in the city. Querit finds twelve pages about them and reads the best six. Grok turns pages into profiles where every figure keeps its sentence and its URL. Ranked by evidence, valued five ways, on the page as it happens.',
  'Squirrel Hill Wash and Fold: 570,768 dollars, range 475 to 686 thousand.',
  'Five ways to value it, each with its own typical miss. Weighted by one over the miss squared. Each method is a bit off and they disagree; we add both. A range, never a bare number.',
  'The owner is the seller. Five lots above our value, a buyback below. Every round, one price for everyone, and the owner requotes from the updated value.',
  'Two rounds. Everyone paid 58.67, including Jonas who bid 64.20. Round two: the value moved, the owner requoted, Jonas sold part of his stake at the same price the new buyers paid.',
  'One price, no head start. Price check, no self trades, size limits, a 10 percent band, proportional fills, an audit log.',
  'Every suggestion shows the gap. Kelly sizes the stake. The slider is your risk: move it and the gain and the possible loss move with it.',
  'We derived the fraction on the board. Maximize log wealth, then take half because the edge is estimated. The paper is in the Q and A appendix.',
  'From 20 shares to the whole company: an LOI at the last price and a Pittsburgh checklist with the official forms.',
  'Rules catch it, two models judge it separately, and Grok tries to beat it as red team.',
  'Every company is appraised twice: Grok researches and names a value, K2 names one blind, both go into the price.',
  'Next.js, FastAPI, Atlas, Places, Querit, Grok, K2, iMessage. 103 tests.',
  'The laundromat on Murray Avenue has a price. Buy 20 shares, watch the next round.',
  'Internal Q&A appendix. Stop the public presentation on the close slide. Press Q from anywhere to jump here.',
  'Market: distinguish the 36.2 million business context from the initial reachable market. Lead with aging owners and demonstrated buyer demand.',
  'Users and consent: the first wedge is acquisition search. Unclaimed pages need clear attribution, correction, opt-out and no trading before owner acceptance.',
  'Competition: Google finds locations, BizBuySell begins after a sale decision, and crowdfunding focuses on issuance. The code alone is not the moat.',
  'Valuation: call the pre-owner number an estimate with a range. The calibration path exists, but production accuracy has not yet been proven.',
  'Kelly paper: scroll the derivation. f star is (pb minus q) over b. We use half Kelly, cap 20 percent.',
  'Market design: production cannot promise liquidity. The owner bid is finite, and thin markets remain vulnerable even with rules and halts.',
  'Regulation: the interests are securities. Production issuance and secondary execution require licensed partners and an offering exemption.',
  'Investor rights: the demo models economic units. Production documents must define voting, distributions, dilution, information rights and transfers.',
  'Business model: paid acquisition intelligence is the first hypothesis. Validate owner conversion and transaction economics before claiming a large revenue market.',
  'Technical truth: name the real API and engine, then name seeded data, bots, cached research, demo balances and demo identity without hesitation.',
  'Security: rules create flags and models review them. The current audit log is application append-only, not cryptographically immutable.',
  'Hard questions: owner trust is the core assumption. State the tests that could validate or disprove the exchange thesis.',
];
const TOTAL = 32;
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
