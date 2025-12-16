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

    const { ids } = await request.json();

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'ids array is required'
      }, { status: 400 });
    }

    console.log('Removing orders from orderbook:', ids);

    // 使用官方 API: POST /v1/orders/remove
    const response = await apiClient.post('/v1/orders/remove', {
      data: {
        ids: ids
      }
    }, {
      headers: { 'Authorization': authHeader }
    });

    console.log('Remove orders success:', response.data);
    return NextResponse.json(response.data);
  } catch (error) {
    console.error('Error removing orders:', error.response?.data || error.message);
    return NextResponse.json({
      success: false,
      error: 'Failed to remove orders',
      message: error.response?.data?.message || error.message,
      details: error.response?.data
    }, { status: error.response?.status || 500 });
  }
}
