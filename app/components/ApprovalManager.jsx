'use client';

import React, { useState, useEffect } from 'react';
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
];

const ERC1155_ABI = [
  'function setApprovalForAll(address operator, bool approved)',
  'function isApprovedForAll(address account, address operator) view returns (bool)',
];

const ApprovalManager = ({ signer, userAddress }) => {
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [addresses, setAddresses] = useState(null);

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

    setActionLoading(approval.id);

    try {
      if (approval.type === 'ERC20') {
        const contract = new ethers.Contract(approval.tokenAddress, ERC20_ABI, signer);
        const tx = await contract.approve(approval.spenderAddress, ethers.MaxUint256);
        await tx.wait();
      } else if (approval.type === 'ERC1155') {
        const contract = new ethers.Contract(approval.tokenAddress, ERC1155_ABI, signer);
        const tx = await contract.setApprovalForAll(approval.spenderAddress, true);
        await tx.wait();
      }

      await checkAllApprovals();
      alert('✅ 授权成功！');
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
      alert('✅ 已取消授权');
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

  const formatAllowance = (allowance) => {
    if (!allowance || allowance === 0n) return '0';
    if (allowance >= ethers.MaxUint256 / 2n) return '无限';
    const formatted = ethers.formatUnits(allowance, 18);
    const num = parseFloat(formatted);
    if (num > 1000000) return `${(num / 1000000).toFixed(2)}M`;
    if (num > 1000) return `${(num / 1000).toFixed(2)}K`;
    return num.toFixed(2);
  };

  const approveAll = async () => {
    const unapproved = approvals.filter(a => !a.isApproved);
    if (unapproved.length === 0) {
      alert('所有合约已授权！');
      return;
    }

    for (const approval of unapproved) {
      await handleApprove(approval);
    }
  };

  const approvedCount = approvals.filter(a => a.isApproved).length;
  const totalCount = approvals.length;

  if (!signer || !userAddress) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <h3 style={styles.title}>🔐 授权管理</h3>
        </div>
        <div style={styles.emptyState}>
          请先连接钱包
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>🔐 授权管理</h3>
        <div style={styles.headerRight}>
          <span style={styles.statusBadge}>
            {approvedCount}/{totalCount} 已授权
          </span>
          <button
            onClick={checkAllApprovals}
            style={styles.refreshBtn}
            disabled={loading}
          >
            {loading ? '...' : '🔄'}
          </button>
        </div>
      </div>

      {approvedCount < totalCount && (
        <button
          onClick={approveAll}
          style={styles.approveAllBtn}
          disabled={loading}
        >
          ✅ 一键授权所有 ({totalCount - approvedCount} 项未授权)
        </button>
      )}

      {loading ? (
        <div style={styles.loading}>检查授权状态...</div>
      ) : (
        <div style={styles.approvalsList}>
          {approvals.map((approval) => (
            <div key={approval.id} style={styles.approvalCard}>
              <div style={styles.approvalInfo}>
                <div style={styles.approvalHeader}>
                  <span style={styles.tokenBadge}>{approval.token}</span>
                  <span style={styles.typeBadge}>{approval.type}</span>
                </div>
                <div style={styles.spenderName}>{approval.spender}</div>
                <div style={styles.spenderAddress}>
                  {approval.spenderAddress.slice(0, 10)}...{approval.spenderAddress.slice(-6)}
                </div>
                {approval.type === 'ERC20' && (
                  <div style={styles.allowanceInfo}>
                    额度: <strong>{formatAllowance(approval.allowance)}</strong>
                  </div>
                )}
              </div>

              <div style={styles.approvalActions}>
                {approval.isApproved ? (
                  <>
                    <span style={styles.approvedBadge}>✓ 已授权</span>
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
    </div>
  );
};

const styles = {
  container: {
    backgroundColor: 'var(--card, #FFFFFF)',
    borderRadius: '20px',
    padding: '20px',
    border: '2px solid var(--foreground, #1E293B)',
    boxShadow: '6px 6px 0 0 var(--accent, #8B5CF6)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  },
  title: {
    margin: 0,
    fontSize: '18px',
    fontWeight: '700',
    fontFamily: 'var(--font-heading, Outfit)',
    color: 'var(--foreground, #1E293B)',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  statusBadge: {
    padding: '6px 14px',
    backgroundColor: 'var(--quaternary, #34D399)',
    color: 'white',
    borderRadius: '9999px',
    fontSize: '12px',
    fontWeight: '700',
    border: '2px solid var(--foreground, #1E293B)',
    boxShadow: '2px 2px 0 0 var(--foreground, #1E293B)',
  },
  refreshBtn: {
    padding: '8px 12px',
    border: '2px solid var(--foreground, #1E293B)',
    borderRadius: '12px',
    backgroundColor: 'var(--muted, #F1F5F9)',
    cursor: 'pointer',
    fontSize: '16px',
    boxShadow: '2px 2px 0 0 var(--foreground, #1E293B)',
    transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
  approveAllBtn: {
    width: '100%',
    padding: '14px',
    border: '2px solid var(--foreground, #1E293B)',
    borderRadius: '9999px',
    backgroundColor: 'var(--quaternary, #34D399)',
    color: 'white',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '700',
    fontFamily: 'var(--font-heading, Outfit)',
    marginBottom: '16px',
    boxShadow: '4px 4px 0 0 var(--foreground, #1E293B)',
    transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
  loading: {
    textAlign: 'center',
    padding: '24px',
    color: 'var(--muted-foreground, #64748B)',
    fontFamily: 'var(--font-body, Plus Jakarta Sans)',
  },
  emptyState: {
    textAlign: 'center',
    padding: '24px',
    color: 'var(--muted-foreground, #64748B)',
    fontFamily: 'var(--font-body, Plus Jakarta Sans)',
  },
  approvalsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  approvalCard: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '14px',
    backgroundColor: 'var(--muted, #F1F5F9)',
    borderRadius: '16px',
    border: '2px solid var(--foreground, #1E293B)',
    boxShadow: '3px 3px 0 0 var(--tertiary, #FBBF24)',
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
    backgroundColor: 'var(--accent, #8B5CF6)',
    color: 'white',
    borderRadius: '9999px',
    fontSize: '10px',
    fontWeight: '700',
    border: '1px solid var(--foreground, #1E293B)',
  },
  typeBadge: {
    padding: '4px 10px',
    backgroundColor: 'var(--tertiary, #FBBF24)',
    color: 'var(--foreground, #1E293B)',
    borderRadius: '9999px',
    fontSize: '10px',
    fontWeight: '600',
    border: '1px solid var(--foreground, #1E293B)',
  },
  spenderName: {
    fontSize: '14px',
    fontWeight: '700',
    color: 'var(--foreground, #1E293B)',
    fontFamily: 'var(--font-heading, Outfit)',
  },
  spenderAddress: {
    fontSize: '11px',
    color: 'var(--muted-foreground, #64748B)',
    fontFamily: 'var(--font-mono, JetBrains Mono)',
  },
  allowanceInfo: {
    fontSize: '12px',
    color: 'var(--muted-foreground, #64748B)',
    marginTop: '4px',
  },
  approvalActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  approvedBadge: {
    padding: '6px 12px',
    backgroundColor: 'var(--quaternary, #34D399)',
    color: 'white',
    borderRadius: '9999px',
    fontSize: '11px',
    fontWeight: '700',
    border: '2px solid var(--foreground, #1E293B)',
  },
  approveBtn: {
    padding: '10px 18px',
    border: '2px solid var(--foreground, #1E293B)',
    borderRadius: '9999px',
    backgroundColor: 'var(--accent, #8B5CF6)',
    color: 'white',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '700',
    boxShadow: '3px 3px 0 0 var(--foreground, #1E293B)',
    transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
  revokeBtn: {
    padding: '6px 14px',
    border: '2px solid var(--accent-red, #F87171)',
    borderRadius: '9999px',
    backgroundColor: 'transparent',
    color: 'var(--accent-red, #F87171)',
    cursor: 'pointer',
    fontSize: '11px',
    fontWeight: '600',
    transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
};

export default ApprovalManager;
