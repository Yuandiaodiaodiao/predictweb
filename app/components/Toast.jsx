'use client';

import React, { useState, useEffect, createContext, useContext } from 'react';

// 错误消息翻译
const errorTranslations = {
  'Insufficient shares: available balance is less than the total ask amount.': '份额不足：可用余额小于卖出总量',
  'Insufficient collateral: available allowance is less than the total bid amount.': '抵押品不足：授权额度小于买入总量',
  'Price precision is 3. Max allowed is 2 decimal points': '价格精度错误：最多允许2位小数',
  'Order must have a value of at least 0.9 USD': '订单价值必须至少为 0.9 USD',
  'InvalidSignature': '签名无效，请重新连接钱包',
  'Neg risk adapter not approved by the owner': 'NegRisk Adapter 未授权，请先授权',
  'Operator not approved': '合约未授权，请先在授权管理中授权',
  'User rejected the request': '用户拒绝了请求',
  'User denied transaction signature': '用户拒绝签名',
};

// 翻译错误消息
const translateError = (message) => {
  if (!message) return '未知错误';

  // 精确匹配
  if (errorTranslations[message]) {
    return errorTranslations[message];
  }

  // 部分匹配
  for (const [key, value] of Object.entries(errorTranslations)) {
    if (message.includes(key)) {
      return value;
    }
  }

  return message;
};

// Toast Context
const ToastContext = createContext();

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

// Toast Provider
export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = (message, type = 'error', duration = 5000) => {
    const id = Date.now();
    const translatedMessage = type === 'error' ? translateError(message) : message;

    setToasts(prev => [...prev, { id, message: translatedMessage, type }]);

    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  };

  const showError = (message) => addToast(message, 'error');
  const showSuccess = (message) => addToast(message, 'success');
  const showInfo = (message) => addToast(message, 'info');

  const removeToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showError, showSuccess, showInfo }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
};

// Toast Container
const ToastContainer = ({ toasts, onRemove }) => {
  if (toasts.length === 0) return null;

  return (
    <div style={styles.container}>
      {toasts.map(toast => (
        <Toast key={toast.id} toast={toast} onRemove={() => onRemove(toast.id)} />
      ))}
    </div>
  );
};

// Single Toast
const Toast = ({ toast, onRemove }) => {
  const [isExiting, setIsExiting] = useState(false);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(onRemove, 300);
  };

  const getIcon = () => {
    switch (toast.type) {
      case 'success': return '✅';
      case 'error': return '❌';
      case 'info': return 'ℹ️';
      default: return '📢';
    }
  };

  const getStyle = () => {
    const baseStyle = { ...styles.toast };
    if (isExiting) {
      baseStyle.animation = 'slideOut 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards';
    }
    switch (toast.type) {
      case 'success':
        return { ...baseStyle, boxShadow: '4px 4px 0 0 var(--quaternary, #34D399)' };
      case 'error':
        return { ...baseStyle, boxShadow: '4px 4px 0 0 var(--accent-red, #F87171)' };
      case 'info':
        return { ...baseStyle, boxShadow: '4px 4px 0 0 var(--accent, #8B5CF6)' };
      default:
        return baseStyle;
    }
  };

  return (
    <div style={getStyle()}>
      <span style={styles.icon}>{getIcon()}</span>
      <span style={styles.message}>{toast.message}</span>
      <button onClick={handleClose} style={styles.closeBtn}>×</button>
    </div>
  );
};

const styles = {
  container: {
    position: 'fixed',
    top: '24px',
    right: '24px',
    zIndex: 10000,
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    maxWidth: '420px',
  },
  toast: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    padding: '16px 18px',
    backgroundColor: 'var(--card, #FFFFFF)',
    borderRadius: '16px',
    border: '2px solid var(--foreground, #1E293B)',
    boxShadow: '4px 4px 0 0 var(--foreground, #1E293B)',
    animation: 'slideIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
  icon: {
    fontSize: '20px',
    flexShrink: 0,
  },
  message: {
    flex: 1,
    fontSize: '14px',
    fontWeight: '600',
    color: 'var(--foreground, #1E293B)',
    lineHeight: '1.5',
  },
  closeBtn: {
    background: 'var(--muted, #F1F5F9)',
    border: '2px solid var(--foreground, #1E293B)',
    borderRadius: '50%',
    width: '28px',
    height: '28px',
    fontSize: '14px',
    fontWeight: '700',
    color: 'var(--foreground, #1E293B)',
    cursor: 'pointer',
    padding: '0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    boxShadow: '2px 2px 0 0 var(--foreground, #1E293B)',
    transition: 'all 0.2s',
  },
};

export default Toast;
