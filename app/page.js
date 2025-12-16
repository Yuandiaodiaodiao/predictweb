'use client';

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import WalletConnect from './components/WalletConnect';
import MarketList from './components/MarketList';
import TradeModal from './components/TradeModal';
import OrderBook from './components/OrderBook';
import Positions from './components/Positions';
import Orders from './components/Orders';
import ApprovalManager from './components/ApprovalManager';
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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showOrderBook, setShowOrderBook] = useState(true);
  const [accountInfo, setAccountInfo] = useState(null);
  const [sidebarVisible, setSidebarVisible] = useState(false);

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

  const handleTradeClick = (market) => {
    setSelectedMarket(market);
    setIsModalOpen(true);
  };

  const handleMarketSelect = (market) => {
    setSelectedMarket(market);
    setSidebarVisible(true);
  };

  const handlePriceSelect = (price, side) => {
    setIsModalOpen(true);
  };

  const handleTradeSuccess = () => {
    fetchMarkets();
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
                    <span style={styles.referralLabel}>我的邀请码:</span>
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
                    <span style={styles.copyIcon}>📋</span>
                  </div>
                )}
              </div>
            )}
            <WalletConnect onConnect={handleConnect} />
            {userAddress && jwtToken && (
              <span style={styles.authStatus}>✓ 已认证</span>
            )}
          </div>
        </header>

        {/* Main Content */}
        <div style={styles.mainContent}>
          {/* Market List */}
          <div style={styles.marketSection}>
            {error && (
              <div style={styles.errorBanner}>
                Error: {error}
                <button onClick={fetchMarkets} style={styles.retryBtn}>Retry</button>
              </div>
            )}
            <MarketList
              markets={markets}
              loading={loading}
              onTrade={handleTradeClick}
              onSelect={handleMarketSelect}
              selectedMarketId={selectedMarket?.id}
            />
          </div>

          {/* Right Sidebar */}
          {showOrderBook && selectedMarket && sidebarVisible && (
            <div style={styles.sidebarContainer}>
              <button
                onClick={() => setSidebarVisible(false)}
                style={styles.closeOrderBookBtn}
                title="关闭面板"
              >
                ✕
              </button>

              <div style={styles.orderBookColumn}>
                <OrderBook
                  market={selectedMarket}
                  onPriceSelect={handlePriceSelect}
                />

                <button
                  onClick={() => setIsModalOpen(true)}
                  style={styles.quickTradeBtn}
                >
                  Trade {selectedMarket.question?.slice(0, 30)}...
                </button>

                <Orders
                  jwtToken={jwtToken}
                  userAddress={userAddress}
                  onOrderCancelled={fetchMarkets}
                  onViewMarket={(marketId) => {
                    const found = markets.find(m => m.id === marketId || m.marketId === marketId);
                    if (found) {
                      setSelectedMarket(found);
                    } else {
                      window.open(`https://predict.fun/market/${marketId}`, '_blank');
                    }
                  }}
                />

                <Positions
                  jwtToken={jwtToken}
                  userAddress={userAddress}
                  onSelectMarket={handleMarketSelect}
                  signer={signer}
                />
              </div>

              {signer && (
                <div style={styles.approvalColumn}>
                  <ApprovalManager
                    signer={signer}
                    userAddress={userAddress}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Toggle OrderBook Button */}
        <button
          onClick={() => setShowOrderBook(!showOrderBook)}
          style={styles.toggleOrderBookBtn}
        >
          {showOrderBook ? '◀ Hide OrderBook' : '▶ Show OrderBook'}
        </button>

        {/* Trade Modal */}
        <TradeModal
          market={selectedMarket}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          signer={signer}
          jwtToken={jwtToken}
          onTradeSuccess={handleTradeSuccess}
        />
      </div>
    </ToastProvider>
  );
}

const styles = {
  app: {
    minHeight: '100vh',
    backgroundColor: 'var(--bg-primary, #0d1117)'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 24px',
    backgroundColor: 'var(--bg-secondary, #161b22)',
    borderBottom: '1px solid var(--border-color, #30363d)',
    position: 'sticky',
    top: 0,
    zIndex: 100,
    backdropFilter: 'blur(10px)'
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px'
  },
  logo: {
    margin: 0,
    fontSize: '22px',
    fontWeight: '700',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text'
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px'
  },
  accountInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  accountName: {
    fontSize: '13px',
    color: 'var(--text-secondary, #8b949e)',
    fontWeight: '500'
  },
  referralBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 14px',
    backgroundColor: 'rgba(163, 113, 247, 0.1)',
    borderRadius: '10px',
    border: '1px solid rgba(163, 113, 247, 0.3)'
  },
  referralLabel: {
    fontSize: '12px',
    color: 'var(--accent-purple, #a371f7)'
  },
  referralCode: {
    fontSize: '14px',
    fontWeight: '700',
    color: 'var(--accent-purple, #a371f7)',
    cursor: 'pointer',
    fontFamily: 'var(--font-mono, monospace)',
    letterSpacing: '1px'
  },
  copyIcon: {
    fontSize: '12px',
    cursor: 'pointer',
    opacity: 0.7
  },
  authStatus: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '12px',
    color: 'var(--accent-green, #3fb950)',
    fontWeight: '500',
    padding: '6px 12px',
    backgroundColor: 'rgba(63, 185, 80, 0.1)',
    borderRadius: '20px'
  },
  mainContent: {
    display: 'flex',
    padding: '24px',
    gap: '24px',
    maxWidth: '1600px',
    margin: '0 auto'
  },
  marketSection: {
    flex: 1,
    minWidth: 0
  },
  sidebarContainer: {
    position: 'fixed',
    top: 0,
    right: 0,
    zIndex: 50,
    display: 'flex',
    gap: '16px',
    height: '100vh',
    maxHeight: '100vh',
    backgroundColor: 'var(--bg-primary, #0d1117)',
    boxShadow: '-8px 0 32px rgba(0, 0, 0, 0.4)',
    padding: '16px',
    paddingTop: '0'
  },
  orderBookColumn: {
    width: '380px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    height: '100vh',
    maxHeight: '100vh',
    overflowY: 'auto',
    paddingTop: '16px',
    paddingBottom: '16px'
  },
  approvalColumn: {
    width: '320px',
    flexShrink: 0,
    height: '100vh',
    maxHeight: '100vh',
    overflowY: 'auto',
    paddingTop: '16px',
    paddingBottom: '16px'
  },
  closeOrderBookBtn: {
    position: 'absolute',
    top: '8px',
    right: '8px',
    width: '28px',
    height: '28px',
    border: 'none',
    borderRadius: '50%',
    backgroundColor: 'var(--bg-tertiary, #21262d)',
    color: 'var(--text-secondary, #8b949e)',
    fontSize: '14px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    transition: 'all 0.2s'
  },
  errorBanner: {
    padding: '14px 18px',
    backgroundColor: 'rgba(248, 81, 73, 0.1)',
    color: 'var(--accent-red, #f85149)',
    borderRadius: '12px',
    marginBottom: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    border: '1px solid rgba(248, 81, 73, 0.3)'
  },
  retryBtn: {
    padding: '8px 16px',
    border: '1px solid var(--accent-red, #f85149)',
    backgroundColor: 'transparent',
    color: 'var(--accent-red, #f85149)',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '500',
    transition: 'all 0.2s'
  },
  quickTradeBtn: {
    width: '100%',
    marginTop: '12px',
    padding: '14px 20px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: '#fff',
    border: 'none',
    borderRadius: '12px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)',
    transition: 'all 0.2s'
  },
  toggleOrderBookBtn: {
    position: 'fixed',
    right: '24px',
    bottom: '24px',
    padding: '12px 20px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: '#fff',
    border: 'none',
    borderRadius: '25px',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
    boxShadow: '0 4px 20px rgba(102, 126, 234, 0.5)',
    transition: 'all 0.2s'
  }
};
