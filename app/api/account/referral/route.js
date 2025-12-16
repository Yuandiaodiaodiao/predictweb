import { NextResponse } from 'next/server';
import { apiClient } from '../../lib/apiClient';

export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({
        success: false,
        error: 'Authorization required'
      }, { status: 401 });
    }

    const body = await request.json();
    const response = await apiClient.post('/v1/account/referral', body, {
      headers: { 'Authorization': authHeader }
    });
    return NextResponse.json(response.data);
  } catch (error) {
    console.error('Error setting referral:', error.response?.data || error.message);
    return NextResponse.json({
      success: false,
      error: 'Failed to set referral',
      message: error.response?.data?.message || error.message
    }, { status: error.response?.status || 500 });
  }
}
