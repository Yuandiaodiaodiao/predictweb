'use client';

import React from 'react';

const MarketList = ({ markets, loading, onTrade, onSelect, selectedMarketId }) => {
  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.flexGrid}>
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} style={styles.skeletonCard}>
              <div style={styles.skeletonImage} className="skeleton" />
              <div style={styles.skeletonText} className="skeleton" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (markets.length === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.emptyState}>
          <span style={styles.emptyIcon}>📭</span>
          <p style={styles.emptyTitle}>暂无市场</p>
          <p style={styles.emptyText}>请检查后端是否运行及 API Key 配置</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.flexGrid}>
        {markets.map((market) => {
          const isSelected = selectedMarketId === market.id;
          return (
            <div
              key={market.conditionId || market.id}
              data-market-card
              onClick={() => {
                if (onSelect) {
                  onSelect(market);
                }
              }}
              style={{
                ...styles.card,
                borderColor: isSelected ? 'var(--accent-blue, #58a6ff)' : 'var(--border-color, #30363d)',
                boxShadow: isSelected ? '0 0 12px rgba(88, 166, 255, 0.3)' : 'none'
              }}
            >
              {/* 市场图片 */}
              {market.imageUrl && (
                <div style={styles.imageWrapper}>
                  <img
                    src={market.imageUrl}
                    alt={market.title}
                    style={styles.image}
                  />
                  {isSelected && <div style={styles.selectedBadge}>选中</div>}
                </div>
              )}

              {/* 标签 */}
              <div style={styles.tags}>
                <span style={styles.categoryTag}>
                  {market.category || market.categorySlug || 'General'}
                </span>
                {market.status === 'OPEN' && (
                  <span style={styles.statusTag}>开放</span>
                )}
              </div>

              {/* 标题 */}
              <h3 style={styles.cardTitle}>
                {market.question || market.title}
              </h3>

              {/* 结果选项 */}
              <div style={styles.outcomes}>
                {market.outcomes && market.outcomes.slice(0, 2).map((outcome, idx) => (
                  <span
                    key={idx}
                    style={{
                      ...styles.outcomeTag,
                      backgroundColor: idx === 0
                        ? 'rgba(63, 185, 80, 0.15)'
                        : 'rgba(248, 81, 73, 0.15)',
                      color: idx === 0
                        ? 'var(--accent-green, #3fb950)'
                        : 'var(--accent-red, #f85149)'
                    }}
                  >
                    {outcome}
                  </span>
                ))}
              </div>

              {/* 快速交易按钮 */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onTrade(market);
                }}
                style={{
                  ...styles.tradeBtn,
                  backgroundColor: isSelected
                    ? 'var(--accent-blue, #58a6ff)'
                    : 'linear-gradient(135deg, #3fb950 0%, #2ea043 100%)'
                }}
              >
                {isSelected ? '已选中' : '交易'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const styles = {
  container: {
    flex: 1,
    overflow: 'auto',
    paddingRight: '4px',
    minHeight: 0
  },
  flexGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '12px',
    alignContent: 'flex-start'
  },
  skeletonCard: {
    width: 'calc(50% - 6px)',
    minWidth: '160px',
    padding: '12px',
    backgroundColor: 'var(--bg-card, #1c2128)',
    borderRadius: '10px',
    border: '1px solid var(--border-color, #30363d)'
  },
  skeletonImage: {
    width: '100%',
    height: '80px',
    borderRadius: '6px',
    marginBottom: '10px',
    backgroundColor: 'var(--bg-tertiary, #21262d)'
  },
  skeletonText: {
    height: '14px',
    borderRadius: '3px',
    backgroundColor: 'var(--bg-tertiary, #21262d)'
  },
  card: {
    width: 'calc(50% - 6px)',
    minWidth: '160px',
    padding: '12px',
    backgroundColor: 'var(--bg-card, #1c2128)',
    borderRadius: '10px',
    border: '1px solid var(--border-color, #30363d)',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    display: 'flex',
    flexDirection: 'column'
  },
  imageWrapper: {
    position: 'relative',
    marginBottom: '10px',
    borderRadius: '6px',
    overflow: 'hidden'
  },
  image: {
    width: '100%',
    height: '80px',
    objectFit: 'cover',
    display: 'block'
  },
  selectedBadge: {
    position: 'absolute',
    top: '6px',
    right: '6px',
    padding: '2px 8px',
    backgroundColor: 'var(--accent-blue, #58a6ff)',
    color: '#fff',
    fontSize: '10px',
    fontWeight: '600',
    borderRadius: '4px'
  },
  tags: {
    display: 'flex',
    gap: '6px',
    marginBottom: '8px',
    flexWrap: 'wrap'
  },
  categoryTag: {
    fontSize: '10px',
    padding: '3px 8px',
    backgroundColor: 'rgba(88, 166, 255, 0.15)',
    color: 'var(--accent-blue, #58a6ff)',
    borderRadius: '4px',
    fontWeight: '500'
  },
  statusTag: {
    fontSize: '10px',
    padding: '3px 8px',
    backgroundColor: 'rgba(63, 185, 80, 0.15)',
    color: 'var(--accent-green, #3fb950)',
    borderRadius: '4px',
    fontWeight: '500'
  },
  cardTitle: {
    fontSize: '13px',
    fontWeight: '600',
    color: 'var(--text-primary, #f0f6fc)',
    margin: '0 0 8px 0',
    lineHeight: '1.3',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
    flex: 1
  },
  outcomes: {
    display: 'flex',
    gap: '6px',
    flexWrap: 'wrap',
    marginBottom: '10px'
  },
  outcomeTag: {
    fontSize: '10px',
    padding: '3px 8px',
    borderRadius: '12px',
    fontWeight: '500'
  },
  tradeBtn: {
    width: '100%',
    padding: '8px 12px',
    background: 'linear-gradient(135deg, #3fb950 0%, #2ea043 100%)',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '11px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  emptyState: {
    textAlign: 'center',
    padding: '40px 20px',
    backgroundColor: 'var(--bg-card, #1c2128)',
    borderRadius: '10px',
    border: '1px solid var(--border-color, #30363d)'
  },
  emptyIcon: {
    fontSize: '36px',
    display: 'block',
    marginBottom: '12px'
  },
  emptyTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: 'var(--text-primary, #f0f6fc)',
    margin: '0 0 6px 0'
  },
  emptyText: {
    fontSize: '13px',
    color: 'var(--text-muted, #6e7681)',
    margin: 0
  }
};

export default MarketList;
