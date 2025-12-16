'use client';

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ethers } from 'ethers';
import { useToast } from './Toast';

// 动态导入 SDK
let OrderBuilder, ChainId, Side, setApprovals, AddressesByChainId;

// ERC20 ABI - 用于检查 USDT 授权
const ERC20_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
];

// ERC1155 ABI - 用于检查 Token 授权
const ERC1155_ABI = [
  'function setApprovalForAll(address operator, bool approved)',
  'function isApprovedForAll(address account, address operator) view returns (bool)',
];

// BSC 网络配置
const BSC_CHAIN_ID = 56;
const BSC_CHAIN_ID_HEX = '0x38';
const BSC_CHAIN_CONFIG = {
  chainId: BSC_CHAIN_ID_HEX,
  chainName: 'BNB Smart Chain',
  nativeCurrency: {
    name: 'BNB',
    symbol: 'BNB',
    decimals: 18
  },
  rpcUrls: ['https://bsc-dataseed.binance.org/'],
  blockExplorerUrls: ['https://bscscan.com/']
};

const loadSDK = async () => {
  try {
    const sdk = await import('@predictdotfun/sdk');
    OrderBuilder = sdk.OrderBuilder;
    ChainId = sdk.ChainId;
    Side = sdk.Side;
    setApprovals = sdk.setApprovals;
    AddressesByChainId = sdk.AddressesByChainId;
    console.log('SDK Loaded');
    return true;
  } catch (err) {
    console.error('Failed to load SDK:', err);
    return false;
  }
};

const ensureBSCNetwork = async () => {
  if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error('请安装 MetaMask');
  }

  const currentChainId = await window.ethereum.request({ method: 'eth_chainId' });

  if (currentChainId !== BSC_CHAIN_ID_HEX) {
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: BSC_CHAIN_ID_HEX }]
      });
    } catch (switchError) {
      if (switchError.code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [BSC_CHAIN_CONFIG]
        });
      } else {
        throw new Error('请切换到 BSC 网络');
      }
    }
  }
  return true;
};

