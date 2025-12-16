import { NextResponse } from 'next/server';
import { apiClient } from '../lib/apiClient';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const params = Object.fromEntries(searchParams.entries());

    const response = await apiClient.get('/v1/categories', { params });
    return NextResponse.json(response.data);
  } catch (error) {
    console.error('Error fetching categories:', error.response?.data || error.message);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch categories'
    }, { status: error.response?.status || 500 });
  }
}
