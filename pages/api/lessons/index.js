import dbConnect from '../../../lib/mongodb';
import Lesson from '../../../models/Lesson';

export default async function handler(req, res) {
  const { method } = req;
  
  await dbConnect();

  switch (method) {
    case 'GET':
      try {
        const lessons = await Lesson.find({});
        res.status(200).json({ success: true, data: lessons });
      } catch (error) {
        res.status(400).json({ success: false });
      }
      break;
    case 'POST':
      try {
        const lesson = await Lesson.create(req.body);
        res.status(201).json({ success: true, data: lesson });
      } catch (error) {
        res.status(400).json({ success: false, error: error.message });
      }
      break;
    default:
      res.status(400).json({ success: false });
      break;
  }
} 