export const dynamic = "force-dynamic";
import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';

const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(apiKey);

export async function POST(req: Request) {
  try {
    const { prompt, currentTranscript } = await req.json();

    if (!apiKey) {
      return NextResponse.json({ error: 'Gemini API Key missing' }, { status: 500 });
    }

    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.0-flash-lite',
      generationConfig: {
        responseMimeType: 'application/json',
      }
    });

    const systemInstruction = `
      You are the Aether Forge Synthesis Engine. Your task is to transform a user's idea or a conversation transcript into a "Sovereign Blueprint" for an AI Agent.
      
      The blueprint must be a JSON object conforming to this structure:
      {
        "name": "Distinctive Name",
        "role": "Specific Role (e.g. Neural Architect, Shadow Sentinel)",
        "aetherId": "A unique lowercase slug (e.g. 'shadow-sentinel-v1')",
        "systemPrompt": "A detailed system instruction for the agent (1-2 paragraphs)",
        "persona": "Analytical | Creative | Sarcastic | Empathetic",
        "rules": ["Rule 1", "Rule 2", "Rule 3"],
        "voiceName": "One of: 'Aoide', 'Charis', 'Astraeus', 'Nyx'",
        "tools": {
          "googleSearch": boolean,
          "googleMaps": boolean,
          "weather": boolean,
          "news": boolean,
          "crypto": boolean,
          "calculator": boolean,
          "semanticMemory": boolean
        },
        "skills": {
          "gmail": boolean,
          "calendar": boolean,
          "drive": boolean
        }
      }

      Context provided:
      User Idea: "${prompt || 'Not provided'}"
      Full Conversation Transcript: "${currentTranscript || 'None'}"

      Design Principles:
      1. Premium & Technical: Names and roles should sound specialized and high-tech.
      2. Data Integrity: Ensure the "name" field is populated (do NOT use "suggestedName").
      3. Zero-Friction: Only enable tools and skills that are essential for the described role.
    `;

    const result = await model.generateContent(systemInstruction);
    const response = await result.response;
    const text = response.text();
    
    // Parse the JSON blueprint safely
    const cleanText = text.replace(/```json/gi, '').replace(/```/gi, '').trim();
    const blueprint = JSON.parse(cleanText) as Record<string, unknown>;

    // Return the blueprint directly to match client expectations
    return NextResponse.json(blueprint);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error during synthesis';
    console.error('Synthesis Error:', error);
    return NextResponse.json({ error: 'Synthesis failed', details: errorMessage }, { status: 500 });
  }
}
