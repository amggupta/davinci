import dbConnect from '../../../../lib/mongodb';
import FigureGen from '../../../../models/FigureGen';
import { OpenAI } from 'openai';
import { deleteThread } from '../../../../lib/openai';

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

console.log(process.env.OPENAI_API_KEY)

// SVG generation Assistant ID
const SVG_ASSISTANT_ID = process.env.SVG_ASSISTANT_ID;

async function generateSVG(instructions, existingThreadId = null, maxAttempts = 3) {
  console.log(`[generateSVG] Starting with instruction length: ${instructions?.length || 0}`);
  console.log(`[generateSVG] Existing thread ID: ${existingThreadId || 'none'}`);
  
  // Skip if no instructions provided
  if (!instructions) {
    console.log(`[generateSVG] No instructions provided, skipping generation`);
    return { svgContent: null, threadId: null };
  }
  
  // Delete existing thread if provided
  if (existingThreadId) {
    console.log(`[generateSVG] Deleting existing thread: ${existingThreadId}`);
    await deleteThread(existingThreadId);
  }
  
  let attempt = 0;
  
  while (attempt < maxAttempts) {
    attempt++;
    let threadId = null;
    
    try {
      console.log(`[generateSVG] Attempt ${attempt}/${maxAttempts}`);
      
      // Create a new thread
      const thread = await openai.beta.threads.create();
      threadId = thread.id;
      console.log(`[generateSVG] Created new thread: ${threadId}`);
      
      // Add the message to the thread
      await openai.beta.threads.messages.create(
        threadId,
        {
          role: "user",
          content: [{ type: "text", text: instructions }]
        }
      );
      
      // Run the assistant on the thread
      const run = await openai.beta.threads.runs.create(
        threadId,
        { assistant_id: SVG_ASSISTANT_ID }
      );
      
      // Poll for completion
      let runStatus;
      let completed = false;
      const startTime = Date.now();
      const timeout = 5 * 60 * 1000; // 5 minutes
      
      while (!completed && Date.now() - startTime < timeout) {
        runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);
        
        if (["completed", "failed", "cancelled", "expired"].includes(runStatus.status)) {
          completed = true;
        } else {
          // Wait before polling again
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
      
      // Handle timeout
      if (!completed) {
        console.log(`[generateSVG] Run timed out, cancelling`);
        await openai.beta.threads.runs.cancel(threadId, run.id);
        
        if (attempt < maxAttempts) {
          console.log(`[generateSVG] Will retry after timeout`);
          continue;
        } else {
          throw new Error("SVG generation timed out");
        }
      }
      
      // Handle non-completed status
      if (runStatus.status !== "completed") {
        console.log(`[generateSVG] Run ended with status: ${runStatus.status}`);
        
        if (attempt < maxAttempts) {
          console.log(`[generateSVG] Will retry after non-successful run`);
          continue;
        } else {
          throw new Error(`SVG generation failed with status: ${runStatus.status}`);
        }
      }
      
      // Get response
      const messages = await openai.beta.threads.messages.list(threadId);
      
      if (!messages.data.length) {
        throw new Error("No messages returned from assistant");
      }
      
      const responseContent = messages.data[0].content[0].text.value;
      
      // Extract SVG from response
      let svgContent = responseContent;
      
      // Try to extract SVG tags if embedded in other text
      const svgMatch = responseContent.match(/<svg[\s\S]*?<\/svg>/i);
      if (svgMatch) {
        svgContent = svgMatch[0];
      }
      
      // Success! Return results
      return {
        svgContent,
        threadId
      };
      
    } catch (error) {
      console.error(`[generateSVG] Error in attempt ${attempt}: ${error.message}`);
      
      // Clean up
      if (threadId) {
        try {
          await openai.beta.threads.del(threadId);
        } catch (delErr) {
          console.warn(`[generateSVG] Warning: Failed to delete thread: ${delErr.message}`);
        }
      }
      
      // Retry or throw
      if (attempt < maxAttempts) {
        console.log(`[generateSVG] Will retry after error`);
        await new Promise(resolve => setTimeout(resolve, 3000));
      } else {
        throw error;
      }
    }
  }
  
  throw new Error("All attempts to generate SVG failed");
}

export default async function handler(req, res) {
  const { id } = req.query;
  const { generateBoth = true } = req.body;
  
  console.log(`[API:generateSVG] Received request for figure ID: ${id}, generateBoth: ${generateBoth}`);
  
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
    
    // Check if we have instructions to work with
    if (!figure.instructions_with_image && !figure.Instruction_txt_only) {
      return res.status(400).json({ 
        success: false, 
        error: 'No instructions available. Please generate instructions first.' 
      });
    }
    
    // Update figure status to processing
    figure.current_state = 'processing';
    await figure.save();
    
    // Send initial response
    res.status(202).json({ 
      success: true, 
      message: 'SVG generation started', 
      figure: figure 
    });
    
    // Process in background
    (async () => {
      try {
        console.log(`[API:generateSVG:bg] Starting parallel SVG generation processes`);
        
        // Run both processes in parallel
        const [withImageResult, textOnlyResult] = await Promise.all([
          // Only process if we have instructions
          figure.instructions_with_image ? 
            generateSVG(figure.instructions_with_image, figure.asst_thread_id_svg_gen_with_image) : 
            Promise.resolve({ svgContent: null, threadId: null }),
            
          figure.Instruction_txt_only ? 
            generateSVG(figure.Instruction_txt_only, figure.asst_thread_id_svg_gen_txt_only) : 
            Promise.resolve({ svgContent: null, threadId: null })
        ]);
        
        console.log(`[API:generateSVG:bg] Both parallel SVG generation processes completed`);
        
        // Prepare updates based on what was generated
        const updates = {
          current_state: 'completed',
          updated_at: new Date()
        };
        
        if (withImageResult.svgContent) {
          updates.output_svg_with_image = withImageResult.svgContent;
          updates.asst_thread_id_svg_gen_with_image = withImageResult.threadId;
          console.log(`[API:generateSVG:bg] Added with-image SVG result with thread: ${withImageResult.threadId}`);
        }
        
        if (textOnlyResult.svgContent) {
          updates.output_svg_txt_only = textOnlyResult.svgContent;
          updates.asst_thread_id_svg_gen_txt_only = textOnlyResult.threadId;
          console.log(`[API:generateSVG:bg] Added text-only SVG result with thread: ${textOnlyResult.threadId}`);
        }
        
        // Update the figure with the results
        await FigureGen.findByIdAndUpdate(id, updates);
        console.log(`[API:generateSVG:bg] Successfully updated figure with SVG results`);
        
      } catch (error) {
        console.error(`[API:generateSVG:bg] Error generating SVGs: ${error.message}`);
        
        // Update figure with error state
        await FigureGen.findByIdAndUpdate(id, {
          current_state: 'failed',
          updated_at: new Date()
        });
      }
    })();
    
  } catch (error) {
    console.error(`[API:generateSVG] Error handling request: ${error.message}`);
    
    // If headers haven't been sent, send error response
    if (!res.headersSent) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }
} 