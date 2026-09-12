import Link from "next/link";
import { SearchBar } from "@/components/search/search-bar";
import { CityShortcuts } from "@/components/search/city-shortcuts";
import { LandingHeroArt } from "@/components/search/landing-hero-art";
import { LandingLogos } from "@/components/search/landing-logos";
import { LandingMirror } from "@/components/search/landing-mirror";
import type { Company } from "@contracts/types";
import exampleCompany from "@contracts/examples/company.json";
import { LandingValuationJourney } from "@/components/search/landing-valuation-journey";
import { LandingClose } from "@/components/search/landing-close";
import { Label } from "@/components/ui/label";
import { getCompany } from "@/lib/api";

/**
 * Three, because a fourth wraps the hero column onto a second line. Each one
 * has to return something: the mock stream parses "in <place>" and both the
 * fixtures and the API seeds have to hold a match.
 */
const examples = ["laundromat in Pittsburgh", "car wash in Waco", "machine shop in McKees Rocks"];

export default async function Home() {
  const fetched = await getCompany("co_squirrel_hill_wash").catch(() => null);
  const hero = fetched?.valuation ? fetched : (exampleCompany as Company);

  return (
    <>
      <section className="relative overflow-hidden bg-background">
        <LandingHeroArt />
        <div className="relative mx-auto max-w-7xl 3xl:max-w-8xl px-4 sm:px-6 xl:border-l xl:border-r xl:border-line">
          <div className="grid gap-12 pt-20 pb-10 md:pt-28 md:pb-14 xl:grid-cols-[minmax(0,1fr)_minmax(280px,0.92fr)] xl:gap-10">
            <div className="relative z-10 max-w-2xl">
              <Label className="mb-4 block">Discovery engine and exchange</Label>
              <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.12em] text-accent">33 million businesses. None of them has a price.</p>
              <h1 className="text-[33px] lg:text-[40px] 3xl:text-[48px] leading-[1.1] tracking-[-0.01em]">
                Small businesses shouldn’t die waiting for a buyer. We built a market for them.
              </h1>
              <p className="mt-subhead text-[18px] leading-[1.3] secondary max-w-xl">
                Search the laundromats, car washes, and family manufacturers that will never be listed. Price them like a stock, buy a
                fraction, or acquire the whole thing.
              </p>
              <SearchBar className="mt-8" autoFocus chips={examples} />
              <CityShortcuts />
            </div>
            <div className="relative hidden min-h-[340px] xl:block" aria-hidden />
          </div>
          <div className="relative z-10 border-t border-line">
            <LandingLogos />
          </div>
        </div>
      </section>

      <section className="border-t border-line">
        {hero?.valuation ? <LandingValuationJourney company={hero} /> : null}
      </section>

      <section className="border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-wrap items-end justify-between gap-6 px-4 py-10 sm:px-6 xl:border-x xl:border-line 3xl:max-w-8xl">
          <div>
            <Label className="mb-2 block">Exchange</Label>
            <h2 className="text-[28px] leading-[1.15] md:text-[34px]">Bid after the number exists.</h2>
          </div>
          <Link
            href="/company/co_squirrel_hill_wash/bid"
            className="border border-primary bg-primary px-5 py-3 font-mono text-[12px] uppercase tracking-[0.08em] text-primary-foreground"
          >
            Open the book
          </Link>
        </div>
      </section>

      <section className="border-t border-line">
        <div className="mx-auto max-w-7xl 3xl:max-w-8xl px-4 sm:px-6 pt-14 md:pt-20 xl:border-l xl:border-r xl:border-line">
          <div className="max-w-2xl">
            <Label className="mb-2 block">Coverage</Label>
            <h2 className="text-[30px] md:text-[36px] 3xl:text-[44px] leading-[1.2]">The businesses you were never going to see.</h2>
          </div>
          <div className="mt-10">
            <LandingMirror />
          </div>
        </div>
      </section>

      <section className="border-t border-line">
        <div className="mx-auto max-w-7xl 3xl:max-w-8xl px-4 sm:px-6 py-20 md:py-28 xl:border-l xl:border-r xl:border-line">
          <div className="max-w-3xl">
            <Label className="mb-3 block">Start</Label>
            <h2 className="text-[40px] leading-[1.05] tracking-[-0.02em] md:text-[52px] 3xl:text-[64px]">Find one. Price it. Trade it.</h2>
            <div className="mt-8">
              <LandingClose />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
