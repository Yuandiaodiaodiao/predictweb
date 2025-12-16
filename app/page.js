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
  const [selectedOutcome, setSelectedOutcome] = useState('yes'); // 共享的 outcome 状态

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
                  selectedOutcome={selectedOutcome}
                  onOutcomeChange={setSelectedOutcome}
                />
              </div>
              <div style={styles.tradePanelWrapper}>
                <TradePanel
                  market={selectedMarket}
                  signer={signer}
                  jwtToken={jwtToken}
                  onTradeSuccess={handleTradeSuccess}
                  selectedOutcome={selectedOutcome}
                  onOutcomeChange={setSelectedOutcome}
                />
              </div>
            </div>

            {/* Right Bottom - Orders/Positions Tabs */}
            <div style={styles.rightBottom}>
              <OrdersPositionsTabs
                jwtToken={jwtToken}
                userAddress={userAddress}
                signer={signer}
                markets={markets}
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
    backgroundColor: 'var(--background, #FFFDF5)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    position: 'relative'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 24px',
    backgroundColor: 'var(--card, #FFFFFF)',
    borderBottom: '2px solid var(--foreground, #1E293B)',
    zIndex: 100,
    flexShrink: 0,
    boxShadow: '0 4px 0 0 var(--border, #E2E8F0)'
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px'
  },
  logo: {
    margin: 0,
    fontSize: '22px',
    fontWeight: '800',
    fontFamily: 'var(--font-heading, Outfit)',
    color: 'var(--accent, #8B5CF6)',
    letterSpacing: '-0.02em',
    textShadow: '2px 2px 0 var(--secondary, #F472B6)'
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
    fontSize: '13px',
    color: 'var(--text-secondary, #475569)',
    fontWeight: '600',
    fontFamily: 'var(--font-heading, Outfit)'
  },
  referralBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 12px',
    backgroundColor: 'var(--accent, #8B5CF6)',
    borderRadius: '9999px',
    border: '2px solid var(--foreground, #1E293B)',
    boxShadow: '3px 3px 0 0 var(--foreground, #1E293B)'
  },
  referralLabel: {
    fontSize: '11px',
    fontWeight: '600',
    color: 'white',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  referralCode: {
    fontSize: '13px',
    fontWeight: '700',
    color: 'white',
    cursor: 'pointer',
    fontFamily: 'var(--font-mono, monospace)',
    letterSpacing: '1px'
  },
  authStatus: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '12px',
    color: 'var(--foreground, #1E293B)',
    fontWeight: '600',
    padding: '8px 14px',
    backgroundColor: 'var(--quaternary, #34D399)',
    borderRadius: '9999px',
    border: '2px solid var(--foreground, #1E293B)',
    boxShadow: '3px 3px 0 0 var(--foreground, #1E293B)'
  },
  mainContent: {
    display: 'flex',
    flex: 1,
    padding: '20px 24px',
    gap: '20px',
    minHeight: 0,
    overflow: 'hidden'
  },
  leftPanel: {
    width: '40%',
    minWidth: '360px',
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    overflow: 'hidden'
  },
  leftPanelHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
    flexShrink: 0
  },
  sectionTitle: {
    margin: 0,
    fontSize: '18px',
    fontWeight: '700',
    fontFamily: 'var(--font-heading, Outfit)',
    color: 'var(--foreground, #1E293B)',
    position: 'relative',
    display: 'inline-block'
  },
  marketCount: {
    fontSize: '12px',
    fontWeight: '600',
    color: 'var(--foreground, #1E293B)',
    padding: '6px 14px',
    backgroundColor: 'var(--tertiary, #FBBF24)',
    borderRadius: '9999px',
    border: '2px solid var(--foreground, #1E293B)',
    boxShadow: '2px 2px 0 0 var(--foreground, #1E293B)'
  },
  errorBanner: {
    padding: '12px 16px',
    backgroundColor: 'var(--accent-red, #F87171)',
    color: 'white',
    borderRadius: '16px',
    marginBottom: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    fontSize: '13px',
    fontWeight: '600',
    border: '2px solid var(--foreground, #1E293B)',
    boxShadow: '4px 4px 0 0 var(--foreground, #1E293B)',
    flexShrink: 0
  },
  retryBtn: {
    padding: '8px 16px',
    border: '2px solid var(--foreground, #1E293B)',
    backgroundColor: 'white',
    color: 'var(--foreground, #1E293B)',
    borderRadius: '9999px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '700',
    boxShadow: '2px 2px 0 0 var(--foreground, #1E293B)',
    transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)'
  },
  rightPanel: {
    width: '60%',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    minHeight: 0,
    overflow: 'hidden'
  },
  rightTop: {
    display: 'flex',
    gap: '20px',
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
