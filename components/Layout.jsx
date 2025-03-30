import React from 'react';
import Navbar from './Navbar';
import Footer from './Footer';
import styles from '../styles/Layout.module.css';

const Layout = ({ children, viewMode, onViewModeChange }) => {
  return (
    <div className={styles.container}>
      <Navbar viewMode={viewMode} onViewModeChange={onViewModeChange} />
      <main className={styles.main}>
        {children}
      </main>
      <Footer />
    </div>
  );
};

export default Layout; 