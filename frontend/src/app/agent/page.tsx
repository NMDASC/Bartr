import { Chat } from "@/components/agent/chat";
import { ChannelStatusBar } from "@/components/agent/channel-status";

export default function AgentPage() {
  return (
    <div className="mx-auto max-w-7xl 3xl:max-w-8xl px-4 sm:px-6 xl:border-l xl:border-r xl:border-line">
      <div className="pt-10 pb-6">
        <h1 className="text-[30px] md:text-[40px] leading-[1.1]">Agent</h1>
      </div>
      <ChannelStatusBar className="mb-6" />
      <Chat />
    </div>
  );
}
