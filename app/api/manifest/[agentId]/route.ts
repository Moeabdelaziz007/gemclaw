export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const { agentId } = await params;
  
  try {
    // Attempt to fetch agent name for better personalization if possible
    // Note: This relies on the agent existing in Firestore
    const agentRef = doc(db, 'agents', agentId);
    const agentSnap = await getDoc(agentRef);
    const agentData = agentSnap.exists() ? agentSnap.data() : null;
    
    const agentName = agentData?.name || agentId;
    const seed = agentData?.seed || agentName;

    const manifest = {
      name: `${agentName} - Gemclaw AI`,
      short_name: agentName,
      description: agentData?.role || 'Gemclaw AI Assistant',
      start_url: `/?agent=${agentId}`,
      display: 'standalone',
      orientation: 'portrait',
      background_color: '#050B14',
      theme_color: '#10ff87',
      icons: [
        {
          src: `https://api.dicebear.com/7.x/bottts-neutral/png?seed=${encodeURIComponent(seed)}&size=192&backgroundColor=050B14`,
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any maskable',
        },
        {
          src: `https://api.dicebear.com/7.x/bottts-neutral/png?seed=${encodeURIComponent(seed)}&size=512&backgroundColor=050B14`,
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any maskable',
        },
      ],
      categories: ['productivity', 'utilities'],
      shortcuts: [
        {
          name: 'Open Chat',
          url: `/workspace?agent=${agentId}`,
          description: 'Start conversation',
        }
      ]
    };

    return NextResponse.json(manifest, {
      headers: {
        'Content-Type': 'application/manifest+json',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    });
  } catch (error) {
    console.error('[ManifestAPI] Error generating manifest:', error);
    // Return a default manifest if fetch fails
    return NextResponse.json({
      name: 'Gemclaw AI Agent',
      short_name: 'Agent',
      start_url: `/?agent=${agentId}`,
      display: 'standalone',
      background_color: '#050B14',
      theme_color: '#10ff87',
    }, {
      headers: { 'Content-Type': 'application/manifest+json' }
    });
  }
}
