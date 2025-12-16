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

    const { searchParams } = new URL(request.url);
    const params = Object.fromEntries(searchParams.entries());

    const response = await apiClient.get('/v1/orders', {
      params,
      headers: { 'Authorization': authHeader }
    });

    // 调试: 打印原始订单数据
    console.log('Orders API response:', JSON.stringify(response.data, null, 2));

    // 尝试为每个订单添加市场信息
    const ordersData = response.data;
    if (ordersData.success && ordersData.data && Array.isArray(ordersData.data)) {
      // 获取唯一的市场 ID 列表
      const marketIds = [...new Set(ordersData.data.map(o => o.marketId).filter(Boolean))];

      // 并行批量获取市场信息
      const marketInfoMap = {};
      const marketPromises = marketIds.map(async (marketId) => {
        try {
          const marketRes = await apiClient.get(`/v1/markets/${marketId}`);
          if (marketRes.data.success && marketRes.data.data) {
            marketInfoMap[marketId] = marketRes.data.data;
          }
        } catch (err) {
          console.log(`Failed to fetch market ${marketId}:`, err.message);
        }
      });

      await Promise.all(marketPromises);

      // 将市场信息附加到订单
      ordersData.data = ordersData.data.map(order => {
        const marketInfo = marketInfoMap[order.marketId];
        return {
          ...order,
          market: marketInfo || null,
          marketTitle: marketInfo?.question || marketInfo?.title || null,
          outcomeName: marketInfo?.outcomes?.[order.outcomeIndex] ||
            (order.outcomeIndex === 0 ? 'Yes' : order.outcomeIndex === 1 ? 'No' : null)
        };
      });
    }

    return NextResponse.json(ordersData);
  } catch (error) {
    console.error('Error fetching orders:', error.response?.data || error.message);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch orders'
    }, { status: error.response?.status || 500 });
  }
}

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
    const response = await apiClient.post('/v1/orders', body, {
      headers: { 'Authorization': authHeader }
    });
    return NextResponse.json(response.data);
  } catch (error) {
    console.error('Error submitting order:', error.response?.data || error.message);
    const apiError = error.response?.data?.error;
    return NextResponse.json({
      success: false,
      error: apiError || 'Failed to submit order',
      message: error.response?.data?.message || error.message
    }, { status: error.response?.status || 500 });
  }
}
