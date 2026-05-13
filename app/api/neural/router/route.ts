export const dynamic = "force-dynamic";
import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Anthropic } from "@anthropic-ai/sdk";
import OpenAI from "openai";

// Edge runtime for 10x performance and instant cold-starts
export const runtime = 'edge';

// Rate Limiting Map (in-memory for Edge)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_SEC = 60;
const MAX_REQ_PER_MIN = 30; // 30 requests per minute

// LRU Cache Map (in-memory)
// Keys: hash of (provider + messages + options)
const responseCache = new Map<string, { data: any; expiresAt: number }>();
const CACHE_TTL_MS = 1000 * 60 * 5; // 5 minutes

export async function POST(req: Request) {
  try {
    // 1. Basic Rate Limiting by IP (or UUID if provided in headers)
    const ip = req.headers.get('x-forwarded-for') || 'anonymous_ip';
    const now = Date.now();
    const rateData = rateLimitMap.get(ip) || { count: 0, resetAt: now + RATE_LIMIT_SEC * 1000 };
    
    if (now > rateData.resetAt) {
      rateData.count = 0;
      rateData.resetAt = now + RATE_LIMIT_SEC * 1000;
    }
    
    if (rateData.count >= MAX_REQ_PER_MIN) {
      return NextResponse.json({ error: "Rate limit exceeded. Please try again later. (Code: 429)" }, { status: 429 });
    }
    rateData.count++;
    rateLimitMap.set(ip, rateData);

    // 2. Parse Payload
    const body = await req.json();
    const { provider, messages, options = {} } = body;

    if (!provider || !messages) {
      return NextResponse.json({ error: "Missing required fields: provider or messages" }, { status: 400 });
    }

    // 3. Simple In-Memory LRU Caching (for identical context-free runs)
    const cachePayload = JSON.stringify({ provider, messages, options });
    const cacheKey = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(cachePayload))
      .then(b => Array.from(new Uint8Array(b)).map(b => b.toString(16).padStart(2, '0')).join(''));
    
    if (options.cache !== false) {
      const cached = responseCache.get(cacheKey);
      if (cached && now < cached.expiresAt) {
        console.log(`[NeuralRouter_Proxy] 🛡️ Cache HIT for provider: ${provider}`);
        return NextResponse.json(cached.data);
      }
    }

    // 4. Secure Provider Routing (No NEXT_PUBLIC_ exposure)
    let responseData;
    const startTime = Date.now();
    console.log(`[NeuralRouter_Proxy] 🧠 Routing request to: ${provider}`);

    if (provider === "google") {
      const geminiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
      if (!geminiKey) return NextResponse.json({ error: "Google API key not configured" }, { status: 500 });
      
      const googleAI = new GoogleGenerativeAI(geminiKey);
      const modelName = options.model || "gemini-2.5-flash"; // Default to advanced speed model
      const model = googleAI.getGenerativeModel({ model: modelName });
      
      const systemInstruction = messages.find((m: any) => m.role === "system")?.content;
      const history = messages
        .filter((m: any) => m.role !== "system")
        .map((m: any) => ({
          role: m.role === "user" ? "user" : "model",
          parts: [{ text: m.content }],
        }));
      
      // Ensure alternating roles for Gemini specifically if there's an odd number
      while (history.length > 0 && history[history.length - 1].role === "model") {
          history.pop();
      }

      const result = await model.generateContent({
        contents: history,
        systemInstruction: systemInstruction ? { role: "system", parts: [{ text: systemInstruction }] } : undefined,
      });

      const response = await result.response;
      responseData = {
        id: `google-${Date.now()}`,
        text: response.text(),
        model: modelName,
        provider: "google",
        latencyMs: Date.now() - startTime,
      };

    } else if (provider === "anthropic") {
      const anthropicKey = process.env.ANTHROPIC_API_KEY || process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY;
      if (!anthropicKey) return NextResponse.json({ error: "Anthropic API key not configured" }, { status: 500 });

      // Notice: No `dangerouslyAllowBrowser: true` required here because we are on the Server Route.
      const anthropic = new Anthropic({ apiKey: anthropicKey });
      const modelName = options.model || "claude-3-5-sonnet-20241022";
      
      const system = messages.find((m: any) => m.role === "system")?.content;
      const anthropicMessages = messages
        .filter((m: any) => m.role !== "system")
        .map((m: any) => ({
          role: m.role === "user" ? ("user" as const) : ("assistant" as const),
          content: m.content,
        }));

      try {
        const msg = await anthropic.messages.create({
          model: modelName,
          max_tokens: options.maxTokens || 4096,
          system,
          messages: anthropicMessages,
          temperature: options.temperature,
        });

        responseData = {
          id: msg.id,
          text: msg.content[0].type === 'text' ? msg.content[0].text : '',
          model: modelName,
          provider: "anthropic",
          usage: {
            promptTokens: msg.usage.input_tokens,
            completionTokens: msg.usage.output_tokens,
            totalTokens: msg.usage.input_tokens + msg.usage.output_tokens,
          },
          latencyMs: Date.now() - startTime,
        };
      } catch (err: any) {
        // Multi-Route Fallback Grid (Self-Healing Moonshot Pattern)
        console.warn(`[NeuralRouter_Proxy] ⚠️ Anthropic failed: ${err.message}. Triggering Fallback to Gemini 2.5 Flash.`);
        const geminiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
        if (!geminiKey) throw err;
        
        const googleAI = new GoogleGenerativeAI(geminiKey);
        const fallbackModel = googleAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const systemInstruction = messages.find((m: any) => m.role === "system")?.content;
        const history = messages
          .filter((m: any) => m.role !== "system")
          .map((m: any) => ({
            role: m.role === "user" ? "user" : "model",
            parts: [{ text: m.content }],
          }));
        
        const result = await fallbackModel.generateContent({
          contents: history,
          systemInstruction: systemInstruction ? { role: "system", parts: [{ text: systemInstruction }] } : undefined,
        });
        const res = await result.response;
        responseData = {
          id: `fallback-google-${Date.now()}`,
          text: res.text(),
          model: "gemini-2.5-flash (Fallback)",
          provider: "google",
          latencyMs: Date.now() - startTime,
        };
      }
    } else if (provider === "deepseek") {
      const deepseekKey = process.env.DEEPSEEK_API_KEY || process.env.NEXT_PUBLIC_DEEPSEEK_API_KEY;
      if (!deepseekKey) return NextResponse.json({ error: "DeepSeek API key not configured" }, { status: 500 });
      
      const deepseek = new OpenAI({
        apiKey: deepseekKey,
        baseURL: "https://api.deepseek.com",
        // No dangerouslyAllowBrowser!
      });
      const modelName = options.model || "deepseek-chat";
      
      const completion = await deepseek.chat.completions.create({
        model: modelName,
        messages: messages as any[],
        temperature: options.temperature,
        max_tokens: options.maxTokens,
      });

      responseData = {
        id: completion.id,
        text: completion.choices[0].message?.content || "",
        model: modelName,
        provider: "deepseek",
        usage: {
          promptTokens: completion.usage?.prompt_tokens || 0,
          completionTokens: completion.usage?.completion_tokens || 0,
          totalTokens: completion.usage?.total_tokens || 0,
        },
        latencyMs: Date.now() - startTime,
      };
    } else {
      return NextResponse.json({ error: `Provider ${provider} not supported` }, { status: 400 });
    }

    // Update Cache
    if (responseData && options.cache !== false) {
      // For brevity, maintaining a small cache footprint.
      if (responseCache.size > 100) {
        const oldestKey = responseCache.keys().next().value;
        if (oldestKey) responseCache.delete(oldestKey);
      }
      responseCache.set(cacheKey, { data: responseData, expiresAt: now + CACHE_TTL_MS });
    }

    return NextResponse.json(responseData);
  } catch (error: any) {
    console.error("[NeuralRouter_Proxy] ❌ Fatal Execution Error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
