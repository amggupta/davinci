import React, { useState, useEffect } from 'react';
import styles from '../styles/BatchView.module.css';
import { formatAssetId } from '../utils/cardHelpers';

const BatchView = ({ figures, onUpdate }) => {
  const [selectedFigures, setSelectedFigures] = useState([]);
  const [processingStatus, setProcessingStatus] = useState({
    isProcessing: false,
    action: null,
    totalSelected: 0,
    completed: 0,
    inProgress: [],
    error: null
  });
  const [filterMode, setFilterMode] = useState('all'); // 'all' or 'stale'
  const [displayedFigures, setDisplayedFigures] = useState(figures);

  // Apply filters when filterMode or figures change
  useEffect(() => {
    if (filterMode === 'all') {
      setDisplayedFigures(figures);
    } else {
      // Stale only - filter figures
      const staleFigures = figures.filter(figure => {
        const inputUpdated = figure.input_updated ? new Date(figure.input_updated) : null;
        const stepsGenerated = figure.steps_generated ? new Date(figure.steps_generated) : null;
        const svgGenerated = figure.svg_generated ? new Date(figure.svg_generated) : null;

        // Figure is stale if:
        // 1. input_updated exists and is after steps_generated or steps_generated doesn't exist
        // 2. steps_generated exists and is after svg_generated or svg_generated doesn't exist
        return (
          (inputUpdated && (!stepsGenerated || inputUpdated > stepsGenerated)) ||
          (stepsGenerated && (!svgGenerated || stepsGenerated > svgGenerated))
        );
      });
      
      setDisplayedFigures(staleFigures);
    }
  }, [filterMode, figures]);

  // Reset selected figures when displayed figures change
  useEffect(() => {
    setSelectedFigures([]);
  }, [displayedFigures]);

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedFigures(displayedFigures.map(fig => fig._id));
    } else {
      setSelectedFigures([]);
    }
  };

  const handleSelectFigure = (figureId) => {
    setSelectedFigures(prev => {
      if (prev.includes(figureId)) {
        return prev.filter(id => id !== figureId);
      } else {
        return [...prev, figureId];
      }
    });
  };

  const processFiguresInBatches = async (action) => {
    if (selectedFigures.length === 0 || processingStatus.isProcessing) return;

    const BATCH_SIZE = 8;
    const totalSelected = selectedFigures.length;
    let processedCount = 0;
    let successCount = 0;
    
    // Set initial processing state
    setProcessingStatus({
      isProcessing: true,
      action: action,
      totalSelected,
      completed: 0,
      inProgress: [],
      error: null
    });

    // Create a copy of selected figures to process
    const figuresToProcess = [...selectedFigures];
    
    // Process in batches
    while (figuresToProcess.length > 0) {
      // Take up to BATCH_SIZE figures for this batch
      const batch = figuresToProcess.splice(0, BATCH_SIZE);
      
      // Update status with current batch
      setProcessingStatus(prev => ({
        ...prev,
        inProgress: batch.map(id => {
          const fig = figures.find(f => f._id === id);
          return {
            id,
            assetId: fig?.ASSET_ID || id.substring(0, 8),
            status: 'processing'
          };
        })
      }));
      
      // Process the batch in parallel
      const batchPromises = batch.map(async (figureId) => {
        try {
          const figure = figures.find(f => f._id === figureId);
          if (!figure) throw new Error(`Figure not found: ${figureId}`);
          
          const endpoint = action === 'sketchbook' 
            ? `/api/figures/generateInstructions/${figureId}`
            : `/api/figures/generateSVG/${figureId}`;
          
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ generateBoth: true })
          });
          
          const data = await response.json();
          
          if (!data.success) {
            throw new Error(data.error || 'Generation failed');
          }
          
          return { figureId, success: true };
        } catch (error) {
          console.error(`Error processing figure ${figureId}:`, error);
          return { figureId, success: false, error: error.message };
        }
      });
      
      // Wait for all promises in this batch to complete
      const batchResults = await Promise.allSettled(batchPromises);
      
      // Update counts and status
      processedCount += batch.length;
      const batchSuccessCount = batchResults.filter(r => 
        r.status === 'fulfilled' && r.value.success
      ).length;
      successCount += batchSuccessCount;
      
      // Update processing status
      setProcessingStatus(prev => ({
        ...prev,
        completed: processedCount,
        inProgress: [],
      }));
      
      // Wait a moment before starting the next batch
      if (figuresToProcess.length > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // All batches are complete
    setProcessingStatus(prev => ({
      ...prev,
      isProcessing: false,
      completed: totalSelected,
      inProgress: []
    }));
    
    // Refresh the figures to get updated status
    if (onUpdate) {
      // This should trigger a fetch of all figures with their new states
      onUpdate();
    }
  };

  const handleBatchAction = (action) => {
    processFiguresInBatches(action);
  };

  return (
    <div className={styles.batchView}>
      <div className={styles.batchControls}>
        <div className={styles.actionButtons}>
          <button 
            className={styles.actionButton}
            onClick={() => handleBatchAction('sketchbook')}
            disabled={selectedFigures.length === 0 || processingStatus.isProcessing}
          >
            Create Sketchbook
          </button>
          <button 
            className={styles.actionButton}
            onClick={() => handleBatchAction('davinciCode')}
            disabled={selectedFigures.length === 0 || processingStatus.isProcessing}
          >
            Create daVinci Code
          </button>
        </div>
        
        <div className={styles.filterControl}>
          <select 
            value={filterMode}
            onChange={(e) => setFilterMode(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="all">All Items</option>
            <option value="stale">Stale Only</option>
          </select>
        </div>
      </div>
      
      {processingStatus.isProcessing && (
        <div className={styles.processingStatus}>
          <div className={styles.processingHeader}>
            {processingStatus.action === 'sketchbook' ? 'Creating Sketchbooks' : 'Creating daVinci Code'}
            <div className={styles.progressInfo}>
              {processingStatus.completed} of {processingStatus.totalSelected} complete
            </div>
          </div>
          
          {processingStatus.inProgress.length > 0 && (
            <div className={styles.currentBatch}>
              <div className={styles.batchHeader}>Currently Processing:</div>
              <div className={styles.batchItems}>
                {processingStatus.inProgress.map(item => (
                  <div key={item.id} className={styles.batchItem}>
                    {item.assetId} <span className={styles.processing}>processing...</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <div className={styles.progressBar}>
            <div 
              className={styles.progressFill} 
              style={{ width: `${(processingStatus.completed / processingStatus.totalSelected) * 100}%` }}
            ></div>
          </div>
        </div>
      )}
      
      <div className={styles.tableContainer}>
        <table className={styles.figuresTable}>
          <thead>
            <tr>
              <th className={styles.checkboxColumn}>
                <input 
                  type="checkbox" 
                  onChange={handleSelectAll}
                  checked={selectedFigures.length === displayedFigures.length && displayedFigures.length > 0}
                />
              </th>
              <th className={styles.imageColumn}>Image</th>
              <th className={styles.assetIdColumn}>Asset ID</th>
              <th className={styles.titleColumn}>Title</th>
              <th className={styles.statusColumn}>Status</th>
            </tr>
          </thead>
          <tbody>
            {displayedFigures.length === 0 ? (
              <tr>
                <td colSpan="5" className={styles.noItems}>
                  No items match the current filter
                </td>
              </tr>
            ) : (
              displayedFigures.map(figure => (
                <tr 
                  key={figure._id}
                  className={selectedFigures.includes(figure._id) ? styles.selectedRow : ''}
                >
                  <td className={styles.checkboxColumn}>
                    <input 
                      type="checkbox"
                      checked={selectedFigures.includes(figure._id)}
                      onChange={() => handleSelectFigure(figure._id)}
                    />
                  </td>
                  <td className={styles.imageColumn}>
                    {figure.img_url ? (
                      <img 
                        src={figure.img_url} 
                        alt={figure.title} 
                        className={styles.thumbnail}
                      />
                    ) : (
                      <div className={styles.noImage}>No Image</div>
                    )}
                  </td>
                  <td className={styles.assetIdColumn}>
                    {figure.ASSET_ID ? formatAssetId(figure.ASSET_ID) : 'N/A'}
                  </td>
                  <td className={styles.titleColumn}>
                    {figure.lesson_title || figure.title || 'Untitled'}
                  </td>
                  <td className={styles.statusColumn}>
                    <span className={`${styles.statusBadge} ${styles[figure.current_state || 'pending']}`}>
                      {figure.current_state || 'pending'}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      
      <div className={styles.selectionInfo}>
        {selectedFigures.length} of {displayedFigures.length} items selected
      </div>
    </div>
  );
};

export default BatchView; 