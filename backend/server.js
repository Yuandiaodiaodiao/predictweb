const express = require('express');
const cors = require('cors');
const axios = require('axios');
const compression = require('compression');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// 根据文档使用正确的 API URL
const API_BASE_URL = process.env.API_BASE_URL || 'https://api-testnet.predict.fun';
const API_KEY = process.env.PREDICT_API_KEY;

// 允许所有来源
app.use(cors());

// 启用 gzip 压缩
app.use(compression());

app.use(express.json());

// 安全：不暴露敏感信息到日志
if (!API_KEY) {
  console.warn('WARNING: PREDICT_API_KEY not set!')
}

// 创建带有认证头的 axios 实例
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'x-api-key': API_KEY,
    'Content-Type': 'application/json'
  },
  timeout: 30000 // 30秒超时
});

// 获取市场列表 - 使用 /v1/categories 端点
// 参数: first (分类数量，默认100), limit (市场总数限制，0=不限制)
app.get('/api/markets', async (req, res) => {
  try {
    const response = await apiClient.get('/v1/categories', {
      params: {
        first: req.query.first || 100, // 获取更多分类
        after: req.query.after,
        status: req.query.status || 'OPEN'
      }
    });

    // 转换数据结构：从嵌套的 categories->markets 提取扁平的市场列表
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
        // 转换 outcomes 为前端友好的格式
        outcomes: market.outcomes?.map(o => o.name) || [],
        outcomesDetail: market.outcomes || [],
        createdAt: market.createdAt
      }))
    );

    // 可选：限制返回的市场总数 (limit=0 表示不限制)
    const maxMarkets = parseInt(req.query.limit);
    if (maxMarkets > 0 && markets.length > maxMarkets) {
      markets = markets.slice(0, maxMarkets);
    }

    console.log(`Returning ${markets.length} markets from ${categories.length} categories`);

    res.json({
      success: true,
      data: markets,
      cursor: response.data.cursor,
      total: markets.length
    });
  } catch (error) {
    console.error('Error fetching markets:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      success: false,
      error: 'Failed to fetch markets',
      message: error.response?.data?.message || error.message
    });
  }
});

// 获取分类列表（原始格式）
app.get('/api/categories', async (req, res) => {
  try {
    const response = await apiClient.get('/v1/categories', {
      params: req.query
    });
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching categories:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      success: false,
      error: 'Failed to fetch categories'
    });
  }
});

// 获取特定分类
app.get('/api/categories/:slug', async (req, res) => {
  try {
    const response = await apiClient.get(`/v1/categories/${req.params.slug}`);
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching category:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      success: false,
      error: 'Failed to fetch category'
    });
  }
});

// 认证端点 - 获取 JWT
app.post('/api/auth', async (req, res) => {
  try {
    const { signer, signature, message } = req.body;
    const response = await apiClient.post('/v1/auth', {
      signer,
      signature,
      message
    });
    res.json(response.data);
  } catch (error) {
    console.error('Error authenticating:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      success: false,
      error: 'Authentication failed'
    });
  }
});

// 获取账户信息
app.get('/api/account', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        error: 'Authorization required'
      });
    }

    const response = await apiClient.get('/v1/account', {
      headers: { 'Authorization': authHeader }
    });
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching account:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      success: false,
      error: 'Failed to fetch account'
    });
  }
});

// 获取认证消息（用于签名）
app.get('/api/auth/message', async (req, res) => {
  try {
    const response = await apiClient.get('/v1/auth/message');
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching auth message:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      success: false,
      error: 'Failed to fetch auth message'
    });
  }
});

// 获取账户信息（需要 JWT）
app.get('/api/account', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const response = await apiClient.get('/v1/account', {
      headers: authHeader ? { 'Authorization': authHeader } : {}
    });
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching account:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      success: false,
      error: 'Failed to fetch account'
    });
  }
});

// 获取订单（需要认证）
app.get('/api/orders', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const response = await apiClient.get('/v1/orders', {
      params: req.query,
      headers: authHeader ? { 'Authorization': authHeader } : {}
    });
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching orders:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      success: false,
      error: 'Failed to fetch orders'
    });
  }
});

// 获取订单簿
app.get('/api/orderbook/:marketId', async (req, res) => {
  try {
    const response = await apiClient.get(`/v1/markets/${req.params.marketId}/orderbook`);
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching orderbook:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      success: false,
      error: 'Failed to fetch orderbook',
      message: error.response?.data?.message || error.message
    });
  }
});

// 获取市场详情
app.get('/api/markets/:marketId', async (req, res) => {
  try {
    const response = await apiClient.get(`/v1/markets/${req.params.marketId}`);
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching market:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      success: false,
      error: 'Failed to fetch market'
    });
  }
});

// 提交订单
app.post('/api/orders', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        error: 'Authorization required'
      });
    }

    const response = await apiClient.post('/v1/orders', req.body, {
      headers: { 'Authorization': authHeader }
    });
    res.json(response.data);
  } catch (error) {
    console.error('Error submitting order:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      success: false,
      error: 'Failed to submit order',
      message: error.response?.data?.message || error.message
    });
  }
});

// 获取用户订单列表
app.get('/api/orders', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        error: 'Authorization required'
      });
    }

    const response = await apiClient.get('/v1/orders', {
      params: req.query,
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
          // 添加结果名称
          outcomeName: marketInfo?.outcomes?.[order.outcomeIndex] || 
                       (order.outcomeIndex === 0 ? 'Yes' : order.outcomeIndex === 1 ? 'No' : null)
        };
      });
    }
    
    res.json(ordersData);
  } catch (error) {
    console.error('Error fetching orders:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      success: false,
      error: 'Failed to fetch orders'
    });
  }
});

// 取消订单 - 使用官方 API: POST /v1/orders/remove
// 参考文档: https://dev.predict.fun/api-25326904
app.post('/api/orders/remove', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        error: 'Authorization required'
      });
    }

    const { ids } = req.body;
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'ids array is required'
      });
    }

    console.log('Removing orders from orderbook:', ids);

    // 使用官方 API: POST /v1/orders/remove
    const response = await apiClient.post('/v1/orders/remove', {
      data: {
        ids: ids // 订单 ID 数组，如 ["1016"]
      }
    }, {
      headers: { 'Authorization': authHeader }
    });

    console.log('Remove orders success:', response.data);
    res.json(response.data);
  } catch (error) {
    console.error('Error removing orders:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      success: false,
      error: 'Failed to remove orders',
      message: error.response?.data?.message || error.message,
      details: error.response?.data
    });
  }
});

// 获取用户持仓
app.get('/api/positions', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        error: 'Authorization required'
      });
    }

    const response = await apiClient.get('/v1/positions', {
      params: req.query,
      headers: { 'Authorization': authHeader }
    });
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching positions:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      success: false,
      error: 'Failed to fetch positions'
    });
  }
});

// 设置 Referral Code
app.post('/api/account/referral', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        error: 'Authorization required'
      });
    }

    const response = await apiClient.post('/v1/account/referral', req.body, {
      headers: { 'Authorization': authHeader }
    });
    res.json(response.data);
  } catch (error) {
    console.error('Error setting referral:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      success: false,
      error: 'Failed to set referral',
      message: error.response?.data?.message || error.message
    });
  }
});

// 健康检查端点 (不暴露敏感信息)
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    configured: !!API_KEY,
    version: '1.0.0'
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
  console.log(`API Base URL: ${API_BASE_URL}`);
  console.log(`API Key configured: ${API_KEY ? 'Yes' : 'No - Please set PREDICT_API_KEY in .env'}`);
});
