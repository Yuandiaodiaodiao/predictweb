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

            return (
              <div
                key={group.name}
                style={{
                  ...styles.groupCard,
                  borderColor: hasSelectedMarket ? 'var(--accent-blue, #58a6ff)' : 'var(--border-color, #30363d)'
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
                            backgroundColor: isSelected
                              ? 'rgba(88, 166, 255, 0.1)'
                              : 'transparent',
                            borderColor: isSelected
                              ? 'var(--accent-blue, #58a6ff)'
                              : 'var(--border-color, #30363d)'
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
                                ? 'var(--accent-blue, #58a6ff)'
                                : 'var(--accent-green, #3fb950)'
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
    marginBottom: '12px',
    flexShrink: 0
  },
  searchIcon: {
    position: 'absolute',
    left: '12px',
    top: '50%',
    transform: 'translateY(-50%)',
    fontSize: '14px',
    opacity: 0.6,
    pointerEvents: 'none'
  },
  searchInput: {
    width: '100%',
    padding: '10px 36px',
    backgroundColor: 'var(--bg-card, #1c2128)',
    border: '1px solid var(--border-color, #30363d)',
    borderRadius: '8px',
    color: 'var(--text-primary, #f0f6fc)',
    fontSize: '13px',
    outline: 'none',
    transition: 'border-color 0.2s',
    boxSizing: 'border-box'
  },
  clearBtn: {
    position: 'absolute',
    right: '10px',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    color: 'var(--text-muted, #6e7681)',
    fontSize: '12px',
    cursor: 'pointer',
    padding: '4px 8px',
    borderRadius: '4px'
  },
  searchInfo: {
    fontSize: '11px',
    color: 'var(--text-muted, #6e7681)',
    marginBottom: '8px',
    paddingLeft: '4px',
    flexShrink: 0
  },
  groupList: {
    flex: 1,
    overflow: 'auto',
    paddingRight: '4px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px'
  },
  groupCard: {
    backgroundColor: 'var(--bg-card, #1c2128)',
    borderRadius: '10px',
    border: '1px solid var(--border-color, #30363d)',
    overflow: 'hidden',
    transition: 'border-color 0.2s',
    minHeight: '60px',
    flexShrink: 0
  },
  groupHeader: {
    display: 'flex',
    alignItems: 'center',
    padding: '12px',
    cursor: 'pointer',
    gap: '10px',
    transition: 'background-color 0.2s'
  },
  groupImage: {
    width: '36px',
    height: '36px',
    borderRadius: '6px',
    objectFit: 'contain',
    backgroundColor: 'var(--bg-tertiary, #21262d)',
    flexShrink: 0
  },
  groupInfo: {
    flex: 1,
    minWidth: 0
  },
  groupName: {
    fontSize: '14px',
    fontWeight: '600',
    color: 'var(--text-primary, #f0f6fc)',
    marginBottom: '2px'
  },
  groupCount: {
    fontSize: '11px',
    color: 'var(--text-muted, #6e7681)'
  },
  expandIcon: {
    fontSize: '10px',
    color: 'var(--text-muted, #6e7681)',
    flexShrink: 0
  },
  marketItems: {
    borderTop: '1px solid var(--border-color, #30363d)',
    padding: '8px'
  },
  marketItem: {
    display: 'flex',
    alignItems: 'center',
    padding: '10px',
    borderRadius: '8px',
    border: '1px solid transparent',
    cursor: 'pointer',
    gap: '10px',
    marginBottom: '6px',
    transition: 'all 0.2s'
  },
  marketImage: {
    width: '40px',
    height: '40px',
    borderRadius: '6px',
    objectFit: 'contain',
    backgroundColor: 'var(--bg-tertiary, #21262d)',
    flexShrink: 0
  },
  marketContent: {
    flex: 1,
    minWidth: 0
  },
  marketTitle: {
    fontSize: '12px',
    fontWeight: '500',
    color: 'var(--text-primary, #f0f6fc)',
    marginBottom: '6px',
    lineHeight: '1.3',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap'
  },
  selectedTag: {
    fontSize: '9px',
    padding: '2px 6px',
    backgroundColor: 'var(--accent-blue, #58a6ff)',
    color: '#fff',
    borderRadius: '4px',
    fontWeight: '600',
    flexShrink: 0
  },
  outcomes: {
    display: 'flex',
    gap: '6px',
    flexWrap: 'wrap',
    alignItems: 'center'
  },
  outcomeTag: {
    fontSize: '10px',
    padding: '2px 8px',
    borderRadius: '10px',
    fontWeight: '500'
  },
  statusTag: {
    fontSize: '9px',
    padding: '2px 6px',
    backgroundColor: 'rgba(63, 185, 80, 0.15)',
    color: 'var(--accent-green, #3fb950)',
    borderRadius: '10px',
    fontWeight: '500'
  },
  tradeBtn: {
    width: '32px',
    height: '32px',
    borderRadius: '6px',
    border: 'none',
    color: '#fff',
    fontSize: '14px',
    cursor: 'pointer',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s'
  },
  skeletonCard: {
    padding: '14px',
    backgroundColor: 'var(--bg-card, #1c2128)',
    borderRadius: '10px',
    border: '1px solid var(--border-color, #30363d)'
  },
  skeletonHeader: {
    width: '40%',
    height: '16px',
    borderRadius: '4px',
    marginBottom: '8px',
    backgroundColor: 'var(--bg-tertiary, #21262d)'
  },
  skeletonText: {
    width: '60%',
    height: '12px',
    borderRadius: '4px',
    backgroundColor: 'var(--bg-tertiary, #21262d)'
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
  },
  noResults: {
    textAlign: 'center',
    padding: '30px 20px'
  },
  noResultsIcon: {
    fontSize: '28px',
    display: 'block',
    marginBottom: '10px',
    opacity: 0.6
  },
  noResultsText: {
    fontSize: '13px',
    color: 'var(--text-muted, #6e7681)',
    margin: 0
  }
};

export default MarketList;
