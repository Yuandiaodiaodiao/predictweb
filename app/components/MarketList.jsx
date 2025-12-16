'use client';

import React, { useState, useMemo } from 'react';

const MarketList = ({ markets, loading, onTrade, onSelect, selectedMarketId }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedGroups, setExpandedGroups] = useState({});

  // Fuzzy search filter
  const filteredMarkets = useMemo(() => {
    if (!searchQuery.trim()) return markets;

    const query = searchQuery.toLowerCase().trim();
    return markets.filter(market => {
      const title = (market.question || market.title || '').toLowerCase();
      const category = (market.category || market.categorySlug || '').toLowerCase();
      const outcomes = (market.outcomes || []).join(' ').toLowerCase();

      // Simple fuzzy match - check if all query characters exist in order
      const fuzzyMatch = (text, q) => {
        let qIdx = 0;
        for (let i = 0; i < text.length && qIdx < q.length; i++) {
          if (text[i] === q[qIdx]) qIdx++;
        }
        return qIdx === q.length;
      };

      return title.includes(query) ||
             category.includes(query) ||
             outcomes.includes(query) ||
             fuzzyMatch(title, query);
    });
  }, [markets, searchQuery]);

  // Group markets by category
  const groupedMarkets = useMemo(() => {
    const groups = {};

    filteredMarkets.forEach(market => {
      const category = market.category || market.categorySlug || 'General';
      if (!groups[category]) {
        groups[category] = {
          name: category,
          markets: [],
          // Use first market's image as group image
          imageUrl: null
        };
      }
      groups[category].markets.push(market);
      // Set group image from first market that has one
      if (!groups[category].imageUrl && market.imageUrl) {
        groups[category].imageUrl = market.imageUrl;
      }
    });

    return Object.values(groups).sort((a, b) => b.markets.length - a.markets.length);
  }, [filteredMarkets]);

  // Initialize expanded state for groups with selected market
  useMemo(() => {
    if (selectedMarketId) {
      groupedMarkets.forEach(group => {
        const hasSelected = group.markets.some(m => m.id === selectedMarketId);
        if (hasSelected && !expandedGroups[group.name]) {
          setExpandedGroups(prev => ({ ...prev, [group.name]: true }));
        }
      });
    }
  }, [selectedMarketId, groupedMarkets]);

  const toggleGroup = (groupName) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupName]: !prev[groupName]
    }));
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.searchWrapper}>
          <div style={{ ...styles.searchInput, backgroundColor: 'var(--bg-tertiary, #21262d)' }} className="skeleton" />
        </div>
        <div style={styles.groupList}>
          {[1, 2, 3].map(i => (
            <div key={i} style={styles.skeletonCard}>
              <div style={styles.skeletonHeader} className="skeleton" />
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
      {/* Search Box */}
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

      {/* Search Results Info */}
      {searchQuery && (
        <div style={styles.searchInfo}>
          找到 {filteredMarkets.length} 个市场 ({groupedMarkets.length} 个分类)
        </div>
      )}

      {/* Grouped Market List */}
      <div style={styles.groupList}>
        {groupedMarkets.length === 0 ? (
          <div style={styles.noResults}>
            <span style={styles.noResultsIcon}>🔎</span>
            <p style={styles.noResultsText}>未找到匹配的市场</p>
          </div>
        ) : (
          groupedMarkets.map(group => {
            const isExpanded = expandedGroups[group.name];
            const hasSelectedMarket = group.markets.some(m => m.id === selectedMarketId);
            const isSingleMarket = group.markets.length === 1;

            // Single market - render directly without group wrapper
            if (isSingleMarket) {
              const market = group.markets[0];
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
                    ...styles.singleMarketCard,
                    boxShadow: isSelected
                      ? 'inset 6px 6px 12px rgb(163, 177, 198, 0.6), inset -6px -6px 12px rgba(255, 255, 255, 0.5)'
                      : '6px 6px 12px rgb(163, 177, 198, 0.6), -6px -6px 12px rgba(255, 255, 255, 0.5)'
                  }}
                >
                  {market.imageUrl && (
                    <img
                      src={market.imageUrl}
                      alt=""
                      style={styles.marketImage}
                    />
                  )}

                  <div style={styles.marketContent}>
                    <div style={styles.marketTitle}>
                      {market.question || market.title}
                      {isSelected && <span style={styles.selectedTag}>已选中</span>}
                    </div>

                    <div style={styles.outcomes}>
                      {market.outcomes && market.outcomes.slice(0, 2).map((outcome, idx) => (
                        <span
                          key={idx}
                          style={{
                            ...styles.outcomeTag,
                            backgroundColor: idx === 0
                              ? 'rgba(56, 178, 172, 0.15)'
                              : 'rgba(229, 62, 62, 0.15)',
                            color: idx === 0
                              ? '#38B2AC'
                              : '#E53E3E'
                          }}
                        >
                          {outcome}
                        </span>
                      ))}
                      {market.status === 'OPEN' && (
                        <span style={styles.statusTag}>开放</span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onTrade(market);
                    }}
                    style={{
                      ...styles.tradeBtn,
                      backgroundColor: isSelected
                        ? '#6C63FF'
                        : '#38B2AC'
                    }}
                  >
                    {isSelected ? '✓' : '→'}
                  </button>
                </div>
              );
            }

            // Multiple markets - render with collapsible group
            return (
              <div
                key={group.name}
                style={{
                  ...styles.groupCard,
                  boxShadow: hasSelectedMarket
                    ? 'inset 6px 6px 12px rgb(163, 177, 198, 0.6), inset -6px -6px 12px rgba(255, 255, 255, 0.5)'
                    : '6px 6px 12px rgb(163, 177, 198, 0.6), -6px -6px 12px rgba(255, 255, 255, 0.5)'
                }}
              >
                {/* Group Header */}
                <div
                  style={styles.groupHeader}
                  onClick={() => toggleGroup(group.name)}
                >
                  {group.imageUrl && (
                    <img src={group.imageUrl} alt="" style={styles.groupImage} />
                  )}
                  <div style={styles.groupInfo}>
                    <div style={styles.groupName}>{group.name}</div>
                    <div style={styles.groupCount}>{group.markets.length} 个市场</div>
                  </div>
                  <div style={styles.expandIcon}>
                    {isExpanded ? '▼' : '▶'}
                  </div>
                </div>

                {/* Market Items */}
                {isExpanded && (
                  <div style={styles.marketItems}>
                    {group.markets.map(market => {
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
                            ...styles.marketItem,
                            boxShadow: isSelected
                              ? 'inset 5px 5px 10px rgb(163, 177, 198, 0.6), inset -5px -5px 10px rgba(255, 255, 255, 0.5)'
                              : '4px 4px 8px rgb(163, 177, 198, 0.6), -4px -4px 8px rgba(255, 255, 255, 0.5)'
                          }}
                        >
                          {/* Market Image */}
                          {market.imageUrl && (
                            <img
                              src={market.imageUrl}
                              alt=""
                              style={styles.marketImage}
                            />
                          )}

                          <div style={styles.marketContent}>
                            {/* Title */}
                            <div style={styles.marketTitle}>
                              {market.question || market.title}
                              {isSelected && <span style={styles.selectedTag}>已选中</span>}
                            </div>

                            {/* Outcomes */}
                            <div style={styles.outcomes}>
                              {market.outcomes && market.outcomes.slice(0, 2).map((outcome, idx) => (
                                <span
                                  key={idx}
                                  style={{
                                    ...styles.outcomeTag,
                                    backgroundColor: idx === 0
                                      ? 'rgba(56, 178, 172, 0.15)'
                                      : 'rgba(229, 62, 62, 0.15)',
                                    color: idx === 0
                                      ? '#38B2AC'
                                      : '#E53E3E'
                                  }}
                                >
                                  {outcome}
                                </span>
                              ))}
                              {market.status === 'OPEN' && (
                                <span style={styles.statusTag}>开放</span>
                              )}
                            </div>
                          </div>

                          {/* Trade Button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onTrade(market);
                            }}
                            style={{
                              ...styles.tradeBtn,
                              backgroundColor: isSelected
                                ? '#6C63FF'
                                : '#38B2AC'
                            }}
                          >
                            {isSelected ? '✓' : '→'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

const styles = {
  container: {
    flex: 1,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0
  },
  searchWrapper: {
    position: 'relative',
    marginBottom: '16px',
    flexShrink: 0
  },
  searchIcon: {
    position: 'absolute',
    left: '16px',
    top: '50%',
    transform: 'translateY(-50%)',
    fontSize: '14px',
    opacity: 0.6,
    pointerEvents: 'none',
    color: '#6B7280'
  },
  searchInput: {
    width: '100%',
    padding: '14px 44px',
    backgroundColor: '#E0E5EC',
    border: 'none',
    borderRadius: '16px',
    color: '#3D4852',
    fontSize: '14px',
    outline: 'none',
    transition: 'all 300ms ease-out',
    boxSizing: 'border-box',
    boxShadow: 'inset 6px 6px 10px rgb(163, 177, 198, 0.6), inset -6px -6px 10px rgba(255, 255, 255, 0.5)'
  },
  clearBtn: {
    position: 'absolute',
    right: '12px',
    top: '50%',
    transform: 'translateY(-50%)',
    background: '#E0E5EC',
    border: 'none',
    color: '#6B7280',
    fontSize: '12px',
    cursor: 'pointer',
    padding: '6px 10px',
    borderRadius: '12px',
    boxShadow: '3px 3px 6px rgb(163, 177, 198, 0.6), -3px -3px 6px rgba(255, 255, 255, 0.5)',
    minHeight: 'auto'
  },
  searchInfo: {
    fontSize: '12px',
    color: '#6B7280',
    marginBottom: '12px',
    paddingLeft: '4px',
    flexShrink: 0,
    fontWeight: '500'
  },
  groupList: {
    flex: 1,
    overflow: 'auto',
    paddingRight: '4px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  groupCard: {
    backgroundColor: '#E0E5EC',
    borderRadius: '24px',
    overflow: 'hidden',
    transition: 'all 300ms ease-out',
    minHeight: '60px',
    flexShrink: 0,
    boxShadow: '6px 6px 12px rgb(163, 177, 198, 0.6), -6px -6px 12px rgba(255, 255, 255, 0.5)'
  },
  singleMarketCard: {
    display: 'flex',
    alignItems: 'center',
    padding: '16px',
    borderRadius: '24px',
    cursor: 'pointer',
    gap: '12px',
    transition: 'all 300ms ease-out',
    minHeight: '60px',
    flexShrink: 0,
    backgroundColor: '#E0E5EC',
    boxShadow: '6px 6px 12px rgb(163, 177, 198, 0.6), -6px -6px 12px rgba(255, 255, 255, 0.5)'
  },
  groupHeader: {
    display: 'flex',
    alignItems: 'center',
    padding: '16px',
    cursor: 'pointer',
    gap: '12px',
    transition: 'all 300ms ease-out'
  },
  groupImage: {
    width: '44px',
    height: '44px',
    borderRadius: '12px',
    objectFit: 'contain',
    backgroundColor: '#E0E5EC',
    flexShrink: 0,
    boxShadow: 'inset 4px 4px 8px rgb(163, 177, 198, 0.6), inset -4px -4px 8px rgba(255, 255, 255, 0.5)'
  },
  groupInfo: {
    flex: 1,
    minWidth: 0
  },
  groupName: {
    fontSize: '15px',
    fontWeight: '600',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    color: '#3D4852',
    marginBottom: '4px'
  },
  groupCount: {
    fontSize: '12px',
    color: '#6B7280',
    fontWeight: '500'
  },
  expandIcon: {
    fontSize: '10px',
    color: '#6B7280',
    flexShrink: 0,
    transition: 'transform 300ms ease-out'
  },
  marketItems: {
    padding: '12px',
    paddingTop: '4px'
  },
  marketItem: {
    display: 'flex',
    alignItems: 'center',
    padding: '14px',
    borderRadius: '16px',
    cursor: 'pointer',
    gap: '12px',
    marginBottom: '8px',
    transition: 'all 300ms ease-out',
    backgroundColor: '#E0E5EC'
  },
  marketImage: {
    width: '44px',
    height: '44px',
    borderRadius: '12px',
    objectFit: 'contain',
    backgroundColor: '#E0E5EC',
    flexShrink: 0,
    boxShadow: 'inset 4px 4px 8px rgb(163, 177, 198, 0.6), inset -4px -4px 8px rgba(255, 255, 255, 0.5)'
  },
  marketContent: {
    flex: 1,
    minWidth: 0
  },
  marketTitle: {
    fontSize: '13px',
    fontWeight: '500',
    color: '#3D4852',
    marginBottom: '8px',
    lineHeight: '1.4',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap'
  },
  selectedTag: {
    fontSize: '9px',
    padding: '4px 8px',
    backgroundColor: '#6C63FF',
    color: '#fff',
    borderRadius: '8px',
    fontWeight: '600',
    flexShrink: 0,
    boxShadow: '2px 2px 4px rgb(163, 177, 198, 0.6)'
  },
  outcomes: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
    alignItems: 'center'
  },
  outcomeTag: {
    fontSize: '11px',
    padding: '4px 10px',
    borderRadius: '9999px',
    fontWeight: '500',
    boxShadow: 'inset 2px 2px 4px rgb(163, 177, 198, 0.5), inset -2px -2px 4px rgba(255, 255, 255, 0.4)'
  },
  statusTag: {
    fontSize: '10px',
    padding: '4px 10px',
    backgroundColor: 'rgba(56, 178, 172, 0.15)',
    color: '#38B2AC',
    borderRadius: '9999px',
    fontWeight: '500',
    boxShadow: 'inset 2px 2px 4px rgb(163, 177, 198, 0.5), inset -2px -2px 4px rgba(255, 255, 255, 0.4)'
  },
  tradeBtn: {
    width: '40px',
    height: '40px',
    borderRadius: '12px',
    border: 'none',
    color: '#fff',
    fontSize: '16px',
    cursor: 'pointer',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 300ms ease-out',
    boxShadow: '4px 4px 8px rgb(163, 177, 198, 0.6), -4px -4px 8px rgba(255, 255, 255, 0.5)',
    minHeight: 'auto',
    padding: 0
  },
  skeletonCard: {
    padding: '20px',
    backgroundColor: '#E0E5EC',
    borderRadius: '24px',
    boxShadow: '6px 6px 12px rgb(163, 177, 198, 0.6), -6px -6px 12px rgba(255, 255, 255, 0.5)'
  },
  skeletonHeader: {
    width: '40%',
    height: '18px',
    borderRadius: '8px',
    marginBottom: '10px'
  },
  skeletonText: {
    width: '60%',
    height: '14px',
    borderRadius: '6px'
  },
  emptyState: {
    textAlign: 'center',
    padding: '48px 24px',
    backgroundColor: '#E0E5EC',
    borderRadius: '32px',
    boxShadow: 'inset 8px 8px 16px rgb(163, 177, 198, 0.6), inset -8px -8px 16px rgba(255, 255, 255, 0.5)'
  },
  emptyIcon: {
    fontSize: '40px',
    display: 'block',
    marginBottom: '16px'
  },
  emptyTitle: {
    fontSize: '18px',
    fontWeight: '700',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    color: '#3D4852',
    margin: '0 0 8px 0'
  },
  emptyText: {
    fontSize: '14px',
    color: '#6B7280',
    margin: 0
  },
  noResults: {
    textAlign: 'center',
    padding: '40px 24px'
  },
  noResultsIcon: {
    fontSize: '32px',
    display: 'block',
    marginBottom: '12px',
    opacity: 0.7
  },
  noResultsText: {
    fontSize: '14px',
    color: '#6B7280',
    margin: 0
  }
};

export default MarketList;
