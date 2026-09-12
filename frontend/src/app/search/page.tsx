import { SearchBar } from "@/components/search/search-bar";
import { Results } from "@/components/search/results";
import { Label } from "@/components/ui/label";
import { CityShortcuts } from "@/components/search/city-shortcuts";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  return (
    <div className="mx-auto max-w-7xl 3xl:max-w-8xl px-4 sm:px-6 xl:border-l xl:border-r xl:border-line">
      <div className="pt-10 pb-6">
        <Label className="mb-2 block">Discover</Label>
        {/* the page had no h1 at all: the query is its subject, so the query titles it */}
        <h1 className="mb-5 text-[30px] leading-[1.15] tracking-[-0.01em] md:text-[36px] 3xl:text-[44px]">
          {q ? q : "Find a business"}
        </h1>
        <SearchBar key={q} initial={q} className="max-w-2xl" />
        <CityShortcuts />
      </div>
      <Results key={q} q={q} />
    </div>
  );
}
