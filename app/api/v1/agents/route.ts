export const dynamic = "force-dynamic";
/**
 * Sovereign Public Agent API (v1.0)
 * 
 * Provides endpoints for discovering and creating intelligence entities.
 * Security: Requires valid Client IDs for mutations.
 */

import { NextResponse } from 'next/server';
import { db } from '@/firebase';
import { collection, getDocs, addDoc, query, where, limit } from 'firebase/firestore';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    
    let q = query(collection(db, 'agents'), limit(50));
    
    if (category) {
      q = query(collection(db, 'agents'), where('category', '==', category), limit(50));
    }

    const snapshot = await getDocs(q);
    const agents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    return NextResponse.json({ success: true, count: agents.length, data: agents });
  } catch (error) {
    console.error('[API_Agents_GET_Error]:', error);
    return NextResponse.json({ success: false, error: 'Internal Neural Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const developerToken = request.headers.get('x-developer-token');

    if (!developerToken) {
      return NextResponse.json({ success: false, error: 'Authorization Denied: Developer Token Missing' }, { status: 401 });
    }

    // [TODO]: Verify developerToken against a 'developers' collection in Firestore
    
    const docRef = await addDoc(collection(db, 'agents'), {
      ...body,
      createdAt: Date.now(),
      status: 'pending_review',
    });

    return NextResponse.json({ success: true, id: docRef.id, message: 'Agent successfully submitted for neural review.' });
  } catch (error) {
    console.error('[API_Agents_POST_Error]:', error);
    return NextResponse.json({ success: false, error: 'Internal Neural Error' }, { status: 500 });
  }
}
