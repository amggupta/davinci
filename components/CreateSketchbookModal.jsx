import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import styles from '../styles/CreateSketchbookModal.module.css';

const CreateSketchbookModal = ({ isOpen, onClose }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processingStep, setProcessingStep] = useState('');
  const [disableClose, setDisableClose] = useState(false);
  
  // Reset the form when the modal closes
  useEffect(() => {
    if (!isOpen) {
      setTitle('');
      setDescription('');
      setImageFile(null);
      setImagePreview('');
      setError('');
      setUploadProgress(0);
      setProcessingStep('');
      setDisableClose(false);
    }
  }, [isOpen]);
  
  // Handle image file selection
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };
  
  // Upload the image to get a temporary URL
  const uploadImageToTempStorage = async (file) => {
    setProcessingStep('Uploading image...');
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to upload image');
      }
      
      const data = await response.json();
      setUploadProgress(100);
      return data.url; // Return the temporary URL
    } catch (error) {
      console.error('Error uploading image:', error);
      throw error;
    }
  };
  
  // Create the sketchbook with all necessary steps
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    setDisableClose(true);
    setUploadProgress(0);
    
    try {
      // Validate form
      if (!title.trim()) {
        throw new Error('Title is required');
      }
      
      let imgUrl = null;
      
      // Step 1: Upload image to temporary storage if available
      if (imageFile) {
        setProcessingStep('Uploading image to temporary storage...');
        imgUrl = await uploadImageToTempStorage(imageFile);
        setUploadProgress(25);
      }
      
      // Step 2: Create the figure with image already uploaded to OpenAI if needed
      setProcessingStep('Creating sketchbook...');
      const response = await fetch('/api/figures', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          description,
          instructions: "Initial instructions will be generated automatically",
          img_url: imgUrl,
          svg_data: '<svg width="100" height="100"></svg>' // Default placeholder
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create sketchbook');
      }
      
      setUploadProgress(50);
      const figureData = await response.json();
      
      // Step 3: Generate instructions in parallel for with_image and text_only
      setProcessingStep('Generating instructions...');
      
      // Only proceed with image instructions if we have an image
      const promises = [];
      
      // Add the with_image instruction generation if we have an image
      if (imgUrl) {
        const withImagePromise = fetch(`/api/figures/${figureData.data._id}/generate-instructions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'with_image',
            description,
          }),
        });
        promises.push(withImagePromise);
      }
      
      // Always add the text_only instruction generation
      const textOnlyPromise = fetch(`/api/figures/${figureData.data._id}/generate-instructions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'text_only',
          description,
        }),
      });
      promises.push(textOnlyPromise);
      
      // Wait for both to complete
      await Promise.all(promises);
      setUploadProgress(100);
      
      // Success! Close the modal and refresh
      setTimeout(() => {
        setLoading(false);
        setDisableClose(false);
        onClose();
        // Refresh the page to show the new sketchbook
        window.location.reload();
      }, 500);
      
    } catch (error) {
      console.error('Error creating sketchbook:', error);
      setError(error.message);
      setLoading(false);
      setDisableClose(false);
    }
  };
  
  return (
    <Modal isOpen={isOpen} onClose={onClose} disableClose={disableClose}>
      <div className={styles.modalHeader}>
        <h3>Create New Sketchbook</h3>
        <button 
          className={styles.closeButton} 
          onClick={onClose}
          disabled={disableClose}
        >
          ×
        </button>
      </div>
      
      {/* Progress bar */}
      {loading && (
        <div className={styles.progressContainer}>
          <div 
            className={styles.progressBar} 
            style={{ width: `${uploadProgress}%` }}
          ></div>
        </div>
      )}
      
      <div className={styles.modalBody}>
        {loading ? (
          <div className={styles.loadingContainer}>
            <div className={styles.spinner}></div>
            <p>{processingStep}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {error && <div className={styles.error}>{error}</div>}
            
            <div className={styles.formGroup}>
              <label htmlFor="title">Title *</label>
              <input
                id="title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter a title for your sketchbook"
                required
              />
            </div>
            
            <div className={styles.formGroup}>
              <label htmlFor="description">Description (optional)</label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter a description to help the AI understand your sketchbook"
                rows={3}
              />
            </div>
            
            <div className={styles.formGroup}>
              <label htmlFor="image">Upload Image (optional)</label>
              <input
                id="image"
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className={styles.fileInput}
              />
              
              {imagePreview && (
                <div className={styles.imagePreview}>
                  <img src={imagePreview} alt="Preview" />
                </div>
              )}
            </div>
            
            <div className={styles.actionButtons}>
              <button 
                type="button" 
                onClick={onClose} 
                className={styles.cancelButton}
                disabled={disableClose}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className={styles.submitButton}
                disabled={loading || !title.trim()}
              >
                Create Sketchbook
              </button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
};

export default CreateSketchbookModal; 