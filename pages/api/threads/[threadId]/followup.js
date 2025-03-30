import { OpenAI } from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  const { threadId } = req.query;
  const { message, assistantId } = req.body;
  
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }
  
  if (!threadId || !message || !assistantId) {
    return res.status(400).json({ 
      success: false, 
      error: 'Thread ID, message, and assistant ID are required' 
    });
  }
  
  try {
    // Add the user message to the thread
    await openai.beta.threads.messages.create(threadId, {
      role: 'user',
      content: message
    });
    
    // Run the assistant
    const run = await openai.beta.threads.runs.create(threadId, {
      assistant_id: assistantId
    });
    
    // Poll for completion
    let runStatus;
    let completed = false;
    const startTime = Date.now();
    const timeout = 5 * 60 * 1000; // 5 minutes timeout
    
    while (!completed && Date.now() - startTime < timeout) {
      runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);
      
      if (["completed", "failed", "cancelled", "expired"].includes(runStatus.status)) {
        completed = true;
      } else {
        // Wait before polling again
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // Check result
    if (!completed) {
      await openai.beta.threads.runs.cancel(threadId, run.id);
      return res.status(504).json({ 
        success: false, 
        error: 'Request timed out' 
      });
    }
    
    if (runStatus.status !== "completed") {
      return res.status(500).json({ 
        success: false, 
        error: `Run ended with status: ${runStatus.status}` 
      });
    }
    
    // Get latest message
    const messages = await openai.beta.threads.messages.list(threadId);
    
    if (!messages.data.length) {
      return res.status(500).json({
        success: false,
        error: 'No reply received from assistant'
      });
    }
    
    const assistantResponse = messages.data[0].content[0]?.text?.value || '';
    
    return res.status(200).json({ 
      success: true, 
      assistantResponse,
      runStatus: runStatus.status
    });
    
  } catch (error) {
    console.error('Error in follow-up process:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to process follow-up' 
    });
  }
} 