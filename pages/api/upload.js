import formidable from 'formidable';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

// Disable Next.js body parsing for this route
export const config = {
  api: {
    bodyParser: false,
  },
};

// Create uploads directory if it doesn't exist
const uploadDir = path.join(process.cwd(), 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Parse the form data
    const form = new formidable.IncomingForm();
    form.uploadDir = uploadDir;
    form.keepExtensions = true;
    
    form.parse(req, async (err, fields, files) => {
      if (err) {
        return res.status(500).json({ message: 'Error parsing form data', error: err.message });
      }

      if (!files.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }

      // Get the file and create a unique name
      const file = Array.isArray(files.file) ? files.file[0] : files.file;
      const fileExt = path.extname(file.originalFilename);
      const fileName = `${uuidv4()}${fileExt}`;
      const finalPath = path.join(uploadDir, fileName);

      try {
        // Rename the temp file to ensure it has the correct extension
        fs.renameSync(file.filepath, finalPath);

        // Create a public URL for the file
        const publicUrl = `/uploads/${fileName}`;

        res.status(200).json({
          message: 'File uploaded successfully',
          url: publicUrl,
          filename: fileName,
        });
      } catch (error) {
        console.error('Error moving file:', error);
        return res.status(500).json({ message: 'Error saving file', error: error.message });
      }
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ message: 'Error processing upload', error: error.message });
  }
} 