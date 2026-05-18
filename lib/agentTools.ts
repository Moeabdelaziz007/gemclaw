import { FunctionDeclaration, Type } from "@google/genai";

export const agentTools: FunctionDeclaration[] = [
  {
    name: "workspace_email_manager",
    description: "Manages Gmail operations. Maps to gws gmail +send, +reply, +triage.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        action: {
          type: Type.STRING,
          enum: ["send", "reply", "triage"],
          description: "Action: 'send' (gws gmail +send), 'reply' (gws gmail +reply), 'triage' (gws gmail +triage)."
        },
        params: {
          type: Type.OBJECT,
          properties: {
            to: { type: Type.STRING },
            subject: { type: Type.STRING },
            body: { type: Type.STRING },
            messageId: { type: Type.STRING }
          }
        }
      },
      required: ["action"]
    }
  },
  {
    name: "workspace_calendar_manager",
    description: "Manages Calendar operations. Maps to gws calendar +agenda, +insert.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        action: {
          type: Type.STRING,
          enum: ["agenda", "insert"],
          description: "Action: 'agenda' (gws calendar +agenda), 'insert' (gws calendar +insert)."
        },
        params: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING, description: "Event title." },
            start: { type: Type.STRING, description: "Start time (ISO)." },
            end: { type: Type.STRING, description: "End time (ISO)." }
          }
        }
      },
      required: ["action"]
    }
  },
  {
    name: "workspace_tasks_manager",
    description: "Manages Tasks operations. Maps to gws tasks.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        action: {
          type: Type.STRING,
          enum: ["add", "list", "complete"],
          description: "Action: 'add', 'list', 'complete'."
        },
        params: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            taskId: { type: Type.STRING }
          }
        }
      },
      required: ["action"]
    }
  },
  {
    name: "store_memory",
    description: "Stores information in IQRA's quantum memory system (layers 0-6). Routed to IQRA MemoryClient (L2).",
    parameters: {
      type: Type.OBJECT,
      properties: {
        content: { type: Type.STRING, description: "Information to store." },
        importance: { type: Type.NUMBER, description: "Importance score (1-10)." }
      },
      required: ["content"]
    }
  },
  {
    name: "search_memory",
    description: "Searches IQRA's quantum memory across all 7 layers (Hot/Warm/Cold/Vector/Topological/Graph/Quantum). Routed to IQRA MemoryClient (L2).",
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: { type: Type.STRING, description: "Search query." }
      },
      required: ["query"]
    }
  },
  {
    name: "search_web",
    description: "Searches the web for real-time information to combat outdated knowledge. Use when you need current data, documentation, or solutions that may be newer than your training cutoff. Searches StackOverflow, GitHub, and general web.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: { type: Type.STRING, description: "Search query — be specific and technical." },
        platform: {
          type: Type.STRING,
          enum: ["general", "stackoverflow", "github"],
          description: "Platform to focus search on. Default: 'general'."
        },
        maxResults: { type: Type.NUMBER, description: "Max results to return (1-5). Default: 3." }
      },
      required: ["query"]
    }
  },
  {
    name: "search_knowledge_base",
    description: "Searches IQRA's knowledge base across semantic and topological layers. Routed to IQRA MemoryClient (L2).",
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: { type: Type.STRING, description: "Semantic search query." },
        category: {
          type: Type.STRING,
          enum: ["all", "preferences", "notes", "conversations", "decisions"],
          description: "Category filter. Default: 'all'."
        }
      },
      required: ["query"]
    }
  }
];
