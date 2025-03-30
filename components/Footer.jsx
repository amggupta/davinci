import React from 'react';
import styles from '../styles/Footer.module.css';

const Footer = () => {
  return (
    <footer className={styles.footer}>
      <p className={styles.copyright}>
        © {new Date().getFullYear()} da Vinci Figure Generator. All rights reserved.
      </p>
    </footer>
  );
};

export default Footer; 