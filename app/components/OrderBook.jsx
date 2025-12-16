'use client';

import React, { useState, useEffect } from 'react';
import axios from 'axios';

const OrderBook = ({ market, onPriceSelect }) => {
  const [orderBook, setOrderBook] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedOutcome, setSelectedOutcome] = useState('yes');

  useEffect(() => {
    if (market?.id) {
      fetchOrderBook();
      const interval = setInterval(fetchOrderBook, 5000);
      return () => clearInterval(interval);
    }
  }, [market?.id]);

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

    // 统一按价格从低到高排序
    asks.sort((a, b) => a[0] - b[0]);
    bids.sort((a, b) => a[0] - b[0]);

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
            onClick={() => setSelectedOutcome('yes')}
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
            onClick={() => setSelectedOutcome('no')}
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
        <div style={styles.orderBookContent}>
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
          <div style={styles.spread}>
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
  outcomeToggle: {
    display: 'flex',
    gap: '4px'
  },
  toggleBtn: {
    padding: '6px 12px',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '500',
    transition: 'all 0.2s',
    backgroundColor: 'var(--bg-tertiary, #21262d)',
    color: 'var(--text-secondary, #8b949e)'
  },
  toggleBtnActive: {
    backgroundColor: 'var(--accent-blue, #58a6ff)',
    color: '#fff'
  },
  marketInfo: {
    padding: '10px 12px',
    backgroundColor: 'var(--bg-tertiary, #21262d)',
    borderRadius: '8px',
    marginBottom: '12px'
  },
  marketTitle: {
    fontSize: '13px',
    color: 'var(--text-secondary, #8b949e)'
  },
  loading: {
    textAlign: 'center',
    padding: '20px',
    color: 'var(--text-muted, #6e7681)'
  },
  error: {
    textAlign: 'center',
    padding: '12px',
    backgroundColor: 'rgba(248, 81, 73, 0.1)',
    color: 'var(--accent-red, #f85149)',
    borderRadius: '8px',
    fontSize: '13px',
    border: '1px solid rgba(248, 81, 73, 0.3)'
  },
  retryBtn: {
    marginLeft: '8px',
    padding: '4px 8px',
    border: '1px solid var(--accent-red, #f85149)',
    backgroundColor: 'transparent',
    color: 'var(--accent-red, #f85149)',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px'
  },
  orderBookContent: {},
  section: {
    marginBottom: '4px'
  },
  sectionHeader: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    padding: '8px 10px',
    fontSize: '10px',
    color: 'var(--text-muted, #6e7681)',
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
    padding: '8px 10px',
    fontSize: '13px',
    position: 'relative',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
    borderRadius: '4px'
  },
  askPrice: {
    color: 'var(--accent-red, #f85149)',
    fontWeight: '600',
    fontFamily: 'var(--font-mono, monospace)'
  },
  bidPrice: {
    color: 'var(--accent-green, #3fb950)',
    fontWeight: '600',
    fontFamily: 'var(--font-mono, monospace)'
  },
  qty: {
    color: 'var(--text-secondary, #8b949e)',
    textAlign: 'center',
    fontFamily: 'var(--font-mono, monospace)'
  },
  total: {
    color: 'var(--text-muted, #6e7681)',
    textAlign: 'right',
    fontFamily: 'var(--font-mono, monospace)'
  },
  depthBar: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    opacity: 0.2,
    zIndex: 0,
    borderRadius: '4px'
  },
  askBar: {
    right: 0,
    backgroundColor: 'var(--accent-red, #f85149)'
  },
  bidBar: {
    right: 0,
    backgroundColor: 'var(--accent-green, #3fb950)'
  },
  spread: {
    textAlign: 'center',
    padding: '10px',
    backgroundColor: 'var(--bg-tertiary, #21262d)',
    fontSize: '12px',
    color: 'var(--text-secondary, #8b949e)',
    borderRadius: '6px',
    margin: '8px 0'
  },
  spreadValue: {
    fontWeight: '600',
    color: 'var(--text-primary, #f0f6fc)',
    fontFamily: 'var(--font-mono, monospace)'
  },
  timestamp: {
    textAlign: 'center',
    fontSize: '11px',
    color: 'var(--text-muted, #6e7681)',
    marginTop: '10px'
  },
  placeholder: {
    textAlign: 'center',
    padding: '40px 20px',
    color: 'var(--text-muted, #6e7681)'
  }
};

export default OrderBook;
