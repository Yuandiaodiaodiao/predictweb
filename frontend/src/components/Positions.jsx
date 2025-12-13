import React, { useState, useEffect } from 'react';
import axios from 'axios';

// Wei 转换函数 (10^18) - 全局定义供所有组件使用
const fromWei = (value) => {
    if (!value) return 0;
    const num = typeof value === 'string' ? parseFloat(value) : value;
    // 如果数值大于 10^15，认为是 Wei 单位
    if (num > 1e15) {
        return num / 1e18;
    }
    return num;
};

const Positions = ({ jwtToken, userAddress, onSelectMarket }) => {
    const [positions, setPositions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showAll, setShowAll] = useState(false);

    useEffect(() => {
        if (jwtToken && userAddress) {
            fetchPositions();
            // 每 30 秒刷新一次
            const interval = setInterval(fetchPositions, 30000);
            return () => clearInterval(interval);
        }
    }, [jwtToken, userAddress]);

    const fetchPositions = async () => {
        if (!jwtToken) return;
        
        setLoading(true);
        setError('');
        
        try {
            const response = await axios.get('/api/positions', {
                headers: {
                    'Authorization': `Bearer ${jwtToken}`
                }
            });
            
            if (response.data.success) {
                setPositions(response.data.data || []);
            } else {
                setError(response.data.error || '获取持仓失败');
            }
        } catch (err) {
            console.error('Error fetching positions:', err);
            setError(err.response?.data?.message || '获取持仓失败');
        } finally {
            setLoading(false);
        }
    };

    // 计算总持仓价值
    const calculateTotalValue = () => {
        return positions.reduce((total, pos) => {
            const rawValue = parseFloat(pos.value || pos.currentValue || 0);
            return total + fromWei(rawValue);
        }, 0);
    };

    // 计算总盈亏
    const calculateTotalPnL = () => {
        return positions.reduce((total, pos) => {
            const rawPnl = parseFloat(pos.pnl || pos.unrealizedPnl || 0);
            return total + fromWei(rawPnl);
        }, 0);
    };

    if (!jwtToken || !userAddress) {
        return (
            <div style={styles.container}>
                <div style={styles.header}>
                    <h3 style={styles.title}>我的持仓</h3>
                </div>
                <div style={styles.emptyState}>
                    <span style={styles.emptyIcon}>🔒</span>
                    <p style={styles.emptyText}>请连接钱包查看持仓</p>
                </div>
            </div>
        );
    }

    const displayPositions = showAll ? positions : positions.slice(0, 5);
    const totalValue = calculateTotalValue();
    const totalPnL = calculateTotalPnL();

    return (
        <div style={styles.container}>
            {/* 标题栏 */}
            <div style={styles.header}>
                <h3 style={styles.title}>我的持仓</h3>
                <button onClick={fetchPositions} style={styles.refreshBtn} disabled={loading}>
                    {loading ? '刷新中...' : '🔄 刷新'}
                </button>
            </div>

            {/* 总览 */}
            <div style={styles.summary}>
                <div style={styles.summaryItem}>
                    <span style={styles.summaryLabel}>总持仓</span>
                    <span style={styles.summaryValue}>{positions.length} 个</span>
                </div>
                <div style={styles.summaryItem}>
                    <span style={styles.summaryLabel}>总价值</span>
                    <span style={styles.summaryValue}>${totalValue.toFixed(2)}</span>
                </div>
                <div style={styles.summaryItem}>
                    <span style={styles.summaryLabel}>总盈亏</span>
                    <span style={{
                        ...styles.summaryValue,
                        color: totalPnL >= 0 ? '#4caf50' : '#f44336'
                    }}>
                        {totalPnL >= 0 ? '+' : ''}{totalPnL.toFixed(2)}
                    </span>
                </div>
            </div>

            {/* 错误提示 */}
            {error && (
                <div style={styles.error}>{error}</div>
            )}

            {/* 持仓列表 */}
            {loading && positions.length === 0 ? (
                <div style={styles.loading}>加载中...</div>
            ) : positions.length === 0 ? (
                <div style={styles.emptyState}>
                    <span style={styles.emptyIcon}>📭</span>
                    <p style={styles.emptyText}>暂无持仓</p>
                </div>
            ) : (
                <>
                    <div style={styles.positionList}>
                        {displayPositions.map((position, index) => (
                            <PositionCard 
                                key={position.id || index} 
                                position={position}
                                onSelect={onSelectMarket}
                            />
                        ))}
                    </div>

                    {/* 显示更多 */}
                    {positions.length > 5 && (
                        <button 
                            onClick={() => setShowAll(!showAll)}
                            style={styles.showMoreBtn}
                        >
                            {showAll ? '收起' : `查看全部 (${positions.length})`}
                        </button>
                    )}
                </>
            )}
        </div>
    );
};

