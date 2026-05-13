export const dynamic = "force-dynamic";
/**
 * Sovereign Public Agent API (v1.0)
 * 
 * Provides endpoints for managing a specific intelligence entity.
 * Security: Requires valid Client IDs for mutations.
 */

import { NextResponse } from 'next/server';
import { db } from '@/firebase';
import { doc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const docRef = doc(db, 'agents', params.id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return NextResponse.json({ success: false, error: 'Agent Instance Not Found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: { id: docSnap.id, ...docSnap.data() } });
  } catch (error) {
    console.error('[API_Agent_ID_GET_Error]:', error);
    return NextResponse.json({ success: false, error: 'Internal Neural Error' }, { status: 500 });
  }
}

export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const body = await request.json();
    const developerToken = request.headers.get('x-developer-token');

    if (!developerToken) {
      return NextResponse.json({ success: false, error: 'Authorization Denied: Developer Token Missing' }, { status: 401 });
    }

    const docRef = doc(db, 'agents', params.id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return NextResponse.json({ success: false, error: 'Agent Instance Not Found' }, { status: 404 });
    }

    // [TODO]: Verify developerToken ownership of this agent
    
    await updateDoc(docRef, { ...body, updatedAt: Date.now() });

    return NextResponse.json({ success: true, message: 'Agent configuration updated successfully.' });
  } catch (error) {
    console.error('[API_Agent_ID_PATCH_Error]:', error);
    return NextResponse.json({ success: false, error: 'Internal Neural Error' }, { status: 500 });
  }
}

export async function DELETE(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const developerToken = request.headers.get('x-developer-token');

    if (!developerToken) {
      return NextResponse.json({ success: false, error: 'Authorization Denied: Developer Token Missing' }, { status: 401 });
    }

    const docRef = doc(db, 'agents', params.id);
    await deleteDoc(docRef);

    return NextResponse.json({ success: true, message: 'Agent successfully decommissioned.' });
  } catch (error) {
    console.error('[API_Agent_ID_DELETE_Error]:', error);
    return NextResponse.json({ success: false, error: 'Internal Neural Error' }, { status: 500 });
  }
}
