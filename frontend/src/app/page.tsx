import Link from "next/link";
import { SearchBar } from "@/components/search/search-bar";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { listCompanies } from "@/lib/api";
import { px, usd, pct } from "@/lib/format";

const examples = ["laundromat in Oklahoma", "car wash in Texas under 2M", "machine shop in Ohio", "restaurant in Pittsburgh"];

export default async function Home() {
  const trending = (await listCompanies()).filter((c) => c.status === "ready").slice(0, 6);
  return (
    <>
      <section className="bg-background">
        <div className="mx-auto max-w-7xl 3xl:max-w-8xl px-4 sm:px-6 xl:border-l xl:border-r xl:border-line">
          <div className="mx-auto max-w-2xl pt-20 pb-16 md:pt-28 md:pb-24">
            <Label className="mb-4 block">Discovery engine and exchange</Label>
            <h1 className="text-[33px] lg:text-[40px] 3xl:text-[48px] leading-[1.1] tracking-[-0.01em]">
              Small businesses have no price. We built one.
            </h1>
            <p className="mt-subhead text-[18px] leading-[1.3] secondary max-w-xl">
              Search the laundromats, car washes, and family manufacturers that will never be listed. Price them like a stock, buy a
              fraction, or acquire the whole thing.
            </p>
            <SearchBar className="mt-8" autoFocus />
            <div className="mt-3 flex flex-wrap gap-2">
              {examples.map((e) => (
                <Button key={e} size="sm" href={`/search?q=${encodeURIComponent(e)}`}>
                  {e}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-line">
        <div className="mx-auto max-w-7xl 3xl:max-w-8xl px-4 sm:px-6 py-14 xl:border-l xl:border-r xl:border-line">
          <div className="flex items-end justify-between gap-4 mb-6">
            <div>
              <Label className="mb-2 block">Trending</Label>
              <h2 className="text-[30px] md:text-[32px] leading-[1.2]">Markets clearing right now.</h2>
            </div>
            <Link href="/search?q=laundromat%20in%20Oklahoma" className="hidden sm:inline font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground hover:text-accent">
              All markets
            </Link>
          </div>

          <div className="hidden md:grid grid-cols-[1fr_120px_96px_96px_96px_80px] gap-4 px-3 pb-2">
            <Label>Company</Label>
            <Label className="text-right">Value</Label>
            <Label className="text-right">Bid</Label>
            <Label className="text-right">Ask</Label>
            <Label className="text-right">Last</Label>
            <Label className="text-right">Conf</Label>
          </div>
          <ul className="flex flex-col gap-px">
            {trending.map((c) => (
              <li key={c._id}>
                <Link
                  href={`/company/${c._id}`}
                  className="grid grid-cols-[1fr_auto] md:grid-cols-[1fr_120px_96px_96px_96px_80px] items-center gap-x-4 gap-y-1 bg-surface px-3 py-3 transition-colors duration-150 ease-out hover:bg-surface-hover"
                >
                  <div className="min-w-0">
                    <div className="truncate text-[16px]">{c.name}</div>
                    <div className="text-[13px] secondary">
                      {c.city}, {c.state} · {c.category}
                    </div>
                  </div>
                  <div className="font-mono text-[13px] tabular-nums text-right">{usd(c.v0_per_share! * 10000, { compact: true })}</div>
                  <div className="hidden md:block font-mono text-[13px] tabular-nums text-right text-up">{px(c.bid)}</div>
                  <div className="hidden md:block font-mono text-[13px] tabular-nums text-right text-down">{px(c.ask)}</div>
                  <div className="hidden md:block font-mono text-[13px] tabular-nums text-right">{px(c.last)}</div>
                  <div className="hidden md:block font-mono text-[13px] tabular-nums text-right text-muted-foreground">{pct(c.confidence)}</div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="border-t border-line">
        <div className="mx-auto max-w-7xl 3xl:max-w-8xl px-4 sm:px-6 py-14 xl:border-l xl:border-r xl:border-line">
          <div className="grid gap-10 md:grid-cols-3">
            <div>
              <Label className="mb-3 block">01 Discover</Label>
              <p className="text-[16px]">Real businesses from Places and the open web, read by Grok, with a source on every number.</p>
            </div>
            <div>
              <Label className="mb-3 block">02 Price</Label>
              <p className="text-[16px]">A uniform-price batch auction every ten seconds. A house market maker so there is always a counterparty.</p>
            </div>
            <div>
              <Label className="mb-3 block">03 Acquire</Label>
              <p className="text-[16px]">A letter of intent and a state-specific diligence checklist, drafted with citations, when you want the whole thing.</p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
