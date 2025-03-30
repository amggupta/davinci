import React, { useState, useEffect, useRef, useCallback } from 'react';
import styles from '../styles/FollowupModal.module.css';
import { OpenAI } from 'openai';
import Modal from './Modal';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true // This is needed for client-side usage
});

const FollowupModal = ({ 
  isOpen,
  figure, 
  type, 
  onClose, 
  onAccept, 
  assistantId, 
  threadId,
  currentSvg,
  instructions,
  onUpdate = () => console.warn('onUpdate not provided')
}) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [processingSubmission, setProcessingSubmission] = useState(false); // Track submission state separately
  const [progress, setProgress] = useState(0); // For progress indication
  const [error, setError] = useState(null);
  const [generatedSvg, setGeneratedSvg] = useState('');
  const messagesEndRef = useRef(null);
  const progressIntervalRef = useRef(null);
  
  // Memoize fetchMessages to avoid recreating on every render
  const fetchMessages = useCallback(async () => {
    if (!threadId) return;
    
    try {
      setLoading(true);
      const response = await fetch(`/api/threads/${threadId}/messages`);
      const data = await response.json();
      
      if (data.success) {
        setMessages(data.messages);
      } else {
        throw new Error(data.error || 'Failed to fetch messages');
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
      setError('Failed to load messages');
    } finally {
      setLoading(false);
    }
  }, [threadId]);
  
  // Only fetch messages when modal opens
  useEffect(() => {
    if (isOpen && threadId) {
      fetchMessages();
    }
  }, [isOpen, threadId, fetchMessages]);
  
  // Clear state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setGeneratedSvg('');
      setError(null);
      setProgress(0);
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    }
  }, [isOpen]);
  
  // Cleanup progress interval on unmount
  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, []);
  
  // Scroll to bottom of messages when they change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);
  
  // Start progress animation
  const startProgressAnimation = () => {
    // Reset progress
    setProgress(0);
    
    // Clear any existing interval
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }
    
    // Set up progress animation
    progressIntervalRef.current = setInterval(() => {
      setProgress(prevProgress => {
        // Slowly increase progress, but never reach 100% until complete
        if (prevProgress < 90) {
          // Move quickly to 60%, then slow down
          const increment = prevProgress < 60 ? 2 : 0.5;
          return prevProgress + increment;
        }
        return prevProgress;
      });
    }, 300); // Update every 300ms
  };
  
  // Stop progress animation
  const stopProgressAnimation = () => {
    clearInterval(progressIntervalRef.current);
    progressIntervalRef.current = null;
    setProgress(100); // Complete the progress bar
    
    // Reset to 0 after a delay
    setTimeout(() => {
      setProgress(0);
    }, 500);
  };
  
  // Handle sending a new message
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || processingSubmission) return;
    
    setProcessingSubmission(true); // Prevents modal closing
    setLoading(true);
    setError(null);
    startProgressAnimation();
    
    try {
      // Add user message to UI immediately
      const userMessage = {
        role: 'user',
        content: newMessage,
        createdAt: new Date().toISOString()
      };
      setMessages(prev => [...prev, userMessage]);
      setNewMessage('');
      
      // Submit to the API
      const response = await fetch(`/api/threads/${threadId}/followup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: newMessage,
          assistantId: assistantId
        })
      });
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to send message');
      }
      
      // Extract SVG from the assistant's response
      if (data.assistantResponse) {
        // Add assistant message to UI
        const assistantMessage = {
          role: 'assistant',
          content: data.assistantResponse,
          createdAt: new Date().toISOString()
        };
        setMessages(prev => [...prev, assistantMessage]);
        
        // Try to extract SVG
        const svgMatch = data.assistantResponse.match(/<svg[\s\S]*?<\/svg>/i);
        if (svgMatch) {
          const extractedSvg = svgMatch[0];
          setGeneratedSvg(extractedSvg);
          console.log('Extracted SVG from response:', extractedSvg.substring(0, 100) + '...');
        } else {
          console.log('No SVG pattern found in response');
          setGeneratedSvg(data.assistantResponse);
        }
      }
      
      // Don't set currentSvg here unless it's what you want to update
      // Remove or comment out this line if it's causing confusion:
      // setCurrentSvg(data.svg);
    } catch (error) {
      console.error('Error sending message:', error);
      setError(error.message || 'Failed to send message');
    } finally {
      stopProgressAnimation();
      setLoading(false);
      setProcessingSubmission(false); // Allow modal closing again
    }
  };
  
  // Format date for message timestamps
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Handle attempt to close the modal
  const handleClose = () => {
    // Only allow closing if not processing a submission
    if (!processingSubmission) {
      onClose();
    }
  };

  const handleSvgUpdate = useCallback((svgContent) => {
    // Log the incoming data
    console.log('handleSvgUpdate called with:', svgContent ? svgContent.substring(0, 100) + '...' : 'null');
    console.log('followupType:', type);
    
    if (!svgContent || !type) {
      console.error('Missing required data for update:', { svgContent: !!svgContent, type });
      return;
    }
    
    // Make sure we're updating the correct field based on the followupType
    const updateData = {};
    if (type === 'withImage') {
      updateData.output_svg_with_image = svgContent;
    } else {
      updateData.output_svg_txt_only = svgContent;
    }
    
    console.log('Update data being sent:', JSON.stringify(updateData));
    console.log('followupType:', type);
    console.log('svgContent length:', svgContent ? svgContent.length : 0);
    
    // Make the API call
    fetch(`/api/figures/${figure._id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updateData)
    })
    .then(response => {
      console.log('API response status:', response.status);
      return response.json();
    })
    .then(data => {
      console.log('API response data:', data);
      if (data.success) {
        console.log('SVG updated successfully');
        // Ensure this call happens with the right data
        if (onUpdate) onUpdate(data.data);
        onClose();
      } else {
        console.error('API returned error:', data.error);
      }
    })
    .catch(error => {
      console.error('Error updating SVG:', error);
    });
  }, [figure._id, type, onUpdate, onClose]);

  // Handle accepting the generated SVG
  const handleAccept = useCallback(() => {
    if (!generatedSvg) {
      console.error('No generated SVG content available to save');
      setError('No SVG content to save');
      return;
    }
    
    console.log('Accept button clicked');
    console.log('Generated SVG state:', generatedSvg ? generatedSvg.substring(0, 100) + '...' : 'null');
    
    if (generatedSvg) {
      console.log('Sending generatedSvg to update');
      onUpdate(generatedSvg);
    } else {
      console.error('No generated SVG content available to save');
    }
  }, [generatedSvg, onUpdate]);

  return (
    <Modal isOpen={isOpen} onClose={handleClose} disableClose={processingSubmission}>
      <div className={styles.modalHeader}>
        <h3>{type === 'withImage' ? 'SVG with Image Follow-up' : 'SVG (Text Only) Follow-up'}</h3>
        <button 
          className={styles.closeButton} 
          onClick={handleClose}
          disabled={processingSubmission}
          aria-label="Close modal"
        >
          ×
        </button>
      </div>
      
      {/* Progress bar */}
      {progress > 0 && (
        <div className={styles.progressContainer}>
          <div 
            className={styles.progressBar} 
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      )}
      
      <div className={styles.modalBody}>
        {/* Left Column - Conversation */}
        <div className={styles.conversationColumn}>
          <div className={styles.messagesContainer}>
            {loading && messages.length === 0 ? (
              <div className={styles.loading}>Loading conversation...</div>
            ) : messages.length === 0 ? (
              <div className={styles.emptyMessages}>
                <p>No message history yet.</p>
                <p>Instructions:</p>
                <pre className={styles.instructions}>{instructions}</pre>
              </div>
            ) : (
              <>
                <div className={styles.messageContainer}>
                  {[...messages].reverse().map((msg, index) => (
                    <div 
                      key={index} 
                      className={`${styles.message} ${msg.role === 'user' ? styles.userMessage : styles.assistantMessage}`}
                    >
                      <div className={styles.messageHeader}>
                        <span className={styles.messageRole}>{msg.role === 'user' ? 'You' : 'Assistant'}</span>
                        <span className={styles.messageTime}>{formatDate(msg.createdAt)}</span>
                      </div>
                      <div className={styles.messageContent}>
                        {msg.content}
                      </div>
                    </div>
                  ))}
                </div>
                <div ref={messagesEndRef} />
              </>
            )}
          </div>
          
          <form className={styles.messageForm} onSubmit={handleSubmit}>
            {error && <div className={styles.error}>{error}</div>}
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Enter your follow-up request or feedback..."
              className={styles.messageInput}
              rows={3}
              disabled={loading || processingSubmission}
            />
            <button 
              type="submit" 
              className={`${styles.submitButton} ${processingSubmission ? styles.processing : ''}`}
              disabled={loading || processingSubmission || !newMessage.trim()}
            >
              {processingSubmission ? 'Processing...' : loading ? 'Sending...' : 'Submit'}
            </button>
          </form>
        </div>
        
        {/* Right Column - SVG Preview */}
        <div className={styles.svgColumn}>
          <h4 className={styles.previewTitle}>SVG Preview</h4>
          <div className={styles.svgPreview}>
            {processingSubmission && (
              <div className={styles.processingOverlay}>
                <div className={styles.spinner}></div>
                <p>Generating SVG...</p>
              </div>
            )}
            {generatedSvg ? (
              <div dangerouslySetInnerHTML={{ __html: generatedSvg }} />
            ) : currentSvg ? (
              <div dangerouslySetInnerHTML={{ __html: currentSvg }} />
            ) : (
              <div className={styles.emptySvg}>No SVG available</div>
            )}
          </div>
          
          <div className={styles.svgActions}>
            <button 
              className={styles.rejectButton}
              onClick={handleClose}
              disabled={processingSubmission}
            >
              Reject
            </button>
            <button 
              className={styles.acceptButton}
              onClick={handleAccept}
              disabled={!generatedSvg || processingSubmission}
            >
              Accept
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default FollowupModal; 