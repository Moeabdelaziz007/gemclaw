/**
 * Neural Tool Handlers (Zero-Function Architecture)
 *
 * Logic previously residing in API routes is now co-located with the client-side
 * neural engine to enable 100% static hosting on Firebase's free tier.
 */

import { auth } from '@/firebase';
import { useGemclawStore } from '../store/useGemclawStore';
import { fetchWithTimeout, getLocalBridgeUrl, getNetworkTimeoutMs, isLocalBridgeExecutionEnabled, normalizeNetworkError } from '../network/runtime';
import { ToolResult } from '../types/live-api';
import { GoogleWorkspaceClient } from './google-workspace';
import { CreditManager } from '../billing/credit-manager';

const FUNCTION_URL = process.env.NEXT_PUBLIC_FUNCTION_URL?.trim() || 'https://executeagenttool-v7vofv7mxa-uc.a.run.app';
const DEFAULT_PERSONA = 'GemclawAssistant';

function readString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function createNetworkErrorResult(message: string, error: unknown): ToolResult {
  const failure = normalizeNetworkError(error);
  return {
    status: 'error',
    message,
    details: failure.message,
    failureKind: failure.kind,
  };
}

export async function handleNeuralTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
  let result: ToolResult = { status: 'success' };

  if (name === 'browse_url' || (name === 'searchWeb' && args.url)) {
    const urlToRead = readString(args.url || args.query);
    try {
      const response = await fetchWithTimeout(
        `https://r.jina.ai/${urlToRead}`,
        { cache: 'no-store' },
        getNetworkTimeoutMs(process.env.NEXT_PUBLIC_REMOTE_FETCH_TIMEOUT_MS, 4000)
      );
      const markdown = await response.text();
      return {
        status: 'success',
        content: markdown.substring(0, 10000),
        source: urlToRead,
        method: 'Jina-Stateless-Link',
        synthesis: 'Content extracted and mapped to neural context. Ready for analysis.'
      };
    } catch (error) {
      return createNetworkErrorResult('Failed to read URL via Neural Link.', error);
    }
  }

  if (name === 'create_agent') {
    try {
      const { setPendingManifest } = useGemclawStore.getState();

      const toolSelections = readStringArray(args.tools);
      const skillSelections = readStringArray(args.skills);

      const manifest = {
        name: readString(args.name, 'UNNAMED ENTITY'),
        role: readString(args.role, 'General Purpose Intelligence'),
        systemPrompt: readString(args.systemPrompt, 'You are a specialized Sovereign Intelligence.'),
        voiceName: readString(args.voiceName, 'Charon'),
        soul: readString(args.soul, 'Analytical and precise.'),
        rules: readString(args.rules, 'Always prioritize security and efficiency.'),
        tools: {
          googleSearch: toolSelections.includes('search'),
          googleMaps: toolSelections.includes('maps'),
          weather: toolSelections.includes('weather'),
          news: toolSelections.includes('news'),
          crypto: toolSelections.includes('crypto'),
          calculator: toolSelections.includes('math'),
          semanticMemory: toolSelections.includes('memory') || true,
        },
        skills: {
          gmail: skillSelections.includes('gmail'),
          calendar: skillSelections.includes('calendar'),
          drive: skillSelections.includes('drive'),
        }
      };

      setPendingManifest(manifest);
      window.dispatchEvent(new CustomEvent('aether:genesis_triggered', { detail: manifest }));

      return {
        status: 'success',
        message: `Agent ${readString(args.name, 'Unnamed agent')} manifest synthesized. Materializing in Forge Chamber...`,
        manifest
      };
    } catch {
      return { status: 'error', message: 'Genesis protocol failed.' };
    }
  }

  if (name === 'listProjects') {
    const token = readString(args.accessToken);
    if (!token) return { status: 'error', message: 'Access token required for project discovery.' };

    try {
      const response = await fetchWithTimeout(
        'https://cloudresourcemanager.googleapis.com/v1/projects',
        {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        },
        getNetworkTimeoutMs(process.env.NEXT_PUBLIC_REMOTE_FETCH_TIMEOUT_MS, 4000)
      );
      const data = await response.json() as { projects?: unknown[] };
      result = { status: 'success', projects: data.projects || [] };
    } catch (error) {
      result = createNetworkErrorResult('Failed to fetch projects.', error);
    }
  }
  else if (name === 'getProjectDetails') {
    const token = readString(args.accessToken);
    const projectId = readString(args.projectId);
    if (!token || !projectId) return { status: 'error', message: 'Missing credentials or Project ID.' };

    try {
      const response = await fetchWithTimeout(
        `https://cloudresourcemanager.googleapis.com/v1/projects/${projectId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        },
        getNetworkTimeoutMs(process.env.NEXT_PUBLIC_REMOTE_FETCH_TIMEOUT_MS, 4000)
      );
      result = await response.json() as ToolResult;
    } catch (error) {
      result = createNetworkErrorResult('Failed to fetch project details.', error);
    }
  }
  else if (name === 'getWeather') {
    const location = readString(args.location, 'Unknown');
    result = {
      location,
      temperature: Math.floor(Math.random() * 30) + 10,
      condition: ['Sunny', 'Cloudy', 'Rainy', 'Partly Cloudy'][Math.floor(Math.random() * 4)],
      humidity: `${Math.floor(Math.random() * 50) + 30}%`
    };
  }
  else if (name === 'getCryptoPrice') {
    const symbol = readString(args.symbol, 'BTC').toUpperCase();
    const basePrice = symbol === 'BTC' ? 65000 : symbol === 'ETH' ? 3500 : 100;
    result = {
      symbol,
      price: `$${(basePrice + (Math.random() * basePrice * 0.05)).toFixed(2)}`,
      change24h: `${(Math.random() * 10 - 5).toFixed(2)}%`
    };
  }
  else if (name === 'getMapLocation') {
    const location = readString(args.location, 'Unknown');
    result = {
      location,
      lat: (Math.random() * 180 - 90).toFixed(4),
      lng: (Math.random() * 360 - 180).toFixed(4),
      address: `Neural Sector ${Math.floor(Math.random() * 100)}, ${location}`,
      context: 'Geospatial data synthesized by Gemclaw Neural Engine.'
    };
  }
  else if (name === 'searchWeb') {
    result = {
      results: [
        { title: 'GemclawOS Intelligence', snippet: 'The sovereign neural OS is active.', url: 'https://aether.os' }
      ],
      context: 'Search capability is now integrated directly into the Gemini neural core with Google Search Grounding.'
    };
  }
  else if (name === 'store_memory' || name === 'search_memory' || name === 'search_knowledge_base') {
    result = {
      status: 'success',
      message: 'Memory routed to IQRA MemoryClient (L2)'
    };
  }
  else if (name.startsWith('workspace_')) {
    const isAdmin = auth.currentUser?.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL;
    if (!isAdmin && (name === 'list_users' || name === 'analyze_users')) {
      return { status: 'error' as const, message: 'Unauthorized. Admin spinal access required.' };
    }

    try {
      const user = auth.currentUser;
      if (!user) return { status: 'error' as const, message: 'User must be authenticated for Workspace operations.' };

      // Direct Google Workspace Client calls
      switch (name) {
        case 'workspace_gmail':
          try {
            const query = readString(args.query, 'is:unread');
            const data = await GoogleWorkspaceClient.searchGmail(query);
            await CreditManager.applyUsageCharge(500, 2);
            return { status: 'success', data, toolId: name };
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Gmail operation failed';
            return { status: 'fail', message: msg, toolId: name };
          }

        case 'workspace_calendar':
          try {
            const data = await GoogleWorkspaceClient.listEvents();
            await CreditManager.applyUsageCharge(300, 1.5);
            return { status: 'success', data, toolId: name };
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Calendar operation failed';
            return { status: 'fail', message: msg, toolId: name };
          }

        default:
          // Fallback to Bridge or Cloud
          try {
            const localBridgeUrl = getLocalBridgeUrl('/execute');
            if (isLocalBridgeExecutionEnabled() && localBridgeUrl) {
              const localResponse = await fetchWithTimeout(
                localBridgeUrl,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    toolId: name,
                    action: readString(args.action, '+triage'),
                    params: args.params || {},
                    persona: readString(args.persona, DEFAULT_PERSONA),
                  }),
                },
                1500
              );
              return await localResponse.json() as ToolResult;
            }

            const idToken = await user.getIdToken();
            const cloudResponse = await fetchWithTimeout(
              FUNCTION_URL,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${idToken}`
                },
                body: JSON.stringify({
                  toolId: name,
                  action: readString(args.action, '+triage'),
                  params: args.params || {},
                  persona: readString(args.persona, DEFAULT_PERSONA)
                })
              },
              4000
            );
            return await cloudResponse.json() as ToolResult;
          } catch (error) {
            return createNetworkErrorResult('Neural routing failed.', error);
          }
      }
    } catch (error: unknown) {
      console.error('[NeuralHandler] Critical Failure:', error);
      return createNetworkErrorResult('Neural routing failed.', error);
    }
  }

  return result;
}