const TradePanel = ({ market, signer, jwtToken, onTradeSuccess, selectedOutcome = 'yes', onOutcomeChange }) => {
  const [amount, setAmount] = useState('');
  const [price, setPrice] = useState('0.50');
  const [side, setSide] = useState('buy');

  // 根据 selectedOutcome prop 计算 outcomeIndex
  const outcomeIndex = selectedOutcome === 'yes' ? 0 : 1;

  // 处理 outcome 变化
  const handleOutcomeChange = (idx) => {
    if (onOutcomeChange) {
      onOutcomeChange(idx === 0 ? 'yes' : 'no');
    }
  };
  const [orderType, setOrderType] = useState('limit');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderBook, setOrderBook] = useState(null);
  const [error, setError] = useState('');
  const [userAddress, setUserAddress] = useState('');
  const [sdkLoaded, setSdkLoaded] = useState(false);

  // 授权相关状态
  const [approvalBanner, setApprovalBanner] = useState(null);
  const [isApproving, setIsApproving] = useState(false);

  const { showError, showSuccess, showInfo } = useToast();

  useEffect(() => {
    loadSDK().then(success => {
      setSdkLoaded(success);
      if (!success) {
        setError('SDK 加载失败，请检查依赖是否安装');
      }
    });
  }, []);

  useEffect(() => {
    const getAddress = async () => {
      if (signer) {
        const addr = await signer.getAddress();
        setUserAddress(addr);
      }
    };
    getAddress();
  }, [signer]);

  useEffect(() => {
    if (market?.id) {
      fetchOrderBook();
      const interval = setInterval(fetchOrderBook, 3000);
      return () => clearInterval(interval);
    }
  }, [market?.id]);

  const fetchOrderBook = async () => {
    if (!market?.id) return;
    try {
      const response = await axios.get(`/api/orderbook/${market.id}`);
      if (response.data.success) {
        setOrderBook(response.data.data);
      }
    } catch (err) {
      console.error('Error fetching orderbook:', err);
    }
  };

  const getBestPrices = () => {
    if (!orderBook) return { bestBid: null, bestAsk: null };

    const bids = orderBook.bids || [];
    const asks = orderBook.asks || [];

    if (outcomeIndex === 0) {
      return {
        bestBid: bids[0]?.[0],
        bestAsk: asks[0]?.[0]
      };
    } else {
      return {
        bestBid: asks[0] ? 1 - asks[0][0] : null,
        bestAsk: bids[0] ? 1 - bids[0][0] : null
      };
    }
  };

  const { bestBid, bestAsk } = getBestPrices();

  const setToBestPrice = (type) => {
    if (type === 'bid' && bestBid) {
      setPrice(bestBid.toFixed(2));
    } else if (type === 'ask' && bestAsk) {
      setPrice(bestAsk.toFixed(2));
    }
  };

  const calculateEstimate = () => {
    const qty = parseFloat(amount) || 0;
    const p = parseFloat(price) || 0;
    return (qty * p).toFixed(2);
  };

  // 检查授权状态
  const checkApprovalForTrade = async (tradeSide, requiredAmount, freshSigner, freshAddress) => {
    if (!AddressesByChainId) return { approved: true };

    const addresses = AddressesByChainId[BSC_CHAIN_ID];
    if (!addresses) return { approved: true };

    const {
      CTF_EXCHANGE,
      NEG_RISK_CTF_EXCHANGE,
      CONDITIONAL_TOKENS,
      USDT,
      COLLATERAL
    } = addresses;

    const isNegRisk = market.isNegRisk || false;
    const exchangeAddress = isNegRisk ? NEG_RISK_CTF_EXCHANGE : CTF_EXCHANGE;

    if (tradeSide === 'buy') {
      const usdtAddress = USDT || COLLATERAL;
      if (!usdtAddress) return { approved: true };

      try {
        const usdtContract = new ethers.Contract(usdtAddress, ERC20_ABI, freshSigner);
        const allowance = await usdtContract.allowance(freshAddress, exchangeAddress);

        if (allowance < requiredAmount) {
          return {
            approved: false,
            type: 'usdt',
            tokenName: 'USDT',
            tokenAddress: usdtAddress,
            spenderAddress: exchangeAddress,
            requiredAmount: requiredAmount,
            currentAllowance: allowance
          };
        }
      } catch (err) {
        console.error('Error checking USDT allowance:', err);
      }
    } else {
      if (!CONDITIONAL_TOKENS) return { approved: true };

      try {
        const ctContract = new ethers.Contract(CONDITIONAL_TOKENS, ERC1155_ABI, freshSigner);
        const isApproved = await ctContract.isApprovedForAll(freshAddress, exchangeAddress);

        if (!isApproved) {
          return {
            approved: false,
            type: 'token',
            tokenName: 'Conditional Token',
            tokenAddress: CONDITIONAL_TOKENS,
            spenderAddress: exchangeAddress
          };
        }
      } catch (err) {
        console.error('Error checking Token approval:', err);
      }
    }

    return { approved: true };
  };

  // 执行授权 - 按需授权，不进行无限授权
  const executeApproval = async (approvalInfo, freshSigner) => {
    setIsApproving(true);

    try {
      if (approvalInfo.type === 'usdt') {
        const contract = new ethers.Contract(approvalInfo.tokenAddress, ERC20_ABI, freshSigner);
        // 按需授权：使用实际需要的金额而非无限授权
        const approvalAmount = approvalInfo.requiredAmount;
        const formattedAmount = ethers.formatUnits(approvalAmount, 18); // BSC USDT 是 18 位小数
        showInfo(`正在授权 ${parseFloat(formattedAmount).toFixed(2)} ${approvalInfo.tokenName}，请在钱包中确认...`);
        const tx = await contract.approve(approvalInfo.spenderAddress, approvalAmount);
        showInfo('等待交易确认...');
        await tx.wait();
        showSuccess(`${approvalInfo.tokenName} 授权 ${parseFloat(formattedAmount).toFixed(2)} 成功！`);
        setApprovalBanner(null);
        return true;
      } else if (approvalInfo.type === 'token') {
        const contract = new ethers.Contract(approvalInfo.tokenAddress, ERC1155_ABI, freshSigner);
        showInfo(`正在授权 ${approvalInfo.tokenName}，请在钱包中确认...`);
        const tx = await contract.setApprovalForAll(approvalInfo.spenderAddress, true);
        showInfo('等待交易确认...');
        await tx.wait();
        showSuccess(`${approvalInfo.tokenName} 授权成功！`);
        setApprovalBanner(null);
        return true;
      }
    } catch (err) {
      console.error('Approval failed:', err);
      if (err.code === 'ACTION_REJECTED') {
        showError('用户取消了授权');
      } else {
        showError(`授权失败: ${err.message}`);
      }
      return false;
    } finally {
      setIsApproving(false);
    }
  };

  const handleTrade = async () => {
    setError('');

    if (!signer) {
      setError('请先连接钱包');
      return;
    }

    if (!jwtToken) {
      setError('请先认证（重新连接钱包）');
      return;
    }

    if (!sdkLoaded || !OrderBuilder || !Side) {
      setError('SDK 未加载，请刷新页面');
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      setError('请输入有效数量');
      return;
    }

    if (orderType === 'limit' && (!price || parseFloat(price) <= 0 || parseFloat(price) >= 1)) {
      setError('价格必须在 0 到 1 之间');
      return;
    }

    setIsSubmitting(true);

    try {
      await ensureBSCNetwork();

      const freshProvider = new ethers.BrowserProvider(window.ethereum);
      const freshSigner = await freshProvider.getSigner();
      const freshAddress = await freshSigner.getAddress();

      const selectedOutcome = market.outcomesDetail?.[outcomeIndex] || {};
      const tokenId = selectedOutcome.onChainId || '0';

      const priceValue = Math.round(parseFloat(price) * 100) / 100;
      const amountValue = parseFloat(amount);

      const pricePerShareWei = ethers.parseUnits(priceValue.toFixed(2), 18);
      const quantityWei = ethers.parseUnits(amountValue.toFixed(18), 18);

      const orderSide = side === 'buy' ? Side.BUY : Side.SELL;

      const builder = await OrderBuilder.make(BSC_CHAIN_ID, freshSigner);

      let amounts;
      let order;

      if (orderType === 'limit') {
        amounts = builder.getLimitOrderAmounts({
          side: orderSide,
          pricePerShareWei: pricePerShareWei,
          quantityWei: quantityWei
        });

        order = builder.buildOrder("LIMIT", {
          maker: freshAddress,
          signer: freshAddress,
          side: orderSide,
          tokenId: tokenId,
          makerAmount: amounts.makerAmount,
          takerAmount: amounts.takerAmount,
          nonce: 0n,
          feeRateBps: market.feeRateBps || 100
        });
      } else {
        const marketPriceWei = orderSide === Side.BUY
          ? ethers.parseUnits("0.99", 18)
          : ethers.parseUnits("0.01", 18);

        amounts = builder.getLimitOrderAmounts({
          side: orderSide,
          pricePerShareWei: marketPriceWei,
          quantityWei: quantityWei
        });

        order = builder.buildOrder("MARKET", {
          maker: freshAddress,
          signer: freshAddress,
          side: orderSide,
          tokenId: tokenId,
          makerAmount: amounts.makerAmount,
          takerAmount: amounts.takerAmount,
          nonce: 0n,
          feeRateBps: market.feeRateBps || 100
        });
      }

      // 授权检查
      const requiredAmount = side === 'buy' ? amounts.makerAmount : 0n;
      const approvalCheck = await checkApprovalForTrade(side, requiredAmount, freshSigner, freshAddress);

      if (!approvalCheck.approved) {
        const tokenLabel = approvalCheck.type === 'usdt' ? 'USDT' : 'Conditional Token';
        // 计算需要授权的具体金额
        let approvalMessage = `需要授权 ${tokenLabel} 才能${side === 'buy' ? '买入' : '卖出'}`;
        if (approvalCheck.type === 'usdt' && approvalCheck.requiredAmount) {
          const formattedRequired = parseFloat(ethers.formatUnits(approvalCheck.requiredAmount, 18)).toFixed(2);
          approvalMessage = `需要授权 ${formattedRequired} ${tokenLabel} 才能买入`;
        }
        setApprovalBanner({
          type: approvalCheck.type,
          message: approvalMessage,
          approvalInfo: approvalCheck
        });

        const approved = await executeApproval(approvalCheck, freshSigner);
        if (!approved) {
          setIsSubmitting(false);
          return;
        }
      }

      const isNegRisk = market.isNegRisk || false;
      const typedData = builder.buildTypedData(order, { isNegRisk });

      const signedOrder = await builder.signTypedDataOrder(typedData);
      const orderHash = builder.buildTypedDataHash(typedData);

      const requestData = {
        data: {
          pricePerShare: amounts.pricePerShare ? amounts.pricePerShare.toString() : "0",
          strategy: orderType.toUpperCase(),
          order: {
            hash: orderHash,
            salt: signedOrder.salt.toString(),
            maker: signedOrder.maker,
            signer: signedOrder.signer,
            taker: signedOrder.taker,
            tokenId: signedOrder.tokenId.toString(),
            makerAmount: signedOrder.makerAmount.toString(),
            takerAmount: signedOrder.takerAmount.toString(),
            expiration: signedOrder.expiration.toString(),
            nonce: signedOrder.nonce.toString(),
            feeRateBps: signedOrder.feeRateBps.toString(),
            side: signedOrder.side,
            signatureType: signedOrder.signatureType,
            signature: signedOrder.signature
          }
        }
      };

      const response = await axios.post('/api/orders', requestData, {
        headers: {
          'Authorization': `Bearer ${jwtToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.data.success) {
        showSuccess('订单提交成功！');
        setAmount('');
        onTradeSuccess && onTradeSuccess(response.data);
      } else {
        const errorDesc = response.data.error?.description ||
          response.data.error ||
          response.data.message ||
          '订单提交失败';
        showError(errorDesc);
      }
    } catch (err) {
      console.error('Trade failed:', err);
      if (err.code === 'ACTION_REJECTED') {
        showError('用户拒绝签名');
      } else {
        const errorData = err.response?.data;
        const errorDesc = errorData?.error?.description ||
          errorData?.error ||
          errorData?.message ||
          err.message ||
          '订单提交失败';
        showError(errorDesc);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const getOutcomeName = (idx) => {
    if (market?.outcomesDetail?.[idx]?.name) {
      return market.outcomesDetail[idx].name;
    }
    return market?.outcomes?.[idx] || `Outcome ${idx}`;
  };

  if (!market) {
    return (
      <div style={styles.container}>
        <div style={styles.placeholder}>
          <span style={styles.placeholderIcon}>📈</span>
          <p style={styles.placeholderText}>选择一个市场开始交易</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>下单</h3>
        <div style={{
          ...styles.sdkBadge,
          backgroundColor: '#E0E5EC',
          color: sdkLoaded ? '#38B2AC' : '#DD6B20'
        }}>
          {sdkLoaded ? 'SDK Ready' : 'Loading...'}
        </div>
      </div>

      {/* 授权提示横幅 */}
      {approvalBanner && (
        <div style={styles.approvalBanner}>
          <span style={styles.approvalIcon}>🔐</span>
          <div style={styles.approvalContent}>
            <div style={styles.approvalMessage}>{approvalBanner.message}</div>
            {isApproving && (
              <div style={styles.approvalStatus}>授权中，请在钱包中确认...</div>
            )}
          </div>
          <button
            onClick={() => setApprovalBanner(null)}
            style={styles.approvalClose}
          >
            ×
          </button>
        </div>
      )}

      {/* 市场信息 */}
      <div style={styles.marketInfo}>
        <span style={styles.marketQuestion}>
          {market.question || market.title}
        </span>
      </div>

      {error && (
        <div style={styles.errorBanner}>{error}</div>
      )}

      {!jwtToken && (
        <div style={styles.warningBanner}>
          请连接钱包并认证以进行交易
        </div>
      )}

      {/* 订单类型 - 仅支持限价单 */}

      {/* 结果选择 */}
      <div style={styles.formGroup}>
        <label style={styles.label}>结果</label>
        <div style={styles.toggleGroup}>
          {(market.outcomes || ['Yes', 'No']).map((outcome, idx) => (
            <button
              key={idx}
              onClick={() => handleOutcomeChange(idx)}
              style={{
                ...styles.toggleBtn,
                backgroundColor: outcomeIndex === idx
                  ? (idx === 0 ? '#38B2AC' : '#E53E3E')
                  : 'transparent',
                color: outcomeIndex === idx ? '#fff' : '#6B7280',
                boxShadow: outcomeIndex === idx
                  ? '4px 4px 8px rgb(163, 177, 198, 0.6), -4px -4px 8px rgba(255, 255, 255, 0.5)'
                  : 'none'
              }}
            >
              {getOutcomeName(idx)}
            </button>
          ))}
        </div>
      </div>

      {/* 买卖方向 */}
      <div style={styles.formGroup}>
        <label style={styles.label}>方向</label>
        <div style={styles.toggleGroup}>
          <button
            onClick={() => setSide('buy')}
            style={{
              ...styles.toggleBtn,
              backgroundColor: side === 'buy' ? '#38B2AC' : 'transparent',
              color: side === 'buy' ? '#fff' : '#6B7280',
              boxShadow: side === 'buy'
                ? '4px 4px 8px rgb(163, 177, 198, 0.6), -4px -4px 8px rgba(255, 255, 255, 0.5)'
                : 'none'
            }}
          >
            买入
          </button>
          <button
            onClick={() => setSide('sell')}
            style={{
              ...styles.toggleBtn,
              backgroundColor: side === 'sell' ? '#E53E3E' : 'transparent',
              color: side === 'sell' ? '#fff' : '#6B7280',
              boxShadow: side === 'sell'
                ? '4px 4px 8px rgb(163, 177, 198, 0.6), -4px -4px 8px rgba(255, 255, 255, 0.5)'
                : 'none'
            }}
          >
            卖出
          </button>
        </div>
      </div>

      {/* 最佳价格参考 */}
      {orderBook && (
        <div style={styles.priceReference}>
          <div style={styles.priceRefItem} onClick={() => setToBestPrice('bid')}>
            <span style={styles.priceRefLabel}>最佳买价</span>
            <span style={styles.priceRefValueBid}>
              {bestBid ? `$${bestBid.toFixed(2)}` : '-'}
            </span>
          </div>
          <div style={styles.priceRefItem} onClick={() => setToBestPrice('ask')}>
            <span style={styles.priceRefLabel}>最佳卖价</span>
            <span style={styles.priceRefValueAsk}>
              {bestAsk ? `$${bestAsk.toFixed(2)}` : '-'}
            </span>
          </div>
        </div>
      )}

      {/* 价格输入 */}
      {orderType === 'limit' && (
        <div style={styles.formGroup}>
          <label style={styles.label}>价格 (0-1)</label>
          <div style={styles.inputWrapper}>
            <span style={styles.inputPrefix}>$</span>
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              min="0.01"
              max="0.99"
              step="0.01"
              style={styles.input}
            />
          </div>
          <div style={styles.quickBtns}>
            {[0.1, 0.25, 0.5, 0.75, 0.9].map(p => (
              <button
                key={p}
                onClick={() => setPrice(p.toString())}
                style={styles.quickBtn}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 数量输入 */}
      <div style={styles.formGroup}>
        <label style={styles.label}>数量 (份额)</label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          min="1"
          placeholder="输入数量"
          style={styles.inputFull}
        />
        <div style={styles.quickBtns}>
          {[10, 50, 100, 500, 1000].map(a => (
            <button
              key={a}
              onClick={() => setAmount(a.toString())}
              style={styles.quickBtn}
            >
              {a}
            </button>
          ))}
        </div>
      </div>

      {/* 预估成本 */}
      <div style={styles.estimate}>
        <div style={styles.estimateRow}>
          <span>预估 {side === 'buy' ? '成本' : '收益'}</span>
          <span style={styles.estimateValue}>${calculateEstimate()} USDT</span>
        </div>
        {market.feeRateBps && (
          <div style={styles.estimateRow}>
            <span>手续费 ({market.feeRateBps / 100}%)</span>
            <span>${(parseFloat(calculateEstimate()) * market.feeRateBps / 10000).toFixed(4)}</span>
          </div>
        )}
      </div>

      {/* 提交按钮 */}
      <button
        onClick={handleTrade}
        disabled={isSubmitting || isApproving || !jwtToken || !sdkLoaded || !market}
        style={{
          ...styles.submitBtn,
          backgroundColor: side === 'buy' ? '#38B2AC' : '#E53E3E',
          opacity: (isSubmitting || isApproving || !jwtToken || !sdkLoaded || !market) ? 0.6 : 1
        }}
      >
        {isApproving ? '授权中...' : isSubmitting ? '签名中...' : `${side === 'buy' ? '买入' : '卖出'} ${getOutcomeName(outcomeIndex)}`}
      </button>
    </div>
  );
};

const styles = {
  container: {
    backgroundColor: '#E0E5EC',
    borderRadius: '32px',
    padding: '20px',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '9px 9px 16px rgb(163, 177, 198, 0.6), -9px -9px 16px rgba(255, 255, 255, 0.5)'
  },
  placeholder: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px 24px'
  },
  placeholderIcon: {
    fontSize: '56px',
    marginBottom: '20px'
  },
  placeholderText: {
    margin: 0,
    fontSize: '15px',
    color: '#6B7280'
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
  sdkBadge: {
    fontSize: '11px',
    padding: '6px 12px',
    borderRadius: '9999px',
    fontWeight: '600',
    boxShadow: 'inset 3px 3px 6px rgb(163, 177, 198, 0.6), inset -3px -3px 6px rgba(255, 255, 255, 0.5)'
  },
  approvalBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '14px 16px',
    backgroundColor: '#E0E5EC',
    borderRadius: '16px',
    marginBottom: '16px',
    boxShadow: 'inset 5px 5px 10px rgb(163, 177, 198, 0.6), inset -5px -5px 10px rgba(255, 255, 255, 0.5)'
  },
  approvalIcon: {
    fontSize: '20px'
  },
  approvalContent: {
    flex: 1
  },
  approvalMessage: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#DD6B20'
  },
  approvalStatus: {
    fontSize: '12px',
    color: '#6B7280',
    marginTop: '4px'
  },
  approvalClose: {
    background: '#E0E5EC',
    border: 'none',
    fontSize: '18px',
    cursor: 'pointer',
    color: '#6B7280',
    padding: '4px 8px',
    borderRadius: '8px',
    boxShadow: '3px 3px 6px rgb(163, 177, 198, 0.6), -3px -3px 6px rgba(255, 255, 255, 0.5)',
    minHeight: 'auto'
  },
  marketInfo: {
    padding: '14px 16px',
    backgroundColor: '#E0E5EC',
    borderRadius: '16px',
    marginBottom: '16px',
    boxShadow: 'inset 5px 5px 10px rgb(163, 177, 198, 0.6), inset -5px -5px 10px rgba(255, 255, 255, 0.5)'
  },
  marketQuestion: {
    fontSize: '13px',
    color: '#5A6570',
    lineHeight: '1.5',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden'
  },
  errorBanner: {
    padding: '14px 16px',
    backgroundColor: '#E0E5EC',
    color: '#E53E3E',
    borderRadius: '16px',
    fontSize: '13px',
    marginBottom: '16px',
    boxShadow: 'inset 5px 5px 10px rgb(163, 177, 198, 0.6), inset -5px -5px 10px rgba(255, 255, 255, 0.5)'
  },
  warningBanner: {
    padding: '14px 16px',
    backgroundColor: '#E0E5EC',
    color: '#DD6B20',
    borderRadius: '16px',
    fontSize: '13px',
    marginBottom: '16px',
    boxShadow: 'inset 5px 5px 10px rgb(163, 177, 198, 0.6), inset -5px -5px 10px rgba(255, 255, 255, 0.5)'
  },
  formGroup: {
    marginBottom: '16px'
  },
  label: {
    display: 'block',
    marginBottom: '8px',
    fontSize: '12px',
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  toggleGroup: {
    display: 'flex',
    gap: '8px',
    backgroundColor: '#E0E5EC',
    padding: '4px',
    borderRadius: '16px',
    boxShadow: 'inset 4px 4px 8px rgb(163, 177, 198, 0.6), inset -4px -4px 8px rgba(255, 255, 255, 0.5)'
  },
  toggleBtn: {
    flex: 1,
    padding: '12px 16px',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '600',
    transition: 'all 300ms ease-out',
    minHeight: 'auto',
    boxShadow: 'none'
  },
  priceReference: {
    display: 'flex',
    gap: '10px',
    marginBottom: '16px'
  },
  priceRefItem: {
    flex: 1,
    padding: '12px 14px',
    backgroundColor: '#E0E5EC',
    borderRadius: '16px',
    textAlign: 'center',
    cursor: 'pointer',
    transition: 'all 300ms ease-out',
    boxShadow: '5px 5px 10px rgb(163, 177, 198, 0.6), -5px -5px 10px rgba(255, 255, 255, 0.5)'
  },
  priceRefLabel: {
    display: 'block',
    fontSize: '11px',
    color: '#6B7280',
    marginBottom: '4px',
    fontWeight: '500'
  },
  priceRefValueBid: {
    fontSize: '14px',
    fontWeight: '700',
    color: '#38B2AC',
    fontFamily: "'JetBrains Mono', monospace"
  },
  priceRefValueAsk: {
    fontSize: '14px',
    fontWeight: '700',
    color: '#E53E3E',
    fontFamily: "'JetBrains Mono', monospace"
  },
  inputWrapper: {
    display: 'flex',
    alignItems: 'center',
    backgroundColor: '#E0E5EC',
    borderRadius: '16px',
    overflow: 'hidden',
    boxShadow: 'inset 6px 6px 10px rgb(163, 177, 198, 0.6), inset -6px -6px 10px rgba(255, 255, 255, 0.5)'
  },
  inputPrefix: {
    padding: '14px 16px',
    backgroundColor: '#E0E5EC',
    color: '#6B7280',
    fontSize: '14px',
    fontWeight: '600'
  },
  input: {
    flex: 1,
    padding: '14px 16px',
    border: 'none',
    backgroundColor: 'transparent',
    color: '#3D4852',
    fontSize: '14px',
    outline: 'none',
    boxShadow: 'none'
  },
  inputFull: {
    width: '100%',
    padding: '14px 16px',
    border: 'none',
    borderRadius: '16px',
    backgroundColor: '#E0E5EC',
    color: '#3D4852',
    fontSize: '14px',
    boxSizing: 'border-box',
    outline: 'none',
    boxShadow: 'inset 6px 6px 10px rgb(163, 177, 198, 0.6), inset -6px -6px 10px rgba(255, 255, 255, 0.5)'
  },
  quickBtns: {
    display: 'flex',
    gap: '6px',
    marginTop: '10px'
  },
  quickBtn: {
    flex: 1,
    padding: '8px 10px',
    border: 'none',
    borderRadius: '12px',
    backgroundColor: '#E0E5EC',
    color: '#5A6570',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '500',
    transition: 'all 300ms ease-out',
    boxShadow: '4px 4px 8px rgb(163, 177, 198, 0.6), -4px -4px 8px rgba(255, 255, 255, 0.5)',
    minHeight: 'auto'
  },
  estimate: {
    padding: '14px 16px',
    backgroundColor: '#E0E5EC',
    borderRadius: '16px',
    marginBottom: '16px',
    boxShadow: 'inset 5px 5px 10px rgb(163, 177, 198, 0.6), inset -5px -5px 10px rgba(255, 255, 255, 0.5)'
  },
  estimateRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '13px',
    color: '#5A6570',
    marginBottom: '6px'
  },
  estimateValue: {
    fontWeight: '700',
    color: '#3D4852',
    fontFamily: "'JetBrains Mono', monospace"
  },
  submitBtn: {
    width: '100%',
    padding: '16px',
    border: 'none',
    borderRadius: '16px',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '15px',
    fontWeight: '700',
    transition: 'all 300ms ease-out',
    marginTop: 'auto',
    boxShadow: '6px 6px 12px rgb(163, 177, 198, 0.6), -6px -6px 12px rgba(255, 255, 255, 0.5)'
  }
};

export default TradePanel;
