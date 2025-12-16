import { NextResponse } from 'next/server';
import { apiClient } from '../lib/apiClient';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const first = searchParams.get('first') || 100;
    const after = searchParams.get('after');
    const status = searchParams.get('status') || 'OPEN';
    const limit = parseInt(searchParams.get('limit')) || 0;

    const response = await apiClient.get('/v1/categories', {
      params: { first, after, status }
    });

    // 从嵌套的 categories->markets 提取扁平的市场列表
    const categories = response.data.data || [];
    let markets = categories.flatMap(category =>
      (category.markets || []).map(market => ({
        id: market.id,
        conditionId: market.conditionId,
        question: market.question,
        title: market.title,
        imageUrl: market.imageUrl,
        status: market.status,
        category: category.title,
        categorySlug: category.slug,
        isNegRisk: market.isNegRisk,
        feeRateBps: market.feeRateBps,
        outcomes: market.outcomes?.map(o => o.name) || [],
        outcomesDetail: market.outcomes || [],
        createdAt: market.createdAt
      }))
    );

    // 限制返回的市场总数
    if (limit > 0 && markets.length > limit) {
      markets = markets.slice(0, limit);
    }

    console.log(`Returning ${markets.length} markets from ${categories.length} categories`);

    return NextResponse.json({
      success: true,
      data: markets,
      cursor: response.data.cursor,
      total: markets.length
    });
  } catch (error) {
    console.error('Error fetching markets:', error.response?.data || error.message);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch markets',
      message: error.response?.data?.message || error.message
    }, { status: error.response?.status || 500 });
  }
}
