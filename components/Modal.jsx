import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import styles from '../styles/Modal.module.css';

const Modal = ({ isOpen, onClose, children, disableClose = false }) => {
  // Prevent scrolling of the body while modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [isOpen]);

  // Handle escape key to close modal
  useEffect(() => {
    const handleEsc = (event) => {
      if (!disableClose && event.key === 'Escape') {
        onClose();
      }
    };
    
    if (isOpen) {
      window.addEventListener('keydown', handleEsc);
    }
    
    return () => {
      window.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen, onClose, disableClose]);
  
  // Handle click outside modal content to close
  const handleOverlayClick = (e) => {
    if (!disableClose && e.target === e.currentTarget) {
      onClose();
    }
  };

  // Don't render anything if the modal is not open
  if (!isOpen) return null;
  
  // Use createPortal to render the modal directly to the body
  return createPortal(
    <div 
      className={`${styles.overlay} ${disableClose ? styles.processing : ''}`}
      onClick={handleOverlayClick}
    >
      <div 
        className={styles.modalContainer}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body
  );
};

export default Modal; 