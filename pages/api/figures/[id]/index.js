import FigureGen from '../../../../models/FigureGen';
import dbConnect from '../../../../utils/dbConnect';

export default async function handler(req, res) {
  const {
    query: { id },
    method,
  } = req;

  await dbConnect();

  switch (method) {
    case 'GET':
      try {
        const figure = await FigureGen.findById(id);
        if (!figure) {
          return res.status(404).json({ success: false, error: 'Figure not found' });
        }
        res.status(200).json({ success: true, data: figure });
      } catch (error) {
        res.status(400).json({ success: false, error: error.message });
      }
      break;
      
    case 'PUT':
      try {
        const updateData = {};
        const allowedFields = ['title', 'description', 'cleaned_xhtml', 'REMARKS', 'output_svg_txt_only', 'output_svg_with_image'];
        
        // Only add fields that are provided in the request
        Object.keys(req.body).forEach(key => {
          if (allowedFields.includes(key)) {
            updateData[key] = req.body[key];
          }
        });
        
        if (Object.keys(updateData).length === 0) {
          return res.status(400).json({ success: false, error: 'No valid fields to update' });
        }
        
        console.log('Received update request for figure:', id);
        console.log('Update data:', updateData);
        
        const updatedFigure = await FigureGen.findByIdAndUpdate(
          id,
          updateData,
          { new: true, runValidators: true }
        );
        
        if (!updatedFigure) {
          return res.status(404).json({ success: false, error: 'Figure not found' });
        }
        
        console.log('Updated figure:', updatedFigure);
        
        res.status(200).json({ success: true, data: updatedFigure });
      } catch (error) {
        res.status(400).json({ success: false, error: error.message });
      }
      break;
      
    case 'DELETE':
      try {
        const deletedFigure = await FigureGen.deleteOne({ _id: id });
        if (deletedFigure.deletedCount === 0) {
          return res.status(404).json({ success: false, error: 'Figure not found' });
        }
        res.status(200).json({ success: true, data: {} });
      } catch (error) {
        res.status(400).json({ success: false, error: error.message });
      }
      break;
      
    default:
      res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
      res.status(405).json({ success: false, error: `Method ${method} not allowed` });
  }
} 