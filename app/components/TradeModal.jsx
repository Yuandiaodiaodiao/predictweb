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

const TradeModal = ({ market, isOpen, onClose, signer, jwtToken, onTradeSuccess }) => {
  const [amount, setAmount] = useState('');
  const [price, setPrice] = useState('0.50');
  const [side, setSide] = useState('buy');
  const [outcomeIndex, setOutcomeIndex] = useState(0);
  const [orderType, setOrderType] = useState('limit');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderBook, setOrderBook] = useState(null);
  const [error, setError] = useState('');
  const [userAddress, setUserAddress] = useState('');
  const [sdkLoaded, setSdkLoaded] = useState(false);

  // 授权相关状态
  const [approvalBanner, setApprovalBanner] = useState(null); // { type: 'usdt' | 'token', message: string }
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
    if (isOpen && market?.id) {
      fetchOrderBook();
      const interval = setInterval(fetchOrderBook, 3000);
      return () => clearInterval(interval);
    }
  }, [isOpen, market?.id]);

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

  if (!isOpen || !market) return null;

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
      // Buy 订单：检查 USDT 授权
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
      // Sell 订单：检查 Token (ERC1155) 授权
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

  // 执行授权
  const executeApproval = async (approvalInfo, freshSigner) => {
    setIsApproving(true);

    try {
      if (approvalInfo.type === 'usdt') {
        // ERC20 授权
        const contract = new ethers.Contract(approvalInfo.tokenAddress, ERC20_ABI, freshSigner);
        showInfo(`正在授权 ${approvalInfo.tokenName}，请在钱包中确认...`);
        const tx = await contract.approve(approvalInfo.spenderAddress, ethers.MaxUint256);
        showInfo('等待交易确认...');
        await tx.wait();
        showSuccess(`${approvalInfo.tokenName} 授权成功！`);
        setApprovalBanner(null);
        return true;
      } else if (approvalInfo.type === 'token') {
        // ERC1155 授权
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

      // 授权检查：Buy 订单检查 USDT，Sell 订单检查 Token
      const requiredAmount = side === 'buy' ? amounts.makerAmount : 0n;
      const approvalCheck = await checkApprovalForTrade(side, requiredAmount, freshSigner, freshAddress);

      if (!approvalCheck.approved) {
        // 设置顶部授权提示横幅
        const tokenLabel = approvalCheck.type === 'usdt' ? 'USDT' : 'Conditional Token';
        setApprovalBanner({
          type: approvalCheck.type,
          message: `需要授权 ${tokenLabel} 才能${side === 'buy' ? '买入' : '卖出'}`,
          approvalInfo: approvalCheck
        });

        // 自动拉起授权请求
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
        onTradeSuccess && onTradeSuccess(response.data);
        onClose();
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
    if (market.outcomesDetail?.[idx]?.name) {
      return market.outcomesDetail[idx].name;
    }
    return market.outcomes?.[idx] || `Outcome ${idx}`;
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <h2 style={styles.title}>交易</h2>
          <button onClick={onClose} style={styles.closeBtn}>×</button>
        </div>

        {/* 授权提示横幅 */}
        {approvalBanner && (
          <div style={styles.approvalBanner}>
            <div style={styles.approvalBannerIcon}>🔐</div>
            <div style={styles.approvalBannerContent}>
              <div style={styles.approvalBannerMessage}>{approvalBanner.message}</div>
              {isApproving && (
                <div style={styles.approvalBannerStatus}>授权中，请在钱包中确认...</div>
              )}
            </div>
            <button
              onClick={() => setApprovalBanner(null)}
              style={styles.approvalBannerClose}
            >
              ×
            </button>
          </div>
        )}

        <div style={styles.marketInfo}>
          <span style={styles.marketQuestion}>{market.question || market.title}</span>
        </div>

        <div style={{
          ...styles.sdkStatus,
          backgroundColor: sdkLoaded ? '#e8f5e9' : '#fff3e0',
          color: sdkLoaded ? '#2e7d32' : '#e65100'
        }}>
          {sdkLoaded ? '✓ SDK 已加载' : '⏳ SDK 加载中...'}
        </div>

        {error && (
          <div style={styles.errorBanner}>{error}</div>
        )}

        {!jwtToken && (
          <div style={styles.warningBanner}>
            ⚠️ 请连接钱包并认证以进行交易
          </div>
        )}

        {userAddress && (
          <div style={styles.addressBanner}>
            钱包: {userAddress.slice(0, 6)}...{userAddress.slice(-4)}
          </div>
        )}

        <div style={styles.formGroup}>
          <label style={styles.label}>订单类型</label>
          <div style={styles.toggleGroup}>
            <button
              onClick={() => setOrderType('limit')}
              style={{
                ...styles.toggleBtn,
                backgroundColor: orderType === 'limit' ? '#1976d2' : '#f5f5f5',
                color: orderType === 'limit' ? '#fff' : '#333'
              }}
            >
              限价单
            </button>
            <button
              onClick={() => setOrderType('market')}
              style={{
                ...styles.toggleBtn,
                backgroundColor: orderType === 'market' ? '#1976d2' : '#f5f5f5',
                color: orderType === 'market' ? '#fff' : '#333'
              }}
            >
              市价单
            </button>
          </div>
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>结果</label>
          <div style={styles.toggleGroup}>
            {(market.outcomes || ['Yes', 'No']).map((outcome, idx) => (
              <button
                key={idx}
                onClick={() => setOutcomeIndex(idx)}
                style={{
                  ...styles.toggleBtn,
                  backgroundColor: outcomeIndex === idx
                    ? (idx === 0 ? '#4caf50' : '#f44336')
                    : '#f5f5f5',
                  color: outcomeIndex === idx ? '#fff' : '#333'
                }}
              >
                {getOutcomeName(idx)}
              </button>
            ))}
          </div>
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>买卖方向</label>
          <div style={styles.toggleGroup}>
            <button
              onClick={() => setSide('buy')}
              style={{
                ...styles.toggleBtn,
                backgroundColor: side === 'buy' ? '#4caf50' : '#e8f5e9',
                color: side === 'buy' ? '#fff' : '#2e7d32'
              }}
            >
              买入
            </button>
            <button
              onClick={() => setSide('sell')}
              style={{
                ...styles.toggleBtn,
                backgroundColor: side === 'sell' ? '#f44336' : '#ffebee',
                color: side === 'sell' ? '#fff' : '#c62828'
              }}
            >
              卖出
            </button>
          </div>
        </div>

        {orderBook && (
          <div style={styles.priceReference}>
            <div style={styles.priceRefItem}>
              <span style={styles.priceRefLabel}>最佳买价:</span>
              <span
                style={styles.priceRefValueBid}
                onClick={() => setToBestPrice('bid')}
              >
                {bestBid ? `$${bestBid.toFixed(2)}` : '-'}
              </span>
            </div>
            <div style={styles.priceRefItem}>
              <span style={styles.priceRefLabel}>最佳卖价:</span>
              <span
                style={styles.priceRefValueAsk}
                onClick={() => setToBestPrice('ask')}
              >
                {bestAsk ? `$${bestAsk.toFixed(2)}` : '-'}
              </span>
            </div>
          </div>
        )}

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
            <div style={styles.quickPrices}>
              {[0.1, 0.25, 0.5, 0.75, 0.9].map(p => (
                <button
                  key={p}
                  onClick={() => setPrice(p.toString())}
                  style={styles.quickPriceBtn}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

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
          <div style={styles.quickAmounts}>
            {[10, 50, 100, 500, 1000].map(a => (
              <button
                key={a}
                onClick={() => setAmount(a.toString())}
                style={styles.quickAmountBtn}
              >
                {a}
              </button>
            ))}
          </div>
        </div>

        <div style={styles.estimate}>
          <div style={styles.estimateRow}>
            <span>预估 {side === 'buy' ? '成本' : '收益'}:</span>
            <span style={styles.estimateValue}>${calculateEstimate()} USDT</span>
          </div>
          {market.feeRateBps && (
            <div style={styles.estimateRow}>
              <span>手续费 ({market.feeRateBps / 100}%):</span>
              <span>${(parseFloat(calculateEstimate()) * market.feeRateBps / 10000).toFixed(4)}</span>
            </div>
          )}
        </div>

        <div style={styles.actions}>
          <button onClick={onClose} style={styles.cancelBtn}>
            取消
          </button>
          <button
            onClick={handleTrade}
            disabled={isSubmitting || isApproving || !jwtToken || !sdkLoaded}
            style={{
              ...styles.submitBtn,
              backgroundColor: side === 'buy' ? '#4caf50' : '#f44336',
              opacity: (isSubmitting || isApproving || !jwtToken || !sdkLoaded) ? 0.6 : 1
            }}
          >
            {isApproving ? '授权中...' : isSubmitting ? '签名中...' : `${side === 'buy' ? '买入' : '卖出'} ${getOutcomeName(outcomeIndex)}`}
          </button>
        </div>
      </div>
    </div>
  );
};

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    backdropFilter: 'blur(4px)'
  },
  modal: {
    backgroundColor: 'var(--card, #FFFFFF)',
    borderRadius: '24px',
    width: '440px',
    maxWidth: '95vw',
    maxHeight: '90vh',
    overflow: 'auto',
    border: '3px solid var(--foreground, #1E293B)',
    boxShadow: '8px 8px 0 0 var(--accent, #8B5CF6)',
    animation: 'popIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '18px 24px',
    borderBottom: '2px dashed var(--border, #E2E8F0)',
    backgroundColor: 'var(--muted, #F1F5F9)'
  },
  title: {
    margin: 0,
    fontSize: '20px',
    fontWeight: '800',
    fontFamily: 'var(--font-heading, Outfit)',
    color: 'var(--foreground, #1E293B)'
  },
  closeBtn: {
    background: 'var(--muted, #F1F5F9)',
    border: '2px solid var(--foreground, #1E293B)',
    borderRadius: '50%',
    width: '36px',
    height: '36px',
    fontSize: '18px',
    fontWeight: '700',
    cursor: 'pointer',
    color: 'var(--foreground, #1E293B)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '2px 2px 0 0 var(--foreground, #1E293B)',
    transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
  },
  marketInfo: {
    padding: '14px 24px',
    backgroundColor: 'var(--tertiary, #FBBF24)',
    borderBottom: '2px solid var(--foreground, #1E293B)'
  },
  marketQuestion: {
    fontSize: '14px',
    color: 'var(--foreground, #1E293B)',
    fontWeight: '600',
    fontFamily: 'var(--font-body, Plus Jakarta Sans)'
  },
  sdkStatus: {
    margin: '12px 24px',
    padding: '10px 16px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: '600',
    textAlign: 'center',
    border: '2px solid var(--foreground, #1E293B)'
  },
  errorBanner: {
    margin: '12px 24px',
    padding: '12px 16px',
    backgroundColor: 'var(--accent-red, #F87171)',
    color: 'white',
    borderRadius: '12px',
    fontSize: '13px',
    fontWeight: '600',
    border: '2px solid var(--foreground, #1E293B)',
    boxShadow: '3px 3px 0 0 var(--foreground, #1E293B)'
  },
  warningBanner: {
    margin: '12px 24px',
    padding: '12px 16px',
    backgroundColor: 'var(--tertiary, #FBBF24)',
    color: 'var(--foreground, #1E293B)',
    borderRadius: '12px',
    fontSize: '13px',
    fontWeight: '600',
    border: '2px solid var(--foreground, #1E293B)'
  },
  addressBanner: {
    margin: '0 24px 12px',
    padding: '10px 16px',
    backgroundColor: 'var(--accent, #8B5CF6)',
    color: 'white',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: '600',
    fontFamily: 'var(--font-mono, JetBrains Mono)',
    border: '2px solid var(--foreground, #1E293B)'
  },
  approvalBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    margin: '0',
    padding: '14px 24px',
    backgroundColor: 'var(--tertiary, #FBBF24)',
    borderBottom: '2px solid var(--foreground, #1E293B)'
  },
  approvalBannerIcon: {
    fontSize: '28px'
  },
  approvalBannerContent: {
    flex: 1
  },
  approvalBannerMessage: {
    fontSize: '14px',
    fontWeight: '700',
    color: 'var(--foreground, #1E293B)',
    fontFamily: 'var(--font-heading, Outfit)'
  },
  approvalBannerStatus: {
    fontSize: '12px',
    color: 'var(--foreground, #1E293B)',
    marginTop: '4px',
    opacity: 0.8
  },
  approvalBannerClose: {
    background: 'var(--card, #FFFFFF)',
    border: '2px solid var(--foreground, #1E293B)',
    borderRadius: '50%',
    width: '28px',
    height: '28px',
    fontSize: '14px',
    fontWeight: '700',
    cursor: 'pointer',
    color: 'var(--foreground, #1E293B)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  formGroup: {
    padding: '14px 24px'
  },
  label: {
    display: 'block',
    marginBottom: '10px',
    fontSize: '13px',
    fontWeight: '700',
    color: 'var(--foreground, #1E293B)',
    fontFamily: 'var(--font-heading, Outfit)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  toggleGroup: {
    display: 'flex',
    gap: '10px'
  },
  toggleBtn: {
    flex: 1,
    padding: '12px 18px',
    border: '2px solid var(--foreground, #1E293B)',
    borderRadius: '12px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '700',
    fontFamily: 'var(--font-heading, Outfit)',
    transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
    boxShadow: '3px 3px 0 0 var(--foreground, #1E293B)'
  },
  priceReference: {
    display: 'flex',
    justifyContent: 'space-around',
    padding: '12px 24px',
    backgroundColor: 'var(--muted, #F1F5F9)',
    borderTop: '2px dashed var(--border, #E2E8F0)',
    borderBottom: '2px dashed var(--border, #E2E8F0)'
  },
  priceRefItem: {
    textAlign: 'center'
  },
  priceRefLabel: {
    fontSize: '11px',
    color: 'var(--muted-foreground, #64748B)',
    display: 'block',
    fontWeight: '600',
    marginBottom: '4px'
  },
  priceRefValueBid: {
    fontSize: '16px',
    fontWeight: '700',
    color: 'var(--quaternary, #34D399)',
    cursor: 'pointer',
    fontFamily: 'var(--font-mono, JetBrains Mono)'
  },
  priceRefValueAsk: {
    fontSize: '16px',
    fontWeight: '700',
    color: 'var(--accent-red, #F87171)',
    cursor: 'pointer',
    fontFamily: 'var(--font-mono, JetBrains Mono)'
  },
  inputWrapper: {
    display: 'flex',
    alignItems: 'center',
    border: '2px solid var(--foreground, #1E293B)',
    borderRadius: '12px',
    overflow: 'hidden',
    boxShadow: '3px 3px 0 0 var(--foreground, #1E293B)'
  },
  inputPrefix: {
    padding: '14px',
    backgroundColor: 'var(--muted, #F1F5F9)',
    color: 'var(--foreground, #1E293B)',
    fontSize: '14px',
    fontWeight: '700',
    borderRight: '2px solid var(--foreground, #1E293B)'
  },
  input: {
    flex: 1,
    padding: '14px',
    border: 'none',
    fontSize: '16px',
    fontWeight: '600',
    outline: 'none',
    fontFamily: 'var(--font-mono, JetBrains Mono)'
  },
  inputFull: {
    width: '100%',
    padding: '14px',
    border: '2px solid var(--foreground, #1E293B)',
    borderRadius: '12px',
    fontSize: '16px',
    fontWeight: '600',
    boxSizing: 'border-box',
    fontFamily: 'var(--font-mono, JetBrains Mono)',
    boxShadow: '3px 3px 0 0 var(--foreground, #1E293B)'
  },
  quickPrices: {
    display: 'flex',
    gap: '8px',
    marginTop: '10px'
  },
  quickPriceBtn: {
    flex: 1,
    padding: '8px',
    border: '2px solid var(--foreground, #1E293B)',
    borderRadius: '9999px',
    backgroundColor: 'var(--card, #FFFFFF)',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '700',
    color: 'var(--foreground, #1E293B)',
    transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
    boxShadow: '2px 2px 0 0 var(--foreground, #1E293B)'
  },
  quickAmounts: {
    display: 'flex',
    gap: '8px',
    marginTop: '10px'
  },
  quickAmountBtn: {
    flex: 1,
    padding: '8px',
    border: '2px solid var(--foreground, #1E293B)',
    borderRadius: '9999px',
    backgroundColor: 'var(--card, #FFFFFF)',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '700',
    color: 'var(--foreground, #1E293B)',
    transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
    boxShadow: '2px 2px 0 0 var(--foreground, #1E293B)'
  },
  estimate: {
    margin: '12px 24px',
    padding: '16px',
    backgroundColor: 'var(--muted, #F1F5F9)',
    borderRadius: '16px',
    border: '2px solid var(--foreground, #1E293B)',
    boxShadow: '3px 3px 0 0 var(--tertiary, #FBBF24)'
  },
  estimateRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '13px',
    color: 'var(--muted-foreground, #64748B)',
    marginBottom: '6px'
  },
  estimateValue: {
    fontWeight: '700',
    color: 'var(--foreground, #1E293B)',
    fontFamily: 'var(--font-mono, JetBrains Mono)'
  },
  actions: {
    display: 'flex',
    gap: '14px',
    padding: '20px 24px',
    borderTop: '2px dashed var(--border, #E2E8F0)',
    backgroundColor: 'var(--muted, #F1F5F9)'
  },
  cancelBtn: {
    flex: 1,
    padding: '16px',
    border: '2px solid var(--foreground, #1E293B)',
    borderRadius: '12px',
    backgroundColor: 'var(--card, #FFFFFF)',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '700',
    color: 'var(--foreground, #1E293B)',
    fontFamily: 'var(--font-heading, Outfit)',
    boxShadow: '3px 3px 0 0 var(--foreground, #1E293B)',
    transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
  },
  submitBtn: {
    flex: 2,
    padding: '16px',
    border: '2px solid var(--foreground, #1E293B)',
    borderRadius: '12px',
    color: 'white',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '700',
    fontFamily: 'var(--font-heading, Outfit)',
    boxShadow: '4px 4px 0 0 var(--foreground, #1E293B)',
    transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
  }
};

export default TradeModal;
