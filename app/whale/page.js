'use client';

import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import Link from 'next/link';

const API_BASE_URL = '/api';

export default function WhalePage() {
  const [markets, setMarkets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Fee 筛选状态
  const [feeMin, setFeeMin] = useState('');
  const [feeMax, setFeeMax] = useState('');

  useEffect(() => {
    fetchMarkets();
  }, []);

  const fetchMarkets = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`${API_BASE_URL}/markets`);
      if (response.data.success) {
        setMarkets(response.data.data || []);
      } else {
        setError(response.data.error || '获取市场数据失败');
      }
    } catch (err) {
      console.error('Error fetching markets:', err);
      setError(err.message || '获取市场数据失败');
    } finally {
      setLoading(false);
    }
  };

  // 筛选市场
  const filteredMarkets = useMemo(() => {
    let result = markets;

    // 搜索过滤
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(market => {
        const title = (market.question || market.title || '').toLowerCase();
        const category = (market.category || '').toLowerCase();
        return title.includes(query) || category.includes(query);
      });
    }

    // Fee 过滤
    const minFee = feeMin === '' ? 0 : parseFloat(feeMin) * 100;
    const maxFee = feeMax === '' ? Infinity : parseFloat(feeMax) * 100;

    if (!isNaN(minFee) || !isNaN(maxFee)) {
      result = result.filter(market => {
        const fee = market.feeRateBps || 0;
        const min = isNaN(minFee) ? 0 : minFee;
        const max = isNaN(maxFee) ? Infinity : maxFee;
        return fee >= min && fee <= max;
      });
    }

    // 按 fee 从低到高排序
    return result.sort((a, b) => (a.feeRateBps || 0) - (b.feeRateBps || 0));
  }, [markets, searchQuery, feeMin, feeMax]);

  return (
    <div style={styles.app}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <Link href="/" style={styles.backLink}>
            ← 返回
          </Link>
          <h1 style={styles.logo}>Whale 市场筛选</h1>
        </div>
        <div style={styles.headerRight}>
          <span style={styles.marketCount}>{filteredMarkets.length} / {markets.length} 个市场</span>
        </div>
      </header>

      {/* Main Content */}
      <div style={styles.mainContent}>
        {/* Filters Panel */}
        <div style={styles.filtersPanel}>
          <div style={styles.filterCard}>
            <h3 style={styles.filterTitle}>Fee 费率筛选</h3>

            {/* Fee 范围输入 */}
            <div style={styles.feeRange}>
              <div style={styles.rangeInputs}>
                <div style={styles.inputGroup}>
                  <label style={styles.inputLabel}>最小 Fee</label>
                  <div style={styles.inputWrapper}>
                    <input
                      type="number"
                      placeholder="0"
                      value={feeMin}
                      onChange={(e) => setFeeMin(e.target.value)}
                      style={styles.rangeInput}
                      min="0"
                      step="0.1"
                    />
                    <span style={styles.inputUnit}>%</span>
                  </div>
                </div>
                <span style={styles.rangeSeparator}>~</span>
                <div style={styles.inputGroup}>
                  <label style={styles.inputLabel}>最大 Fee</label>
                  <div style={styles.inputWrapper}>
                    <input
                      type="number"
                      placeholder="不限"
                      value={feeMax}
                      onChange={(e) => setFeeMax(e.target.value)}
                      style={styles.rangeInput}
                      min="0"
                      step="0.1"
                    />
                    <span style={styles.inputUnit}>%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 搜索框 */}
            <div style={styles.searchWrapper}>
              <div style={styles.searchIcon}>🔍</div>
              <input
                type="text"
                placeholder="搜索市场..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={styles.searchInput}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  style={styles.clearBtn}
                  type="button"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Markets List */}
        <div style={styles.marketsPanel}>
          {error && (
            <div style={styles.errorBanner}>
              {error}
              <button onClick={fetchMarkets} style={styles.retryBtn}>重试</button>
            </div>
          )}

          {loading ? (
            <div style={styles.loading}>
              <div style={styles.loadingSpinner}></div>
              <p>加载中...</p>
            </div>
          ) : filteredMarkets.length === 0 ? (
            <div style={styles.emptyState}>
              <span style={styles.emptyIcon}>🐋</span>
              <p style={styles.emptyTitle}>未找到符合条件的市场</p>
              <p style={styles.emptyText}>请调整筛选条件</p>
            </div>
          ) : (
            <div style={styles.marketList}>
              {filteredMarkets.map((market) => (
                <MarketCard key={market.id || market.conditionId} market={market} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const MarketCard = ({ market }) => {
  const feePercent = (market.feeRateBps || 0) / 100;

  // 根据 fee 确定颜色
  const getFeeColor = (fee) => {
    if (fee === 0) return 'var(--quaternary, #34D399)';
    if (fee <= 100) return 'var(--accent-blue, #60A5FA)';
    if (fee <= 200) return 'var(--tertiary, #FBBF24)';
    return 'var(--accent-red, #F87171)';
  };

  const feeColor = getFeeColor(market.feeRateBps || 0);

  return (
    <div style={styles.marketCard}>
      <div style={styles.marketHeader}>
        {market.imageUrl && (
          <img src={market.imageUrl} alt="" style={styles.marketImage} />
        )}
        <div style={styles.marketInfo}>
          <div style={styles.marketTitle}>
            {market.question || market.title}
          </div>
          <div style={styles.marketMeta}>
            <span style={styles.categoryTag}>{market.category || 'General'}</span>
            {market.status === 'OPEN' && (
              <span style={styles.statusTag}>开放</span>
            )}
          </div>
        </div>
        <div style={{
          ...styles.feeBadge,
          backgroundColor: feeColor
        }}>
          <span style={styles.feeValue}>{feePercent.toFixed(2)}%</span>
          <span style={styles.feeLabel}>Fee</span>
        </div>
      </div>

      <div style={styles.marketOutcomes}>
        {market.outcomes && market.outcomes.slice(0, 4).map((outcome, idx) => (
          <span
            key={idx}
            style={{
              ...styles.outcomeTag,
              backgroundColor: idx === 0
                ? 'rgba(52, 211, 153, 0.15)'
                : idx === 1
                ? 'rgba(248, 113, 113, 0.15)'
                : 'rgba(139, 92, 246, 0.15)',
              color: idx === 0
                ? 'var(--quaternary, #34D399)'
                : idx === 1
                ? 'var(--accent-red, #F87171)'
                : 'var(--accent, #8B5CF6)'
            }}
          >
            {outcome}
          </span>
        ))}
        {market.outcomes && market.outcomes.length > 4 && (
          <span style={styles.moreOutcomes}>+{market.outcomes.length - 4}</span>
        )}
      </div>

      <div style={styles.marketActions}>
        <a
          href={`https://predict.fun/market/${market.id}`}
          target="_blank"
          rel="noopener noreferrer"
          style={styles.viewBtn}
        >
          查看详情 →
        </a>
      </div>
    </div>
  );
};

const styles = {
  app: {
    minHeight: '100vh',
    backgroundColor: 'var(--background, #FFFDF5)',
    display: 'flex',
    flexDirection: 'column'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 24px',
    backgroundColor: 'var(--card, #FFFFFF)',
    borderBottom: '2px solid var(--foreground, #1E293B)',
    zIndex: 100,
    flexShrink: 0,
    boxShadow: '0 4px 0 0 var(--border, #E2E8F0)'
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px'
  },
  backLink: {
    fontSize: '14px',
    fontWeight: '600',
    color: 'var(--foreground, #1E293B)',
    textDecoration: 'none',
    padding: '8px 16px',
    backgroundColor: 'var(--muted, #F1F5F9)',
    borderRadius: '9999px',
    border: '2px solid var(--foreground, #1E293B)',
    boxShadow: '2px 2px 0 0 var(--foreground, #1E293B)',
    transition: 'all 0.2s'
  },
  logo: {
    margin: 0,
    fontSize: '22px',
    fontWeight: '800',
    fontFamily: 'var(--font-heading, Outfit)',
    color: 'var(--accent, #8B5CF6)',
    letterSpacing: '-0.02em',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  marketCount: {
    fontSize: '13px',
    fontWeight: '700',
    color: 'var(--foreground, #1E293B)',
    padding: '8px 16px',
    backgroundColor: 'var(--tertiary, #FBBF24)',
    borderRadius: '9999px',
    border: '2px solid var(--foreground, #1E293B)',
    boxShadow: '3px 3px 0 0 var(--foreground, #1E293B)'
  },
  mainContent: {
    display: 'flex',
    flex: 1,
    padding: '20px 24px',
    gap: '20px',
    minHeight: 0,
    overflow: 'hidden'
  },
  filtersPanel: {
    width: '320px',
    flexShrink: 0
  },
  filterCard: {
    backgroundColor: 'var(--card, #FFFFFF)',
    borderRadius: '20px',
    border: '2px solid var(--foreground, #1E293B)',
    padding: '20px',
    boxShadow: '6px 6px 0 0 var(--secondary, #F472B6)'
  },
  filterTitle: {
    margin: '0 0 16px 0',
    fontSize: '16px',
    fontWeight: '700',
    fontFamily: 'var(--font-heading, Outfit)',
    color: 'var(--foreground, #1E293B)',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  feeRange: {
    marginBottom: '20px'
  },
  rangeInputs: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: '12px'
  },
  inputGroup: {
    flex: 1
  },
  inputLabel: {
    display: 'block',
    fontSize: '11px',
    fontWeight: '700',
    color: 'var(--muted-foreground, #64748B)',
    marginBottom: '6px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  inputWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center'
  },
  rangeInput: {
    width: '100%',
    padding: '12px 36px 12px 14px',
    fontSize: '14px',
    fontWeight: '600',
    backgroundColor: 'var(--muted, #F1F5F9)',
    border: '2px solid var(--border, #E2E8F0)',
    borderRadius: '12px',
    outline: 'none',
    transition: 'all 0.2s',
    fontFamily: 'var(--font-mono, monospace)',
    boxSizing: 'border-box'
  },
  inputUnit: {
    position: 'absolute',
    right: '12px',
    fontSize: '13px',
    fontWeight: '700',
    color: 'var(--muted-foreground, #64748B)'
  },
  rangeSeparator: {
    fontSize: '18px',
    fontWeight: '700',
    color: 'var(--muted-foreground, #64748B)',
    paddingBottom: '10px'
  },
  searchWrapper: {
    position: 'relative'
  },
  searchIcon: {
    position: 'absolute',
    left: '14px',
    top: '50%',
    transform: 'translateY(-50%)',
    fontSize: '14px',
    pointerEvents: 'none'
  },
  searchInput: {
    width: '100%',
    padding: '12px 40px',
    backgroundColor: 'var(--muted, #F1F5F9)',
    border: '2px solid var(--border, #E2E8F0)',
    borderRadius: '12px',
    color: 'var(--foreground, #1E293B)',
    fontSize: '14px',
    fontWeight: '500',
    outline: 'none',
    transition: 'all 0.2s',
    boxSizing: 'border-box'
  },
  clearBtn: {
    position: 'absolute',
    right: '12px',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'var(--accent-red, #F87171)',
    border: '2px solid var(--foreground, #1E293B)',
    color: 'white',
    fontSize: '11px',
    fontWeight: '700',
    cursor: 'pointer',
    padding: '4px 8px',
    borderRadius: '9999px',
    boxShadow: '1px 1px 0 0 var(--foreground, #1E293B)'
  },
  marketsPanel: {
    flex: 1,
    overflow: 'auto',
    minHeight: 0
  },
  errorBanner: {
    padding: '12px 16px',
    backgroundColor: 'var(--accent-red, #F87171)',
    color: 'white',
    borderRadius: '16px',
    marginBottom: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    fontSize: '13px',
    fontWeight: '600',
    border: '2px solid var(--foreground, #1E293B)',
    boxShadow: '4px 4px 0 0 var(--foreground, #1E293B)'
  },
  retryBtn: {
    padding: '8px 16px',
    border: '2px solid var(--foreground, #1E293B)',
    backgroundColor: 'white',
    color: 'var(--foreground, #1E293B)',
    borderRadius: '9999px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '700',
    boxShadow: '2px 2px 0 0 var(--foreground, #1E293B)'
  },
  loading: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 24px',
    color: 'var(--muted-foreground, #64748B)'
  },
  loadingSpinner: {
    width: '40px',
    height: '40px',
    border: '4px solid var(--muted, #F1F5F9)',
    borderTopColor: 'var(--accent, #8B5CF6)',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    marginBottom: '16px'
  },
  emptyState: {
    textAlign: 'center',
    padding: '60px 24px',
    backgroundColor: 'var(--card, #FFFFFF)',
    borderRadius: '24px',
    border: '2px solid var(--foreground, #1E293B)',
    boxShadow: '6px 6px 0 0 var(--border, #E2E8F0)'
  },
  emptyIcon: {
    fontSize: '64px',
    display: 'block',
    marginBottom: '16px'
  },
  emptyTitle: {
    fontSize: '20px',
    fontWeight: '700',
    fontFamily: 'var(--font-heading, Outfit)',
    color: 'var(--foreground, #1E293B)',
    margin: '0 0 8px 0'
  },
  emptyText: {
    fontSize: '14px',
    color: 'var(--muted-foreground, #64748B)',
    margin: 0
  },
  marketList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  marketCard: {
    backgroundColor: 'var(--card, #FFFFFF)',
    borderRadius: '20px',
    border: '2px solid var(--foreground, #1E293B)',
    padding: '16px',
    boxShadow: '4px 4px 0 0 var(--border, #E2E8F0)',
    transition: 'all 0.2s'
  },
  marketHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    marginBottom: '12px'
  },
  marketImage: {
    width: '48px',
    height: '48px',
    borderRadius: '12px',
    objectFit: 'cover',
    border: '2px solid var(--foreground, #1E293B)',
    flexShrink: 0
  },
  marketInfo: {
    flex: 1,
    minWidth: 0
  },
  marketTitle: {
    fontSize: '14px',
    fontWeight: '600',
    color: 'var(--foreground, #1E293B)',
    lineHeight: '1.4',
    marginBottom: '8px'
  },
  marketMeta: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap'
  },
  categoryTag: {
    fontSize: '11px',
    padding: '4px 10px',
    backgroundColor: 'var(--muted, #F1F5F9)',
    color: 'var(--muted-foreground, #64748B)',
    borderRadius: '9999px',
    fontWeight: '600',
    border: '2px solid var(--border, #E2E8F0)'
  },
  statusTag: {
    fontSize: '10px',
    padding: '4px 10px',
    backgroundColor: 'var(--quaternary, #34D399)',
    color: 'var(--foreground, #1E293B)',
    borderRadius: '9999px',
    fontWeight: '700',
    border: '2px solid var(--foreground, #1E293B)'
  },
  feeBadge: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '8px 14px',
    borderRadius: '12px',
    border: '2px solid var(--foreground, #1E293B)',
    boxShadow: '2px 2px 0 0 var(--foreground, #1E293B)',
    flexShrink: 0
  },
  feeValue: {
    fontSize: '16px',
    fontWeight: '800',
    color: 'var(--foreground, #1E293B)',
    fontFamily: 'var(--font-mono, monospace)'
  },
  feeLabel: {
    fontSize: '10px',
    fontWeight: '700',
    color: 'var(--foreground, #1E293B)',
    textTransform: 'uppercase',
    opacity: 0.7
  },
  marketOutcomes: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
    marginBottom: '12px'
  },
  outcomeTag: {
    fontSize: '11px',
    padding: '4px 10px',
    borderRadius: '9999px',
    fontWeight: '600',
    border: '2px solid var(--foreground, #1E293B)'
  },
  moreOutcomes: {
    fontSize: '11px',
    padding: '4px 10px',
    backgroundColor: 'var(--muted, #F1F5F9)',
    color: 'var(--muted-foreground, #64748B)',
    borderRadius: '9999px',
    fontWeight: '600'
  },
  marketActions: {
    display: 'flex',
    justifyContent: 'flex-end'
  },
  viewBtn: {
    fontSize: '12px',
    fontWeight: '700',
    color: 'var(--accent, #8B5CF6)',
    textDecoration: 'none',
    padding: '8px 16px',
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    borderRadius: '9999px',
    border: '2px solid var(--accent, #8B5CF6)',
    transition: 'all 0.2s'
  }
};
