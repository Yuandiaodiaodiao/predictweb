'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ethers } from 'ethers';

let AddressesByChainId = null;

const loadSDKAddresses = async () => {
  if (AddressesByChainId) return AddressesByChainId;
  try {
    const sdk = await import('@predictdotfun/sdk');
    AddressesByChainId = sdk.AddressesByChainId;
    return AddressesByChainId;
  } catch (err) {
    console.error('Failed to load SDK addresses:', err);
    return null;
  }
};

const BSC_CHAIN_ID = 56;

const ERC20_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function decimals() view returns (uint8)',
];

const ERC1155_ABI = [
  'function setApprovalForAll(address operator, bool approved)',
  'function isApprovedForAll(address account, address operator) view returns (bool)',
];

const ApprovalDropdown = ({ signer, userAddress }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [addresses, setAddresses] = useState(null);
  const [approvalAmount, setApprovalAmount] = useState('100');
  const [decimals, setDecimals] = useState(18);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    loadSDKAddresses().then(addr => {
      if (addr && addr[BSC_CHAIN_ID]) {
        setAddresses(addr[BSC_CHAIN_ID]);
      }
    });
  }, []);

  useEffect(() => {
    if (signer && userAddress && addresses) {
      checkAllApprovals();
    }
  }, [signer, userAddress, addresses]);

  const checkAllApprovals = async () => {
    if (!signer || !userAddress || !addresses) return;

    setLoading(true);
    const results = [];

    try {
      const {
        CTF_EXCHANGE,
        NEG_RISK_CTF_EXCHANGE,
        NEG_RISK_ADAPTER,
        CONDITIONAL_TOKENS,
        USDT,
        COLLATERAL
      } = addresses;

      const usdtAddress = USDT || COLLATERAL;

      if (!usdtAddress || !CTF_EXCHANGE) {
        console.error('Missing required addresses');
        setLoading(false);
        return;
      }

      const usdtContract = new ethers.Contract(usdtAddress, ERC20_ABI, signer);

      // Get token decimals
      try {
        const tokenDecimals = await usdtContract.decimals();
        setDecimals(Number(tokenDecimals));
      } catch (err) {
        console.warn('Could not get decimals, defaulting to 18');
      }

      const usdtSpenders = [
        { key: 'CTF_EXCHANGE', name: 'CTF Exchange', address: CTF_EXCHANGE },
      ];

      if (NEG_RISK_CTF_EXCHANGE && NEG_RISK_CTF_EXCHANGE !== CTF_EXCHANGE) {
        usdtSpenders.push({ key: 'NEG_RISK_CTF_EXCHANGE', name: 'NegRisk CTF Exchange', address: NEG_RISK_CTF_EXCHANGE });
      }

      if (NEG_RISK_ADAPTER) {
        usdtSpenders.push({ key: 'NEG_RISK_ADAPTER', name: 'NegRisk Adapter', address: NEG_RISK_ADAPTER });
      }

      for (const spender of usdtSpenders) {
        try {
          const allowance = await usdtContract.allowance(userAddress, spender.address);
          results.push({
            id: `usdt_${spender.key}`,
            type: 'ERC20',
            token: 'USDT',
            spender: spender.name,
            spenderAddress: spender.address,
            tokenAddress: usdtAddress,
            allowance: allowance,
            isApproved: allowance > 0n,
            isUnlimited: allowance >= ethers.MaxUint256 / 2n,
          });
        } catch (err) {
          console.error(`Error checking USDT allowance for ${spender.key}:`, err);
        }
      }

      if (CONDITIONAL_TOKENS) {
        const ctContract = new ethers.Contract(CONDITIONAL_TOKENS, ERC1155_ABI, signer);

        const erc1155Operators = [
          { key: 'CTF_EXCHANGE', name: 'CTF Exchange', address: CTF_EXCHANGE },
        ];

        if (NEG_RISK_CTF_EXCHANGE && NEG_RISK_CTF_EXCHANGE !== CTF_EXCHANGE) {
          erc1155Operators.push({ key: 'NEG_RISK_CTF_EXCHANGE', name: 'NegRisk CTF Exchange', address: NEG_RISK_CTF_EXCHANGE });
        }

        if (NEG_RISK_ADAPTER) {
          erc1155Operators.push({ key: 'NEG_RISK_ADAPTER', name: 'NegRisk Adapter', address: NEG_RISK_ADAPTER });
        }

        for (const operator of erc1155Operators) {
          try {
            const isApproved = await ctContract.isApprovedForAll(userAddress, operator.address);
            results.push({
              id: `ct_${operator.key}`,
              type: 'ERC1155',
              token: 'ConditionalTokens',
              spender: operator.name,
              spenderAddress: operator.address,
              tokenAddress: CONDITIONAL_TOKENS,
              isApproved: isApproved,
            });
          } catch (err) {
            console.error(`Error checking CT approval for ${operator.key}:`, err);
          }
        }
      }
    } catch (err) {
      console.error('Error checking approvals:', err);
    }

    setApprovals(results);
    setLoading(false);
  };

  const handleApprove = async (approval) => {
    if (!signer) return;

    const amount = parseFloat(approvalAmount);
    if (isNaN(amount) || amount <= 0) {
      alert('请输入有效的授权额度');
      return;
    }

    setActionLoading(approval.id);

    try {
      if (approval.type === 'ERC20') {
        const contract = new ethers.Contract(approval.tokenAddress, ERC20_ABI, signer);
        // Convert to token units with proper decimals
        const amountInWei = ethers.parseUnits(approvalAmount, decimals);
        const tx = await contract.approve(approval.spenderAddress, amountInWei);
        await tx.wait();
      } else if (approval.type === 'ERC1155') {
        const contract = new ethers.Contract(approval.tokenAddress, ERC1155_ABI, signer);
        const tx = await contract.setApprovalForAll(approval.spenderAddress, true);
        await tx.wait();
      }

      await checkAllApprovals();
      alert('授权成功！');
    } catch (err) {
      console.error('Approval failed:', err);
      if (err.code === 'ACTION_REJECTED') {
        alert('用户取消了交易');
      } else {
        alert(`授权失败: ${err.message}`);
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleRevoke = async (approval) => {
    if (!signer) return;

    if (!confirm(`确定要取消对 ${approval.spender} 的授权吗？`)) return;

    setActionLoading(approval.id);

    try {
      if (approval.type === 'ERC20') {
        const contract = new ethers.Contract(approval.tokenAddress, ERC20_ABI, signer);
        const tx = await contract.approve(approval.spenderAddress, 0);
        await tx.wait();
      } else if (approval.type === 'ERC1155') {
        const contract = new ethers.Contract(approval.tokenAddress, ERC1155_ABI, signer);
        const tx = await contract.setApprovalForAll(approval.spenderAddress, false);
        await tx.wait();
      }

      await checkAllApprovals();
      alert('已取消授权');
    } catch (err) {
      console.error('Revoke failed:', err);
      if (err.code === 'ACTION_REJECTED') {
        alert('用户取消了交易');
      } else {
        alert(`取消授权失败: ${err.message}`);
      }
    } finally {
      setActionLoading(null);
    }
  };

  const formatAllowance = (allowance, tokenDecimals = decimals) => {
    if (!allowance || allowance === 0n) return '0';
    if (allowance >= ethers.MaxUint256 / 2n) return '无限';
    try {
      const formatted = ethers.formatUnits(allowance, tokenDecimals);
      const num = parseFloat(formatted);
      if (num > 1000000) return `${(num / 1000000).toFixed(2)}M`;
      if (num > 1000) return `${(num / 1000).toFixed(2)}K`;
      return num.toFixed(2);
    } catch {
      return '---';
    }
  };

  const approvedCount = approvals.filter(a => a.isApproved).length;
  const totalCount = approvals.length;

  if (!signer || !userAddress) {
    return (
      <div style={styles.triggerDisabled}>
        <span style={styles.lockIcon}>🔐</span>
        <span>授权管理</span>
      </div>
    );
  }

  return (
    <div style={styles.container} ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={styles.triggerButton}
      >
        <span style={styles.lockIcon}>🔐</span>
        <span>授权管理</span>
        <span style={styles.badge}>
          {approvedCount}/{totalCount}
        </span>
        <span style={styles.arrow}>{isOpen ? '▲' : '▼'}</span>
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div style={styles.dropdown}>
          <div style={styles.dropdownHeader}>
            <h4 style={styles.dropdownTitle}>授权管理</h4>
            <button
              onClick={checkAllApprovals}
              style={styles.refreshBtn}
              disabled={loading}
            >
              {loading ? '...' : '🔄 刷新'}
            </button>
          </div>

          {/* Approval Amount Input */}
          <div style={styles.inputSection}>
            <label style={styles.inputLabel}>授权额度 (USDT)</label>
            <div style={styles.inputWrapper}>
              <input
                type="number"
                value={approvalAmount}
                onChange={(e) => setApprovalAmount(e.target.value)}
                style={styles.input}
                placeholder="输入授权额度"
                min="0"
              />
              <span style={styles.inputSuffix}>USDT</span>
            </div>
            <div style={styles.quickAmounts}>
              {[50, 100, 500, 1000].map(amount => (
                <button
                  key={amount}
                  onClick={() => setApprovalAmount(String(amount))}
                  style={{
                    ...styles.quickAmountBtn,
                    ...(approvalAmount === String(amount) ? styles.quickAmountBtnActive : {})
                  }}
                >
                  {amount}
                </button>
              ))}
            </div>
          </div>

          {/* Approvals List */}
          {loading ? (
            <div style={styles.loadingState}>检查授权状态...</div>
          ) : (
            <div style={styles.approvalsList}>
              {approvals.map((approval) => (
                <div key={approval.id} style={styles.approvalItem}>
                  <div style={styles.approvalInfo}>
                    <div style={styles.approvalHeader}>
                      <span style={styles.tokenBadge}>{approval.token}</span>
                      <span style={styles.typeBadge}>{approval.type}</span>
                      <button
                        onClick={() => window.open(`https://bscscan.com/address/${approval.spenderAddress}`, '_blank')}
                        style={styles.inspectBtn}
                        title="在 BSCScan 查看合约"
                      >
                        View in BSCScan
                      </button>
                    </div>
                    <div style={styles.spenderName}>{approval.spender}</div>
                    <div style={styles.spenderAddress}>{approval.spenderAddress}</div>
                    {approval.type === 'ERC20' && (
                      <div style={styles.allowanceDisplay}>
                        剩余额度: <strong style={styles.allowanceValue}>
                          {formatAllowance(approval.allowance)}
                        </strong>
                      </div>
                    )}
                  </div>

                  <div style={styles.approvalActions}>
                    {approval.isApproved ? (
                      <>
                        <span style={styles.approvedStatus}>✓</span>
                        <button
                          onClick={() => handleApprove(approval)}
                          style={styles.addMoreBtn}
                          disabled={actionLoading === approval.id}
                          title="追加授权"
                        >
                          {actionLoading === approval.id ? '...' : '+'}
                        </button>
                        <button
                          onClick={() => handleRevoke(approval)}
                          style={styles.revokeBtn}
                          disabled={actionLoading === approval.id}
                        >
                          {actionLoading === approval.id ? '...' : '取消'}
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => handleApprove(approval)}
                        style={styles.approveBtn}
                        disabled={actionLoading === approval.id}
                      >
                        {actionLoading === approval.id ? '授权中...' : '授权'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Footer */}
          <div style={styles.dropdownFooter}>
            <span style={styles.footerText}>
              {approvedCount === totalCount ? '✅ 所有合约已授权' : `⚠️ ${totalCount - approvedCount} 项待授权`}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

const styles = {
  container: {
    position: 'relative',
  },
  triggerButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px 18px',
    backgroundColor: '#E0E5EC',
    border: 'none',
    borderRadius: '16px',
    color: '#3D4852',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 300ms ease-out',
    boxShadow: '5px 5px 10px rgb(163, 177, 198, 0.6), -5px -5px 10px rgba(255, 255, 255, 0.5)',
    minHeight: 'auto',
  },
  triggerDisabled: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px 18px',
    backgroundColor: '#E0E5EC',
    border: 'none',
    borderRadius: '16px',
    color: '#6B7280',
    fontSize: '13px',
    cursor: 'not-allowed',
    boxShadow: 'inset 4px 4px 8px rgb(163, 177, 198, 0.6), inset -4px -4px 8px rgba(255, 255, 255, 0.5)',
  },
  lockIcon: {
    fontSize: '15px',
  },
  badge: {
    padding: '4px 10px',
    backgroundColor: '#E0E5EC',
    color: '#38B2AC',
    borderRadius: '9999px',
    fontSize: '11px',
    fontWeight: '700',
    boxShadow: 'inset 2px 2px 4px rgb(163, 177, 198, 0.5), inset -2px -2px 4px rgba(255, 255, 255, 0.4)',
  },
  arrow: {
    fontSize: '10px',
    color: '#6B7280',
  },
  dropdown: {
    position: 'absolute',
    top: 'calc(100% + 12px)',
    right: 0,
    width: '440px',
    backgroundColor: '#E0E5EC',
    borderRadius: '24px',
    boxShadow: '12px 12px 20px rgb(163, 177, 198, 0.7), -12px -12px 20px rgba(255, 255, 255, 0.6)',
    zIndex: 1000,
    overflow: 'hidden',
  },
  dropdownHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '18px 20px',
    boxShadow: '0 4px 6px rgb(163, 177, 198, 0.3)',
  },
  dropdownTitle: {
    margin: 0,
    fontSize: '16px',
    fontWeight: '700',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    color: '#3D4852',
  },
  refreshBtn: {
    padding: '10px 16px',
    border: 'none',
    borderRadius: '12px',
    backgroundColor: '#E0E5EC',
    color: '#5A6570',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '600',
    transition: 'all 300ms ease-out',
    boxShadow: '4px 4px 8px rgb(163, 177, 198, 0.6), -4px -4px 8px rgba(255, 255, 255, 0.5)',
    minHeight: 'auto',
  },
  inputSection: {
    padding: '18px 20px',
  },
  inputLabel: {
    display: 'block',
    marginBottom: '10px',
    fontSize: '12px',
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  inputWrapper: {
    display: 'flex',
    alignItems: 'center',
    backgroundColor: '#E0E5EC',
    borderRadius: '16px',
    overflow: 'hidden',
    boxShadow: 'inset 6px 6px 10px rgb(163, 177, 198, 0.6), inset -6px -6px 10px rgba(255, 255, 255, 0.5)',
  },
  input: {
    flex: 1,
    padding: '14px 16px',
    border: 'none',
    backgroundColor: 'transparent',
    color: '#3D4852',
    fontSize: '14px',
    outline: 'none',
    boxShadow: 'none',
  },
  inputSuffix: {
    padding: '0 16px',
    fontSize: '13px',
    color: '#6B7280',
    fontWeight: '600',
  },
  quickAmounts: {
    display: 'flex',
    gap: '8px',
    marginTop: '12px',
  },
  quickAmountBtn: {
    flex: 1,
    padding: '10px 0',
    border: 'none',
    borderRadius: '12px',
    backgroundColor: '#E0E5EC',
    color: '#5A6570',
    fontSize: '12px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 300ms ease-out',
    boxShadow: '4px 4px 8px rgb(163, 177, 198, 0.6), -4px -4px 8px rgba(255, 255, 255, 0.5)',
    minHeight: 'auto',
  },
  quickAmountBtnActive: {
    backgroundColor: '#6C63FF',
    color: '#fff',
  },
  loadingState: {
    padding: '36px',
    textAlign: 'center',
    color: '#6B7280',
    fontSize: '14px',
  },
  approvalsList: {
    maxHeight: '300px',
    overflowY: 'auto',
    padding: '12px',
  },
  approvalItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px',
    backgroundColor: '#E0E5EC',
    borderRadius: '16px',
    marginBottom: '10px',
    boxShadow: '5px 5px 10px rgb(163, 177, 198, 0.6), -5px -5px 10px rgba(255, 255, 255, 0.5)',
  },
  approvalInfo: {
    flex: 1,
  },
  approvalHeader: {
    display: 'flex',
    gap: '8px',
    marginBottom: '6px',
  },
  tokenBadge: {
    padding: '4px 10px',
    backgroundColor: '#E0E5EC',
    color: '#6C63FF',
    borderRadius: '8px',
    fontSize: '11px',
    fontWeight: '600',
    boxShadow: 'inset 2px 2px 4px rgb(163, 177, 198, 0.5), inset -2px -2px 4px rgba(255, 255, 255, 0.4)',
  },
  typeBadge: {
    padding: '4px 10px',
    backgroundColor: '#E0E5EC',
    color: '#DD6B20',
    borderRadius: '8px',
    fontSize: '11px',
    boxShadow: 'inset 2px 2px 4px rgb(163, 177, 198, 0.5), inset -2px -2px 4px rgba(255, 255, 255, 0.4)',
  },
  spenderName: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#3D4852',
    marginBottom: '4px',
  },
  spenderAddress: {
    fontSize: '11px',
    fontFamily: "'JetBrains Mono', monospace",
    color: '#6B7280',
    wordBreak: 'break-all',
    marginBottom: '6px',
    padding: '6px 10px',
    backgroundColor: '#E0E5EC',
    borderRadius: '8px',
    boxShadow: 'inset 2px 2px 4px rgb(163, 177, 198, 0.5), inset -2px -2px 4px rgba(255, 255, 255, 0.4)',
  },
  inspectBtn: {
    padding: '4px 10px',
    border: 'none',
    borderRadius: '8px',
    backgroundColor: '#E0E5EC',
    color: '#6C63FF',
    cursor: 'pointer',
    fontSize: '10px',
    fontWeight: '600',
    marginLeft: 'auto',
    transition: 'all 300ms ease-out',
    boxShadow: '3px 3px 6px rgb(163, 177, 198, 0.6), -3px -3px 6px rgba(255, 255, 255, 0.5)',
    minHeight: 'auto',
  },
  allowanceDisplay: {
    fontSize: '12px',
    color: '#5A6570',
  },
  allowanceValue: {
    color: '#38B2AC',
    fontWeight: '600',
  },
  approvalActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  approvedStatus: {
    color: '#38B2AC',
    fontSize: '16px',
    marginRight: '6px',
  },
  approveBtn: {
    padding: '10px 18px',
    border: 'none',
    borderRadius: '12px',
    backgroundColor: '#6C63FF',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '600',
    transition: 'all 300ms ease-out',
    boxShadow: '4px 4px 8px rgb(163, 177, 198, 0.6), -4px -4px 8px rgba(255, 255, 255, 0.5)',
    minHeight: 'auto',
  },
  addMoreBtn: {
    padding: '8px 14px',
    border: 'none',
    borderRadius: '10px',
    backgroundColor: '#E0E5EC',
    color: '#6C63FF',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '700',
    boxShadow: '3px 3px 6px rgb(163, 177, 198, 0.6), -3px -3px 6px rgba(255, 255, 255, 0.5)',
    minHeight: 'auto',
  },
  revokeBtn: {
    padding: '8px 14px',
    border: 'none',
    borderRadius: '10px',
    backgroundColor: '#E0E5EC',
    color: '#E53E3E',
    cursor: 'pointer',
    fontSize: '11px',
    fontWeight: '600',
    boxShadow: '3px 3px 6px rgb(163, 177, 198, 0.6), -3px -3px 6px rgba(255, 255, 255, 0.5)',
    minHeight: 'auto',
  },
  dropdownFooter: {
    padding: '16px 20px',
    textAlign: 'center',
    boxShadow: '0 -4px 6px rgb(163, 177, 198, 0.3)',
  },
  footerText: {
    fontSize: '13px',
    color: '#5A6570',
    fontWeight: '500',
  },
};

export default ApprovalDropdown;