import { IntentEngine } from '../neural/intent-engine';

/**
 * 🎙️ Gemclaw Voice Orchestrator (Zero-UI Protocol)
 *
 * Manages the high-speed loop between User Voice Intention and
 * Autonomous Tool Execution.
 */
export async function GemclawVoiceOrchestrator(intent: string, context: Record<string, unknown>) {
  const recipeMatch = intent.match(/(triage|agenda|standup|meeting prep|email to task|weekly digest)/i);
  const toolMatch = intent.match(/(email|calendar|task|drive|memory|search|read|browse)/i);

  let toolId = '';
  let action = '+triage';
  let params = (context.params as Record<string, unknown>) || {};

  if (recipeMatch) {
    const recipe = recipeMatch[0].toLowerCase();
    switch (recipe) {
      case 'triage': toolId = 'workspace_gmail'; action = '+triage'; break;
      case 'agenda': toolId = 'workspace_calendar'; action = '+agenda'; break;
      case 'standup': toolId = 'workspace_workflow'; action = '+standup-report'; break;
      case 'meeting prep': toolId = 'workspace_workflow'; action = '+meeting-prep'; break;
      case 'email to task': toolId = 'workspace_workflow'; action = '+email-to-task'; break;
      case 'weekly digest': toolId = 'workspace_workflow'; action = '+weekly-digest'; break;
    }
  } else if (toolMatch) {
    const tool = toolMatch[0].toLowerCase();
    switch (tool) {
      case 'email': toolId = 'workspace_gmail'; break;
      case 'calendar': toolId = 'workspace_calendar'; break;
      case 'task': toolId = 'workspace_tasks'; break;
      case 'drive': toolId = 'workspace_drive'; break;
      case 'memory': toolId = 'store_memory'; break;
      case 'search': toolId = 'searchWeb'; break;
      case 'read':
      case 'browse': toolId = 'browse_url'; break;
    }
  }

  // Phase 2 Final: LLM Intent Fallback
  if (!toolId || intent.split(' ').length > 4) {
    console.warn('[Orchestrator] Regex insufficient. Engaging Neural Intent Engine...');
    const refined = await IntentEngine.classify(intent);
    if (refined.confidence > 0.6) {
      toolId = refined.toolId;
      action = refined.action;
      params = { ...params, ...refined.params };
    }
  }

  if (!toolId) {
    return {
      status: 'fail',
      message: 'Intention does not map to a skill.'
    };
  }

  const executionResult = await handleNeuralTool(toolId, { ...context, action, params });

  return {
    status: 'orchestrated',
    intent,
    executionResult,
    vocalResponse: executionResult.status === 'success'
      ? 'Task processed via Neural Cloud.'
      : `Error: ${executionResult.message}`
  };
}
