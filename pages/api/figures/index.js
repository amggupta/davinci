import dbConnect from '../../../lib/mongodb';
import FigureGen from '../../../models/FigureGen';

export default async function handler(req, res) {
  const { method } = req;
  
  await dbConnect();

  if (method === 'GET') {
    try {
      const figures = await FigureGen.find({});
      res.status(200).json({ success: true, data: figures });
    } catch (error) {
      res.status(400).json({ success: false });
    }
  } else if (method === 'POST') {
    try {
      const { title, description, instructions, img_url, svg_data } = req.body;
      
      // Validate required fields
      if (!title || !instructions) {
        return res.status(400).json({ success: false, error: 'Missing required fields' });
      }

      let finalImgUrl = img_url;
      let fileId = null;
      
      // Check if the image needs to be uploaded to OpenAI
      if (img_url && !img_url.startsWith('file-')) {
        // Image is a URL and not already an OpenAI file ID
        try {
          console.log('Uploading image to OpenAI:', img_url);
          
          // Fetch the image data
          const imageResponse = await fetch(img_url);
          if (!imageResponse.ok) throw new Error('Failed to fetch image');
          
          const imageBuffer = await imageResponse.arrayBuffer();
          const imageData = Buffer.from(imageBuffer);
          
          // Upload to OpenAI to get a file_id
          const formData = new FormData();
          formData.append('purpose', 'assistants');
          const blob = new Blob([imageData]);
          formData.append('file', blob, 'image.png');
          
          const uploadResponse = await fetch('https://api.openai.com/v1/files', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
            },
            body: formData
          });
          
          if (!uploadResponse.ok) {
            const error = await uploadResponse.json();
            throw new Error(`OpenAI file upload failed: ${JSON.stringify(error)}`);
          }
          
          const uploadData = await uploadResponse.json();
          fileId = uploadData.id;
          finalImgUrl = fileId; // Store the file ID instead of the URL
          
          console.log('Image uploaded successfully, file_id:', fileId);
        } catch (error) {
          console.error('Error uploading image to OpenAI:', error);
          return res.status(500).json({ 
            success: false, 
            error: `Failed to upload image: ${error.message}` 
          });
        }
      } else if (img_url && img_url.startsWith('file-')) {
        // Image is already an OpenAI file ID
        fileId = img_url;
        console.log('Using existing OpenAI file_id:', fileId);
      }
      
      // Now proceed with creating the figure with the file_id
      const figure = await FigureGen.create({
        title,
        description,
        instructions,
        img_url: finalImgUrl,
        svg_data,
      });
      
      // Proceed with generating instructions if needed
      // ... rest of your existing code ...

      return res.status(201).json({ success: true, data: figure });
    } catch (error) {
      console.error('Error creating figure:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  } else {
    res.setHeader('Allow', ['GET', 'POST']);
    res.status(405).json({ success: false, error: `Method ${method} not allowed` });
  }
} 