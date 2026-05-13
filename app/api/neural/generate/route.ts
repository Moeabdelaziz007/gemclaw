export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { NeuralRouter } from "@/lib/neural/router";
import { NeuralProvider } from "@/lib/neural/types";

import { retrieveMemories } from "@/lib/memory/indexer";

const router = new NeuralRouter();

export async function POST(req: Request) {
  try {
    const { provider, messages, options, userId, agentId, useRAG } = await req.json();

    if (!provider || !messages) {
      return NextResponse.json(
        { error: "Missing required fields: provider or messages." },
        { status: 400 }
      );
    }

    let augmentedMessages = [...messages];

    // Cognitive Fabric Integration: RAG
    if (useRAG && userId && agentId) {
      const lastUserMessage = messages.filter((m: { role: string; content: string }) => m.role === "user").pop();
      if (lastUserMessage) {
        const { contextString } = await retrieveMemories(lastUserMessage.content, userId, agentId);
        
        if (contextString) {
          // Inject context into the last system prompt or as a new system message
          const contextPrompt = `\n\n[COGNITIVE FABRIC - LONG TERM MEMORY]:\n${contextString}\n[END MEMORY]`;
          
          const systemMsgIdx = augmentedMessages.findIndex((m: { role: string }) => m.role === "system");
          if (systemMsgIdx !== -1) {
            augmentedMessages[systemMsgIdx].content += contextPrompt;
          } else {
            augmentedMessages.unshift({ role: "system", content: "You are a Sovereign Intelligence. Use the following past memory context if relevant:" + contextPrompt });
          }
        }
      }
    }

    const response = await router.generate(provider as NeuralProvider, augmentedMessages, options);

    return NextResponse.json(response);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to generate neural response.";
    console.error("[Neural_Router_Failure]:", error);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
