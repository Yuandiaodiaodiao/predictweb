'use client';

import React, { useState, useEffect } from 'react';
import axios from 'axios';

const Orders = ({ jwtToken, userAddress, onOrderCancelled, onViewMarket }) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cancellingId, setCancellingId] = useState(null);

  useEffect(() => {
    if (jwtToken && userAddress) {
      fetchOrders();
      const interval = setInterval(fetchOrders, 10000);
      return () => clearInterval(interval);
    }
  }, [jwtToken, userAddress]);

  const fetchOrders = async () => {
    if (!jwtToken) return;

    setLoading(true);
    setError('');

    try {
      const response = await axios.get('/api/orders', {
        headers: {
          'Authorization': `Bearer ${jwtToken}`
        },
        params: {
          status: 'OPEN'
        }
      });

      if (response.data.success) {
        setOrders(response.data.data || []);
      } else {
        setError(response.data.error || '获取订单失败');
      }
    } catch (err) {
      console.error('Error fetching orders:', err);
      if (err.response?.status !== 401) {
        setError('获取订单失败');
      }
    } finally {
      setLoading(false);
    }
  };

  const cancelOrder = async (orderData) => {
    if (!orderData) {
      alert('订单数据缺失，无法取消');
      return;
    }

    const orderId = orderData.id || orderData.orderId;

    if (!orderId) {
      alert('订单 ID 缺失，无法取消');
      return;
    }

    if (!window.confirm(`确定要取消这个订单吗？\n\n订单 ID: ${orderId}`)) {
      return;
    }

    setCancellingId(orderId);

    try {
      const response = await axios.post('/api/orders/remove', {
        ids: [orderId.toString()]
      }, {
        headers: {
          'Authorization': `Bearer ${jwtToken}`
        }
      });

      if (response.data.success) {
        alert('✅ 订单已取消！');
        fetchOrders();
        onOrderCancelled && onOrderCancelled();
      } else {
        alert('❌ 取消失败: ' + (response.data.error || response.data.message || '未知错误'));
      }
    } catch (err) {
      console.error('Error cancelling order:', err);
      const errorMsg = err.response?.data?.message || err.response?.data?.error || err.message;
      alert('❌ 取消订单失败\n\n' + errorMsg);
    } finally {
      setCancellingId(null);
    }
  };

  if (!jwtToken || !userAddress) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <h3 style={styles.title}>我的挂单</h3>
        </div>
        <div style={styles.emptyState}>
          <span style={styles.emptyIcon}>🔒</span>
          <p style={styles.emptyText}>请连接钱包查看挂单</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>我的挂单</h3>
        <button onClick={fetchOrders} style={styles.refreshBtn} disabled={loading}>
          {loading ? '刷新中...' : '🔄'}
        </button>
      </div>

      <div style={styles.countBadge}>
        {orders.length} 个活跃订单
      </div>

      {error && (
        <div style={styles.error}>{error}</div>
      )}

      {loading && orders.length === 0 ? (
        <div style={styles.loading}>加载中...</div>
      ) : orders.length === 0 ? (
        <div style={styles.emptyState}>
          <span style={styles.emptyIcon}>📋</span>
          <p style={styles.emptyText}>暂无挂单</p>
        </div>
      ) : (
        <div style={styles.orderList}>
          {orders.map((order, index) => {
            const orderId = order?.id || order?.orderId || index;
            return (
              <OrderCard
                key={orderId}
                order={order}
                onCancel={cancelOrder}
                isCancelling={cancellingId === orderId}
                onViewMarket={onViewMarket}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

const OrderCard = ({ order: orderWrapper, onCancel, isCancelling, onViewMarket }) => {
  if (!orderWrapper) return null;

  const rawOrder = orderWrapper.order || orderWrapper || {};
  const orderHash = rawOrder.hash || orderWrapper.id || '';
  const side = rawOrder.side ?? orderWrapper.side ?? 0;

  const tokenId = rawOrder.tokenId || orderWrapper.tokenId || '';
  let outcomeIndex;
  if (tokenId) {
    try {
      outcomeIndex = BigInt(tokenId) % 2n === 0n ? 0 : 1;
    } catch (e) {
      outcomeIndex = 0;
    }
  }

  const {
    marketId = '',
    market,
    outcome,
    marketTitle: wrapperMarketTitle,
    outcomeName: wrapperOutcomeName,
    amount: wrapperAmount,
    amountFilled,
    createdAt
  } = orderWrapper || {};

  const makerAmount = rawOrder.makerAmount;
  const takerAmount = rawOrder.takerAmount;

  const isBuy = side === 0 || side === 'BUY' || side === 'buy';
  const sideText = isBuy ? '买入' : '卖出';
  const sideColor = isBuy ? 'var(--accent-green, #3fb950)' : 'var(--accent-red, #f85149)';

  const fromWei = (value) => {
    if (!value) return 0;
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (num > 1e15) {
      return num / 1e18;
    }
    return num;
  };

  const makerAmountNum = fromWei(makerAmount);
  const takerAmountNum = fromWei(takerAmount);
  const filledAmountNum = fromWei(amountFilled);

  let displayPrice = 0;
  if (makerAmountNum && takerAmountNum) {
    if (side === 0) {
      displayPrice = makerAmountNum / takerAmountNum;
    } else {
      displayPrice = takerAmountNum / makerAmountNum;
    }
  }

  const displayAmount = (side === 0 ? takerAmountNum : makerAmountNum) || 0;
  const displayFilled = filledAmountNum || 0;

  const safePrice = isNaN(displayPrice) ? 0 : displayPrice;
  const safeAmount = isNaN(displayAmount) ? 0 : displayAmount;
  const safeFilled = isNaN(displayFilled) ? 0 : displayFilled;

  const getMarketTitle = () => {
    if (market?.question) return market.question;
    if (market?.title) return market.title;
    if (wrapperMarketTitle) return wrapperMarketTitle;
    if (marketId) return `市场 #${marketId}`;
    return '加载中...';
  };
  const marketTitle = getMarketTitle();

  const getOutcomeName = () => {
    if (outcome?.name) return outcome.name;
    if (wrapperOutcomeName) return wrapperOutcomeName;
    if (market?.outcomes && outcomeIndex !== undefined) {
      return market.outcomes[outcomeIndex] || (outcomeIndex === 0 ? 'Yes' : 'No');
    }
    if (outcomeIndex !== undefined) {
      return outcomeIndex === 0 ? 'Yes' : 'No';
    }
    return isBuy ? 'Yes' : 'No';
  };
  const outcomeName = getOutcomeName();

  const handleViewMarket = () => {
    const mktId = marketId || orderWrapper.marketId || market?.id;
    if (mktId && onViewMarket) {
      onViewMarket(mktId);
    } else if (mktId) {
      window.open(`https://predict.fun/market/${mktId}`, '_blank');
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel(orderWrapper);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div style={styles.orderCard}>
      <div style={styles.orderHeader}>
        <span style={{
          ...styles.sideBadge,
          backgroundColor: sideColor
        }}>
          {sideText}
        </span>
        <span style={styles.orderTime}>{formatDate(createdAt)}</span>
      </div>

      <div style={styles.orderMarket}>
        {marketTitle && marketTitle.length > 35 ? marketTitle.slice(0, 35) + '...' : (marketTitle || '-')}
      </div>

      <div style={styles.orderDetails}>
        <div style={styles.detailRow}>
          <span style={styles.detailLabel}>结果</span>
          <span style={styles.detailValue}>{outcomeName || '-'}</span>
        </div>
        <div style={styles.detailRow}>
          <span style={styles.detailLabel}>价格</span>
          <span style={styles.detailValue}>${safePrice.toFixed(3)}</span>
        </div>
        <div style={styles.detailRow}>
          <span style={styles.detailLabel}>数量</span>
          <span style={styles.detailValue}>{safeAmount.toFixed(2)}</span>
        </div>
        {safeFilled > 0 && (
          <div style={styles.detailRow}>
            <span style={styles.detailLabel}>已成交</span>
            <span style={styles.detailValue}>{safeFilled.toFixed(2)}</span>
          </div>
        )}
      </div>

      <div style={styles.orderHash}>
        {orderHash && typeof orderHash === 'string' && orderHash.length > 18
          ? `${orderHash.slice(0, 10)}...${orderHash.slice(-8)}`
          : (orderHash || '无哈希')}
      </div>

      <div style={styles.orderActions}>
        {(marketId || orderWrapper.marketId || market?.id) && (
          <button
            onClick={handleViewMarket}
            style={styles.viewMarketBtn}
          >
            🔗 查看市场
          </button>
        )}

        <button
          onClick={handleCancel}
          disabled={isCancelling}
          style={{
            ...styles.cancelBtn,
            opacity: isCancelling ? 0.6 : 1
          }}
        >
          {isCancelling ? '取消中...' : '❌ 取消订单'}
        </button>
      </div>
    </div>
  );
};

const styles = {
  container: {
    backgroundColor: 'var(--bg-card, #1c2128)',
    borderRadius: '12px',
    padding: '16px',
    border: '1px solid var(--border-color, #30363d)'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px'
  },
  title: {
    margin: 0,
    fontSize: '16px',
    fontWeight: '600',
    color: 'var(--text-primary, #f0f6fc)'
  },
  refreshBtn: {
    padding: '6px 10px',
    border: '1px solid var(--border-color, #30363d)',
    borderRadius: '6px',
    backgroundColor: 'var(--bg-tertiary, #21262d)',
    color: 'var(--text-secondary, #8b949e)',
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'all 0.2s'
  },
  countBadge: {
    display: 'inline-block',
    padding: '4px 12px',
    backgroundColor: 'rgba(88, 166, 255, 0.15)',
    color: 'var(--accent-blue, #58a6ff)',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: '500',
    marginBottom: '12px'
  },
  error: {
    padding: '10px 12px',
    backgroundColor: 'rgba(248, 81, 73, 0.1)',
    color: 'var(--accent-red, #f85149)',
    borderRadius: '8px',
    fontSize: '13px',
    marginBottom: '12px',
    border: '1px solid rgba(248, 81, 73, 0.3)'
  },
  loading: {
    textAlign: 'center',
    padding: '20px',
    color: 'var(--text-muted, #6e7681)'
  },
  emptyState: {
    textAlign: 'center',
    padding: '30px 20px'
  },
  emptyIcon: {
    fontSize: '32px',
    display: 'block',
    marginBottom: '8px'
  },
  emptyText: {
    margin: 0,
    fontSize: '13px',
    color: 'var(--text-muted, #6e7681)'
  },
  orderList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    maxHeight: '400px',
    overflowY: 'auto'
  },
  orderCard: {
    padding: '14px',
    border: '1px solid var(--border-color, #30363d)',
    borderRadius: '10px',
    backgroundColor: 'var(--bg-tertiary, #21262d)'
  },
  orderHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '10px'
  },
  sideBadge: {
    padding: '4px 12px',
    borderRadius: '6px',
    color: '#fff',
    fontSize: '11px',
    fontWeight: '600',
    textTransform: 'uppercase'
  },
  orderTime: {
    fontSize: '11px',
    color: 'var(--text-muted, #6e7681)'
  },
  orderMarket: {
    fontSize: '13px',
    fontWeight: '500',
    color: 'var(--text-primary, #f0f6fc)',
    marginBottom: '12px',
    lineHeight: '1.4'
  },
  orderDetails: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '8px',
    marginBottom: '12px',
    padding: '10px',
    backgroundColor: 'var(--bg-secondary, #161b22)',
    borderRadius: '8px'
  },
  detailRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '12px'
  },
  detailLabel: {
    color: 'var(--text-muted, #6e7681)'
  },
  detailValue: {
    color: 'var(--text-primary, #f0f6fc)',
    fontWeight: '500',
    fontFamily: 'var(--font-mono, monospace)'
  },
  orderHash: {
    fontSize: '10px',
    color: 'var(--text-muted, #6e7681)',
    fontFamily: 'var(--font-mono, monospace)',
    marginBottom: '12px'
  },
  orderActions: {
    display: 'flex',
    gap: '8px'
  },
  viewMarketBtn: {
    flex: 1,
    padding: '10px',
    border: '1px solid var(--accent-blue, #58a6ff)',
    borderRadius: '8px',
    backgroundColor: 'transparent',
    color: 'var(--accent-blue, #58a6ff)',
    fontSize: '12px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  cancelBtn: {
    flex: 1,
    padding: '10px',
    border: 'none',
    borderRadius: '8px',
    backgroundColor: 'var(--accent-red, #f85149)',
    color: '#fff',
    fontSize: '12px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s'
  }
};

export default Orders;
