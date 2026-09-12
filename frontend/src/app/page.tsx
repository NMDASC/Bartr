import { SearchBar } from "@/components/search/search-bar";
import { CityShortcuts } from "@/components/search/city-shortcuts";
import { LandingTape } from "@/components/search/landing-tape";
import { LandingMirror } from "@/components/search/landing-mirror";
import type { Company } from "@contracts/types";
import exampleCompany from "@contracts/examples/company.json";
import { LandingValuationJourney } from "@/components/search/landing-valuation-journey";
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
      <section className="bg-background">
        <div className="mx-auto max-w-7xl 3xl:max-w-8xl px-4 sm:px-6 xl:border-l xl:border-r xl:border-line">
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
        {hero?.valuation ? <LandingValuationJourney company={hero} /> : null}
      </section>
    </>
  );
}
