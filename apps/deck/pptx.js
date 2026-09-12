// Builds Bartr.pptx from the 28 slide stills in .stills/ with the talk track and Q&A prompts as speaker notes.
// Run via ./export.sh (it installs pptxgenjs into .stills/ and renders the stills first).
const pptxgen = require('pptxgenjs');
const path = require('path');
const NOTES = [
  'The laundromat on Murray Avenue is worth 570,768 dollars, give or take 22 percent. Today you can buy 20 shares of it. That is Bartr.',
  '36.2 million small businesses. Almost none has a continuously visible price. Want a laundromat in Squirrel Hill? There is no list.',
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
  'Internal Q&A appendix. Stop the public presentation on slide 16. Press Q from anywhere to jump here.',
  'Market: distinguish the 36.2 million business context from the initial reachable market. Lead with aging owners and demonstrated buyer demand.',
  'Users and consent: the first wedge is acquisition search. Unclaimed pages need clear attribution, correction, opt-out and no trading before owner acceptance.',
  'Competition: Google finds locations, BizBuySell begins after a sale decision, and crowdfunding focuses on issuance. The code alone is not the moat.',
  'Valuation: call the pre-owner number an estimate with a range. The calibration path exists, but production accuracy has not yet been proven.',
  'Market design: production cannot promise liquidity. The owner bid is finite, and thin markets remain vulnerable even with rules and halts.',
  'Regulation: the interests are securities. Production issuance and secondary execution require licensed partners and an offering exemption.',
  'Investor rights: the demo models economic units. Production documents must define voting, distributions, dilution, information rights and transfers.',
  'Business model: paid acquisition intelligence is the first hypothesis. Validate owner conversion and transaction economics before claiming a large revenue market.',
  'Technical truth: name the real API and engine, then name seeded data, bots, cached research, demo balances and demo identity without hesitation.',
  'Security: rules create flags and models review them. The current audit log is application append-only, not cryptographically immutable.',
  'Hard questions: owner trust is the core assumption. State the tests that could validate or disprove the exchange thesis.',
];
const TOTAL = 28;
const pptx = new pptxgen();
pptx.defineLayout({ name: 'W', width: 13.333, height: 7.5 });
pptx.layout = 'W';
pptx.title = 'Bartr';
for (let i = 1; i <= TOTAL; i++) {
  const s = pptx.addSlide();
  s.background = { color: i <= 6 ? 'FFFFFF' : '000000' };
  s.addImage({ path: path.join(__dirname, '.stills', `s${i}.png`), x: 0, y: 0, w: 13.333, h: 7.5 });
  s.addNotes(NOTES[i - 1]);
}
pptx.writeFile({ fileName: path.join(__dirname, 'Bartr.pptx') }).then(f => console.log('wrote', f));
