import dbConnect from '../../../../lib/mongodb';
import FigureGen from '../../../../models/FigureGen';
import { processFigure } from '../../../../lib/openai';

export default async function handler(req, res) {
  const { id } = req.query;
  const { mode = 'with_image' } = req.body;
  
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }
  
  await dbConnect();
  
  try {
    // Find the figure
    const figure = await FigureGen.findById(id);
    
    if (!figure) {
      return res.status(404).json({ success: false, error: 'Figure not found' });
    }
    
    // Update figure status to processing
    figure.current_state = 'processing';
    await figure.save();
    
    // Send initial response to prevent timeout
    res.status(202).json({ 
      success: true, 
      message: 'Generation started', 
      figure: figure 
    });
    
    // Process in background (non-blocking)
    processFigure(figure.toObject(), mode === 'with_image')
      .then(async (updatedData) => {
        // Update figure with results
        await FigureGen.findByIdAndUpdate(id, {
          ...updatedData,
          updated_at: new Date()
        });
        console.log(`Successfully processed figure ${id}`);
      })
      .catch(async (error) => {
        // Update figure with error state
        await FigureGen.findByIdAndUpdate(id, {
          current_state: 'failed',
          updated_at: new Date()
        });
        console.error(`Error processing figure ${id}:`, error);
      });
    
  } catch (error) {
    console.error('API error:', error);
    // If headers haven't been sent, send error response
    if (!res.headersSent) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }
} 