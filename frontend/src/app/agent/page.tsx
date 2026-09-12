import { cookies } from "next/headers";

import { Chat } from "@/components/agent/chat";
import { ChannelStatusBar } from "@/components/agent/channel-status";
import { LivePositions } from "@/components/agent/live-positions";
import { AUTH_COOKIE, readSessionToken } from "@/lib/auth/session";
import { accountId } from "@/lib/auth/account";

export const dynamic = "force-dynamic";

/**
 * Every child sends the same identity, so the chat, the account table and a
 * text to the line all read and write one account. Without this the web chat
 * ran as a throwaway `guest-` id while the rest of the app used the session.
 */
export default async function AgentPage() {
  const jar = await cookies();
  const session = readSessionToken(jar.get(AUTH_COOKIE)?.value);
  const uid = accountId(session);

  return (
    <div className="mx-auto max-w-7xl 3xl:max-w-8xl px-4 sm:px-6 xl:border-l xl:border-r xl:border-line">
      <div className="pt-10 pb-6">
        <h1 className="text-[30px] md:text-[40px] leading-[1.1]">Agent</h1>
      </div>
      <ChannelStatusBar userId={uid} pairedPhone={session?.phone ?? null} />
      <LivePositions className="mb-6" userId={uid} />
      <Chat userId={uid} />
    </div>
  );
}
