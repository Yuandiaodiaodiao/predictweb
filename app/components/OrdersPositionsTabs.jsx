'use client';

import React, { useState } from 'react';
import Orders from './Orders';
import Positions from './Positions';

const OrdersPositionsTabs = ({ jwtToken, userAddress, signer, markets = [], onOrderCancelled, onViewMarket, onSelectMarket }) => {
  const [activeTab, setActiveTab] = useState('orders');

  return (
    <div style={styles.container}>
      {/* Tab Header */}
      <div style={styles.tabHeader}>
        <button
          onClick={() => setActiveTab('orders')}
          style={{
            ...styles.tabBtn,
            ...(activeTab === 'orders' ? styles.tabBtnActive : {})
          }}
        >
          <span style={styles.tabIcon}>📋</span>
          挂单
        </button>
        <button
          onClick={() => setActiveTab('positions')}
          style={{
            ...styles.tabBtn,
            ...(activeTab === 'positions' ? styles.tabBtnActive : {})
          }}
        >
          <span style={styles.tabIcon}>💼</span>
          持仓
        </button>
      </div>

      {/* Tab Content */}
      <div style={styles.tabContent}>
        {activeTab === 'orders' ? (
          <Orders
            jwtToken={jwtToken}
            userAddress={userAddress}
            markets={markets}
            onOrderCancelled={onOrderCancelled}
            onViewMarket={onViewMarket}
            onSelectMarket={onSelectMarket}
          />
        ) : (
          <Positions
            jwtToken={jwtToken}
            userAddress={userAddress}
            markets={markets}
            onSelectMarket={onSelectMarket}
            signer={signer}
          />
        )}
      </div>
    </div>
  );
};

const styles = {
  container: {
    backgroundColor: '#E0E5EC',
    borderRadius: '32px',
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'hidden',
    boxShadow: '9px 9px 16px rgb(163, 177, 198, 0.6), -9px -9px 16px rgba(255, 255, 255, 0.5)'
  },
  tabHeader: {
    display: 'flex',
    backgroundColor: '#E0E5EC',
    padding: '8px',
    gap: '4px',
    boxShadow: '0 4px 6px rgb(163, 177, 198, 0.3)'
  },
  tabBtn: {
    flex: 1,
    padding: '14px 20px',
    border: 'none',
    backgroundColor: 'transparent',
    color: '#6B7280',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    transition: 'all 300ms ease-out',
    borderRadius: '16px',
    boxShadow: 'none',
    minHeight: 'auto'
  },
  tabBtnActive: {
    color: '#fff',
    backgroundColor: '#6C63FF',
    boxShadow: '5px 5px 10px rgb(163, 177, 198, 0.6), -5px -5px 10px rgba(255, 255, 255, 0.5)'
  },
  tabIcon: {
    fontSize: '16px'
  },
  tabContent: {
    flex: 1,
    overflow: 'auto',
    padding: '0'
  }
};

export default OrdersPositionsTabs;
