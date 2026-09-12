import { redirect } from "next/navigation";

/**
 * The agent lives on the account overview now, next to the figures it moves,
 * rather than on a page of its own where the ledger had to be duplicated to
 * show the effect of a trade. Kept as a redirect so existing links still land.
 */
export default function AgentPage() {
  redirect("/overview#agent");
}
