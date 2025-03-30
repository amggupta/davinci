import Figure from '../../../../models/Figure';
import dbConnect from '../../../../utils/dbConnect';
import { OpenAI } from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  const {
    query: { id },
    method,
  } = req;

  await dbConnect();

  if (method === 'POST') {
    try {
      // Find the figure
      const figure = await Figure.findById(id);
      if (!figure) {
        return res.status(404).json({ success: false, error: 'Figure not found' });
      }

      const { type, description } = req.body;
      
      if (!type || (type !== 'with_image' && type !== 'text_only')) {
        return res.status(400).json({ success: false, error: 'Invalid instruction type' });
      }
      
      // Check if we have an image for with_image type
      if (type === 'with_image' && !figure.img_url) {
        return res.status(400).json({ 
          success: false, 
          error: 'Cannot generate instructions with image when no image is provided' 
        });
      }
      
      // Create the appropriate messages based on type
      let messages = [];
      let threadId = null;
      let assistantId = null;
      
      if (type === 'with_image') {
        // Generate instructions with image
        messages = [
          {
            role: "system",
            content: "You are an SVG creation assistant. Generate clear, detailed instructions for creating SVG illustrations based on the uploaded image. Focus on the key visual elements and composition."
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Generate instructions for creating an SVG based on this image${description ? ': ' + description : '.'}`
              },
              {
                type: "image_url",
                image_url: {
                  url: `file-${figure.img_url.replace('file-', '')}`
                }
              }
            ]
          }
        ];
        
        assistantId = process.env.OPENAI_ASSISTANT_ID_IMG;
      } else {
        // Generate text-only instructions
        messages = [
          {
            role: "system",
            content: "You are an SVG creation assistant. Generate clear, detailed instructions for creating SVG illustrations based on text descriptions. Be specific about visual elements to include."
          },
          {
            role: "user",
            content: `Generate instructions for creating an SVG illustration of: ${figure.title}${description ? ' - ' + description : ''}`
          }
        ];
        
        assistantId = process.env.OPENAI_ASSISTANT_ID_TXT;
      }
      
      // Create a thread for this figure
      const thread = await openai.beta.threads.create();
      threadId = thread.id;
      
      // Add the message to the thread
      await openai.beta.threads.messages.create(threadId, {
        role: "user",
        content: type === 'with_image' ? messages[1].content : messages[1].content
      });
      
      // Run the assistant
      const run = await openai.beta.threads.runs.create(
        threadId,
        {
          assistant_id: assistantId
        }
      );
      
      // Poll for completion
      let runStatus = await openai.beta.threads.runs.retrieve(
        threadId,
        run.id
      );
      
      let maxRetries = 30; // Maximum number of retries (about 5 minutes with 10 second intervals)
      let retryCount = 0;
      
      while (runStatus.status !== 'completed' && retryCount < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds before checking again
        runStatus = await openai.beta.threads.runs.retrieve(
          threadId,
          run.id
        );
        retryCount++;
      }
      
      if (runStatus.status !== 'completed') {
        throw new Error('Assistant run timed out');
      }
      
      // Get the messages
      const messagesResponse = await openai.beta.threads.messages.list(
        threadId
      );
      
      // Get the last assistant message
      const assistantMessages = messagesResponse.data.filter(
        msg => msg.role === 'assistant'
      );
      
      if (assistantMessages.length === 0) {
        throw new Error('No assistant response received');
      }
      
      const lastMessage = assistantMessages[0];
      const instructionText = lastMessage.content[0].text.value;
      
      // Update the figure with the generated instructions and thread information
      const updateData = {};
      
      if (type === 'with_image') {
        updateData.with_image_instructions = instructionText;
        updateData.with_image_thread_id = threadId;
        updateData.with_image_assistant_id = assistantId;
      } else {
        updateData.text_only_instructions = instructionText;
        updateData.text_only_thread_id = threadId;
        updateData.text_only_assistant_id = assistantId;
      }
      
      // Update the figure
      const updatedFigure = await Figure.findByIdAndUpdate(
        id,
        updateData,
        { new: true }
      );
      
      return res.status(200).json({
        success: true,
        data: {
          instructions: type === 'with_image' ? updatedFigure.with_image_instructions : updatedFigure.text_only_instructions,
          threadId,
          assistantId
        }
      });
    } catch (error) {
      console.error('Error generating instructions:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).json({ success: false, error: `Method ${method} not allowed` });
  }
} 