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
        if (window.ethereum) {
            const newProvider = new ethers.BrowserProvider(window.ethereum);
            setProvider(newProvider);

            // 监听链变化
            window.ethereum.on('chainChanged', (newChainId) => {
                console.log('Chain changed to:', newChainId);
                setChainId(newChainId);
                setIsCorrectNetwork(newChainId === BSC_CHAIN_ID);
                // 重新加载页面以确保状态正确
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
        if (!window.ethereum) {
            alert('请安装 MetaMask!');
            return false;
        }

        try {
            // 尝试切换到 BSC
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: BSC_CHAIN_ID }]
            });
            return true;
        } catch (switchError) {
            // 如果 BSC 网络未添加，则添加它
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
            // 1. 先切换到 BSC 网络
            const switched = await switchToBSC();
            if (!switched) {
                return;
            }

            // 2. 重新创建 provider (网络切换后)
            const newProvider = new ethers.BrowserProvider(window.ethereum);
            setProvider(newProvider);

            // 3. 请求连接钱包
            const accounts = await newProvider.send("eth_requestAccounts", []);
            setAccount(accounts[0]);
            
            // 4. 获取 signer
            const signer = await newProvider.getSigner();
            
            // 5. 验证网络
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
        gap: '6px',
        padding: '6px 12px',
        backgroundColor: 'var(--bg-tertiary, #21262d)',
        borderRadius: '20px',
        fontSize: '12px',
        border: '1px solid var(--border-color, #30363d)'
    },
    networkDot: {
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        boxShadow: '0 0 6px currentColor'
    },
    networkName: {
        color: 'var(--text-secondary, #8b949e)'
    },
    address: {
        padding: '8px 14px',
        backgroundColor: 'rgba(88, 166, 255, 0.1)',
        color: 'var(--accent-blue, #58a6ff)',
        borderRadius: '10px',
        fontSize: '13px',
        fontFamily: 'var(--font-mono, monospace)',
        border: '1px solid rgba(88, 166, 255, 0.3)'
    },
    switchBtn: {
        padding: '8px 14px',
        background: 'linear-gradient(135deg, #f0b90b 0%, #f5a623 100%)',
        color: '#000',
        border: 'none',
        borderRadius: '8px',
        fontSize: '12px',
        fontWeight: '600',
        cursor: 'pointer',
        transition: 'all 0.2s'
    },
    connectBtn: {
        padding: '12px 24px',
        background: 'linear-gradient(135deg, #f0b90b 0%, #f5a623 100%)',
        color: '#000',
        border: 'none',
        borderRadius: '10px',
        fontSize: '14px',
        fontWeight: '600',
        cursor: 'pointer',
        boxShadow: '0 4px 15px rgba(240, 185, 11, 0.4)',
        transition: 'all 0.2s'
    }
};

export default WalletConnect;
