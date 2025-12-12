import React, { useState, useEffect } from 'react';
import axios from 'axios';

const Orders = ({ jwtToken, userAddress, onOrderCancelled, onViewMarket }) => {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [cancellingId, setCancellingId] = useState(null);

    useEffect(() => {
        if (jwtToken && userAddress) {
            fetchOrders();
            // 每 10 秒刷新一次
            const interval = setInterval(fetchOrders, 10000);
            return () => clearInterval(interval);
        }
    }, [jwtToken, userAddress]);

    const fetchOrders = async () => {
        if (!jwtToken) return;
        
        setLoading(true);
        setError('');
        
        try {
            const response = await axios.get('/api/orders', {
                headers: {
                    'Authorization': `Bearer ${jwtToken}`
                },
                params: {
                    status: 'OPEN' // 只获取未成交的订单
                }
            });
            
            if (response.data.success) {
                setOrders(response.data.data || []);
            } else {
                setError(response.data.error || '获取订单失败');
            }
        } catch (err) {
            console.error('Error fetching orders:', err);
            if (err.response?.status !== 401) {
                setError('获取订单失败');
            }
        } finally {
            setLoading(false);
        }
    };

    // 使用官方 API 取消订单: POST /v1/orders/remove
    // 参考文档: https://dev.predict.fun/api-25326904
    const cancelOrder = async (orderData) => {
        console.log('cancelOrder called with order:', orderData);
        
        if (!orderData) {
            alert('订单数据缺失，无法取消');
            return;
        }
        
        // 获取订单 ID (API 需要 id，不是 hash)
        const orderId = orderData.id || orderData.orderId;
        
        if (!orderId) {
            alert('订单 ID 缺失，无法取消');
            console.error('Order data missing id:', orderData);
            return;
        }
        
        if (!window.confirm(`确定要取消这个订单吗？\n\n订单 ID: ${orderId}`)) {
            return;
        }
        
        setCancellingId(orderId);
        
        try {
            console.log('Calling API to remove order:', orderId);
            
            // 调用后端 API: POST /api/orders/remove
            const response = await axios.post('/api/orders/remove', {
                ids: [orderId.toString()] // API 需要字符串数组
            }, {
                headers: {
                    'Authorization': `Bearer ${jwtToken}`
                }
            });
            
            console.log('Remove order response:', response.data);
            
            if (response.data.success) {
                alert('✅ 订单已取消！');
                fetchOrders(); // 刷新订单列表
                onOrderCancelled && onOrderCancelled();
            } else {
                alert('❌ 取消失败: ' + (response.data.error || response.data.message || '未知错误'));
            }
        } catch (err) {
            console.error('Error cancelling order:', err);
            const errorMsg = err.response?.data?.message || err.response?.data?.error || err.message;
            alert('❌ 取消订单失败\n\n' + errorMsg);
        } finally {
            setCancellingId(null);
        }
    };

    if (!jwtToken || !userAddress) {
        return (
            <div style={styles.container}>
                <div style={styles.header}>
                    <h3 style={styles.title}>我的挂单</h3>
                </div>
                <div style={styles.emptyState}>
                    <span style={styles.emptyIcon}>🔒</span>
                    <p style={styles.emptyText}>请连接钱包查看挂单</p>
                </div>
            </div>
        );
    }

    return (
        <div style={styles.container}>
            {/* 标题栏 */}
            <div style={styles.header}>
                <h3 style={styles.title}>我的挂单</h3>
                <button onClick={fetchOrders} style={styles.refreshBtn} disabled={loading}>
                    {loading ? '刷新中...' : '🔄'}
                </button>
            </div>

            {/* 订单数量 */}
            <div style={styles.countBadge}>
                {orders.length} 个活跃订单
            </div>

            {/* 错误提示 */}
            {error && (
                <div style={styles.error}>{error}</div>
            )}

            {/* 订单列表 */}
            {loading && orders.length === 0 ? (
                <div style={styles.loading}>加载中...</div>
            ) : orders.length === 0 ? (
                <div style={styles.emptyState}>
                    <span style={styles.emptyIcon}>📋</span>
                    <p style={styles.emptyText}>暂无挂单</p>
                </div>
            ) : (
                <div style={styles.orderList}>
                    {orders.map((order, index) => {
                        // 使用订单 ID 作为 key
                        const orderId = order?.id || order?.orderId || index;
                        return (
                            <OrderCard 
                                key={orderId} 
                                order={order}
                                onCancel={cancelOrder}
                                isCancelling={cancellingId === orderId}
                                onViewMarket={onViewMarket}
                            />
                        );
                    })}
                </div>
            )}
        </div>
    );
};

