const mongoose = require('mongoose');

const answerSchema = new mongoose.Schema({
  content: {
    type: String,
    required: true,
    minlength: 20
  },
  question: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Question',
    required: true
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
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
  isAccepted: {
    type: Boolean,
    default: false
  },
  acceptedAt: Date,
  acceptedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
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
answerSchema.index({ question: 1, createdAt: 1 });
answerSchema.index({ author: 1, createdAt: -1 });
answerSchema.index({ 'votes.upvotes': -1 });
answerSchema.index({ isAccepted: 1 });

// Virtual for vote count
answerSchema.virtual('voteCount').get(function() {
  return this.votes.upvotes.length - this.votes.downvotes.length;
});

// Virtual for comment count
answerSchema.virtual('commentCount', {
  ref: 'Comment',
  localField: '_id',
  foreignField: 'answer',
  count: true
});

// Method to check if user has voted
answerSchema.methods.hasUserVoted = function(userId) {
  const upvoted = this.votes.upvotes.some(vote => vote.user.toString() === userId.toString());
  const downvoted = this.votes.downvotes.some(vote => vote.user.toString() === userId.toString());
  
  if (upvoted) return 'upvote';
  if (downvoted) return 'downvote';
  return null;
};

// Method to add vote
answerSchema.methods.addVote = function(userId, voteType) {
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
answerSchema.methods.removeVote = function(userId) {
  this.votes.upvotes = this.votes.upvotes.filter(vote => vote.user.toString() !== userId.toString());
  this.votes.downvotes = this.votes.downvotes.filter(vote => vote.user.toString() !== userId.toString());
  
  return this.save();
};

// Method to accept answer
answerSchema.methods.acceptAnswer = function(userId) {
  this.isAccepted = true;
  this.acceptedAt = new Date();
  this.acceptedBy = userId;
  return this.save();
};

// Method to unaccept answer
answerSchema.methods.unacceptAnswer = function() {
  this.isAccepted = false;
  this.acceptedAt = null;
  this.acceptedBy = null;
  return this.save();
};

// Ensure virtuals are serialized
answerSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Answer', answerSchema); 