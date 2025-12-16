'use client';

import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const OrderBook = ({ market, onPriceSelect, selectedOutcome = 'yes', onOutcomeChange }) => {
  const [orderBook, setOrderBook] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // 使用 prop 进行 outcome 切换，回退到本地处理
  const handleOutcomeChange = (outcome) => {
    if (onOutcomeChange) {
      onOutcomeChange(outcome);
    }
  };

  const scrollContainerRef = useRef(null);
  const spreadRef = useRef(null);
  const prevMarketIdRef = useRef(null);

  useEffect(() => {
    if (market?.id) {
      fetchOrderBook();
      const interval = setInterval(fetchOrderBook, 5000);
      return () => clearInterval(interval);
    }
  }, [market?.id]);

  // 当市场切换或首次加载数据时，滚动到spread居中
  useEffect(() => {
    const isMarketChanged = prevMarketIdRef.current !== market?.id;

    if (orderBook && spreadRef.current && scrollContainerRef.current) {
      // 只在市场切换时自动滚动，避免每次数据更新都滚动
      if (isMarketChanged) {
        setTimeout(() => {
          if (spreadRef.current && scrollContainerRef.current) {
            spreadRef.current.scrollIntoView({
              behavior: 'smooth',
              block: 'center'
            });
          }
        }, 100);
      }
    }

    prevMarketIdRef.current = market?.id;
  }, [orderBook, market?.id]);

  const fetchOrderBook = async () => {
    if (!market?.id) return;

    setLoading(true);
    try {
      const response = await axios.get(`/api/orderbook/${market.id}`);
      if (response.data.success) {
        setOrderBook(response.data.data);
        setError(null);
      } else {
        setError('Failed to fetch orderbook');
      }
    } catch (err) {
      console.error('Error fetching orderbook:', err);
      setError(err.response?.data?.message || 'Failed to load orderbook');
    } finally {
      setLoading(false);
    }
  };

  const getDisplayData = () => {
    if (!orderBook) return { asks: [], bids: [] };

    let asks, bids;

    if (selectedOutcome === 'yes') {
      asks = [...(orderBook.asks || [])];
      bids = [...(orderBook.bids || [])];
    } else {
      asks = (orderBook.bids || []).map(([price, qty]) => [1 - price, qty]);
      bids = (orderBook.asks || []).map(([price, qty]) => [1 - price, qty]);
    }

    // asks按价格从高到低排序（最低卖价在底部靠近spread）
    // bids按价格从高到低排序（最高买价在顶部靠近spread）
    asks.sort((a, b) => b[0] - a[0]);
    bids.sort((a, b) => b[0] - a[0]);

    return { asks, bids };
  };

  const displayData = getDisplayData();

  if (!market) {
    return (
      <div style={styles.container}>
        <div style={styles.placeholder}>
          Select a market to view orderbook
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>Order Book</h3>
        <div style={styles.outcomeToggle}>
          <button
            onClick={() => handleOutcomeChange('yes')}
            style={{
              ...styles.toggleBtn,
              ...(selectedOutcome === 'yes' ? styles.toggleBtnActive : {}),
              backgroundColor: selectedOutcome === 'yes' ? '#4caf50' : '#f5f5f5',
              color: selectedOutcome === 'yes' ? '#fff' : '#333'
            }}
          >
            Yes
          </button>
          <button
            onClick={() => handleOutcomeChange('no')}
            style={{
              ...styles.toggleBtn,
              ...(selectedOutcome === 'no' ? styles.toggleBtnActive : {}),
              backgroundColor: selectedOutcome === 'no' ? '#f44336' : '#f5f5f5',
              color: selectedOutcome === 'no' ? '#fff' : '#333'
            }}
          >
            No
          </button>
        </div>
      </div>

      <div style={styles.marketInfo}>
        <span style={styles.marketTitle}>{market.question || market.title}</span>
      </div>

      {loading && !orderBook && (
        <div style={styles.loading}>Loading orderbook...</div>
      )}

      {error && (
        <div style={styles.error}>
          {error}
          <button onClick={fetchOrderBook} style={styles.retryBtn}>Retry</button>
        </div>
      )}

      {orderBook && (
        <div ref={scrollContainerRef} style={styles.orderBookContent}>
          {/* 卖单 (Asks) */}
          <div style={styles.section}>
            <div style={styles.sectionHeader}>
              <span>Price</span>
              <span>Quantity</span>
              <span>Total</span>
            </div>
            <div style={styles.asksList}>
              {displayData.asks.slice(0, 8).map(([price, qty], idx) => {
                const total = (price * qty).toFixed(2);
                return (
                  <div
                    key={`ask-${idx}`}
                    style={styles.orderRow}
                    onClick={() => onPriceSelect && onPriceSelect(price.toFixed(3), 'sell')}
                  >
                    <span style={styles.askPrice}>${price.toFixed(3)}</span>
                    <span style={styles.qty}>{qty.toFixed(2)}</span>
                    <span style={styles.total}>${total}</span>
                    <div
                      style={{
                        ...styles.depthBar,
                        ...styles.askBar,
                        width: `${Math.min(qty / 1000, 100)}%`
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* 价差 */}
          <div ref={spreadRef} style={styles.spread}>
            <span>Spread: </span>
            {displayData.asks[0] && displayData.bids[0] && (
              <span style={styles.spreadValue}>
                ${(displayData.asks[0][0] - displayData.bids[0][0]).toFixed(3)}
                ({(((displayData.asks[0][0] - displayData.bids[0][0]) / displayData.asks[0][0]) * 100).toFixed(2)}%)
              </span>
            )}
          </div>

          {/* 买单 (Bids) */}
          <div style={styles.section}>
            <div style={styles.bidsList}>
              {displayData.bids.slice(0, 8).map(([price, qty], idx) => {
                const total = (price * qty).toFixed(2);
                return (
                  <div
                    key={`bid-${idx}`}
                    style={styles.orderRow}
                    onClick={() => onPriceSelect && onPriceSelect(price.toFixed(3), 'buy')}
                  >
                    <span style={styles.bidPrice}>${price.toFixed(3)}</span>
                    <span style={styles.qty}>{qty.toFixed(2)}</span>
                    <span style={styles.total}>${total}</span>
                    <div
                      style={{
                        ...styles.depthBar,
                        ...styles.bidBar,
                        width: `${Math.min(qty / 1000, 100)}%`
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {orderBook.updateTimestampMs && (
            <div style={styles.timestamp}>
              Last update: {new Date(orderBook.updateTimestampMs).toLocaleTimeString()}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const styles = {
  container: {
    backgroundColor: '#E0E5EC',
    borderRadius: '32px',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    maxHeight: '100%',
    overflow: 'hidden',
    boxShadow: '9px 9px 16px rgb(163, 177, 198, 0.6), -9px -9px 16px rgba(255, 255, 255, 0.5)'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
    flexShrink: 0
  },
  title: {
    margin: 0,
    fontSize: '18px',
    fontWeight: '700',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    color: '#3D4852',
    letterSpacing: '-0.02em'
  },
  outcomeToggle: {
    display: 'flex',
    gap: '4px',
    backgroundColor: '#E0E5EC',
    padding: '4px',
    borderRadius: '16px',
    boxShadow: 'inset 4px 4px 8px rgb(163, 177, 198, 0.6), inset -4px -4px 8px rgba(255, 255, 255, 0.5)'
  },
  toggleBtn: {
    padding: '10px 18px',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '600',
    transition: 'all 300ms ease-out',
    backgroundColor: 'transparent',
    color: '#6B7280',
    boxShadow: 'none',
    minHeight: 'auto'
  },
  toggleBtnActive: {
    backgroundColor: '#6C63FF',
    color: '#fff',
    boxShadow: '4px 4px 8px rgb(163, 177, 198, 0.6), -4px -4px 8px rgba(255, 255, 255, 0.5)'
  },
  marketInfo: {
    padding: '14px 16px',
    backgroundColor: '#E0E5EC',
    borderRadius: '16px',
    marginBottom: '16px',
    flexShrink: 0,
    boxShadow: 'inset 5px 5px 10px rgb(163, 177, 198, 0.6), inset -5px -5px 10px rgba(255, 255, 255, 0.5)'
  },
  marketTitle: {
    fontSize: '13px',
    color: '#5A6570'
  },
  loading: {
    textAlign: 'center',
    padding: '24px',
    color: '#6B7280',
    flexShrink: 0
  },
  error: {
    textAlign: 'center',
    padding: '14px 16px',
    backgroundColor: '#E0E5EC',
    color: '#E53E3E',
    borderRadius: '16px',
    fontSize: '13px',
    flexShrink: 0,
    boxShadow: 'inset 5px 5px 10px rgb(163, 177, 198, 0.6), inset -5px -5px 10px rgba(255, 255, 255, 0.5)'
  },
  retryBtn: {
    marginLeft: '10px',
    padding: '8px 14px',
    border: 'none',
    backgroundColor: '#E0E5EC',
    color: '#E53E3E',
    borderRadius: '12px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '600',
    boxShadow: '4px 4px 8px rgb(163, 177, 198, 0.6), -4px -4px 8px rgba(255, 255, 255, 0.5)',
    minHeight: 'auto'
  },
  orderBookContent: {
    flex: 1,
    overflowY: 'auto',
    scrollBehavior: 'smooth',
    minHeight: 0
  },
  section: {
    marginBottom: '4px'
  },
  sectionHeader: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    padding: '10px 14px',
    fontSize: '11px',
    color: '#6B7280',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  asksList: {
    display: 'flex',
    flexDirection: 'column'
  },
  bidsList: {
    display: 'flex',
    flexDirection: 'column'
  },
  orderRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    padding: '10px 14px',
    fontSize: '13px',
    position: 'relative',
    cursor: 'pointer',
    transition: 'all 300ms ease-out',
    borderRadius: '12px',
    marginBottom: '2px'
  },
  askPrice: {
    color: '#E53E3E',
    fontWeight: '600',
    fontFamily: "'JetBrains Mono', monospace"
  },
  bidPrice: {
    color: '#38B2AC',
    fontWeight: '600',
    fontFamily: "'JetBrains Mono', monospace"
  },
  qty: {
    color: '#5A6570',
    textAlign: 'center',
    fontFamily: "'JetBrains Mono', monospace"
  },
  total: {
    color: '#6B7280',
    textAlign: 'right',
    fontFamily: "'JetBrains Mono', monospace"
  },
  depthBar: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    opacity: 0.15,
    zIndex: 0,
    borderRadius: '12px'
  },
  askBar: {
    right: 0,
    backgroundColor: '#E53E3E'
  },
  bidBar: {
    right: 0,
    backgroundColor: '#38B2AC'
  },
  spread: {
    textAlign: 'center',
    padding: '14px',
    backgroundColor: '#E0E5EC',
    fontSize: '13px',
    color: '#5A6570',
    borderRadius: '16px',
    margin: '10px 0',
    boxShadow: 'inset 5px 5px 10px rgb(163, 177, 198, 0.6), inset -5px -5px 10px rgba(255, 255, 255, 0.5)'
  },
  spreadValue: {
    fontWeight: '700',
    color: '#3D4852',
    fontFamily: "'JetBrains Mono', monospace"
  },
  timestamp: {
    textAlign: 'center',
    fontSize: '11px',
    color: '#6B7280',
    marginTop: '12px'
  },
  placeholder: {
    textAlign: 'center',
    padding: '48px 24px',
    color: '#6B7280'
  }
};

export default OrderBook;
