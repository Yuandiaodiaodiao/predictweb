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
    backgroundColor: 'rgba(0,0,0,0.6)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000
  },
  modal: {
    backgroundColor: '#fff',
    borderRadius: '16px',
    width: '420px',
    maxWidth: '95vw',
    maxHeight: '90vh',
    overflow: 'auto',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    borderBottom: '1px solid #eee'
  },
  title: {
    margin: 0,
    fontSize: '18px',
    fontWeight: '600',
    color: '#333'
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    fontSize: '24px',
    cursor: 'pointer',
    color: '#666',
    padding: '0 8px'
  },
  marketInfo: {
    padding: '12px 20px',
    backgroundColor: '#f8f9fa'
  },
  marketQuestion: {
    fontSize: '14px',
    color: '#333',
    fontWeight: '500'
  },
  sdkStatus: {
    margin: '8px 20px',
    padding: '8px 12px',
    borderRadius: '8px',
    fontSize: '12px',
    textAlign: 'center'
  },
  errorBanner: {
    margin: '12px 20px',
    padding: '10px 12px',
    backgroundColor: '#ffebee',
    color: '#c62828',
    borderRadius: '8px',
    fontSize: '13px'
  },
  warningBanner: {
    margin: '12px 20px',
    padding: '10px 12px',
    backgroundColor: '#fff3e0',
    color: '#e65100',
    borderRadius: '8px',
    fontSize: '13px'
  },
  addressBanner: {
    margin: '0 20px 12px',
    padding: '8px 12px',
    backgroundColor: '#e3f2fd',
    color: '#1976d2',
    borderRadius: '8px',
    fontSize: '12px',
    fontFamily: 'monospace'
  },
  approvalBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    margin: '0',
    padding: '12px 20px',
    backgroundColor: '#fff3e0',
    borderBottom: '1px solid #ffcc80'
  },
  approvalBannerIcon: {
    fontSize: '24px'
  },
  approvalBannerContent: {
    flex: 1
  },
  approvalBannerMessage: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#e65100'
  },
  approvalBannerStatus: {
    fontSize: '12px',
    color: '#ff9800',
    marginTop: '4px'
  },
  approvalBannerClose: {
    background: 'none',
    border: 'none',
    fontSize: '20px',
    cursor: 'pointer',
    color: '#e65100',
    padding: '0 4px'
  },
  formGroup: {
    padding: '12px 20px'
  },
  label: {
    display: 'block',
    marginBottom: '8px',
    fontSize: '13px',
    fontWeight: '500',
    color: '#666'
  },
  toggleGroup: {
    display: 'flex',
    gap: '8px'
  },
  toggleBtn: {
    flex: 1,
    padding: '10px 16px',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'all 0.2s'
  },
  priceReference: {
    display: 'flex',
    justifyContent: 'space-around',
    padding: '8px 20px',
    backgroundColor: '#fafafa',
    borderTop: '1px solid #eee',
    borderBottom: '1px solid #eee'
  },
  priceRefItem: {
    textAlign: 'center'
  },
  priceRefLabel: {
    fontSize: '11px',
    color: '#999',
    display: 'block'
  },
  priceRefValueBid: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#4caf50',
    cursor: 'pointer'
  },
  priceRefValueAsk: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#f44336',
    cursor: 'pointer'
  },
  inputWrapper: {
    display: 'flex',
    alignItems: 'center',
    border: '1px solid #ddd',
    borderRadius: '8px',
    overflow: 'hidden'
  },
  inputPrefix: {
    padding: '12px',
    backgroundColor: '#f5f5f5',
    color: '#666',
    fontSize: '14px'
  },
  input: {
    flex: 1,
    padding: '12px',
    border: 'none',
    fontSize: '14px',
    outline: 'none'
  },
  inputFull: {
    width: '100%',
    padding: '12px',
    border: '1px solid #ddd',
    borderRadius: '8px',
    fontSize: '14px',
    boxSizing: 'border-box'
  },
  quickPrices: {
    display: 'flex',
    gap: '6px',
    marginTop: '8px'
  },
  quickPriceBtn: {
    flex: 1,
    padding: '6px',
    border: '1px solid #ddd',
    borderRadius: '6px',
    backgroundColor: '#fff',
    cursor: 'pointer',
    fontSize: '12px',
    color: '#333'
  },
  quickAmounts: {
    display: 'flex',
    gap: '6px',
    marginTop: '8px'
  },
  quickAmountBtn: {
    flex: 1,
    padding: '6px',
    border: '1px solid #ddd',
    borderRadius: '6px',
    backgroundColor: '#fff',
    cursor: 'pointer',
    fontSize: '12px',
    color: '#333'
  },
  estimate: {
    margin: '12px 20px',
    padding: '12px',
    backgroundColor: '#f8f9fa',
    borderRadius: '8px'
  },
  estimateRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '13px',
    color: '#666',
    marginBottom: '4px'
  },
  estimateValue: {
    fontWeight: '600',
    color: '#333'
  },
  actions: {
    display: 'flex',
    gap: '12px',
    padding: '16px 20px',
    borderTop: '1px solid #eee'
  },
  cancelBtn: {
    flex: 1,
    padding: '14px',
    border: '1px solid #ddd',
    borderRadius: '8px',
    backgroundColor: '#fff',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    color: '#333'
  },
  submitBtn: {
    flex: 2,
    padding: '14px',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600'
  }
};

export default TradeModal;
