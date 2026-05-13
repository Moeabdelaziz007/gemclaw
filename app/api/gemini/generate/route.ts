export const dynamic = "force-dynamic";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

/**
 * Sovereign Gemini Proxy Route
 * Secures the GEMINI_API_KEY by keeping it server-side.
 */

export async function POST(req: Request) {
  try {
    const { prompt, context, model: modelName = "gemini-2.0-flash-exp" } = await req.json();

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Neural bridge config missing: GEMINI_API_KEY is not set." },
        { status: 500 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: modelName });
    const fullPrompt = context ? `Context: ${context}\n\nTask: ${prompt}` : prompt;

    const result = await model.generateContent(fullPrompt);
    const response = await result.response;
    const text = response.text();

    return NextResponse.json({ text });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Failed to bridge generative request.";
    console.error("[Sovereign_Proxy_Failure]:", error);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
