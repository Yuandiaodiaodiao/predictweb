'use client';

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ethers } from 'ethers';
import { useToast } from './Toast';

let OrderBuilder, ChainId;
const loadSDK = async () => {
  if (OrderBuilder) return true;
  try {
    const sdk = await import('@predictdotfun/sdk');
    OrderBuilder = sdk.OrderBuilder;
    ChainId = sdk.ChainId;
    return true;
  } catch (err) {
    console.error('Failed to load SDK:', err);
    return false;
  }
};

const BSC_CHAIN_ID = 56;

const Positions = ({ jwtToken, userAddress, markets = [], onSelectMarket, signer }) => {
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [redeemingId, setRedeemingId] = useState(null);
  const [sdkLoaded, setSdkLoaded] = useState(false);

  const { showError, showSuccess } = useToast();

  useEffect(() => {
    loadSDK().then(success => setSdkLoaded(success));
  }, []);

  const handleRedeem = async (position, e) => {
    e.stopPropagation();

    if (!signer) {
      showError('请先连接钱包');
      return;
    }

    const positionId = position.id || position.tokenId;
    setRedeemingId(positionId);

    try {
      const sdkSuccess = await loadSDK();
      if (!sdkSuccess || !OrderBuilder) {
        showError('SDK 加载失败，请刷新页面重试');
        setRedeemingId(null);
        return;
      }

      const freshProvider = new ethers.BrowserProvider(window.ethereum);
      const freshSigner = await freshProvider.getSigner();

      const orderBuilder = await OrderBuilder.make(BSC_CHAIN_ID, freshSigner);

      const conditionId = position.conditionId ||
        position.market?.conditionId ||
        position.marketDetails?.conditionId;

      const indexSet = position.outcome?.indexSet ||
        position.indexSet ||
        1;

      const amount = position.amount ||
        position.shares ||
        position.balance ||
        position.size;

      const isNegRisk = position.isNegRisk ||
        position.market?.isNegRisk ||
        position.marketDetails?.negRisk ||
        false;

      const isYieldBearing = position.isYieldBearing !== undefined
        ? position.isYieldBearing
        : (position.marketDetails?.isYieldBearing !== undefined
          ? position.marketDetails.isYieldBearing
          : true);

      if (!conditionId) {
        showError('无法获取 conditionId，市场数据不完整');
        setRedeemingId(null);
        return;
      }

      if (!amount) {
        showError('无法获取赎回数量');
        setRedeemingId(null);
        return;
      }

      const redeemParams = {
        conditionId,
        indexSet: Number(indexSet),
        amount: amount.toString(),
        isNegRisk,
        isYieldBearing,
      };

      const result = await orderBuilder.redeemPositions(redeemParams);

      if (result.success) {
        showSuccess('赎回成功！');
        fetchPositions();
      } else {
        showError(`赎回失败: ${result.cause || '未知错误'}`);
      }
    } catch (err) {
      console.error('Redeem failed:', err);
      if (err.code === 'ACTION_REJECTED') {
        showError('用户取消了交易');
      } else if (err.message?.includes('result for condition not received yet')) {
        showError('赎回失败: 市场尚未结算。请等待比赛结束并结果上链后再试。');
      } else {
        showError(`赎回失败: ${err.message}`);
      }
    } finally {
      setRedeemingId(null);
    }
  };

  useEffect(() => {
    if (jwtToken && userAddress) {
      fetchPositions();
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
        const positionsData = response.data.data || [];

        const positionsWithDetails = await Promise.all(
          positionsData.map(async (pos) => {
            let updatedPos = { ...pos };
            const marketId = pos.marketId || pos.market?.id;

            if (marketId) {
              try {
                const marketResponse = await axios.get(`/api/markets/${marketId}`);
                if (marketResponse.data.success || marketResponse.data.data) {
                  const marketData = marketResponse.data.data || marketResponse.data;
                  const isResolved =
                    marketData.status === 'RESOLVED' ||
                    marketData.status === 'SETTLED' ||
                    marketData.status === 'CLOSED' ||
                    marketData.resolved === true ||
                    marketData.finalized === true;

                  updatedPos.marketDetails = marketData;
                  updatedPos.isResolved = isResolved;
                  updatedPos.conditionId = marketData.conditionId || pos.conditionId;
                  updatedPos.isNegRisk = marketData.isNegRisk || marketData.negRisk || false;
                }
              } catch (err) {
                console.log('Could not fetch market details:', marketId);
              }

              try {
                const obResponse = await axios.get(`/api/orderbook/${marketId}`);
                if (obResponse.data.success || obResponse.data.bids || obResponse.data.asks) {
                  const orderBook = obResponse.data.data || obResponse.data;
                  const bestBid = orderBook.bids?.[0]?.[0] || 0;
                  const bestAsk = orderBook.asks?.[0]?.[0] || 0;
                  const currentPrice = bestBid > 0 && bestAsk > 0
                    ? (bestBid + bestAsk) / 2
                    : (bestBid || bestAsk || 0);

                  updatedPos.fetchedPrice = currentPrice;
                }
              } catch (err) {
                console.log('Could not fetch orderbook for market:', marketId);
              }
            }

            return updatedPos;
          })
        );

        setPositions(positionsWithDetails);
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

  const fromWeiLocal = (value) => {
    if (!value) return 0;
    const str = value.toString();
    if (str.length > 10) {
      return parseFloat(str) / 1e18;
    }
    return parseFloat(str);
  };

  const calculateTotalValue = () => {
    return positions.reduce((total, pos) => {
      let value = fromWeiLocal(pos.value || pos.currentValue || 0);
      if (value === 0) {
        const shares = fromWeiLocal(pos.shares || pos.amount || 0);
        const price = pos.fetchedPrice || 0;
        value = shares * price;
      }
      return total + value;
    }, 0);
  };

  const calculateTotalPnL = () => {
    return positions.reduce((total, pos) => {
      const pnl = fromWeiLocal(pos.pnl || pos.unrealizedPnl || 0);
      return total + pnl;
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
      <div style={styles.header}>
        <h3 style={styles.title}>我的持仓</h3>
        <button onClick={fetchPositions} style={styles.refreshBtn} disabled={loading}>
          {loading ? '刷新中...' : '🔄 刷新'}
        </button>
      </div>

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
            color: totalPnL >= 0 ? '#38B2AC' : '#E53E3E'
          }}>
            {totalPnL >= 0 ? '+' : ''}{totalPnL.toFixed(2)}
          </span>
        </div>
      </div>

      {error && (
        <div style={styles.error}>{error}</div>
      )}

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
                markets={markets}
                onSelect={onSelectMarket}
                onRedeem={handleRedeem}
                isRedeeming={redeemingId === (position.id || position.tokenId)}
                canRedeem={signer && sdkLoaded}
              />
            ))}
          </div>

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

const fromWei = (value) => {
  if (!value) return 0;
  const str = value.toString();
  if (str.length > 10) {
    return parseFloat(str) / 1e18;
  }
  return parseFloat(str);
};

const PositionCard = ({ position, markets = [], onSelect, onRedeem, isRedeeming, canRedeem }) => {
  const {
    market,
    outcome,
    shares,
    currentPrice,
    value,
    pnl,
    pnlPercent,
    marketId,
    side
  } = position;

  // 从 markets 列表中联动查找市场信息
  const linkedMarket = markets.find(m => m.id === marketId || m.marketId === marketId) || market;

  const displayShares = fromWei(shares || position.amount || 0);
  const displayCurrentPrice = position.fetchedPrice || fromWei(currentPrice || position.price || 0);

  let displayValue = fromWei(value || position.currentValue || 0);
  if (displayValue === 0 && displayShares > 0 && displayCurrentPrice > 0) {
    displayValue = displayShares * displayCurrentPrice;
  }

  const displayPnL = fromWei(pnl || position.unrealizedPnl || 0);
  const displayPnLPercent = parseFloat(pnlPercent || 0);

  // 优先使用联动的市场数据
  const marketTitle = linkedMarket?.question || linkedMarket?.title || market?.question || market?.title || position.marketTitle || `市场 #${marketId}`;

  // 获取结果名称，优先使用联动的市场数据
  const getOutcomeName = () => {
    if (outcome?.name) return outcome.name;
    if (position.outcomeName) return position.outcomeName;
    // 尝试从 linkedMarket 获取 outcomes
    if (linkedMarket?.outcomes && typeof side === 'number') {
      return linkedMarket.outcomes[side] || (side === 0 ? 'Yes' : 'No');
    }
    if (market?.outcomes && typeof side === 'number') {
      return market.outcomes[side] || (side === 0 ? 'Yes' : 'No');
    }
    return side === 0 ? 'Yes' : 'No';
  };
  const outcomeName = getOutcomeName();

  const hasLinkedMarket = linkedMarket && (linkedMarket.id || linkedMarket.marketId);

  const handleClick = () => {
    if (onSelect && hasLinkedMarket) {
      onSelect(linkedMarket);
    } else if (onSelect && marketId) {
      onSelect({ id: marketId, ...market });
    }
  };

  return (
    <div
      style={{
        ...styles.positionCard,
        cursor: hasLinkedMarket ? 'pointer' : 'default'
      }}
      onClick={handleClick}
    >
      <div style={styles.positionHeader}>
        <span style={styles.positionMarket}>
          {marketTitle.length > 45 ? marketTitle.slice(0, 45) + '...' : marketTitle}
        </span>
        <span style={{
          ...styles.positionOutcome,
          backgroundColor: outcomeName === 'Yes' ? 'rgba(56, 178, 172, 0.15)' : 'rgba(229, 62, 62, 0.15)',
          color: outcomeName === 'Yes' ? '#38B2AC' : '#E53E3E'
        }}>
          {outcomeName}
        </span>
      </div>

      {hasLinkedMarket && (
        <div style={styles.clickHint}>
          点击查看市场
        </div>
      )}

      <div style={styles.positionDetails}>
        <div style={styles.positionRow}>
          <span style={styles.positionLabel}>数量</span>
          <span style={styles.positionValue}>{displayShares.toFixed(2)} 份</span>
        </div>
        <div style={styles.positionRow}>
          <span style={styles.positionLabel}>价值</span>
          <span style={styles.positionValue}>${displayValue.toFixed(2)}</span>
        </div>
      </div>

      <div style={{
        ...styles.positionPnL,
        backgroundColor: displayPnL >= 0 ? 'rgba(56, 178, 172, 0.15)' : 'rgba(229, 62, 62, 0.15)'
      }}>
        <span style={styles.pnlLabel}>盈亏</span>
        <span style={{
          ...styles.pnlValue,
          color: displayPnL >= 0 ? '#38B2AC' : '#E53E3E'
        }}>
          {displayPnL >= 0 ? '+' : ''}{displayPnL.toFixed(2)}
          {displayPnLPercent !== 0 && ` (${displayPnLPercent >= 0 ? '+' : ''}${displayPnLPercent.toFixed(1)}%)`}
        </span>
      </div>

      {canRedeem && (
        <button
          onClick={(e) => onRedeem(position, e)}
          disabled={isRedeeming}
          style={{
            ...styles.redeemBtn,
            opacity: isRedeeming ? 0.6 : 1,
          }}
        >
          {isRedeeming ? '赎回中...' : '💰 赎回'}
        </button>
      )}
    </div>
  );
};

const styles = {
  container: {
    backgroundColor: 'transparent',
    padding: '20px',
    height: '100%',
    display: 'flex',
    flexDirection: 'column'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px'
  },
  title: {
    margin: 0,
    fontSize: '18px',
    fontWeight: '700',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    color: '#3D4852',
    letterSpacing: '-0.02em'
  },
  refreshBtn: {
    padding: '10px 16px',
    border: 'none',
    borderRadius: '12px',
    backgroundColor: '#E0E5EC',
    color: '#5A6570',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
    transition: 'all 300ms ease-out',
    boxShadow: '4px 4px 8px rgb(163, 177, 198, 0.6), -4px -4px 8px rgba(255, 255, 255, 0.5)',
    minHeight: 'auto'
  },
  summary: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '16px',
    backgroundColor: '#E0E5EC',
    borderRadius: '20px',
    marginBottom: '16px',
    flexShrink: 0,
    boxShadow: 'inset 5px 5px 10px rgb(163, 177, 198, 0.6), inset -5px -5px 10px rgba(255, 255, 255, 0.5)'
  },
  summaryItem: {
    textAlign: 'center'
  },
  summaryLabel: {
    display: 'block',
    fontSize: '12px',
    color: '#6B7280',
    marginBottom: '6px',
    fontWeight: '500'
  },
  summaryValue: {
    fontSize: '16px',
    fontWeight: '700',
    color: '#3D4852',
    fontFamily: "'JetBrains Mono', monospace"
  },
  error: {
    padding: '14px 16px',
    backgroundColor: '#E0E5EC',
    color: '#E53E3E',
    borderRadius: '16px',
    fontSize: '13px',
    marginBottom: '16px',
    flexShrink: 0,
    boxShadow: 'inset 5px 5px 10px rgb(163, 177, 198, 0.6), inset -5px -5px 10px rgba(255, 255, 255, 0.5)'
  },
  loading: {
    textAlign: 'center',
    padding: '24px',
    color: '#6B7280'
  },
  emptyState: {
    textAlign: 'center',
    padding: '40px 24px'
  },
  emptyIcon: {
    fontSize: '40px',
    display: 'block',
    marginBottom: '12px'
  },
  emptyText: {
    margin: 0,
    fontSize: '14px',
    color: '#6B7280'
  },
  positionList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    flex: 1,
    overflowY: 'auto',
    minHeight: 0
  },
  positionCard: {
    padding: '18px',
    borderRadius: '20px',
    backgroundColor: '#E0E5EC',
    transition: 'all 300ms ease-out',
    boxShadow: '6px 6px 12px rgb(163, 177, 198, 0.6), -6px -6px 12px rgba(255, 255, 255, 0.5)'
  },
  positionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '12px'
  },
  positionMarket: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#3D4852',
    flex: 1,
    marginRight: '10px',
    lineHeight: '1.4'
  },
  positionOutcome: {
    padding: '6px 12px',
    borderRadius: '9999px',
    fontSize: '11px',
    fontWeight: '600',
    boxShadow: 'inset 2px 2px 4px rgb(163, 177, 198, 0.5), inset -2px -2px 4px rgba(255, 255, 255, 0.4)'
  },
  clickHint: {
    fontSize: '11px',
    color: '#6C63FF',
    marginBottom: '10px',
    fontWeight: '500'
  },
  positionDetails: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '8px',
    marginBottom: '12px'
  },
  positionRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '13px'
  },
  positionLabel: {
    color: '#6B7280'
  },
  positionValue: {
    color: '#3D4852',
    fontWeight: '600',
    fontFamily: "'JetBrains Mono', monospace"
  },
  positionPnL: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 14px',
    borderRadius: '16px',
    boxShadow: 'inset 4px 4px 8px rgb(163, 177, 198, 0.5), inset -4px -4px 8px rgba(255, 255, 255, 0.4)'
  },
  pnlLabel: {
    fontSize: '13px',
    color: '#5A6570',
    fontWeight: '500'
  },
  pnlValue: {
    fontSize: '14px',
    fontWeight: '700',
    fontFamily: "'JetBrains Mono', monospace"
  },
  showMoreBtn: {
    width: '100%',
    marginTop: '14px',
    padding: '14px',
    border: 'none',
    borderRadius: '16px',
    backgroundColor: '#E0E5EC',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
    color: '#5A6570',
    flexShrink: 0,
    boxShadow: '5px 5px 10px rgb(163, 177, 198, 0.6), -5px -5px 10px rgba(255, 255, 255, 0.5)',
    minHeight: 'auto'
  },
  redeemBtn: {
    width: '100%',
    marginTop: '12px',
    padding: '14px',
    border: 'none',
    borderRadius: '16px',
    backgroundColor: '#38B2AC',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '700',
    transition: 'all 300ms ease-out',
    boxShadow: '4px 4px 8px rgb(163, 177, 198, 0.6), -4px -4px 8px rgba(255, 255, 255, 0.5)',
    minHeight: 'auto'
  }
};

export default Positions;
