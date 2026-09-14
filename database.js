const mongoose = require('mongoose');

// --- SCHEMAS ---

// User Schema
const userSchema = new mongoose.Schema({
  username: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password_hash: { type: String, required: true },
  gemini_api_key: { type: String, default: '' }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: false },
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// VocabItem Schema
const vocabItemSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  word: { type: String, required: true },
  meaning: { type: String, required: true },
  phonetic: { type: String, default: '' },
  type: { type: String, default: 'other' },
  example: { type: String, default: '' },
  example_vi: { type: String, default: '' },
  status: { type: String, default: 'new' },
  date: { type: String, default: '' },
  tags: { type: [String], default: [] },
  date_added: { type: Date, default: Date.now },
  review_count: { type: Number, default: 0 },
  last_reviewed: { type: String, default: '' }
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Create Models
const User = mongoose.model('User', userSchema);
const VocabItem = mongoose.model('VocabItem', vocabItemSchema);

// --- CONNECTION LOGIC ---
async function initDatabase() {
  try {
    if (!process.env.MONGODB_URI) {
      console.warn('MONGODB_URI is not defined in .env file!');
      return;
    }
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB Atlas successfully!');
  } catch (error) {
    console.error('❌ MongoDB Connection Error:', error.message);
  }
}

module.exports = { 
  initDatabase,
  User,
  VocabItem
};
