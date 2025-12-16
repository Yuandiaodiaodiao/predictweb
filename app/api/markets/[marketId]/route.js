import { NextResponse } from 'next/server';
import { apiClient } from '../../lib/apiClient';

export async function GET(request, { params }) {
  try {
    const { marketId } = await params;
    const response = await apiClient.get(`/v1/markets/${marketId}`);
    return NextResponse.json(response.data);
  } catch (error) {
    console.error('Error fetching market:', error.response?.data || error.message);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch market'
    }, { status: error.response?.status || 500 });
  }
}
