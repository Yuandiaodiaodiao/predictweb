import { NextResponse } from 'next/server';
import { apiClient } from '../lib/apiClient';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({
        success: false,
        error: 'Authorization required'
      }, { status: 401 });
    }

    const response = await apiClient.get('/v1/account', {
      headers: { 'Authorization': authHeader }
    });
    return NextResponse.json(response.data);
  } catch (error) {
    console.error('Error fetching account:', error.response?.data || error.message);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch account'
    }, { status: error.response?.status || 500 });
  }
}
