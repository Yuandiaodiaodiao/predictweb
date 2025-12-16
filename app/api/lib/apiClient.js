import axios from 'axios';

// API 配置
const API_BASE_URL = process.env.API_BASE_URL || 'https://api-testnet.predict.fun';
const API_KEY = process.env.PREDICT_API_KEY;

// 创建 axios 实例
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'x-api-key': API_KEY,
    'Content-Type': 'application/json'
  },
  timeout: 30000,
});

// 检查 API Key 是否配置
if (!API_KEY) {
  console.warn('WARNING: PREDICT_API_KEY not set in environment variables!');
}

export { apiClient, API_BASE_URL, API_KEY };
