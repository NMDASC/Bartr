import { cookies } from "next/headers";

import { DiscoveryMap } from "@/components/search/discovery-map";
import { DiscoveryResults } from "@/components/search/discovery-results";
import { SearchBar } from "@/components/search/search-bar";
import { Label } from "@/components/ui/label";
import { AUTH_COOKIE, readSessionToken } from "@/lib/auth/session";

const DEMO_EMAIL = "hackcmu@gmail.com";
const DEMO_QUERY = "laundromat in Pittsburgh";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const cookieStore = await cookies();
  const session = readSessionToken(cookieStore.get(AUTH_COOKIE)?.value);
  const hasSavedSearch = session?.email.toLowerCase() === DEMO_EMAIL && !q.trim();
  const activeQuery = q.trim() || (hasSavedSearch ? DEMO_QUERY : "");

  return (
    <div className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 xl:border-x xl:border-line 3xl:max-w-8xl">
      <header className="border-b border-line pb-6 pt-10">
        <Label className="mb-2 block">Company search</Label>
        <h1 className="text-[30px] leading-[1.1] md:text-[38px]">Discover</h1>
      </header>

      <div className="py-8 md:py-10">
        <SearchBar
          key={q}
          initial={q}
          autoFocus={!q}
          prominent
          className="mx-auto max-w-3xl"
        />
      </div>

      {!q.trim() ? <DiscoveryMap /> : null}

      {hasSavedSearch ? (
        <div className="border-t border-line pt-10">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <Label className="mb-2 block">Saved for your account</Label>
              <h2 className="text-[28px] md:text-[36px]">{DEMO_QUERY}</h2>
            </div>
            <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
              2 cached
            </span>
          </div>
        </div>
      ) : null}

      <DiscoveryResults
        key={`${activeQuery}-${session?.email ?? "guest"}`}
        q={activeQuery}
        userId={session?.email}
        cached={hasSavedSearch}
      />
    </div>
  );
}
