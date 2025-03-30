import React from 'react';
import Link from 'next/link';
import ViewSelector from './ViewSelector';
import styles from '../styles/Navbar.module.css';

const Navbar = ({ viewMode, onViewModeChange }) => {
  return (
    <nav className={styles.navbar}>
      <div className={styles.logo}>
        <Link href="/">
          <div className={styles.appName}>
            <span className={styles.highlight}>daVinci</span> <span className={styles.highlight2}>Figure Generator</span>
          </div>
        </Link>
      </div>
      {viewMode !== undefined && onViewModeChange && (
        <div className={styles.viewSelectorContainer}>
          <ViewSelector currentView={viewMode} onViewChange={onViewModeChange} />
        </div>
      )}
    </nav>
  );
};

export default Navbar; 