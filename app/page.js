'use client';

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import WalletConnect from './components/WalletConnect';
import MarketList from './components/MarketList';
import OrderBook from './components/OrderBook';
import TradePanel from './components/TradePanel';
import OrdersPositionsTabs from './components/OrdersPositionsTabs';
import ApprovalDropdown from './components/ApprovalDropdown';
import { ToastProvider } from './components/Toast';

const API_BASE_URL = '/api';

export default function Home() {
  const [markets, setMarkets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [signer, setSigner] = useState(null);
  const [userAddress, setUserAddress] = useState('');
  const [jwtToken, setJwtToken] = useState('');
  const [selectedMarket, setSelectedMarket] = useState(null);
  const [accountInfo, setAccountInfo] = useState(null);

  useEffect(() => {
    fetchMarkets();
    checkBackendHealth();
  }, []);

  const checkBackendHealth = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/health`);
      if (!response.data.configured) {
        console.warn('Warning: API Key not configured in backend');
      }
    } catch (error) {
      console.error('Backend health check failed:', error);
    }
  };

  const fetchMarkets = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`${API_BASE_URL}/markets`);

      if (response.data.success) {
        const marketData = response.data.data || [];
        setMarkets(marketData);
        if (marketData.length > 0 && !selectedMarket) {
          setSelectedMarket(marketData[0]);
        }
      } else {
        setError(response.data.error || response.data.message || 'Failed to fetch markets');
        setMarkets([]);
      }
    } catch (error) {
      console.error('Error fetching markets:', error);
      setError(error.response?.data?.message || error.message || 'Failed to fetch markets');
      setMarkets([]);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (newSigner, address) => {
    setSigner(newSigner);
    setUserAddress(address);

    try {
      const msgResponse = await axios.get(`${API_BASE_URL}/auth/message`);
      const message = msgResponse.data.data?.message || `Sign in to Predict.fun\nTimestamp: ${Date.now()}`;

      const signature = await newSigner.signMessage(message);

      const authResponse = await axios.post(`${API_BASE_URL}/auth`, {
        signer: address,
        signature,
        message
      });

      if (authResponse.data.success && authResponse.data.data?.token) {
        const token = authResponse.data.data.token;
        setJwtToken(token);
        console.log('JWT authentication successful');

        await fetchAccountInfo(token);
        await setReferralCode(token);
      }
    } catch (error) {
      console.error('Authentication failed:', error);
    }
  };

  const fetchAccountInfo = async (token) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/account`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.data.success && response.data.data) {
        setAccountInfo(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching account info:', error.response?.data || error.message);
    }
  };

  const REFERRAL_CODE = '';

  const setReferralCode = async (token) => {
    if (!REFERRAL_CODE || REFERRAL_CODE.length !== 5) {
      return;
    }

    try {
      const response = await axios.post(`${API_BASE_URL}/account/referral`, {
        data: {
          referralCode: REFERRAL_CODE
        }
      }, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.data.success) {
        console.log('Referral code set successfully:', REFERRAL_CODE);
      }
    } catch (error) {
      // Silent error handling
    }
  };

  const handleMarketSelect = (market) => {
    setSelectedMarket(market);
  };

  const handleTradeSuccess = () => {
    fetchMarkets();
  };

  const handleViewMarket = (marketId) => {
    const found = markets.find(m => m.id === marketId || m.marketId === marketId);
    if (found) {
      setSelectedMarket(found);
    } else {
      window.open(`https://predict.fun/market/${marketId}`, '_blank');
    }
  };

  return (
    <ToastProvider>
      <div style={styles.app}>
        {/* Header */}
        <header style={styles.header}>
          <div style={styles.headerLeft}>
            <h1 style={styles.logo}>Predict.fun Trading</h1>
          </div>
          <div style={styles.headerRight}>
            {accountInfo && (
              <div style={styles.accountInfo}>
                {accountInfo.name && (
                  <span style={styles.accountName}>{accountInfo.name}</span>
                )}
                {accountInfo.referral?.code && (
                  <div style={styles.referralBadge}>
                    <span style={styles.referralLabel}>邀请码:</span>
                    <span
                      style={styles.referralCode}
                      onClick={() => {
                        navigator.clipboard.writeText(accountInfo.referral.code);
                        alert('邀请码已复制!');
                      }}
                      title="点击复制"
                    >
                      {accountInfo.referral.code}
                    </span>
                  </div>
                )}
              </div>
            )}
            <WalletConnect onConnect={handleConnect} />
            <ApprovalDropdown signer={signer} userAddress={userAddress} />
            {userAddress && jwtToken && (
              <span style={styles.authStatus}>已认证</span>
            )}
          </div>
        </header>

        {/* Main Content - 40/60 Split */}
        <div style={styles.mainContent}>
          {/* Left Panel - 40% - Market List */}
          <div style={styles.leftPanel}>
            <div style={styles.leftPanelHeader}>
              <h2 style={styles.sectionTitle}>预测市场</h2>
              <span style={styles.marketCount}>{markets.length} 个市场</span>
            </div>
            {error && (
              <div style={styles.errorBanner}>
                {error}
                <button onClick={fetchMarkets} style={styles.retryBtn}>重试</button>
              </div>
            )}
            <MarketList
              markets={markets}
              loading={loading}
              onTrade={handleMarketSelect}
              onSelect={handleMarketSelect}
              selectedMarketId={selectedMarket?.id}
            />
          </div>

          {/* Right Panel - 60% */}
          <div style={styles.rightPanel}>
            {/* Right Top - OrderBook + TradePanel */}
            <div style={styles.rightTop}>
              <div style={styles.orderBookWrapper}>
                <OrderBook
                  market={selectedMarket}
                  onPriceSelect={() => {}}
                />
              </div>
              <div style={styles.tradePanelWrapper}>
                <TradePanel
                  market={selectedMarket}
                  signer={signer}
                  jwtToken={jwtToken}
                  onTradeSuccess={handleTradeSuccess}
                />
              </div>
            </div>

            {/* Right Bottom - Orders/Positions Tabs */}
            <div style={styles.rightBottom}>
              <OrdersPositionsTabs
                jwtToken={jwtToken}
                userAddress={userAddress}
                signer={signer}
                onOrderCancelled={fetchMarkets}
                onViewMarket={handleViewMarket}
                onSelectMarket={handleMarketSelect}
              />
            </div>
          </div>
        </div>
      </div>
    </ToastProvider>
  );
}

