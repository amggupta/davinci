import React, { useState } from 'react';
import { InlineMath, BlockMath } from 'react-katex';
import 'katex/dist/katex.min.css';
import styles from '../styles/LaTeXTest.module.css';

const LaTeXTest = () => {
  const [latexInput, setLatexInput] = useState('\\frac{\\pi}{2} > \\theta > \\alpha');
  const [renderType, setRenderType] = useState('inline');
  const [error, setError] = useState(null);
  
  const handleRender = () => {
    setError(null);
    // Rendering happens automatically in the render method
  };
  
  return (
    <div className={styles.container}>
      <h2>LaTeX Rendering Test</h2>
      
      <div className={styles.inputSection}>
        <textarea
          value={latexInput}
          onChange={(e) => setLatexInput(e.target.value)}
          className={styles.latexInput}
          rows={4}
          placeholder="Enter LaTeX expression..."
        />
        
        <div className={styles.controls}>
          <div className={styles.radioGroup}>
            <label>
              <input
                type="radio"
                value="inline"
                checked={renderType === 'inline'}
                onChange={() => setRenderType('inline')}
              />
              Inline Math
            </label>
            <label>
              <input
                type="radio"
                value="block"
                checked={renderType === 'block'}
                onChange={() => setRenderType('block')}
              />
              Block Math
            </label>
          </div>
          
          <button onClick={handleRender} className={styles.renderButton}>
            Render
          </button>
        </div>
      </div>
      
      <div className={styles.outputSection}>
        <h3>Rendered Output:</h3>
        <div className={styles.outputContainer}>
          {error ? (
            <div className={styles.error}>{error.toString()}</div>
          ) : renderType === 'inline' ? (
            <div className={styles.inlineOutput}>
              <p>This is some text with <InlineMath math={latexInput} /> inline math.</p>
            </div>
          ) : (
            <div className={styles.blockOutput}>
              <BlockMath math={latexInput} />
            </div>
          )}
        </div>
      </div>
      
      <div className={styles.examples}>
        <h3>Common Examples:</h3>
        <ul>
          <li onClick={() => setLatexInput('\\frac{\\pi}{2} > \\theta > \\alpha')}>
            $\frac{\pi}{2} > \theta > \alpha$
          </li>
          <li onClick={() => setLatexInput('e^{i\\pi} + 1 = 0')}>
            $e^{i\pi} + 1 = 0$
          </li>
          <li onClick={() => setLatexInput('\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}')}>
            $\int_{-\infty}^{\infty} e^{-x^2} dx = \sqrt{\pi}$
          </li>
          <li onClick={() => setLatexInput('\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}')}>
            Matrix example
          </li>
        </ul>
      </div>
    </div>
  );
};

export default LaTeXTest; 