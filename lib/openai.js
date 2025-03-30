import { OpenAI } from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// OpenAI Assistant ID for figure generation
const ASSISTANT_ID = process.env.OPENAI_ASSISTANT_ID;

/**
 * Upload a file to OpenAI from a URL or base64 data
 * @param {string} imageSource - URL or base64 data of the image
 * @returns {Promise<string>} - File ID from OpenAI
 */
export async function uploadFileToOpenAI(imageSource) {
  console.log(`[uploadFileToOpenAI] Starting file upload process`);
  console.log(`[uploadFileToOpenAI] Image source type: ${imageSource.startsWith('data:image') ? 'base64' : 'URL'}`);
  
  try {
    let imageBuffer;
    let filename = `image_${Date.now()}.png`;
    
    // Handle URL vs base64 input
    if (imageSource.startsWith('data:image')) {
      console.log(`[uploadFileToOpenAI] Processing base64 image data`);
      // Extract base64 data from data URL
      const base64Data = imageSource.split(',')[1];
      imageBuffer = Buffer.from(base64Data, 'base64');
      console.log(`[uploadFileToOpenAI] Created buffer from base64 data, size: ${imageBuffer.length} bytes`);
    } else {
      console.log(`[uploadFileToOpenAI] Fetching image from URL: ${imageSource.substring(0, 50)}...`);
      // Fetch image from URL
      const response = await fetch(imageSource, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        }
      });
      
      if (!response.ok) {
        console.error(`[uploadFileToOpenAI] Failed to fetch image: ${response.status} ${response.statusText}`);
        throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
      }
      
      console.log(`[uploadFileToOpenAI] Image fetch successful: ${response.status}`);
      const arrayBuffer = await response.arrayBuffer();
      imageBuffer = Buffer.from(arrayBuffer);
      console.log(`[uploadFileToOpenAI] Created buffer from URL data, size: ${imageBuffer.length} bytes`);
      
      // Extract filename from URL if possible
      try {
        const url = new URL(imageSource);
        const pathSegments = url.pathname.split('/');
        if (pathSegments.length > 0 && pathSegments[pathSegments.length-1].includes('.')) {
          filename = pathSegments[pathSegments.length-1];
          console.log(`[uploadFileToOpenAI] Extracted filename from URL: ${filename}`);
        }
      } catch (urlErr) {
        console.log(`[uploadFileToOpenAI] Could not parse URL for filename, using default`);
      }
    }
    
    // Create a FormData object with the file
    console.log(`[uploadFileToOpenAI] Creating FormData with file: ${filename}`);
    
    // Create a temporary file path using Node.js fs module
    const fs = require('fs');
    const path = require('path');
    const os = require('os');
    
    const tempFilePath = path.join(os.tmpdir(), filename);
    console.log(`[uploadFileToOpenAI] Writing buffer to temporary file: ${tempFilePath}`);
    
    // Write the buffer to a temporary file
    fs.writeFileSync(tempFilePath, imageBuffer);
    
    // Create a readable stream from the file
    const fileStream = fs.createReadStream(tempFilePath);
    
    console.log(`[uploadFileToOpenAI] Uploading file to OpenAI with purpose: 'assistants'`);
    
    // Upload to OpenAI using the correct format
    const file = await openai.files.create({
      file: fileStream,
      purpose: 'assistants',
    });
    
    // Clean up the temporary file
    try {
      fs.unlinkSync(tempFilePath);
      console.log(`[uploadFileToOpenAI] Temporary file deleted: ${tempFilePath}`);
    } catch (unlinkErr) {
      console.warn(`[uploadFileToOpenAI] Warning: Could not delete temporary file: ${unlinkErr.message}`);
    }
    
    console.log(`[uploadFileToOpenAI] File upload successful, received file ID: ${file.id}`);
    console.log(`[uploadFileToOpenAI] File details: ${JSON.stringify({
      id: file.id,
      size: file.bytes,
      created: new Date(file.created_at * 1000).toISOString(),
      purpose: file.purpose
    })}`);
    
    return file.id;
  } catch (error) {
    console.error(`[uploadFileToOpenAI] Error uploading file to OpenAI: ${error.message}`);
    console.error(`[uploadFileToOpenAI] Stack trace: ${error.stack}`);
    throw error;
  }
}

/**
 * Delete a thread from OpenAI
 * @param {string} threadId - The thread ID to delete
 * @returns {Promise<boolean>} - Success status
 */
