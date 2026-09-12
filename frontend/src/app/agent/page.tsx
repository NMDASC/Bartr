import { Label } from "@/components/ui/label";
import { Chat } from "@/components/agent/chat";

export default function AgentPage() {
  return (
    <div className="mx-auto max-w-7xl 3xl:max-w-8xl px-4 sm:px-6 xl:border-l xl:border-r xl:border-line">
      <div className="pt-10 pb-6">
        <Label className="mb-3 block">Agent</Label>
        <h1 className="text-[30px] md:text-[40px] leading-[1.1]">Search, price, and trade in plain text.</h1>
        <p className="mt-subhead text-[16px] secondary max-w-2xl">Same endpoint the iMessage line uses. Short lines, no markdown, one action per turn.</p>
      </div>
      <Chat />
    </div>
  );
}
