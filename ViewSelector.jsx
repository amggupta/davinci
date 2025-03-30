import React from 'react';
import styles from '../styles/ViewSelector.module.css';

const ViewSelector = ({ currentView, onViewChange }) => {
  return (
    <div className={styles.viewSelector}>
      <label htmlFor="view-select">View:</label>
      <select 
        id="view-select"
        value={currentView}
        onChange={(e) => onViewChange(e.target.value)}
        className={styles.select}
      >
        <option value="card">Card View</option>
        <option value="input">Input View</option>
      </select>
    </div>
  );
};

export default ViewSelector; 