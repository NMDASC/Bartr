import Link from "next/link";
import { SearchBar } from "@/components/search/search-bar";
import { CityShortcuts } from "@/components/search/city-shortcuts";
import { LandingTape } from "@/components/search/landing-tape";
import { LandingMirror } from "@/components/search/landing-mirror";
import { LandingTrending } from "@/components/search/landing-trending";
import { LandingClearing } from "@/components/search/landing-clearing";
import { Label } from "@/components/ui/label";
import { listCompanies } from "@/lib/api";

const examples = ["laundromat in Pittsburgh", "car wash on McKnight Road", "machine shop in McKees Rocks", "restaurant on the South Side"];

export default async function Home() {
  const trending = (await listCompanies().catch(() => [])).filter((c) => c.status === "ready").slice(0, 6);

  return (
    <>
      <section className="bg-background">
        <div className="mx-auto max-w-7xl 3xl:max-w-8xl px-4 sm:px-6 xl:border-l xl:border-r xl:border-line">
          <div className="grid gap-12 pt-20 pb-16 md:pt-28 md:pb-24 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-16 3xl:grid-cols-[minmax(0,1fr)_440px]">
            <div className="max-w-2xl">
              <Label className="mb-4 block">Discovery engine and exchange</Label>
              <h1 className="text-[33px] lg:text-[40px] 3xl:text-[48px] leading-[1.1] tracking-[-0.01em]">
                Small businesses have no price. We built one.
              </h1>
              <p className="mt-subhead text-[18px] leading-[1.3] secondary max-w-xl">
                Search the laundromats, car washes, and family manufacturers that will never be listed. Price them like a stock, buy a
                fraction, or acquire the whole thing.
              </p>
              <SearchBar className="mt-8" autoFocus chips={examples} />
              <CityShortcuts />
            </div>

            <div className="hidden lg:block lg:pt-10">
              <LandingTape />
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-line">
        <div className="mx-auto max-w-7xl 3xl:max-w-8xl px-4 sm:px-6 py-14 md:py-20 xl:border-l xl:border-r xl:border-line">
          <div className="max-w-2xl">
            <Label className="mb-2 block">Coverage</Label>
            <h2 className="text-[30px] md:text-[32px] leading-[1.2]">The ones you were never going to see.</h2>
          </div>
          <div className="mt-10">
            <LandingMirror />
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
            <Link
              href="/search?q=laundromat%20in%20Pittsburgh"
              className="hidden sm:inline font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground transition-colors duration-150 ease-out hover:text-accent"
            >
              All markets
            </Link>
          </div>

          <LandingTrending companies={trending} />
        </div>
      </section>

      <section className="border-t border-line">
        <LandingClearing />
      </section>
    </>
  );
}
