// JB over iMessage. Text the line, get the same agent the web app uses.
//
// Photon Spectrum (managed iMessage line) in, POST /api/v1/agent/chat in the middle,
// plain-text replies out. session_id is the sender's phone number, so a person's
// conversation carries across web and iMessage if they log in with the same number.
//
// Adapted from Fifth (~/github/fifth). Same shell, different brain.

import { Spectrum } from "spectrum-ts";
import { imessage } from "spectrum-ts/providers/imessage";
import { terminal } from "spectrum-ts/providers/terminal";
import type { Message, Space } from "spectrum-ts";
import { jbClient } from "./jb.ts";

const env = process.env;
const log = (m: string) => console.log(`[jb] ${m}`);

function required(name: string): string {
  const v = env[name];
  if (!v) {
    console.error(`[jb] missing required env ${name}`);
    process.exit(1);
  }
  return v;
}

const terminalUi = env.TERMINAL_UI === "1";
if (!terminalUi) {
  required("SPECTRUM_PROJECT_ID");
  required("SPECTRUM_PROJECT_SECRET");
}

const jb = jbClient({ apiUrl: env.JB_API_URL, log });

const HELP = [
  "I'm JB. I find small businesses and price them.",
  "",
  "Try:",
  "  laundromat in oklahoma under 1.2m",
  "  book for suds city",
  "  buy 50 shares of suds city at 104",
  "  what should i hold with 10k",
  "",
  "/reset  start over",
  "/help   this",
  "",
  "Play money. Not investment advice.",
].join("\n");

const providers: any[] = [];
if (!terminalUi || env.SPECTRUM_PROJECT_ID) providers.push(imessage.config());
if (terminalUi) providers.push(terminal.config());

const app = await Spectrum({
  projectId: env.SPECTRUM_PROJECT_ID,
  projectSecret: env.SPECTRUM_PROJECT_SECRET,
  providers,
} as any);

log(`up. mode=${jb.mode} terminal=${terminalUi} api=${env.JB_API_URL ?? "(mock)"}`);

/** Text of a message, unwrapping threaded replies. Null for non-text content. */
function textOf(content: Message["content"]): string | null {
  if (content.type === "text") return content.text ?? "";
  if (content.type === "reply") {
    const inner = (content as { content?: { type: string; text?: string } }).content;
    return inner?.type === "text" ? inner.text ?? "" : null;
  }
  return null;
}

function isGroup(space: Space, platform: string): boolean {
  if (platform !== "imessage") return false;
  return imessage.is(space) && space.type === "group";
}

// One in-flight request per sender so replies never interleave.
const queues = new Map<string, Promise<void>>();
function enqueue(key: string, fn: () => Promise<void>) {
  const prev = queues.get(key) ?? Promise.resolve();
  const next = prev.then(fn, fn);
  queues.set(key, next);
  return next;
}

async function handle(space: Space, message: Message, text: string) {
  const sender = message.sender?.id ?? space.id;
  const t = text.trim();
  if (/^\/?help$/i.test(t) || t === "") {
    await space.send(HELP);
    return;
  }
  try {
    await (space as { typing?: (on: boolean) => Promise<void> }).typing?.(true);
  } catch {}
  try {
    const reply = await jb.chat(sender, t);
    const body = reply.content.trim() || "No answer. Try rephrasing.";
    await space.send(body);
    log(`${sender} -> ${reply.tool_calls?.map((c) => c.name).join(",") || "text"}`);
  } catch (err) {
    log(`agent failed for ${sender}: ${(err as Error).message}`);
    await space.send("JB is busy. Try again in a few seconds.");
  } finally {
    try {
      await (space as { typing?: (on: boolean) => Promise<void> }).typing?.(false);
    } catch {}
  }
}

const warnedGroups = new Set<string>();

for await (const [space, message] of app.messages) {
  if (message.direction === "outbound") continue;
  if (message.sender?.kind === "agent") continue;
  const text = textOf(message.content);
  if (text === null) continue;

  if (isGroup(space, message.platform)) {
    if (!warnedGroups.has(space.id)) {
      warnedGroups.add(space.id);
      await space.send("I work 1:1 for now. Text me directly.");
    }
    continue;
  }

  const key = message.sender?.id ?? space.id;
  void enqueue(key, () => handle(space, message, text));
}