// 单个订单卡片
const OrderCard = ({ order: orderWrapper, onCancel, isCancelling, onViewMarket }) => {
    // 安全检查
    if (!orderWrapper) {
        return null;
    }
    
    // API 返回格式: { order: { hash, salt, maker, ... }, id, marketId, isNegRisk, amount, ... }
    // order 字段包含原始订单数据，外层包含元数据
    const rawOrder = orderWrapper.order || orderWrapper || {};
    
    // 获取订单哈希 - 优先从嵌套 order 对象获取
    const orderHash = rawOrder.hash || orderWrapper.id || '';
    
    // 获取 side - 从嵌套 order 对象获取
    const side = rawOrder.side ?? orderWrapper.side ?? 0;
    
    // 从 tokenId 推断 outcomeIndex (偶数=0/Yes, 奇数=1/No)
    const tokenId = rawOrder.tokenId || orderWrapper.tokenId || '';
    let outcomeIndex;
    if (tokenId) {
        try {
            outcomeIndex = BigInt(tokenId) % 2n === 0n ? 0 : 1;
        } catch (e) {
            outcomeIndex = 0; // 默认 Yes
        }
    }
    
    // 外层元数据
    const {
        marketId = '',
        market,
        outcome,
        marketTitle: wrapperMarketTitle,
        outcomeName: wrapperOutcomeName,
        status,
        amount: wrapperAmount,
        amountFilled,
        isNegRisk,
        createdAt
    } = orderWrapper || {};
    
    // 从嵌套 order 获取数量和价格
    const makerAmount = rawOrder.makerAmount;
    const takerAmount = rawOrder.takerAmount;

    // 判断买卖方向 - 检查多种可能的格式
    const isBuy = side === 0 || side === 'BUY' || side === 'buy' || side === 'Buy' || side === 'bid';
    const sideText = isBuy ? '买入' : '卖出';
    const sideColor = isBuy ? 'var(--accent-green, #3fb950)' : 'var(--accent-red, #f85149)';
    
    // Wei 转换函数 (10^18)
    const fromWei = (value) => {
        if (!value) return 0;
        const num = typeof value === 'string' ? parseFloat(value) : value;
        // 如果数值大于 10^15，认为是 Wei 单位
        if (num > 1e15) {
            return num / 1e18;
        }
        return num;
    };
    
    // 计算价格和数量
    // makerAmount: 支付的 USDT (Wei)
    // takerAmount: 获得的 token 数量 (Wei)
    // 价格 = makerAmount / takerAmount
    const makerAmountNum = fromWei(makerAmount);
    const takerAmountNum = fromWei(takerAmount);
    const wrapperAmountNum = fromWei(wrapperAmount);
    const filledAmountNum = fromWei(amountFilled);
    
    // 价格计算: 花费/数量
    let displayPrice = 0;
    if (makerAmountNum && takerAmountNum) {
        // side=0 (买入): makerAmount 是 USDT, takerAmount 是 token
        // side=1 (卖出): makerAmount 是 token, takerAmount 是 USDT
        if (side === 0) {
            displayPrice = makerAmountNum / takerAmountNum; // USDT per token
        } else {
            displayPrice = takerAmountNum / makerAmountNum; // USDT per token
        }
    }
    
    // 数量 - 对于买单是 takerAmount (想买的 token 数量)
    const displayAmount = (side === 0 ? takerAmountNum : makerAmountNum) || 0;
    const displayFilled = filledAmountNum || 0;
    const displayRemaining = wrapperAmountNum ? fromWei(wrapperAmount) - displayFilled : displayAmount;
    
    // 确保数值有效
    const safePrice = isNaN(displayPrice) ? 0 : displayPrice;
    const safeAmount = isNaN(displayAmount) ? 0 : displayAmount;
    const safeFilled = isNaN(displayFilled) ? 0 : displayFilled;
    
    // 市场标题 - 安全检查多种可能的字段
    const getMarketTitle = () => {
        if (market?.question) return market.question;
        if (market?.title) return market.title;
        if (wrapperMarketTitle) return wrapperMarketTitle;
        if (orderWrapper.marketQuestion) return orderWrapper.marketQuestion;
        if (marketId && typeof marketId === 'string' && marketId.length > 10) {
            return `市场 #${marketId.slice(0, 8)}...`;
        }
        if (marketId) return `市场 #${marketId}`;
        return '加载中...';
    };
    const marketTitle = getMarketTitle();
    
    // 结果名称 - 检查多种可能的字段
    const getOutcomeName = () => {
        if (outcome?.name) return outcome.name;
        if (wrapperOutcomeName) return wrapperOutcomeName;
        if (orderWrapper.outcome) return orderWrapper.outcome;
        // 从 market.outcomes 数组获取
        if (market?.outcomes && outcomeIndex !== undefined) {
            return market.outcomes[outcomeIndex] || (outcomeIndex === 0 ? 'Yes' : 'No');
        }
        if (outcomeIndex !== undefined) {
            return outcomeIndex === 0 ? 'Yes' : 'No';
        }
        // 尝试从 side 推断（买通常是 Yes）
        if (isBuy) return 'Yes (推测)';
        return 'No (推测)';
    };
    const outcomeName = getOutcomeName();
    
    // 跳转到市场
    const handleViewMarket = () => {
        const mktId = marketId || orderWrapper.marketId || market?.id;
        if (mktId && onViewMarket) {
            onViewMarket(mktId);
        } else if (mktId) {
            // 直接在新窗口打开 Predict.fun 市场页面
            window.open(`https://predict.fun/market/${mktId}`, '_blank');
        }
    };
    
    // 取消订单 - 传递完整订单数据（包含 order 嵌套对象）
    const handleCancel = () => {
        console.log('Cancelling order (wrapper):', orderWrapper);
        if (onCancel) {
            onCancel(orderWrapper); // 传递完整订单数据给 SDK
        } else {
            console.error('Cannot cancel: missing onCancel function');
            alert('无法取消：功能未就绪');
        }
    };
    
    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        return date.toLocaleString('zh-CN', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div style={styles.orderCard}>
            {/* 订单头部 */}
            <div style={styles.orderHeader}>
                <span style={{
                    ...styles.sideBadge,
                    backgroundColor: sideColor
                }}>
                    {sideText}
                </span>
                <span style={styles.orderTime}>{formatDate(createdAt)}</span>
            </div>

            {/* 市场信息 */}
            <div style={styles.orderMarket}>
                {marketTitle && marketTitle.length > 35 ? marketTitle.slice(0, 35) + '...' : (marketTitle || '-')}
            </div>

            {/* 订单详情 */}
            <div style={styles.orderDetails}>
                <div style={styles.detailRow}>
                    <span style={styles.detailLabel}>结果</span>
                    <span style={styles.detailValue}>{outcomeName || '-'}</span>
                </div>
                <div style={styles.detailRow}>
                    <span style={styles.detailLabel}>价格</span>
                    <span style={styles.detailValue}>${safePrice.toFixed(3)}</span>
                </div>
                <div style={styles.detailRow}>
                    <span style={styles.detailLabel}>数量</span>
                    <span style={styles.detailValue}>{safeAmount.toFixed(2)}</span>
                </div>
                {safeFilled > 0 && (
                    <div style={styles.detailRow}>
                        <span style={styles.detailLabel}>已成交</span>
                        <span style={styles.detailValue}>{safeFilled.toFixed(2)}</span>
                    </div>
                )}
            </div>

            {/* 订单哈希 */}
            <div style={styles.orderHash}>
                {orderHash && typeof orderHash === 'string' && orderHash.length > 18 
                    ? `${orderHash.slice(0, 10)}...${orderHash.slice(-8)}` 
                    : (orderHash || '无哈希')}
            </div>

            {/* 操作按钮 */}
            <div style={styles.orderActions}>
                {/* 查看市场按钮 */}
                {(marketId || orderWrapper.marketId || market?.id) && (
                    <button
                        onClick={handleViewMarket}
                        style={styles.viewMarketBtn}
                    >
                        🔗 查看市场
                    </button>
                )}
                
                {/* 取消按钮 */}
                <button
                    onClick={handleCancel}
                    disabled={isCancelling}
                    style={{
                        ...styles.cancelBtn,
                        opacity: isCancelling ? 0.6 : 1
                    }}
                >
                    {isCancelling ? '取消中...' : '❌ 取消订单'}
                </button>
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
        padding: '6px 10px',
        border: '1px solid var(--border-color, #30363d)',
        borderRadius: '6px',
        backgroundColor: 'var(--bg-tertiary, #21262d)',
        color: 'var(--text-secondary, #8b949e)',
        cursor: 'pointer',
        fontSize: '14px',
        transition: 'all 0.2s'
    },
    countBadge: {
        display: 'inline-block',
        padding: '4px 12px',
        backgroundColor: 'rgba(88, 166, 255, 0.15)',
        color: 'var(--accent-blue, #58a6ff)',
        borderRadius: '12px',
        fontSize: '12px',
        fontWeight: '500',
        marginBottom: '12px'
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
    orderList: {
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        maxHeight: '400px',
        overflowY: 'auto'
    },
    orderCard: {
        padding: '14px',
        border: '1px solid var(--border-color, #30363d)',
        borderRadius: '10px',
        backgroundColor: 'var(--bg-tertiary, #21262d)'
    },
    orderHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '10px'
    },
    sideBadge: {
        padding: '4px 12px',
        borderRadius: '6px',
        color: '#fff',
        fontSize: '11px',
        fontWeight: '600',
        textTransform: 'uppercase'
    },
    orderTime: {
        fontSize: '11px',
        color: 'var(--text-muted, #6e7681)'
    },
    orderMarket: {
        fontSize: '13px',
        fontWeight: '500',
        color: 'var(--text-primary, #f0f6fc)',
        marginBottom: '12px',
        lineHeight: '1.4'
    },
    orderDetails: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '8px',
        marginBottom: '12px',
        padding: '10px',
        backgroundColor: 'var(--bg-secondary, #161b22)',
        borderRadius: '8px'
    },
    detailRow: {
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: '12px'
    },
    detailLabel: {
        color: 'var(--text-muted, #6e7681)'
    },
    detailValue: {
        color: 'var(--text-primary, #f0f6fc)',
        fontWeight: '500',
        fontFamily: 'var(--font-mono, monospace)'
    },
    orderHash: {
        fontSize: '10px',
        color: 'var(--text-muted, #6e7681)',
        fontFamily: 'var(--font-mono, monospace)',
        marginBottom: '12px'
    },
    orderActions: {
        display: 'flex',
        gap: '8px'
    },
    viewMarketBtn: {
        flex: 1,
        padding: '10px',
        border: '1px solid var(--accent-blue, #58a6ff)',
        borderRadius: '8px',
        backgroundColor: 'transparent',
        color: 'var(--accent-blue, #58a6ff)',
        fontSize: '12px',
        fontWeight: '500',
        cursor: 'pointer',
        transition: 'all 0.2s'
    },
    cancelBtn: {
        flex: 1,
        padding: '10px',
        border: 'none',
        borderRadius: '8px',
        backgroundColor: 'var(--accent-red, #f85149)',
        color: '#fff',
        fontSize: '12px',
        fontWeight: '500',
        cursor: 'pointer',
        transition: 'all 0.2s'
    }
};

export default Orders;
