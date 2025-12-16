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
    backgroundColor: 'var(--card, #FFFFFF)',
    borderRadius: '20px',
    padding: '20px',
    border: '2px solid var(--foreground, #1E293B)',
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    maxHeight: '100%',
    overflow: 'hidden',
    boxShadow: '6px 6px 0 0 var(--border, #E2E8F0)'
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
    fontFamily: 'var(--font-heading, Outfit)',
    color: 'var(--foreground, #1E293B)'
  },
  outcomeToggle: {
    display: 'flex',
    gap: '6px',
    padding: '4px',
    backgroundColor: 'var(--muted, #F1F5F9)',
    borderRadius: '9999px',
    border: '2px solid var(--foreground, #1E293B)'
  },
  toggleBtn: {
    padding: '8px 16px',
    border: 'none',
    borderRadius: '9999px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '700',
    transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
    backgroundColor: 'transparent',
    color: 'var(--muted-foreground, #64748B)',
    boxShadow: 'none'
  },
  toggleBtnActive: {
    backgroundColor: 'var(--accent, #8B5CF6)',
    color: 'white',
    boxShadow: '2px 2px 0 0 var(--foreground, #1E293B)'
  },
  marketInfo: {
    padding: '12px 14px',
    backgroundColor: 'var(--muted, #F1F5F9)',
    borderRadius: '12px',
    marginBottom: '16px',
    flexShrink: 0,
    border: '2px solid var(--border, #E2E8F0)'
  },
  marketTitle: {
    fontSize: '13px',
    fontWeight: '500',
    color: 'var(--text-secondary, #475569)'
  },
  loading: {
    textAlign: 'center',
    padding: '24px',
    color: 'var(--muted-foreground, #64748B)',
    fontWeight: '600',
    flexShrink: 0
  },
  error: {
    textAlign: 'center',
    padding: '14px',
    backgroundColor: 'var(--accent-red, #F87171)',
    color: 'white',
    borderRadius: '12px',
    fontSize: '13px',
    fontWeight: '600',
    border: '2px solid var(--foreground, #1E293B)',
    boxShadow: '3px 3px 0 0 var(--foreground, #1E293B)',
    flexShrink: 0
  },
  retryBtn: {
    marginLeft: '10px',
    padding: '6px 12px',
    border: '2px solid var(--foreground, #1E293B)',
    backgroundColor: 'white',
    color: 'var(--foreground, #1E293B)',
    borderRadius: '9999px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '700',
    boxShadow: '2px 2px 0 0 var(--foreground, #1E293B)'
  },
  orderBookContent: {
    flex: 1,
    overflowY: 'auto',
    scrollBehavior: 'smooth',
    minHeight: 0
  },
  section: {
    marginBottom: '6px'
  },
  sectionHeader: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    padding: '10px 12px',
    fontSize: '10px',
    color: 'var(--foreground, #1E293B)',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    fontFamily: 'var(--font-heading, Outfit)',
    backgroundColor: 'var(--muted, #F1F5F9)',
    borderRadius: '10px',
    marginBottom: '6px'
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
    padding: '10px 12px',
    fontSize: '13px',
    position: 'relative',
    cursor: 'pointer',
    transition: 'all 0.2s',
    borderRadius: '8px',
    marginBottom: '2px'
  },
  askPrice: {
    color: 'var(--accent-red, #F87171)',
    fontWeight: '700',
    fontFamily: 'var(--font-mono, monospace)'
  },
  bidPrice: {
    color: 'var(--quaternary, #34D399)',
    fontWeight: '700',
    fontFamily: 'var(--font-mono, monospace)'
  },
  qty: {
    color: 'var(--text-secondary, #475569)',
    textAlign: 'center',
    fontFamily: 'var(--font-mono, monospace)',
    fontWeight: '600'
  },
  total: {
    color: 'var(--muted-foreground, #64748B)',
    textAlign: 'right',
    fontFamily: 'var(--font-mono, monospace)',
    fontWeight: '500'
  },
  depthBar: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    opacity: 0.25,
    zIndex: 0,
    borderRadius: '8px'
  },
  askBar: {
    right: 0,
    backgroundColor: 'var(--accent-red, #F87171)'
  },
  bidBar: {
    right: 0,
    backgroundColor: 'var(--quaternary, #34D399)'
  },
  spread: {
    textAlign: 'center',
    padding: '12px 14px',
    backgroundColor: 'var(--tertiary, #FBBF24)',
    fontSize: '13px',
    fontWeight: '700',
    color: 'var(--foreground, #1E293B)',
    borderRadius: '12px',
    margin: '10px 0',
    border: '2px solid var(--foreground, #1E293B)',
    boxShadow: '3px 3px 0 0 var(--foreground, #1E293B)'
  },
  spreadValue: {
    fontWeight: '700',
    color: 'var(--foreground, #1E293B)',
    fontFamily: 'var(--font-mono, monospace)'
  },
  timestamp: {
    textAlign: 'center',
    fontSize: '11px',
    fontWeight: '600',
    color: 'var(--muted-foreground, #64748B)',
    marginTop: '12px'
  },
  placeholder: {
    textAlign: 'center',
    padding: '48px 24px',
    color: 'var(--muted-foreground, #64748B)',
    fontWeight: '600',
    fontSize: '14px'
  }
};

export default OrderBook;
