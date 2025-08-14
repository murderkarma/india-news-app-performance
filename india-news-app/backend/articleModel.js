const mongoose = require('mongoose');

const articleSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  summary: {
    type: String,
    required: false,
  },
  image: {
    type: String,
    required: false,
  },
  link: {
    type: String,
    required: true,
  },
  state: {
    type: String,
    required: false,
  },
  // AI Enhancement fields
  aiPunchline: {
    type: String,
    required: false,
  },
  aiSummary: {
    type: String,
    required: false,
  },
  originalTitle: {
    type: String,
    required: false,
  },
  aiGenerated: {
    type: Boolean,
    default: false,
  },
  processedAt: {
    type: Date,
    required: false,
  },
  source: {
    type: String,
    required: false,
  },
  scrapedAt: {
    type: Date,
    required: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  contentHash: {
    type: String,
    index: true,
  },
});

const Article = mongoose.model('Article', articleSchema);

module.exports = Article;