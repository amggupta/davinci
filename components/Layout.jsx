import React from 'react';
import Navbar from './Navbar';
import Footer from './Footer';
import styles from '../styles/Layout.module.css';
import Head from 'next/head';

const Layout = ({ children, viewMode, onViewModeChange }) => {
  return (
    <>
      <Head>
        <title>daVinci - Figure Generator</title>
        <meta name="description" content="Generate and manage SVG illustrations" />
        <link rel="icon" href="/dv_logo.png" />
      </Head>
      <div className={styles.container}>
        <Navbar viewMode={viewMode} onViewModeChange={onViewModeChange} />
        <main className={styles.main}>
          {children}
        </main>
        <Footer />
      </div>
    </>
  );
};

export default Layout; 