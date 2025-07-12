const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    minlength: 10,
    maxlength: 300
  },
  description: {
    type: String,
    required: true,
    minlength: 20
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  votes: {
    upvotes: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      createdAt: {
        type: Date,
        default: Date.now
      }
    }],
    downvotes: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      createdAt: {
        type: Date,
        default: Date.now
      }
    }]
  },
  views: {
    type: Number,
    default: 0
  },
  isAnswered: {
    type: Boolean,
    default: false
  },
  acceptedAnswer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Answer'
  },
  status: {
    type: String,
    enum: ['open', 'closed', 'duplicate', 'off-topic'],
    default: 'open'
  },
  bounty: {
    amount: {
      type: Number,
      default: 0
    },
    expiresAt: Date,
    offeredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  isEdited: {
    type: Boolean,
    default: false
  },
  editHistory: [{
    editedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    editedAt: {
      type: Date,
      default: Date.now
    },
    previousContent: String,
    editReason: String
  }],
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  deletedAt: Date,
  deleteReason: String
}, {
  timestamps: true
});

// Indexes for better performance
questionSchema.index({ title: 'text', description: 'text', tags: 'text' });
questionSchema.index({ author: 1, createdAt: -1 });
questionSchema.index({ tags: 1 });
questionSchema.index({ createdAt: -1 });
questionSchema.index({ 'votes.upvotes': -1 });
questionSchema.index({ views: -1 });

// Virtual for vote count
questionSchema.virtual('voteCount').get(function() {
  return this.votes.upvotes.length - this.votes.downvotes.length;
});

// Virtual for answer count
questionSchema.virtual('answerCount', {
  ref: 'Answer',
  localField: '_id',
  foreignField: 'question',
  count: true
});

// Virtual for comment count
questionSchema.virtual('commentCount', {
  ref: 'Comment',
  localField: '_id',
  foreignField: 'question',
  count: true
});

// Method to check if user has voted
questionSchema.methods.hasUserVoted = function(userId) {
  const upvoted = this.votes.upvotes.some(vote => vote.user.toString() === userId.toString());
  const downvoted = this.votes.downvotes.some(vote => vote.user.toString() === userId.toString());
  
  if (upvoted) return 'upvote';
  if (downvoted) return 'downvote';
  return null;
};

// Method to add vote
questionSchema.methods.addVote = function(userId, voteType) {
  // Remove existing votes from this user
  this.votes.upvotes = this.votes.upvotes.filter(vote => vote.user.toString() !== userId.toString());
  this.votes.downvotes = this.votes.downvotes.filter(vote => vote.user.toString() !== userId.toString());
  
  // Add new vote
  if (voteType === 'upvote') {
    this.votes.upvotes.push({ user: userId });
  } else if (voteType === 'downvote') {
    this.votes.downvotes.push({ user: userId });
  }
  
  return this.save();
};

// Method to remove vote
questionSchema.methods.removeVote = function(userId) {
  this.votes.upvotes = this.votes.upvotes.filter(vote => vote.user.toString() !== userId.toString());
  this.votes.downvotes = this.votes.downvotes.filter(vote => vote.user.toString() !== userId.toString());
  
  return this.save();
};

// Method to increment views
questionSchema.methods.incrementViews = function() {
  this.views += 1;
  return this.save();
};

// Ensure virtuals are serialized
questionSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Question', questionSchema); 