export async function deleteThread(threadId) {
  if (!threadId) return true;
  
  console.log(`[deleteThread] Attempting to delete thread: ${threadId}`);
  
  try {
    await openai.beta.threads.del(threadId);
    console.log(`[deleteThread] Successfully deleted thread: ${threadId}`);
    return true;
  } catch (error) {
    console.error(`[deleteThread] Error deleting thread ${threadId}: ${error.message}`);
    console.error(`[deleteThread] Error details: ${JSON.stringify(error.response?.data || {})}`);
    return false;
  }
}

/**
 * Create a thread and run the assistant
 * @param {Object} options - Options for the assistant call
 * @param {string} options.instruction - The prompt to send to the assistant
 * @param {string} options.fileId - Optional file ID to attach
 * @param {number} options.maxAttempts - Max number of retry attempts
 * @param {number} options.timeout - Max time to wait for a response
 * @returns {Promise<Object>} - Assistant response and thread ID
 */
export async function callOpenAIAssistant({
  instruction,
  fileId = null,
  maxAttempts = 3,
  timeout = 300000 // 5 minutes in milliseconds
}) {
  let attempt = 0;
  
  while (attempt < maxAttempts) {
    attempt++;
    let threadId = null;
    
    try {
      console.log(`Starting assistant call (attempt ${attempt}/${maxAttempts})...`);
      
      // Create a new thread
      const thread = await openai.beta.threads.create();
      threadId = thread.id;
      
      // Prepare message content
      let messageContent = [{ type: "text", text: instruction }];
      
      // Add file if provided
      if (fileId) {
        messageContent.unshift({
          type: "image_file",
          image_file: { file_id: fileId }
        });
      }
      
      // Add the message to the thread
      await openai.beta.threads.messages.create(
        threadId,
        {
          role: "user",
          content: messageContent
        }
      );
      
      // Run the assistant on the thread
      const run = await openai.beta.threads.runs.create(
        threadId,
        { assistant_id: ASSISTANT_ID }
      );
      
      // Start time tracking
      const startTime = Date.now();
      let runStatus;
      
      // Poll for completion with timeout
      while (true) {
        // Check if timeout exceeded
        const elapsed = Date.now() - startTime;
        if (elapsed >= timeout) {
          console.log(`Timeout reached (${timeout}ms). Cancelling run...`);
          try {
            await openai.beta.threads.runs.cancel(threadId, run.id);
          } catch (cancelErr) {
            console.error("Error cancelling run:", cancelErr);
          }
          
          // Clean up and retry or fail
          if (attempt < maxAttempts) {
            console.log(`Retrying (attempt ${attempt+1}/${maxAttempts})...`);
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2s before retry
            break; // Break out of polling loop to retry
          } else {
            throw new Error("Maximum attempts reached with timeout");
          }
        }
        
        // Get run status
        try {
          runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);
          
          if (["completed", "failed", "cancelled", "expired"].includes(runStatus.status)) {
            break; // Exit polling loop on terminal state
          }
          
          // Wait before polling again
          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (pollErr) {
          console.error("Error polling run status:", pollErr);
          
          // If we've spent too much time already, bail
          if (Date.now() - startTime >= timeout) {
            throw new Error("Polling error and timeout exceeded");
          }
          
          // Wait longer on errors
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }
      
      // Handle non-completed status
      if (runStatus.status !== "completed") {
        console.log(`Run ended with status: ${runStatus.status}`);
        
        // Retry if attempts remain
        if (attempt < maxAttempts) {
          console.log(`Retrying (attempt ${attempt+1}/${maxAttempts})...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
          continue; // Skip to next attempt
        } else {
          throw new Error(`Assistant run failed with status: ${runStatus.status}`);
        }
      }
      
      // Get the assistant's response
      const messages = await openai.beta.threads.messages.list(threadId);
      
      if (!messages.data.length) {
        throw new Error("No messages returned from assistant");
      }
      
      // Get response content
      const responseContent = messages.data[0].content[0].text.value;
      
      // Success! Return results
      return {
        recreateSteps: responseContent,
        threadId: threadId
      };
      
    } catch (error) {
      console.error(`Error in assistant call (attempt ${attempt}/${maxAttempts}):`, error);
      
      // Clean up thread on error
      if (threadId) {
        try {
          await openai.beta.threads.del(threadId);
        } catch (delErr) {
          console.error("Error deleting thread:", delErr);
        }
      }
      
      // Retry if attempts remain
      if (attempt < maxAttempts) {
        console.log(`Retrying after error (attempt ${attempt+1}/${maxAttempts})...`);
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5s before retry after error
        continue;
      }
      
      // All attempts failed
      throw error;
    }
  }
  
  // If we reach here, all attempts failed
  throw new Error("All attempts to call assistant failed");
}

/**
 * Process a figure with OpenAI Assistant
 * @param {Object} figure - The figure to process
 * @param {boolean} withImage - Whether to include the image in processing
 * @returns {Promise<Object>} - Updated figure data
 */
export async function processFigure(figure, withImage = true) {
  console.log(`[processFigure] Starting with figure ID: ${figure._id}, withImage: ${withImage}`);
  console.log(`[processFigure] Figure state: ${JSON.stringify({
    hasImage: !!figure.img_url,
    existingFileId: figure.image_file_id || 'none',
    withImageThreadId: figure.asst_thread_id_ins_with_image || 'none',
    txtOnlyThreadId: figure.asst_thread_id_ins_txt_only || 'none',
    currentState: figure.current_state || 'unknown',
    hasRemarks: !!figure.REMARKS
  })}`);
  
  try {
    // Prepare the learning context
    const learningContext = figure.cleaned_xhtml || '';
    console.log(`[processFigure] Learning context length: ${learningContext.length} characters`);
    
    let fileId = figure.image_file_id || null;
    let prompt;
    
    // Upload image if needed and requested
    if (withImage && figure.img_url && !fileId) {
      console.log(`[processFigure] No existing file ID, uploading image from URL`);
      fileId = await uploadFileToOpenAI(figure.img_url);
      console.log(`[processFigure] Successfully uploaded image, received file ID: ${fileId}`);
    } else if (withImage && !figure.img_url) {
      console.log(`[processFigure] Warning: withImage=true but no img_url available`);
    } else if (withImage && fileId) {
      console.log(`[processFigure] Using existing file ID: ${fileId}`);
    } else {
      console.log(`[processFigure] Text-only mode, no image needed`);
    }
    
    // Delete existing thread if any, based on which mode we're using
    const existingThreadId = withImage ? 
      figure.asst_thread_id_ins_with_image : 
      figure.asst_thread_id_ins_txt_only;
    
    if (existingThreadId) {
      console.log(`[processFigure] Deleting existing ${withImage ? 'with-image' : 'text-only'} thread: ${existingThreadId}`);
      await deleteThread(existingThreadId);
    }
    
    // Prepare prompt based on mode
    if (withImage) {
      console.log(`[processFigure] Using image-based prompt`);
      prompt = `Analyse the attached image and generate instructions to re-create it to go with learning context. The image needs to be created to fit in the context of following learning content. Learning context - ${learningContext}`;
    } else {
      console.log(`[processFigure] Using text-only prompt`);
      prompt = `Generate instructions to create image to go with learning context. The image needs to be created to fit in the context of following learning content. Learning context - ${learningContext}`;
    }
    
    // Add REMARKS with higher priority if they exist
    if (figure.REMARKS) {
      console.log(`[processFigure] Adding REMARKS to prompt: "${figure.REMARKS}"`);
      prompt += `\n\nPlease take care of following instructions additionally giving these higher priority: ${figure.REMARKS}`;
    }
    
    console.log(`[processFigure] Final prompt length: ${prompt.length} characters`);
    
    // Call assistant
    console.log(`[processFigure] Calling OpenAI Assistant with mode: ${withImage ? 'with image' : 'text only'}`);
    const assistantResponse = await callOpenAIAssistant({
      instruction: prompt,
      fileId: withImage ? fileId : null
    });
    
    // Prepare updated figure data
    console.log(`[processFigure] Assistant call successful, updating figure data`);
    const updatedData = {
      image_file_id: fileId,
      current_state: 'completed'
    };
    
    // Update the appropriate field based on mode
    if (withImage) {
      console.log(`[processFigure] Updating instructions_with_image field and thread ID`);
      updatedData.instructions_with_image = assistantResponse.recreateSteps;
      updatedData.asst_thread_id_ins_with_image = assistantResponse.threadId;
    } else {
      console.log(`[processFigure] Updating Instruction_txt_only field and thread ID`);
      updatedData.Instruction_txt_only = assistantResponse.recreateSteps;
      updatedData.asst_thread_id_ins_txt_only = assistantResponse.threadId;
    }
    
    console.log(`[processFigure] Processing complete, returning updated data`);
    return updatedData;
  } catch (error) {
    console.error(`[processFigure] Error processing figure: ${error.message}`);
    console.error(`[processFigure] Stack trace: ${error.stack}`);
    return {
      current_state: 'failed'
    };
  }
} 