const styles = {
  app: {
    height: '100vh',
    backgroundColor: 'var(--bg-primary, #0d1117)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 20px',
    backgroundColor: 'var(--bg-secondary, #161b22)',
    borderBottom: '1px solid var(--border-color, #30363d)',
    zIndex: 100,
    flexShrink: 0
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px'
  },
  logo: {
    margin: 0,
    fontSize: '20px',
    fontWeight: '700',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text'
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  accountInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },
  accountName: {
    fontSize: '12px',
    color: 'var(--text-secondary, #8b949e)',
    fontWeight: '500'
  },
  referralBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 10px',
    backgroundColor: 'rgba(163, 113, 247, 0.1)',
    borderRadius: '8px',
    border: '1px solid rgba(163, 113, 247, 0.3)'
  },
  referralLabel: {
    fontSize: '11px',
    color: 'var(--accent-purple, #a371f7)'
  },
  referralCode: {
    fontSize: '12px',
    fontWeight: '700',
    color: 'var(--accent-purple, #a371f7)',
    cursor: 'pointer',
    fontFamily: 'var(--font-mono, monospace)',
    letterSpacing: '0.5px'
  },
  authStatus: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '11px',
    color: 'var(--accent-green, #3fb950)',
    fontWeight: '500',
    padding: '5px 10px',
    backgroundColor: 'rgba(63, 185, 80, 0.1)',
    borderRadius: '16px'
  },
  mainContent: {
    display: 'flex',
    flex: 1,
    padding: '16px',
    gap: '16px',
    minHeight: 0,
    overflow: 'hidden'
  },
  leftPanel: {
    width: '40%',
    minWidth: '360px',
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0
  },
  leftPanelHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
    flexShrink: 0
  },
  sectionTitle: {
    margin: 0,
    fontSize: '16px',
    fontWeight: '600',
    color: 'var(--text-primary, #f0f6fc)'
  },
  marketCount: {
    fontSize: '12px',
    color: 'var(--text-muted, #6e7681)',
    padding: '4px 10px',
    backgroundColor: 'var(--bg-tertiary, #21262d)',
    borderRadius: '12px'
  },
  errorBanner: {
    padding: '10px 14px',
    backgroundColor: 'rgba(248, 81, 73, 0.1)',
    color: 'var(--accent-red, #f85149)',
    borderRadius: '8px',
    marginBottom: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    fontSize: '13px',
    border: '1px solid rgba(248, 81, 73, 0.3)',
    flexShrink: 0
  },
  retryBtn: {
    padding: '6px 12px',
    border: '1px solid var(--accent-red, #f85149)',
    backgroundColor: 'transparent',
    color: 'var(--accent-red, #f85149)',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '500'
  },
  rightPanel: {
    width: '60%',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    minHeight: 0,
    overflow: 'hidden'
  },
  rightTop: {
    display: 'flex',
    gap: '16px',
    flex: '0 0 auto',
    maxHeight: '50%'
  },
  orderBookWrapper: {
    flex: 1,
    minWidth: 0,
    overflow: 'auto'
  },
  tradePanelWrapper: {
    flex: 1,
    minWidth: 0,
    overflow: 'auto'
  },
  rightBottom: {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden'
  }
};
