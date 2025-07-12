const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  content: {
    type: String,
    required: true,
    trim: true,
    minlength: 15,
    maxlength: 500
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  question: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Question'
  },
  answer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Answer'
  },
  parentComment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment'
  },
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
commentSchema.index({ question: 1, createdAt: 1 });
commentSchema.index({ answer: 1, createdAt: 1 });
commentSchema.index({ author: 1, createdAt: -1 });
commentSchema.index({ parentComment: 1 });

// Virtual for vote count
commentSchema.virtual('voteCount').get(function() {
  return this.votes.upvotes.length - this.votes.downvotes.length;
});

// Method to check if user has voted
commentSchema.methods.hasUserVoted = function(userId) {
  const upvoted = this.votes.upvotes.some(vote => vote.user.toString() === userId.toString());
  const downvoted = this.votes.downvotes.some(vote => vote.user.toString() === userId.toString());
  
  if (upvoted) return 'upvote';
  if (downvoted) return 'downvote';
  return null;
};

// Method to add vote
commentSchema.methods.addVote = function(userId, voteType) {
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
commentSchema.methods.removeVote = function(userId) {
  this.votes.upvotes = this.votes.upvotes.filter(vote => vote.user.toString() !== userId.toString());
  this.votes.downvotes = this.votes.downvotes.filter(vote => vote.user.toString() !== userId.toString());
  
  return this.save();
};

// Ensure virtuals are serialized
commentSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Comment', commentSchema); 