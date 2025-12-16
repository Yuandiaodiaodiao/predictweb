'use client';

import React, { useState, useEffect } from 'react';
import axios from 'axios';

const Orders = ({ jwtToken, userAddress, markets = [], onOrderCancelled, onViewMarket, onSelectMarket }) => {
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
                markets={markets}
                onCancel={cancelOrder}
                isCancelling={cancellingId === orderId}
                onViewMarket={onViewMarket}
                onSelectMarket={onSelectMarket}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

const OrderCard = ({ order: orderWrapper, markets = [], onCancel, isCancelling, onViewMarket, onSelectMarket }) => {
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

  // 从 markets 列表中联动查找市场信息
  const linkedMarket = markets.find(m => m.id === marketId || m.marketId === marketId) || market;

  const makerAmount = rawOrder.makerAmount;
  const takerAmount = rawOrder.takerAmount;

  const isBuy = side === 0 || side === 'BUY' || side === 'buy';
  const sideText = isBuy ? '买入' : '卖出';
  const sideColor = isBuy ? '#38B2AC' : '#E53E3E';

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
    // 优先使用联动的市场数据
    if (linkedMarket?.question) return linkedMarket.question;
    if (linkedMarket?.title) return linkedMarket.title;
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
    // 优先使用联动的市场数据
    if (linkedMarket?.outcomes && outcomeIndex !== undefined) {
      return linkedMarket.outcomes[outcomeIndex] || (outcomeIndex === 0 ? 'Yes' : 'No');
    }
    if (market?.outcomes && outcomeIndex !== undefined) {
      return market.outcomes[outcomeIndex] || (outcomeIndex === 0 ? 'Yes' : 'No');
    }
    if (outcomeIndex !== undefined) {
      return outcomeIndex === 0 ? 'Yes' : 'No';
    }
    return isBuy ? 'Yes' : 'No';
  };
  const outcomeName = getOutcomeName();

  const handleSelectMarket = () => {
    const mktId = marketId || orderWrapper.marketId || market?.id;
    if (mktId && onSelectMarket && linkedMarket) {
      onSelectMarket(linkedMarket);
    } else if (mktId && onViewMarket) {
      onViewMarket(mktId);
    }
  };

  const handleViewMarket = (e) => {
    e.stopPropagation();
    const mktId = marketId || orderWrapper.marketId || market?.id;
    if (mktId && onSelectMarket && linkedMarket) {
      onSelectMarket(linkedMarket);
    } else if (mktId && onViewMarket) {
      onViewMarket(mktId);
    } else if (mktId) {
      window.open(`https://predict.fun/market/${mktId}`, '_blank');
    }
  };

  const handleCancel = (e) => {
    e.stopPropagation();
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

  const hasLinkedMarket = linkedMarket && (linkedMarket.id || linkedMarket.marketId);

  return (
    <div
      style={{
        ...styles.orderCard,
        cursor: hasLinkedMarket ? 'pointer' : 'default'
      }}
      onClick={hasLinkedMarket ? handleSelectMarket : undefined}
    >
      <div style={styles.orderHeader}>
        <span style={{
          ...styles.sideBadge,
          backgroundColor: sideColor
        }}>
          {sideText}
        </span>
        <span style={{
          ...styles.outcomeBadge,
          backgroundColor: outcomeName === 'Yes' ? 'rgba(56, 178, 172, 0.15)' : 'rgba(229, 62, 62, 0.15)',
          color: outcomeName === 'Yes' ? '#38B2AC' : '#E53E3E'
        }}>
          {outcomeName || '-'}
        </span>
        <span style={styles.orderTime}>{formatDate(createdAt)}</span>
      </div>

      <div style={styles.orderMarket}>
        {marketTitle && marketTitle.length > 50 ? marketTitle.slice(0, 50) + '...' : (marketTitle || '-')}
      </div>

      {hasLinkedMarket && (
        <div style={styles.clickHint}>
          点击查看市场
        </div>
      )}

      <div style={styles.orderDetails}>
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
        <button
          onClick={handleCancel}
          disabled={isCancelling}
          style={{
            ...styles.cancelBtn,
            opacity: isCancelling ? 0.6 : 1
          }}
        >
          {isCancelling ? '取消中...' : '取消订单'}
        </button>
      </div>
    </div>
  );
};

const styles = {
  container: {
    backgroundColor: 'transparent',
    padding: '20px',
    height: '100%',
    display: 'flex',
    flexDirection: 'column'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px'
  },
  title: {
    margin: 0,
    fontSize: '18px',
    fontWeight: '700',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    color: '#3D4852',
    letterSpacing: '-0.02em'
  },
  refreshBtn: {
    padding: '10px 16px',
    border: 'none',
    borderRadius: '12px',
    backgroundColor: '#E0E5EC',
    color: '#5A6570',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
    transition: 'all 300ms ease-out',
    boxShadow: '4px 4px 8px rgb(163, 177, 198, 0.6), -4px -4px 8px rgba(255, 255, 255, 0.5)',
    minHeight: 'auto'
  },
  countBadge: {
    display: 'inline-block',
    padding: '8px 16px',
    backgroundColor: '#E0E5EC',
    color: '#6C63FF',
    borderRadius: '9999px',
    fontSize: '13px',
    fontWeight: '600',
    marginBottom: '16px',
    boxShadow: 'inset 4px 4px 8px rgb(163, 177, 198, 0.6), inset -4px -4px 8px rgba(255, 255, 255, 0.5)'
  },
  error: {
    padding: '14px 16px',
    backgroundColor: '#E0E5EC',
    color: '#E53E3E',
    borderRadius: '16px',
    fontSize: '13px',
    marginBottom: '16px',
    boxShadow: 'inset 5px 5px 10px rgb(163, 177, 198, 0.6), inset -5px -5px 10px rgba(255, 255, 255, 0.5)'
  },
  loading: {
    textAlign: 'center',
    padding: '24px',
    color: '#6B7280'
  },
  emptyState: {
    textAlign: 'center',
    padding: '40px 24px'
  },
  emptyIcon: {
    fontSize: '40px',
    display: 'block',
    marginBottom: '12px'
  },
  emptyText: {
    margin: 0,
    fontSize: '14px',
    color: '#6B7280'
  },
  orderList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    flex: 1,
    overflowY: 'auto',
    minHeight: 0
  },
  orderCard: {
    padding: '18px',
    borderRadius: '20px',
    backgroundColor: '#E0E5EC',
    boxShadow: '6px 6px 12px rgb(163, 177, 198, 0.6), -6px -6px 12px rgba(255, 255, 255, 0.5)'
  },
  orderHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '12px'
  },
  sideBadge: {
    padding: '6px 14px',
    borderRadius: '10px',
    color: '#fff',
    fontSize: '11px',
    fontWeight: '700',
    textTransform: 'uppercase',
    boxShadow: '2px 2px 4px rgb(163, 177, 198, 0.5)'
  },
  outcomeBadge: {
    padding: '6px 12px',
    borderRadius: '9999px',
    fontSize: '11px',
    fontWeight: '600',
    boxShadow: 'inset 2px 2px 4px rgb(163, 177, 198, 0.5), inset -2px -2px 4px rgba(255, 255, 255, 0.4)'
  },
  orderTime: {
    fontSize: '11px',
    color: '#6B7280',
    marginLeft: 'auto',
    fontWeight: '500'
  },
  clickHint: {
    fontSize: '11px',
    color: '#6C63FF',
    marginBottom: '10px',
    fontWeight: '500'
  },
  orderMarket: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#3D4852',
    marginBottom: '14px',
    lineHeight: '1.5'
  },
  orderDetails: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '10px',
    marginBottom: '14px',
    padding: '14px',
    backgroundColor: '#E0E5EC',
    borderRadius: '16px',
    boxShadow: 'inset 5px 5px 10px rgb(163, 177, 198, 0.6), inset -5px -5px 10px rgba(255, 255, 255, 0.5)'
  },
  detailRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '13px'
  },
  detailLabel: {
    color: '#6B7280'
  },
  detailValue: {
    color: '#3D4852',
    fontWeight: '600',
    fontFamily: "'JetBrains Mono', monospace"
  },
  orderHash: {
    fontSize: '11px',
    color: '#6B7280',
    fontFamily: "'JetBrains Mono', monospace",
    marginBottom: '14px'
  },
  orderActions: {
    display: 'flex',
    gap: '10px'
  },
  cancelBtn: {
    width: '100%',
    padding: '12px 16px',
    border: 'none',
    borderRadius: '12px',
    backgroundColor: '#E0E5EC',
    color: '#E53E3E',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 300ms ease-out',
    boxShadow: '4px 4px 8px rgb(163, 177, 198, 0.6), -4px -4px 8px rgba(255, 255, 255, 0.5)',
    minHeight: 'auto'
  }
};

export default Orders;
