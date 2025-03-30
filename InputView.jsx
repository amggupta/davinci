import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import styles from '../styles/InputView.module.css';

const InputListItem = ({ figure, onUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [cleanedXhtml, setCleanedXhtml] = useState(figure.cleaned_xhtml || '');
  const [remarks, setRemarks] = useState(figure.REMARKS || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const handleEdit = () => {
    setIsEditing(true);
  };
  
  const handleCancel = () => {
    // Reset to original values
    setCleanedXhtml(figure.cleaned_xhtml || '');
    setRemarks(figure.REMARKS || '');
    setIsEditing(false);
    setError('');
  };
  
  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch(`/api/figures/${figure._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cleaned_xhtml: cleanedXhtml,
          REMARKS: remarks,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update figure');
      }
      
      const updatedFigure = await response.json();
      setIsEditing(false);
      
      // Log the response to see its structure
      console.log('API Response:', updatedFigure);
      
      // Notify parent component of the update
      if (onUpdate) {
        // Use the correct property depending on your API response structure
        // If the response contains FigureGen instead of Figure
        onUpdate(updatedFigure.data || updatedFigure);
      }
    } catch (error) {
      console.error('Error updating figure:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    // Update local state when figure prop changes
    if (figure) {
      console.log('Figure updated, remarks:', figure.REMARKS); // Debug log
      setCleanedXhtml(figure.cleaned_xhtml || '');
      setRemarks(figure.REMARKS || '');
    }
  }, [figure]);
  
  return (
    <div className={styles.inputListItem}>
      <div className={styles.itemHeader}>
        <h3 className={styles.itemTitle}>{figure.title}</h3>
        {!isEditing ? (
          <button 
            className={styles.editButton} 
            onClick={handleEdit}
          >
            Edit
          </button>
        ) : (
          <div className={styles.actionButtons}>
            <button 
              className={styles.cancelButton} 
              onClick={handleCancel}
              disabled={loading}
            >
              Cancel
            </button>
            <button 
              className={styles.saveButton} 
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Save'}
            </button>
          </div>
        )}
      </div>
      
      <div className={styles.itemContent}>
        {/* Image Section */}
        <div className={styles.imageSection}>
          {figure.img_url ? (
            figure.img_url.startsWith('file-') ? (
              <div className={styles.noImagePlaceholder}>
                <p>OpenAI File: {figure.img_url.substring(0, 10)}...</p>
              </div>
            ) : (
              <div className={styles.imageContainer}>
                <img 
                  src={figure.img_url} 
                  alt={figure.title} 
                  className={styles.figureImage}
                />
              </div>
            )
          ) : (
            <div className={styles.noImagePlaceholder}>
              <p>No Image</p>
            </div>
          )}
        </div>
        
        {/* Content Sections */}
        <div className={styles.contentSection}>
          {/* Cleaned XHTML */}
          <div className={styles.fieldContainer}>
            <label className={styles.fieldLabel}>Cleaned XHTML:</label>
            {isEditing ? (
              <textarea
                value={cleanedXhtml}
                onChange={(e) => setCleanedXhtml(e.target.value)}
                className={styles.textArea}
                rows={6}
                placeholder="Enter cleaned XHTML here..."
              />
            ) : (
              <div className={styles.fieldContent}>
                {figure.cleaned_xhtml ? (
                  <pre className={styles.codeBlock}>{figure.cleaned_xhtml}</pre>
                ) : (
                  <p className={styles.emptyField}>No cleaned XHTML available</p>
                )}
              </div>
            )}
          </div>
          
          {/* Remarks */}
          <div className={styles.fieldContainer}>
            <label className={styles.fieldLabel}>Remarks:</label>
            {isEditing ? (
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className={styles.textArea}
                rows={4}
                placeholder="Enter remarks here..."
              />
            ) : (
              <div className={styles.fieldContent}>
                {figure.REMARKS ? (
                  <p>{figure.REMARKS}</p>
                ) : (
                  <p className={styles.emptyField}>No remarks available</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {error && <div className={styles.errorMessage}>{error}</div>}
    </div>
  );
};

const InputView = ({ figures, onFigureUpdate }) => {
  // Group figures into pairs for two-column layout
  const figuresInPairs = [];
  for (let i = 0; i < figures.length; i += 2) {
    figuresInPairs.push(figures.slice(i, i + 2));
  }
  
  return (
    <div className={styles.inputView}>
      {figuresInPairs.map((pair, rowIndex) => (
        <div key={rowIndex} className={styles.inputRow}>
          {pair.map(figure => (
            <InputListItem 
              key={figure._id} 
              figure={figure} 
              onUpdate={onFigureUpdate}
            />
          ))}
          {/* Add empty placeholder if odd number of items */}
          {pair.length === 1 && <div className={styles.emptyItem} />}
        </div>
      ))}
    </div>
  );
};

export default InputView; 