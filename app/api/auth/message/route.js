import { NextResponse } from 'next/server';
import { apiClient } from '../../lib/apiClient';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const response = await apiClient.get('/v1/auth/message');
    return NextResponse.json(response.data);
  } catch (error) {
    console.error('Error fetching auth message:', error.response?.data || error.message);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch auth message'
    }, { status: error.response?.status || 500 });
  }
}
