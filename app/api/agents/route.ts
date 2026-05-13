export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { verifyIdToken, db } from '@/lib/auth/serverAuth';

/**
 * /api/agents
 * Sovereign Agents API with strict UID isolation.
 */

export async function GET(req: NextRequest) {
  const user = await verifyIdToken(req.headers.get('Authorization'));
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized — Neural Link Required' }, { status: 401 });
  }

  try {
    const agentsSnapshot = await db.collection('agents')
      .where('ownerId', '==', user.uid)
      .get();

    const agents = agentsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return NextResponse.json(agents);
  } catch (error) {
    console.error('[Agents API] GET Error:', error);
    return NextResponse.json({ error: 'System Error: Failed to retrieve agents' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await verifyIdToken(req.headers.get('Authorization'));
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized — Neural Link Required' }, { status: 401 });
  }

  try {
    const data = await req.json();
    
    // Enforcement: ownerId must match the verified UID
    const agentData = {
      ...data,
      ownerId: user.uid,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const docRef = await db.collection('agents').add(agentData);
    
    return NextResponse.json({ 
      id: docRef.id, 
      message: 'Agent Synchronized Successfully' 
    }, { status: 201 });
  } catch (error) {
    console.error('[Agents API] POST Error:', error);
    return NextResponse.json({ error: 'System Error: Failed to create agent' }, { status: 500 });
  }
}
