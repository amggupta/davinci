import { OpenAI } from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  const { threadId } = req.query;
  
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }
  
  if (!threadId) {
    return res.status(400).json({ success: false, error: 'Thread ID is required' });
  }
  
  try {
    const result = await openai.beta.threads.messages.list(threadId);
    
    // Transform the OpenAI response to a more usable format
    const messages = result.data.map(message => ({
      id: message.id,
      role: message.role,
      content: message.content[0]?.text?.value || '',
      createdAt: message.created_at ? new Date(message.created_at * 1000).toISOString() : new Date().toISOString()
    }));
    
    return res.status(200).json({ success: true, messages });
  } catch (error) {
    console.error('Error fetching thread messages:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to fetch messages' 
    });
  }
} 