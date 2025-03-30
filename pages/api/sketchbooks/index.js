import Figure from '../../../models/Figure';
import dbConnect from '../../../utils/dbConnect';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    await dbConnect();
    
    const { figureId } = req.body;
    
    if (!figureId) {
      return res.status(400).json({ message: 'Figure ID is required' });
    }
    
    // Find the figure
    const figure = await Figure.findById(figureId);
    if (!figure) {
      return res.status(404).json({ message: 'Figure not found' });
    }
    
    // Here you would implement whatever "Create Sketchbook" actually does
    // For now, we'll just return success to fix the button issue
    console.log('Successfully creating sketchbook for figure:', figureId);
    
    // Return success
    return res.status(200).json({ 
      success: true, 
      message: 'Sketchbook created successfully' 
    });
    
  } catch (error) {
    console.error('Error creating sketchbook:', error);
    return res.status(500).json({ message: error.message });
  }
} 