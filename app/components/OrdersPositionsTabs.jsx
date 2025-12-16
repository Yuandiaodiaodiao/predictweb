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
    backgroundColor: 'var(--card, #FFFFFF)',
    borderRadius: '20px',
    border: '2px solid var(--foreground, #1E293B)',
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'hidden',
    boxShadow: '6px 6px 0 0 var(--tertiary, #FBBF24)'
  },
  tabHeader: {
    display: 'flex',
    gap: '8px',
    padding: '12px',
    borderBottom: '2px dashed var(--border, #E2E8F0)',
    backgroundColor: 'var(--muted, #F1F5F9)'
  },
  tabBtn: {
    flex: 1,
    padding: '12px 18px',
    border: '2px solid var(--foreground, #1E293B)',
    borderRadius: '12px',
    backgroundColor: 'var(--card, #FFFFFF)',
    color: 'var(--muted-foreground, #64748B)',
    fontSize: '13px',
    fontWeight: '700',
    fontFamily: 'var(--font-heading, Outfit)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
    boxShadow: 'none'
  },
  tabBtnActive: {
    color: 'white',
    backgroundColor: 'var(--accent, #8B5CF6)',
    boxShadow: '3px 3px 0 0 var(--foreground, #1E293B)'
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
