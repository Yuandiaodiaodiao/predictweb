'use client';

import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';

// BSC 主网配置
const BSC_CHAIN_ID = '0x38'; // 56 in hex
const BSC_CHAIN_CONFIG = {
  chainId: BSC_CHAIN_ID,
  chainName: 'BNB Smart Chain',
  nativeCurrency: {
    name: 'BNB',
    symbol: 'BNB',
    decimals: 18
  },
  rpcUrls: ['https://bsc-dataseed.binance.org/'],
  blockExplorerUrls: ['https://bscscan.com/']
};

const WalletConnect = ({ onConnect }) => {
  const [account, setAccount] = useState('');
  const [provider, setProvider] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [isCorrectNetwork, setIsCorrectNetwork] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.ethereum) {
      const newProvider = new ethers.BrowserProvider(window.ethereum);
      setProvider(newProvider);

      // 监听链变化
      window.ethereum.on('chainChanged', (newChainId) => {
        console.log('Chain changed to:', newChainId);
        setChainId(newChainId);
        setIsCorrectNetwork(newChainId === BSC_CHAIN_ID);
        window.location.reload();
      });

      // 监听账户变化
      window.ethereum.on('accountsChanged', (accounts) => {
        if (accounts.length === 0) {
          setAccount('');
        } else {
          setAccount(accounts[0]);
        }
      });

      // 获取当前链
      window.ethereum.request({ method: 'eth_chainId' }).then((currentChainId) => {
        setChainId(currentChainId);
        setIsCorrectNetwork(currentChainId === BSC_CHAIN_ID);
      });
    }
  }, []);

  // 切换到 BSC 网络
  const switchToBSC = async () => {
    if (typeof window === 'undefined' || !window.ethereum) {
      alert('请安装 MetaMask!');
      return false;
    }

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: BSC_CHAIN_ID }]
      });
      return true;
    } catch (switchError) {
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [BSC_CHAIN_CONFIG]
          });
          return true;
        } catch (addError) {
          console.error('Error adding BSC network:', addError);
          alert('添加 BSC 网络失败，请手动在钱包中添加');
          return false;
        }
      }
      console.error('Error switching to BSC:', switchError);
      return false;
    }
  };

  const connectWallet = async () => {
    if (!provider) {
      alert('请安装 MetaMask!');
      return;
    }

    try {
      const switched = await switchToBSC();
      if (!switched) {
        return;
      }

      const newProvider = new ethers.BrowserProvider(window.ethereum);
      setProvider(newProvider);

      const accounts = await newProvider.send("eth_requestAccounts", []);
      setAccount(accounts[0]);

      const signer = await newProvider.getSigner();

      const network = await newProvider.getNetwork();
      console.log('Connected to network:', network.chainId);

      if (network.chainId !== 56n) {
        alert('请切换到 BSC 网络后重试');
        return;
      }

      setIsCorrectNetwork(true);
      onConnect(signer, accounts[0]);

    } catch (error) {
      console.error("Error connecting wallet:", error);
      if (error.code === 4001) {
        alert('连接被拒绝');
      } else {
        alert(`连接失败: ${error.message}`);
      }
    }
  };

  const getNetworkName = () => {
    if (!chainId) return '未连接';
    switch (chainId) {
      case '0x38':
        return 'BSC 主网';
      case '0x61':
        return 'BSC 测试网';
      case '0x1':
        return 'Ethereum';
      case '0x89':
        return 'Polygon';
      default:
        return `Chain ${parseInt(chainId, 16)}`;
    }
  };

  return (
    <div style={styles.container}>
      {account ? (
        <div style={styles.connected}>
          <div style={styles.networkBadge}>
            <span style={{
              ...styles.networkDot,
              backgroundColor: isCorrectNetwork ? '#4caf50' : '#ff9800'
            }} />
            <span style={styles.networkName}>{getNetworkName()}</span>
          </div>
          <span style={styles.address}>
            {account.slice(0, 6)}...{account.slice(-4)}
          </span>
          {!isCorrectNetwork && (
            <button onClick={switchToBSC} style={styles.switchBtn}>
              切换到 BSC
            </button>
          )}
        </div>
      ) : (
        <button onClick={connectWallet} style={styles.connectBtn}>
          连接钱包 (BSC)
        </button>
      )}
    </div>
  );
};

const styles = {
  container: {
    display: 'flex',
    alignItems: 'center'
  },
  connected: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  networkBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 16px',
    backgroundColor: '#E0E5EC',
    borderRadius: '16px',
    fontSize: '12px',
    fontWeight: '500',
    boxShadow: '5px 5px 10px rgb(163, 177, 198, 0.6), -5px -5px 10px rgba(255, 255, 255, 0.5)'
  },
  networkDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    boxShadow: '0 0 8px currentColor'
  },
  networkName: {
    color: '#5A6570'
  },
  address: {
    padding: '10px 16px',
    backgroundColor: '#E0E5EC',
    color: '#6C63FF',
    borderRadius: '16px',
    fontSize: '13px',
    fontWeight: '600',
    fontFamily: "'JetBrains Mono', monospace",
    boxShadow: 'inset 5px 5px 10px rgb(163, 177, 198, 0.6), inset -5px -5px 10px rgba(255, 255, 255, 0.5)'
  },
  switchBtn: {
    padding: '10px 18px',
    backgroundColor: '#DD6B20',
    color: '#fff',
    border: 'none',
    borderRadius: '16px',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 300ms ease-out',
    boxShadow: '5px 5px 10px rgb(163, 177, 198, 0.6), -5px -5px 10px rgba(255, 255, 255, 0.5)'
  },
  connectBtn: {
    padding: '14px 28px',
    backgroundColor: '#6C63FF',
    color: '#fff',
    border: 'none',
    borderRadius: '16px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    boxShadow: '8px 8px 16px rgb(163, 177, 198, 0.6), -8px -8px 16px rgba(255, 255, 255, 0.5)',
    transition: 'all 300ms ease-out'
  }
};

export default WalletConnect;
