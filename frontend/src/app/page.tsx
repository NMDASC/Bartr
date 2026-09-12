import { SearchBar } from "@/components/search/search-bar";
import { CityShortcuts } from "@/components/search/city-shortcuts";
import { LandingTape } from "@/components/search/landing-tape";
import { LandingHeroField } from "@/components/search/landing-hero-field";
import { LandingMirror } from "@/components/search/landing-mirror";
import type { Company } from "@contracts/types";
import exampleCompany from "@contracts/examples/company.json";
import exampleCards from "@contracts/examples/company-cards.json";
import { LandingValuationJourney } from "@/components/search/landing-valuation-journey";
import { Label } from "@/components/ui/label";
import { LandingTrending, BatchClock } from "@/components/search/landing-trending";
import { LandingClose } from "@/components/search/landing-close";
import { getCompany, listCompanies } from "@/lib/api";
import Link from "next/link";

/**
 * Three, because a fourth wraps the hero column onto a second line. Each one
 * has to return something: the mock stream parses "in <place>" and both the
 * fixtures and the API seeds have to hold a match.
 */
const examples = ["laundromat in Pittsburgh", "car wash in Waco", "machine shop in McKees Rocks"];

/**
 * Curated, and deliberately not all one city. Five markets across four cities
 * and five categories. Every id exists in both the fixtures and the API seeds.
 */
const TRENDING = ["co_squirrel_hill_wash", "co_sudsy_tulsa", "co_lonestar_wash", "co_mon_valley_auto", "co_three_rivers_hvac"];

export default async function Home() {
  const [fetched, fetchedAll] = await Promise.all([
    getCompany("co_squirrel_hill_wash").catch(() => null),
    listCompanies().catch(() => []),
  ]);
  // the marketing row is the page's proof of life, so a cold or unreachable API
  // must not empty it. Same fallback the hero already uses for its valuation.
  const all = fetchedAll.length ? fetchedAll : (exampleCards as unknown as typeof fetchedAll);
  const picked = TRENDING.map((id) => all.find((c) => c._id === id)).filter((c) => c && c.status === "ready");
  const rows = (picked.length >= 5 ? picked : all.filter((c) => c.status === "ready")).slice(0, 5) as typeof all;
  const hero = fetched?.valuation ? fetched : (exampleCompany as Company);

  return (
    <>
      <section className="relative isolate overflow-hidden bg-background">
        <LandingHeroField />
        <div className="relative mx-auto max-w-7xl 3xl:max-w-8xl px-4 sm:px-6 xl:border-l xl:border-r xl:border-line">
          <div className="grid gap-12 pt-20 pb-16 md:pt-28 md:pb-24 xl:grid-cols-[minmax(0,1fr)_380px] xl:gap-16 3xl:grid-cols-[minmax(0,1fr)_440px]">
            <div className="max-w-2xl">
              <Label className="mb-4 block">Discovery engine and exchange</Label>
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

            <div className="hidden xl:block xl:pt-10">
              <LandingTape />
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-line">
        <div className="mx-auto max-w-7xl 3xl:max-w-8xl px-4 sm:px-6 py-14 xl:border-l xl:border-r xl:border-line">
          <div className="mb-8 flex items-end justify-between gap-4">
            <div>
              <Label className="mb-3 block">Trending</Label>
              {/* Display scale, one step above the other section headings. This is
                  the page's proof moment, so it is the one heading that carries it. */}
              <h2 className="text-[40px] md:text-[52px] 3xl:text-[64px] leading-[1.02] tracking-[-0.02em]">Markets clearing right now.</h2>
            </div>
            <div className="hidden shrink-0 flex-col items-end gap-2 sm:flex">
              <BatchClock />
              <Link
                href="/search?q=laundromat%20in%20Pittsburgh"
                className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground transition-colors duration-150 ease-out hover:text-accent"
              >
                All markets
              </Link>
            </div>
          </div>

          <LandingTrending companies={rows} />
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

      <section className="border-t border-line">{hero?.valuation ? <LandingValuationJourney company={hero} /> : null}</section>

      {/* the page used to fall straight from the last figure into the footer, so
          the one action it wants from a reader was stranded back in the hero.
          The three verbs are the three sections above it, in order. */}
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
