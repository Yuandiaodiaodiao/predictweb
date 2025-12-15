import React from 'react';

const MarketList = ({ markets, loading, onTrade, onSelect, selectedMarketId }) => {
    if (loading) {
        return (
            <div style={styles.container}>
                <div style={styles.header}>
                    <h2 style={styles.title}>🎯 预测市场</h2>
                </div>
                <div style={styles.loadingGrid}>
                    {[1, 2, 3, 4, 5, 6].map(i => (
                        <div key={i} style={styles.skeletonCard}>
                            <div style={styles.skeletonImage} className="skeleton" />
                            <div style={styles.skeletonText} className="skeleton" />
                            <div style={styles.skeletonTextShort} className="skeleton" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <h2 style={styles.title}>🎯 预测市场</h2>
                <span style={styles.count}>{markets.length} 个市场</span>
            </div>
            
            {markets.length === 0 ? (
                <div style={styles.emptyState}>
                    <span style={styles.emptyIcon}>📭</span>
                    <p style={styles.emptyTitle}>暂无市场</p>
                    <p style={styles.emptyText}>请检查后端是否运行及 API Key 配置</p>
                </div>
            ) : (
                <div style={styles.grid}>
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
                                    boxShadow: isSelected ? '0 0 20px rgba(88, 166, 255, 0.3)' : 'none'
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
                                        {isSelected && <div style={styles.selectedOverlay}>✓ 已选中</div>}
                                    </div>
                                )}
                                
                                {/* 标签 */}
                                <div style={styles.tags}>
                                    <span style={styles.categoryTag}>
                                        {market.category || market.categorySlug || 'General'}
                                    </span>
                                    {market.status && (
                                        <span style={{
                                            ...styles.statusTag,
                                            backgroundColor: market.status === 'OPEN' 
                                                ? 'rgba(63, 185, 80, 0.15)' 
                                                : 'rgba(210, 153, 34, 0.15)',
                                            color: market.status === 'OPEN' 
                                                ? 'var(--accent-green, #3fb950)' 
                                                : 'var(--accent-orange, #d29922)'
                                        }}>
                                            {market.status === 'OPEN' ? '🟢 开放' : market.status}
                                        </span>
                                    )}
                                </div>
                                
                                {/* 标题 */}
                                <h3 style={styles.cardTitle}>
                                    {market.question || market.title}
                                </h3>
                                
                                {/* 结果选项 */}
                                <div style={styles.outcomes}>
                                    {market.outcomes && market.outcomes.map((outcome, idx) => (
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
                                
                                {/* 按钮 */}
                                <div style={styles.actions}>
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (onSelect) {
                                                onSelect(market);
                                            }
                                        }}
                                        style={{
                                            ...styles.viewBtn,
                                            backgroundColor: isSelected
                                                ? 'var(--accent-blue, #58a6ff)'
                                                : 'var(--bg-tertiary, #21262d)',
                                            color: isSelected ? '#fff' : 'var(--text-secondary, #8b949e)'
                                        }}
                                    >
                                        {isSelected ? '✓ 查看中' : '📊 订单簿'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onTrade(market);
                                        }}
                                        style={styles.tradeBtn}
                                    >
                                        ⚡ 交易
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

const styles = {
    container: {
        padding: '0'
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px'
    },
    title: {
        margin: 0,
        fontSize: '20px',
        fontWeight: '700',
        color: 'var(--text-primary, #f0f6fc)'
    },
    count: {
        fontSize: '14px',
        color: 'var(--text-muted, #6e7681)',
        padding: '6px 14px',
        backgroundColor: 'var(--bg-tertiary, #21262d)',
        borderRadius: '20px'
    },
    loadingGrid: {
        display: 'grid',
        gap: '16px',
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))'
    },
    skeletonCard: {
        padding: '16px',
        backgroundColor: 'var(--bg-card, #1c2128)',
        borderRadius: '12px',
        border: '1px solid var(--border-color, #30363d)'
    },
    skeletonImage: {
        width: '100%',
        height: '120px',
        borderRadius: '8px',
        marginBottom: '12px'
    },
    skeletonText: {
        height: '20px',
        borderRadius: '4px',
        marginBottom: '8px'
    },
    skeletonTextShort: {
        height: '16px',
        width: '60%',
        borderRadius: '4px'
    },
    grid: {
        display: 'grid',
        gap: '16px',
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))'
    },
    card: {
        padding: '16px',
        backgroundColor: 'var(--bg-card, #1c2128)',
        borderRadius: '12px',
        border: '1px solid var(--border-color, #30363d)',
        cursor: 'pointer',
        transition: 'all 0.2s ease'
    },
    imageWrapper: {
        position: 'relative',
        marginBottom: '12px',
        borderRadius: '8px',
        overflow: 'hidden'
    },
    image: {
        width: '100%',
        height: '130px',
        objectFit: 'cover',
        display: 'block'
    },
    selectedOverlay: {
        position: 'absolute',
        top: '8px',
        right: '8px',
        padding: '4px 10px',
        backgroundColor: 'var(--accent-blue, #58a6ff)',
        color: '#fff',
        fontSize: '11px',
        fontWeight: '600',
        borderRadius: '6px'
    },
    tags: {
        display: 'flex',
        gap: '8px',
        marginBottom: '10px',
        flexWrap: 'wrap'
    },
    categoryTag: {
        fontSize: '11px',
        padding: '4px 10px',
        backgroundColor: 'rgba(88, 166, 255, 0.15)',
        color: 'var(--accent-blue, #58a6ff)',
        borderRadius: '6px',
        fontWeight: '500'
    },
    statusTag: {
        fontSize: '11px',
        padding: '4px 10px',
        borderRadius: '6px',
        fontWeight: '500'
    },
    cardTitle: {
        fontSize: '15px',
        fontWeight: '600',
        color: 'var(--text-primary, #f0f6fc)',
        margin: '0 0 12px 0',
        lineHeight: '1.4',
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden'
    },
    outcomes: {
        display: 'flex',
        gap: '8px',
        flexWrap: 'wrap',
        marginBottom: '14px'
    },
    outcomeTag: {
        fontSize: '12px',
        padding: '5px 12px',
        borderRadius: '20px',
        fontWeight: '500'
    },
    actions: {
        display: 'flex',
        gap: '8px'
    },
    viewBtn: {
        flex: 1,
        padding: '10px 12px',
        border: 'none',
        borderRadius: '8px',
        fontSize: '12px',
        fontWeight: '500',
        cursor: 'pointer',
        transition: 'all 0.2s'
    },
    tradeBtn: {
        flex: 1,
        padding: '10px 12px',
        background: 'linear-gradient(135deg, #3fb950 0%, #2ea043 100%)',
        color: '#fff',
        border: 'none',
        borderRadius: '8px',
        fontSize: '12px',
        fontWeight: '600',
        cursor: 'pointer',
        transition: 'all 0.2s'
    },
    emptyState: {
        textAlign: 'center',
        padding: '60px 20px',
        backgroundColor: 'var(--bg-card, #1c2128)',
        borderRadius: '12px',
        border: '1px solid var(--border-color, #30363d)'
    },
    emptyIcon: {
        fontSize: '48px',
        display: 'block',
        marginBottom: '16px'
    },
    emptyTitle: {
        fontSize: '18px',
        fontWeight: '600',
        color: 'var(--text-primary, #f0f6fc)',
        margin: '0 0 8px 0'
    },
    emptyText: {
        fontSize: '14px',
        color: 'var(--text-muted, #6e7681)',
        margin: 0
    }
};

export default MarketList;
