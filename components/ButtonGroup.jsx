import React from 'react';
import styles from '../styles/FigureCard.module.css';
import { getThreadUrl, handleDownloadSvg } from '../utils/cardHelpers';

const ThreadButton = ({ threadId, assistantId, label }) => {
  if (!threadId || !assistantId) return null;
  
  const threadUrl = getThreadUrl(threadId, assistantId);
  if (!threadUrl) return null;
  
  return (
    <a
      href={threadUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={styles.threadButton}
    >
      {label}
    </a>
  );
};

const FollowupButton = ({ onClick, disabled }) => (
  <button 
    className={styles.followupButton}
    onClick={onClick}
    disabled={disabled}
  >
    Follow-up
  </button>
);

const DownloadButton = ({ svgContent, fileName }) => {
  if (!svgContent) return null;
  
  return (
    <button 
      className={styles.downloadButton}
      onClick={() => handleDownloadSvg(svgContent, fileName)}
      title="Download SVG"
      aria-label="Download SVG"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="7 10 12 15 17 10"></polyline>
        <line x1="12" y1="15" x2="12" y2="3"></line>
      </svg>
    </button>
  );
};

const ButtonGroup = ({ 
  threadId, 
  assistantId, 
  threadLabel, 
  svgContent, 
  fileName,
  onFollowup,
  disableFollowup 
}) => {
  return (
    <div className={styles.buttonGroup}>
      <div className={styles.leftButtons}>
        <ThreadButton 
          threadId={threadId} 
          assistantId={assistantId} 
          label={threadLabel} 
        />
      </div>
      <div className={styles.rightButtons}>
        <FollowupButton 
          onClick={onFollowup}
          disabled={disableFollowup}
        />
        <DownloadButton 
          svgContent={svgContent}
          fileName={fileName}
        />
      </div>
    </div>
  );
};

export default React.memo(ButtonGroup); 