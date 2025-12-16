'use client';

import React, { useState } from 'react';
import Orders from './Orders';
import Positions from './Positions';

const OrdersPositionsTabs = ({ jwtToken, userAddress, signer, onOrderCancelled, onViewMarket, onSelectMarket }) => {
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
            onOrderCancelled={onOrderCancelled}
            onViewMarket={onViewMarket}
          />
        ) : (
          <Positions
            jwtToken={jwtToken}
            userAddress={userAddress}
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
    backgroundColor: 'var(--bg-card, #1c2128)',
    borderRadius: '12px',
    border: '1px solid var(--border-color, #30363d)',
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'hidden'
  },
  tabHeader: {
    display: 'flex',
    borderBottom: '1px solid var(--border-color, #30363d)',
    backgroundColor: 'var(--bg-secondary, #161b22)'
  },
  tabBtn: {
    flex: 1,
    padding: '12px 16px',
    border: 'none',
    backgroundColor: 'transparent',
    color: 'var(--text-muted, #6e7681)',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    transition: 'all 0.2s',
    borderBottom: '2px solid transparent',
    marginBottom: '-1px'
  },
  tabBtnActive: {
    color: 'var(--text-primary, #f0f6fc)',
    borderBottomColor: 'var(--accent-blue, #58a6ff)',
    backgroundColor: 'var(--bg-card, #1c2128)'
  },
  tabIcon: {
    fontSize: '14px'
  },
  tabContent: {
    flex: 1,
    overflow: 'auto',
    padding: '0'
  }
};

export default OrdersPositionsTabs;