// 单个持仓卡片
const PositionCard = ({ position, onSelect }) => {
    // 安全检查
    if (!position) {
        return null;
    }
    
    const {
        market,
        outcome,
        shares,
        avgPrice,
        currentPrice,
        value,
        pnl,
        pnlPercent,
        marketId = '',
        tokenId,
        side
    } = position || {};

    // 使用 fromWei 转换可能是 Wei 格式的数值
    const rawShares = parseFloat(shares || position.amount || 0) || 0;
    const displayShares = fromWei(rawShares);
    
    const rawAvgPrice = parseFloat(avgPrice || position.averagePrice || 0) || 0;
    const displayAvgPrice = fromWei(rawAvgPrice);
    
    const rawCurrentPrice = parseFloat(currentPrice || position.price || 0) || 0;
    const displayCurrentPrice = fromWei(rawCurrentPrice);
    
    const rawValue = parseFloat(value || position.currentValue || 0) || 0;
    const displayValue = fromWei(rawValue) || (displayShares * displayCurrentPrice);
    
    const rawPnL = parseFloat(pnl || position.unrealizedPnl || 0) || 0;
    const displayPnL = fromWei(rawPnL);
    
    const displayPnLPercent = parseFloat(pnlPercent || 0) || 0;

    const marketTitle = market?.question || market?.title || position.marketTitle || (marketId ? `Market #${marketId}` : '未知市场');
    const outcomeName = outcome?.name || position.outcomeName || (side === 0 ? 'Yes' : 'No');

    return (
        <div 
            style={styles.positionCard}
            onClick={() => onSelect && onSelect({ id: marketId, ...market })}
        >
            {/* 市场标题 */}
            <div style={styles.positionHeader}>
                <span style={styles.positionMarket}>
                    {marketTitle && marketTitle.length > 40 ? marketTitle.slice(0, 40) + '...' : (marketTitle || '-')}
                </span>
                <span style={{
                    ...styles.positionOutcome,
                    backgroundColor: outcomeName === 'Yes' ? 'rgba(63, 185, 80, 0.15)' : 'rgba(248, 81, 73, 0.15)',
                    color: outcomeName === 'Yes' ? 'var(--accent-green, #3fb950)' : 'var(--accent-red, #f85149)'
                }}>
                    {outcomeName || '-'}
                </span>
            </div>

            {/* 持仓详情 */}
            <div style={styles.positionDetails}>
                <div style={styles.positionRow}>
                    <span style={styles.positionLabel}>数量</span>
                    <span style={styles.positionValue}>{displayShares.toFixed(2)} 份</span>
                </div>
                <div style={styles.positionRow}>
                    <span style={styles.positionLabel}>均价</span>
                    <span style={styles.positionValue}>${displayAvgPrice.toFixed(3)}</span>
                </div>
                <div style={styles.positionRow}>
                    <span style={styles.positionLabel}>现价</span>
                    <span style={styles.positionValue}>${displayCurrentPrice.toFixed(3)}</span>
                </div>
                <div style={styles.positionRow}>
                    <span style={styles.positionLabel}>价值</span>
                    <span style={styles.positionValue}>${displayValue.toFixed(2)}</span>
                </div>
            </div>

            {/* 盈亏 */}
            <div style={{
                ...styles.positionPnL,
                backgroundColor: displayPnL >= 0 ? 'rgba(63, 185, 80, 0.1)' : 'rgba(248, 81, 73, 0.1)'
            }}>
                <span style={styles.pnlLabel}>盈亏</span>
                <span style={{
                    ...styles.pnlValue,
                    color: displayPnL >= 0 ? 'var(--accent-green, #3fb950)' : 'var(--accent-red, #f85149)'
                }}>
                    {displayPnL >= 0 ? '+' : ''}{displayPnL.toFixed(2)} 
                    {displayPnLPercent !== 0 && ` (${displayPnLPercent >= 0 ? '+' : ''}${displayPnLPercent.toFixed(1)}%)`}
                </span>
            </div>
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
    refreshBtn: {
        padding: '6px 12px',
        border: '1px solid var(--border-color, #30363d)',
        borderRadius: '6px',
        backgroundColor: 'var(--bg-tertiary, #21262d)',
        cursor: 'pointer',
        fontSize: '12px',
        color: 'var(--text-secondary, #8b949e)',
        transition: 'all 0.2s'
    },
    summary: {
        display: 'flex',
        justifyContent: 'space-between',
        padding: '14px',
        backgroundColor: 'var(--bg-tertiary, #21262d)',
        borderRadius: '10px',
        marginBottom: '12px'
    },
    summaryItem: {
        textAlign: 'center'
    },
    summaryLabel: {
        display: 'block',
        fontSize: '11px',
        color: 'var(--text-muted, #6e7681)',
        marginBottom: '4px',
        textTransform: 'uppercase',
        letterSpacing: '0.5px'
    },
    summaryValue: {
        fontSize: '15px',
        fontWeight: '600',
        color: 'var(--text-primary, #f0f6fc)',
        fontFamily: 'var(--font-mono, monospace)'
    },
    error: {
        padding: '10px 12px',
        backgroundColor: 'rgba(248, 81, 73, 0.1)',
        color: 'var(--accent-red, #f85149)',
        borderRadius: '8px',
        fontSize: '13px',
        marginBottom: '12px',
        border: '1px solid rgba(248, 81, 73, 0.3)'
    },
    loading: {
        textAlign: 'center',
        padding: '20px',
        color: 'var(--text-muted, #6e7681)'
    },
    emptyState: {
        textAlign: 'center',
        padding: '30px 20px'
    },
    emptyIcon: {
        fontSize: '32px',
        display: 'block',
        marginBottom: '8px'
    },
    emptyText: {
        margin: 0,
        fontSize: '13px',
        color: 'var(--text-muted, #6e7681)'
    },
    positionList: {
        display: 'flex',
        flexDirection: 'column',
        gap: '10px'
    },
    positionCard: {
        padding: '14px',
        border: '1px solid var(--border-color, #30363d)',
        borderRadius: '10px',
        cursor: 'pointer',
        transition: 'all 0.2s',
        backgroundColor: 'var(--bg-tertiary, #21262d)'
    },
    positionHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '10px'
    },
    positionMarket: {
        fontSize: '13px',
        fontWeight: '500',
        color: 'var(--text-primary, #f0f6fc)',
        flex: 1,
        marginRight: '8px',
        lineHeight: '1.4'
    },
    positionOutcome: {
        padding: '4px 10px',
        borderRadius: '6px',
        fontSize: '11px',
        fontWeight: '600'
    },
    positionDetails: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '8px',
        marginBottom: '12px',
        padding: '10px',
        backgroundColor: 'var(--bg-secondary, #161b22)',
        borderRadius: '8px'
    },
    positionRow: {
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: '12px'
    },
    positionLabel: {
        color: 'var(--text-muted, #6e7681)'
    },
    positionValue: {
        color: 'var(--text-primary, #f0f6fc)',
        fontWeight: '500',
        fontFamily: 'var(--font-mono, monospace)'
    },
    positionPnL: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '10px 12px',
        borderRadius: '8px'
    },
    pnlLabel: {
        fontSize: '12px',
        color: 'var(--text-secondary, #8b949e)'
    },
    pnlValue: {
        fontSize: '14px',
        fontWeight: '600',
        fontFamily: 'var(--font-mono, monospace)'
    },
    showMoreBtn: {
        width: '100%',
        marginTop: '12px',
        padding: '10px',
        border: '1px solid var(--border-color, #30363d)',
        borderRadius: '8px',
        backgroundColor: 'var(--bg-tertiary, #21262d)',
        cursor: 'pointer',
        fontSize: '13px',
        color: 'var(--text-secondary, #8b949e)',
        transition: 'all 0.2s'
    }
};

export default Positions;

