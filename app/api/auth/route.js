import { NextResponse } from 'next/server';
import { apiClient } from '../lib/apiClient';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const { signer, signature, message } = await request.json();
    const response = await apiClient.post('/v1/auth', {
      signer,
      signature,
      message
    });
    return NextResponse.json(response.data);
  } catch (error) {
    console.error('Error authenticating:', error.response?.data || error.message);
    return NextResponse.json({
      success: false,
      error: 'Authentication failed'
    }, { status: error.response?.status || 500 });
  }
}
