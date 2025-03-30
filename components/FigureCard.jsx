import React, { useState, useCallback } from 'react';
import styles from '../styles/FigureCard.module.css';
import FollowupModal from './FollowupModal';
import ColumnTitle from './ColumnTitle';
import ButtonGroup from './ButtonGroup';
import { formatDate, formatAssetId } from '../utils/cardHelpers';
import { handleDownloadSvg } from '../utils/cardHelpers';

const OPENAI_ASSISTANT_ID = process.env.OPENAI_ASSISTANT_ID || "asst_Humad9Tup9kbKaDtqMFRJvp8";
const SVG_ASSISTANT_ID = process.env.SVG_ASSISTANT_ID || "asst_DsnxBHp30WJCTlgHLSuhpvKw";

const FigureCard = ({ figure, onUpdate }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [timerId, setTimerId] = useState(null);
  const [activeAction, setActiveAction] = useState(null);
  const [showFollowupModal, setShowFollowupModal] = useState(false);
  const [followupType, setFollowupType] = useState('');

  const renderSVG = (svgContent) => {
    if (!svgContent) return <div className={styles.emptySvg}>No SVG available</div>;
    
    return <div dangerouslySetInnerHTML={{ __html: svgContent }} className={styles.svgContainer} />;
  };

  const startTimer = () => {
    if (timerId) clearInterval(timerId);
    
    setElapsedTime(0);
    
    const id = setInterval(() => {
      setElapsedTime(prev => prev + 1);
    }, 1000);
    
    setTimerId(id);
  };

  const stopTimer = () => {
    if (timerId) {
      clearInterval(timerId);
      setTimerId(null);
    }
  };

  const handleCreateSketchbook = async () => {
    if (isGenerating) return;
    
    console.log(`[FigureCard] Create Sketchbook requested for figure: ${figure._id}`);
    setIsGenerating(true);
    setGenerationError(null);
    setActiveAction('sketchbook');
    startTimer();
    
    try {
      console.log(`[FigureCard] Sending API request to generate instructions in parallel`);
      const response = await fetch(`/api/figures/generateInstructions/${figure._id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ generateBoth: true })
      });
      
      console.log(`[FigureCard] API response received, status: ${response.status}`);
      const data = await response.json();
      
      if (!data.success) {
        console.error(`[FigureCard] API returned error: ${data.error || 'Unknown error'}`);
        throw new Error(data.error || 'Generation failed');
      }
      
      console.log(`[FigureCard] Parallel instruction generation started successfully, beginning polling`);
      pollForUpdates();
      
    } catch (error) {
      console.error(`[FigureCard] Error starting instruction generation: ${error.message}`);
      setGenerationError(error.message);
      setIsGenerating(false);
      setActiveAction(null);
      stopTimer();
    }
  };

  const handleCreateDavinciCode = async () => {
    if (isGenerating) return;
    
    console.log(`[FigureCard] Create da Vinci Code requested for figure: ${figure._id}`);
    setIsGenerating(true);
    setGenerationError(null);
    setActiveAction('davinciCode');
    startTimer();
    
    try {
      console.log(`[FigureCard] Sending API request to generate SVGs in parallel`);
      const response = await fetch(`/api/figures/generateSVG/${figure._id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ generateBoth: true })
      });
      
      console.log(`[FigureCard] API response received, status: ${response.status}`);
      const data = await response.json();
      
      if (!data.success) {
        console.error(`[FigureCard] API returned error: ${data.error || 'Unknown error'}`);
        throw new Error(data.error || 'SVG generation failed');
      }
      
      console.log(`[FigureCard] Parallel SVG generation started successfully, beginning polling`);
      pollForUpdates();
      
    } catch (error) {
      console.error(`[FigureCard] Error starting SVG generation: ${error.message}`);
      setGenerationError(error.message);
      setIsGenerating(false);
      setActiveAction(null);
      stopTimer();
    }
  };

  const pollForUpdates = async () => {
    console.log(`[FigureCard] Starting polling for figure updates: ${figure._id}`);
    let pollCount = 0;
    
    const pollInterval = setInterval(async () => {
      pollCount++;
      console.log(`[FigureCard] Poll #${pollCount} for figure: ${figure._id}`);
      
      try {
        const response = await fetch(`/api/figures/${figure._id}`);
        console.log(`[FigureCard] Poll #${pollCount} response status: ${response.status}`);
        
        const data = await response.json();
        
        if (data.success) {
          const updatedFigure = data.data;
          console.log(`[FigureCard] Poll #${pollCount} got updated figure, state: ${updatedFigure.current_state}`);
          
          if (updatedFigure.current_state !== 'processing') {
            console.log(`[FigureCard] Processing complete, state: ${updatedFigure.current_state}`);
            clearInterval(pollInterval);
            stopTimer();
            setIsGenerating(false);
            setActiveAction(null);
            
            if (onUpdate) {
              console.log(`[FigureCard] Calling parent onUpdate with updated figure`);
              onUpdate(updatedFigure);
            }
          }
        }
      } catch (error) {
        console.error(`[FigureCard] Error polling for updates (poll #${pollCount}): ${error.message}`);
      }
    }, 5000);
    
    setTimeout(() => {
      console.log(`[FigureCard] Polling timeout reached (10 minutes), cleaning up`);
      clearInterval(pollInterval);
      if (isGenerating) {
        console.log(`[FigureCard] Figure still in generating state after timeout, setting error`);
        setIsGenerating(false);
        setActiveAction(null);
        stopTimer();
        setGenerationError('Generation timed out. Please try again.');
      }
    }, 10 * 60 * 1000);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const getButtonLabel = (actionType) => {
    if (!isGenerating) return actionType === 'sketchbook' ? 'Create Sketchbook' : 'Create daVinci Code';
    if (activeAction !== actionType) return actionType === 'sketchbook' ? 'Create Sketchbook' : 'Create daVinci Code';
    return `Generating (${formatTime(elapsedTime)})`;
  };

  const getThreadUrl = (assistantId, threadId) => {
    if (!assistantId || !threadId) return null;
    return `https://platform.openai.com/playground/assistant/${assistantId}?thread=${threadId}`;
  };

  const handleOpenFollowup = useCallback((type) => {
    setFollowupType(type);
    setShowFollowupModal(true);
  }, []);
  
  const handleCloseModal = useCallback(() => {
    setShowFollowupModal(false);
  }, []);
  
  const handleSvgUpdate = useCallback((svgContent) => {
    if (!svgContent || !followupType || !onUpdate) return;
    
    const updateData = {
      [followupType === 'withImage' ? 'output_svg_with_image' : 'output_svg_txt_only']: svgContent
    };
    
    console.log(`Updating SVG for ${followupType} with data:`, updateData);
    
    fetch(`/api/figures/${figure._id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updateData)
    })
    .then(response => {
      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      console.log('SVG update response:', data);
      if (data.success && onUpdate) {
        console.log('Calling onUpdate with updated figure data');
        onUpdate(data.data);
      }
      setShowFollowupModal(false);
    })
    .catch(error => {
      console.error('Error updating SVG:', error);
    });
  }, [figure._id, followupType, onUpdate]);

  console.log("SVG data:", {
    with_image: !!figure.output_svg_with_image,
    with_image_id: figure.with_image_assistant_id,
    text_only: !!figure.output_svg_txt_only, 
    text_only_id: figure.text_only_assistant_id
  });

  const handleDownload = () => {
    // Download logic here...
    
    // Add feedback (temporary visual confirmation)
    const button = document.activeElement;
    const originalText = button.innerHTML;
    
    button.innerHTML = 'Downloaded!';
    button.disabled = true;
    
    setTimeout(() => {
      button.innerHTML = originalText;
      button.disabled = false;
    }, 1500);
  };

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <div className={styles.headerTop}>
          <div className={styles.titleSection}>
            <h2 className={styles.title}>{figure.lesson_title || 'Untitled'}</h2>
            {(figure.ASSET_ID) && (
              <span className={styles.assetId} title={figure.ASSET_ID}>
                {formatAssetId(figure.ASSET_ID)}
              </span>
            )}
          </div>
          <div className={styles.actionButtons}>
            <button 
              className={`${styles.actionButton} ${styles.sketchbookButton}`}
              onClick={handleCreateSketchbook}
              disabled={isGenerating || figure.current_state === 'processing'}
            >
              {getButtonLabel('sketchbook')}
            </button>
            <button 
              className={`${styles.actionButton} ${styles.davinciButton}`}
              onClick={handleCreateDavinciCode}
              disabled={isGenerating || figure.current_state === 'processing' || 
                        (!figure.instructions_with_image && !figure.Instruction_txt_only)}
            >
              {getButtonLabel('davinciCode')}
            </button>
          </div>
        </div>        
      </div>
      
      {generationError && (
        <div className={styles.errorBanner}>
          <span className={styles.errorIcon}>⚠️</span> {generationError}
        </div>
      )}
      
      <div className={`${styles.columnsContainer} horizontalScroll`}>
        <div className={styles.column}>
          <h4 className={styles.columnTitle}>
            <span className={styles.columnTitleText}>Image & Info</span>
          </h4>
          <div className={styles.columnContent}>
            <div className={styles.imageContainer}>
              {figure.img_url ? (
                <img 
                  src={figure.img_url} 
                  alt={figure.img_caption || figure.lesson_title} 
                  className={styles.image}
                />
              ) : (
                <div className={styles.noImage}>No Image</div>
              )}
            </div>
            
            <div className={styles.basicInfo}>
              {figure.lesson_url && (
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>URL:</span>
                  <a href={figure.lesson_url} target="_blank" rel="noopener noreferrer" className={styles.link}>
                    {figure.lesson_url.substring(0, 25)}...
                  </a>
                </div>
              )}
              <span className={styles.infoLabel}>REMARKS:</span>
              {figure.REMARKS && (
                <p className={styles.description}>{figure.REMARKS}</p>
              )}
            </div>
          </div>
        </div>
        
        <div className={styles.column}>
          <h4 className={styles.columnTitle}>
            <ColumnTitle 
              title="Instructions with Image"
              threadId={figure.asst_thread_id_ins_with_image}
              assistantId={OPENAI_ASSISTANT_ID}
            />
          </h4>
          <div className={styles.columnContent}>
            {isGenerating && activeAction === 'sketchbook' && (
              <div className={styles.generatingInfo}>
                <div className={styles.spinner}></div>
                <div>Generating ({formatTime(elapsedTime)})</div>
              </div>
            )}
            <div className={styles.instructionText}>
              {figure.instructions_with_image || 'No instructions with image available'}
            </div>
          </div>
        </div>
        
        <div className={styles.column}>
          <h4 className={styles.columnTitle}>
            <ColumnTitle 
              title="Instructions (Text Only)"
              threadId={figure.asst_thread_id_ins_txt_only}
              assistantId={OPENAI_ASSISTANT_ID}
            />
          </h4>
          <div className={styles.columnContent}>
            {isGenerating && activeAction === 'sketchbook' && (
              <div className={styles.generatingInfo}>
                <div className={styles.spinner}></div>
                <div>Generating ({formatTime(elapsedTime)})</div>
              </div>
            )}
            <div className={styles.instructionText}>
              {figure.Instruction_txt_only || 'No text-only instructions available'}
            </div>
          </div>
        </div>
        
        <div className={styles.column}>
          <div className={styles.columnTitleContainer}>
            <h4 className={styles.columnTitle}>
              <ColumnTitle 
                title="SVG with Image"
                threadId={figure.with_image_thread_id}
                assistantId={figure.with_image_assistant_id}
              />
            </h4>
            {figure.instructions_with_image && (
              <button 
                className={styles.followupButton}
                onClick={() => handleOpenFollowup('withImage')}
                title="Send follow-up request to refine this SVG"
              >
                Follow-up
              </button>
            )}
            {figure.output_svg_with_image && (
              <button 
                className={styles.downloadButton}
                onClick={() => handleDownloadSvg(figure.output_svg_with_image, figure.ASSET_ID
                )}
                title="Download SVG"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
              </button>
            )}
          </div>
          <div className={styles.columnContent}>
            {isGenerating && activeAction === 'davinciCode' && (
              <div className={styles.generatingInfo}>
                <div className={styles.spinner}></div>
                <div>Generating ({formatTime(elapsedTime)})</div>
              </div>
            )}
            {renderSVG(figure.output_svg_with_image)}
          </div>          
        </div>
        
        <div className={styles.column}>
          <div className={styles.columnTitleContainer}>
            <h4 className={styles.columnTitle}>
              <ColumnTitle 
                title="SVG (Text Only)"
                threadId={figure.text_only_thread_id}
                assistantId={figure.text_only_assistant_id}
              />
            </h4>
            {figure.Instruction_txt_only && (
              <button 
                className={styles.followupButton}
                onClick={() => handleOpenFollowup('textOnly')}
                title="Send follow-up request to refine this SVG"
              >
                Follow-up
              </button>
            )}
            {figure.output_svg_txt_only && (
              <button 
                className={styles.downloadButton}
                onClick={() => handleDownloadSvg(figure.output_svg_txt_only, figure.ASSET_ID)}
                title="Download SVG"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
              </button>
            )}
          </div>
          <div className={styles.columnContent}>
            {isGenerating && activeAction === 'davinciCode' && (
              <div className={styles.generatingInfo}>
                <div className={styles.spinner}></div>
                <div>Generating ({formatTime(elapsedTime)})</div>
              </div>
            )}
            {renderSVG(figure.output_svg_txt_only)}
          </div>          
        </div>
      </div>
      
      <div className={styles.footer}>
        <div className={styles.status}>
          <span className={`${styles.statusBadge} ${styles[figure.current_state || 'pending']}`}>
            {figure.current_state || 'pending'}
          </span>
          {figure.image_file_id && (
            <span className={styles.fileIdBadge} title={figure.image_file_id}>
              File ID: {figure.image_file_id.substring(0, 8)}...
            </span>
          )}
        </div>
      </div>
      
      <FollowupModal
        isOpen={showFollowupModal}
        figure={figure}
        type={followupType}
        onClose={handleCloseModal}
        onAccept={handleSvgUpdate}
        assistantId={SVG_ASSISTANT_ID}
        threadId={followupType === 'withImage' 
          ? figure.asst_thread_id_svg_gen_with_image 
          : figure.asst_thread_id_svg_gen_txt_only}
        currentSvg={followupType === 'withImage' 
          ? figure.output_svg_with_image 
          : figure.output_svg_txt_only}
        instructions={followupType === 'withImage' 
          ? figure.instructions_with_image 
          : figure.Instruction_txt_only}
      />
    </div>
  );
};

export default React.memo(FigureCard); 