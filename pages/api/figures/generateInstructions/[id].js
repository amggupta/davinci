import dbConnect from '../../../../lib/mongodb';
import FigureGen from '../../../../models/FigureGen';
import { processFigure } from '../../../../lib/openai';

export default async function handler(req, res) {
  const { id } = req.query;
  const { generateBoth = true } = req.body;
  
  console.log(`[API:generateInstructions] Received request for figure ID: ${id}, generateBoth: ${generateBoth}`);
  
  if (req.method !== 'POST') {
    console.log(`[API:generateInstructions] Method not allowed: ${req.method}`);
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }
  
  console.log(`[API:generateInstructions] Connecting to database`);
  await dbConnect();
  
  try {
    // Find the figure
    console.log(`[API:generateInstructions] Finding figure with ID: ${id}`);
    const figure = await FigureGen.findById(id);
    
    if (!figure) {
      console.log(`[API:generateInstructions] Figure not found with ID: ${id}`);
      return res.status(404).json({ success: false, error: 'Figure not found' });
    }
    
    console.log(`[API:generateInstructions] Found figure: ${figure._id}, current state: ${figure.current_state}`);
    
    // Update figure status to processing
    console.log(`[API:generateInstructions] Updating figure status to 'processing'`);
    figure.current_state = 'processing';
    await figure.save();
    
    // Send initial response to prevent timeout
    console.log(`[API:generateInstructions] Sending initial response to client`);
    res.status(202).json({ 
      success: true, 
      message: 'Generation started', 
      figure: figure 
    });
    
    // Generate both instructions in parallel
    const figureData = figure.toObject();
    
    // Process in background
    (async () => {
      try {
        console.log(`[API:generateInstructions:bg] Starting to generate instructions in parallel`);
        
        // Run both processes in parallel
        const [withImageResult, textOnlyResult] = await Promise.all([
          processFigure(figureData, true),  // with image
          processFigure(figureData, false)  // text only
        ]);
        
        console.log(`[API:generateInstructions:bg] Both parallel generation processes completed`);
        
        // Update figure with both results at once
        const updates = {
          // With-image results
          image_file_id: withImageResult.image_file_id,
          asst_thread_id_ins_with_image: withImageResult.asst_thread_id_ins_with_image,
          instructions_with_image: withImageResult.instructions_with_image,
          
          // Text-only results
          asst_thread_id_ins_txt_only: textOnlyResult.asst_thread_id_ins_txt_only,
          Instruction_txt_only: textOnlyResult.Instruction_txt_only,
          
          // Update status
          current_state: 'completed',
          updated_at: new Date()
        };
        
        await FigureGen.findByIdAndUpdate(id, updates);
        console.log(`[API:generateInstructions:bg] Successfully updated figure with both instruction sets`);
        
      } catch (error) {
        console.error(`[API:generateInstructions:bg] Error generating instructions: ${error.message}`);
        console.error(`[API:generateInstructions:bg] Stack trace: ${error.stack}`);
        
        // Update figure with error state
        await FigureGen.findByIdAndUpdate(id, {
          current_state: 'failed',
          updated_at: new Date()
        });
      }
    })();
    
  } catch (error) {
    console.error(`[API:generateInstructions] Error handling request: ${error.message}`);
    console.error(`[API:generateInstructions] Stack trace: ${error.stack}`);
    
    // If headers haven't been sent, send error response
    if (!res.headersSent) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }
} 