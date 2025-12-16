import { NextResponse } from 'next/server';
import { apiClient } from '../../lib/apiClient';

export async function GET(request, { params }) {
  try {
    const { slug } = await params;
    const response = await apiClient.get(`/v1/categories/${slug}`);
    return NextResponse.json(response.data);
  } catch (error) {
    console.error('Error fetching category:', error.response?.data || error.message);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch category'
    }, { status: error.response?.status || 500 });
  }
}
