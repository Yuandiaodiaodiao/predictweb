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
                    backgroundColor: isSelected
                      ? 'rgba(88, 166, 255, 0.1)'
                      : 'var(--bg-card, #1c2128)',
                    borderColor: isSelected
                      ? 'var(--accent-blue, #58a6ff)'
                      : 'var(--border-color, #30363d)'
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
            }

            // Multiple markets - render with collapsible group
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
    marginBottom: '16px',
    flexShrink: 0
  },
  searchIcon: {
    position: 'absolute',
    left: '16px',
    top: '50%',
    transform: 'translateY(-50%)',
    fontSize: '16px',
    pointerEvents: 'none',
    zIndex: 1
  },
  searchInput: {
    width: '100%',
    padding: '14px 44px',
    backgroundColor: 'var(--card, #FFFFFF)',
    border: '2px solid var(--foreground, #1E293B)',
    borderRadius: '9999px',
    color: 'var(--foreground, #1E293B)',
    fontSize: '14px',
    fontWeight: '500',
    outline: 'none',
    transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
    boxSizing: 'border-box',
    boxShadow: '4px 4px 0 0 var(--foreground, #1E293B)'
  },
  clearBtn: {
    position: 'absolute',
    right: '14px',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'var(--accent-red, #F87171)',
    border: '2px solid var(--foreground, #1E293B)',
    color: 'white',
    fontSize: '12px',
    fontWeight: '700',
    cursor: 'pointer',
    padding: '4px 10px',
    borderRadius: '9999px',
    boxShadow: '2px 2px 0 0 var(--foreground, #1E293B)'
  },
  searchInfo: {
    fontSize: '12px',
    fontWeight: '600',
    color: 'var(--muted-foreground, #64748B)',
    marginBottom: '12px',
    paddingLeft: '8px',
    flexShrink: 0
  },
  groupList: {
    flex: 1,
    overflow: 'auto',
    paddingRight: '8px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  groupCard: {
    backgroundColor: 'var(--card, #FFFFFF)',
    borderRadius: '20px',
    border: '2px solid var(--foreground, #1E293B)',
    overflow: 'hidden',
    transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
    minHeight: '70px',
    flexShrink: 0,
    boxShadow: '4px 4px 0 0 var(--border, #E2E8F0)'
  },
  singleMarketCard: {
    display: 'flex',
    alignItems: 'center',
    padding: '14px 16px',
    backgroundColor: 'var(--card, #FFFFFF)',
    borderRadius: '20px',
    border: '2px solid var(--foreground, #1E293B)',
    cursor: 'pointer',
    gap: '12px',
    transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
    minHeight: '70px',
    flexShrink: 0,
    boxShadow: '4px 4px 0 0 var(--border, #E2E8F0)'
  },
  groupHeader: {
    display: 'flex',
    alignItems: 'center',
    padding: '14px 16px',
    cursor: 'pointer',
    gap: '12px',
    transition: 'background-color 0.2s'
  },
  groupImage: {
    width: '44px',
    height: '44px',
    borderRadius: '12px',
    objectFit: 'contain',
    backgroundColor: 'var(--muted, #F1F5F9)',
    border: '2px solid var(--foreground, #1E293B)',
    flexShrink: 0
  },
  groupInfo: {
    flex: 1,
    minWidth: 0
  },
  groupName: {
    fontSize: '15px',
    fontWeight: '700',
    fontFamily: 'var(--font-heading, Outfit)',
    color: 'var(--foreground, #1E293B)',
    marginBottom: '4px'
  },
  groupCount: {
    fontSize: '12px',
    fontWeight: '600',
    color: 'var(--muted-foreground, #64748B)'
  },
  expandIcon: {
    fontSize: '12px',
    color: 'var(--foreground, #1E293B)',
    fontWeight: '700',
    flexShrink: 0,
    width: '28px',
    height: '28px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'var(--tertiary, #FBBF24)',
    borderRadius: '50%',
    border: '2px solid var(--foreground, #1E293B)'
  },
  marketItems: {
    borderTop: '2px dashed var(--border, #E2E8F0)',
    padding: '12px'
  },
  marketItem: {
    display: 'flex',
    alignItems: 'center',
    padding: '12px',
    borderRadius: '16px',
    border: '2px solid transparent',
    cursor: 'pointer',
    gap: '12px',
    marginBottom: '8px',
    transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
    backgroundColor: 'var(--muted, #F1F5F9)'
  },
  marketImage: {
    width: '44px',
    height: '44px',
    borderRadius: '12px',
    objectFit: 'contain',
    backgroundColor: 'var(--card, #FFFFFF)',
    border: '2px solid var(--foreground, #1E293B)',
    flexShrink: 0
  },
  marketContent: {
    flex: 1,
    minWidth: 0
  },
  marketTitle: {
    fontSize: '13px',
    fontWeight: '600',
    color: 'var(--foreground, #1E293B)',
    marginBottom: '8px',
    lineHeight: '1.4',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap'
  },
  selectedTag: {
    fontSize: '10px',
    padding: '4px 10px',
    backgroundColor: 'var(--accent, #8B5CF6)',
    color: 'white',
    borderRadius: '9999px',
    fontWeight: '700',
    flexShrink: 0,
    border: '2px solid var(--foreground, #1E293B)',
    boxShadow: '2px 2px 0 0 var(--foreground, #1E293B)'
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
    fontWeight: '600',
    border: '2px solid var(--foreground, #1E293B)'
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
  tradeBtn: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    border: '2px solid var(--foreground, #1E293B)',
    color: 'white',
    fontSize: '16px',
    fontWeight: '700',
    cursor: 'pointer',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
    boxShadow: '3px 3px 0 0 var(--foreground, #1E293B)'
  },
  skeletonCard: {
    padding: '16px',
    backgroundColor: 'var(--card, #FFFFFF)',
    borderRadius: '20px',
    border: '2px solid var(--border, #E2E8F0)'
  },
  skeletonHeader: {
    width: '40%',
    height: '18px',
    borderRadius: '9999px',
    marginBottom: '10px',
    backgroundColor: 'var(--muted, #F1F5F9)'
  },
  skeletonText: {
    width: '60%',
    height: '14px',
    borderRadius: '9999px',
    backgroundColor: 'var(--muted, #F1F5F9)'
  },
  emptyState: {
    textAlign: 'center',
    padding: '48px 24px',
    backgroundColor: 'var(--card, #FFFFFF)',
    borderRadius: '24px',
    border: '2px solid var(--foreground, #1E293B)',
    boxShadow: '6px 6px 0 0 var(--secondary, #F472B6)'
  },
  emptyIcon: {
    fontSize: '48px',
    display: 'block',
    marginBottom: '16px'
  },
  emptyTitle: {
    fontSize: '18px',
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
  noResults: {
    textAlign: 'center',
    padding: '40px 24px'
  },
  noResultsIcon: {
    fontSize: '36px',
    display: 'block',
    marginBottom: '12px'
  },
  noResultsText: {
    fontSize: '14px',
    fontWeight: '600',
    color: 'var(--muted-foreground, #64748B)',
    margin: 0
  }
};

export default MarketList;
