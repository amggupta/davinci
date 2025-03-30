import React from 'react';
import styles from '../styles/LessonCard.module.css';

const LessonCard = ({ lesson, onGenerate }) => {
  return (
    <div className={styles.card}>
      <div className={styles.imageContainer}>
        {lesson.img_url ? (
          <img 
            src={lesson.img_url} 
            alt={lesson.img_caption || lesson.lesson_title} 
            className={styles.image}
          />
        ) : (
          <div className={styles.noImage}>No Image Available</div>
        )}
      </div>

      <div className={styles.content}>
        <h3 className={styles.title}>{lesson.lesson_title}</h3>
        {lesson.subheading && <p className={styles.subheading}>{lesson.subheading}</p>}
        
        <div className={styles.instructionsContainer}>
          <div className={styles.instructionSection}>
            <h4>Instructions with Image:</h4>
            <p>{lesson.instructions_with_image || 'None'}</p>
          </div>
          
          <div className={styles.instructionSection}>
            <h4>Instructions (Text Only):</h4>
            <p>{lesson.Instruction_txt_only || 'None'}</p>
          </div>
        </div>
        
        <div className={styles.footer}>
          <span className={styles.assetId}>Asset ID: {lesson.ASSET_ID}</span>
          <button 
            className={styles.generateButton}
            onClick={() => onGenerate(lesson._id)}
          >
            Generate
          </button>
        </div>
      </div>
    </div>
  );
};

export default LessonCard; 