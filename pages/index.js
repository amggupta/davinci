import { useState, useEffect } from 'react';
import Head from 'next/head';
import Layout from '../components/Layout';
import FigureCard from '../components/FigureCard';
import InputView from '../components/InputView';
import styles from '../styles/Home.module.css';

export default function Home() {
  const [figures, setFigures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState('card'); // Default to card view
  
  useEffect(() => {
    fetchFigures();
  }, []);
  
  const fetchFigures = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/figures');
      const data = await response.json();
      
      if (data.success) {
        setFigures(data.data);
      } else {
        throw new Error(data.error || 'Failed to fetch figures');
      }
    } catch (error) {
      console.error('Error fetching figures:', error);
      setError('Failed to load figures. Please try again later.');
    } finally {
      setLoading(false);
    }
  };
  
  const handleFigureUpdate = (updatedFigure) => {
    setFigures(prevFigures => 
      prevFigures.map(figure => 
        figure._id === updatedFigure._id ? updatedFigure : figure
      )
    );
  };
  
  return (
    <Layout viewMode={viewMode} onViewModeChange={setViewMode}>
      <Head>
        <title>daVinci - Figure Generator</title>
        <meta name="description" content="Generate and manage SVG illustrations" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      
      <div className={styles.container}>
        {loading ? (
          <div className={styles.loading}>Loading figures...</div>
        ) : error ? (
          <div className={styles.error}>{error}</div>
        ) : figures.length === 0 ? (
          <div className={styles.empty}>
            <p>No figures found.</p>
          </div>
        ) : (
          <>
            {viewMode === 'card' ? (
              <div className={styles.cardList}>
                {figures.map((figure) => (
                  <FigureCard 
                    key={figure._id} 
                    figure={figure}
                    onUpdate={handleFigureUpdate}
                  />
                ))}
              </div>
            ) : (
              <InputView 
                figures={figures} 
                onFigureUpdate={handleFigureUpdate} 
              />
            )}
          </>
        )}
      </div>
    </Layout>
  );
} 