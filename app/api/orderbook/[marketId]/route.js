import { NextResponse } from 'next/server';
import { apiClient } from '../../lib/apiClient';

export async function GET(request, { params }) {
  try {
    const { marketId } = await params;
    const response = await apiClient.get(`/v1/markets/${marketId}/orderbook`);
    return NextResponse.json(response.data);
  } catch (error) {
    console.error('Error fetching orderbook:', error.response?.data || error.message);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch orderbook',
      message: error.response?.data?.message || error.message
    }, { status: error.response?.status || 500 });
  }
}
