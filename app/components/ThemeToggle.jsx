'use client';

import React, { useState, useEffect } from 'react';

export default function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // 检查 localStorage 或系统偏好
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      setIsDark(savedTheme === 'dark');
      document.documentElement.setAttribute('data-theme', savedTheme);
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setIsDark(true);
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = isDark ? 'light' : 'dark';
    setIsDark(!isDark);
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
  };

  // 避免 SSR 水合问题
  if (!mounted) {
    return <div style={styles.placeholder} />;
  }

  return (
    <button
      onClick={toggleTheme}
      style={styles.button}
      title={isDark ? '切换到日间模式' : '切换到夜间模式'}
      aria-label={isDark ? '切换到日间模式' : '切换到夜间模式'}
    >
      <span style={styles.iconWrapper}>
        {isDark ? (
          // 太阳图标 - 日间模式
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={styles.icon}
          >
            <circle cx="12" cy="12" r="5" />
            <line x1="12" y1="1" x2="12" y2="3" />
            <line x1="12" y1="21" x2="12" y2="23" />
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
            <line x1="1" y1="12" x2="3" y2="12" />
            <line x1="21" y1="12" x2="23" y2="12" />
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
          </svg>
        ) : (
          // 月亮图标 - 夜间模式
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={styles.icon}
          >
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        )}
      </span>
    </button>
  );
}

const styles = {
  button: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '40px',
    height: '40px',
    padding: '0',
    backgroundColor: 'var(--tertiary, #FBBF24)',
    border: '2px solid var(--foreground, #1E293B)',
    borderRadius: '9999px',
    cursor: 'pointer',
    boxShadow: '3px 3px 0 0 var(--foreground, #1E293B)',
    transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
    color: 'var(--foreground, #1E293B)',
  },
  placeholder: {
    width: '40px',
    height: '40px',
    borderRadius: '9999px',
    backgroundColor: 'var(--muted, #F1F5F9)',
    border: '2px solid var(--border, #E2E8F0)',
  },
  iconWrapper: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    display: 'block',
  },
};
