import React from 'react';
import styles from '../styles/FigureCard.module.css';
import { getThreadUrl } from '../utils/cardHelpers';

const ColumnTitle = ({ title, threadId, assistantId }) => {
  const threadUrl = threadId && assistantId ? getThreadUrl(threadId, assistantId) : null;
  
  return threadUrl ? (
    <a 
      href={threadUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={styles.columnTitleLink}
      title="Click to view thread in OpenAI Playground"
    >
      <h3 className={styles.columnTitle}>{title}</h3>
    </a>
  ) : (
    <h3 className={styles.columnTitle}>{title}</h3>
  );
};

export default React.memo(ColumnTitle); 