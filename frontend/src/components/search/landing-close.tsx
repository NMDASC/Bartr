"use client";

import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";

/**
 * The page's only closing action. Signed out it opens signup, which is what the
 * header's primary button does, so the two never disagree. Signed in there is
 * nothing to sign up for, so it goes to the account.
 */
export function LandingClose() {
  const { session, openAuth } = useAuth();
  return (
    <div className="flex flex-wrap items-center gap-3">
      {session ? (
        <Button variant="primary" size="lg" href="/overview">
          Go to your account
        </Button>
      ) : (
        <Button variant="primary" size="lg" onClick={() => openAuth("signup", "/overview")}>
          Start trading
        </Button>
      )}
      <Button variant="secondary" size="lg" href="/search?q=laundromat%20in%20Pittsburgh">
        Browse markets
      </Button>
    </div>
  );
}
