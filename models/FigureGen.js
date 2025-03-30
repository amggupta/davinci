import mongoose from 'mongoose';

const FigureGenSchema = new mongoose.Schema({
  ASSET_ID: {
    type: String,
    required: true,
    unique: true,
  },
  lesson_title: {
    type: String,
    required: true,
  },
  lesson_url: String,
  img_url: String,
  img_tag: String,
  subheading: String,
  img_caption: String,
  cleaned_xhtml: String,
  REMARKS: String,
  current_state: {
    type: String,
    default: 'pending'
  },
  image_file_id: String,
  asst_thread_id_ins_with_image: String,
  asst_thread_id_ins_txt_only: String,
  asst_thread_id_svg_gen_with_image: String,
  asst_thread_id_svg_gen_txt_only: String,
  instructions_with_image: String,
  Instruction_txt_only: String,
  output_svg_with_image: String,
  output_svg_txt_only: String,
  output_svg_accepted: {
    type: Boolean,
    default: false
  },
  created_at: {
    type: Date,
    default: Date.now
  },
  updated_at: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.models.FigureGen || mongoose.model('FigureGen', FigureGenSchema); 