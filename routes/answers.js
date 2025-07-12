const express = require('express');
const { body, validationResult } = require('express-validator');
const Answer = require('../models/Answer');
const Question = require('../models/Question');
const Notification = require('../models/Notification');
const { requireUser } = require('../middleware/auth');

const router = express.Router();

// @route   POST /api/answers
// @desc    Create a new answer
// @access  Private
router.post('/', requireUser, [
  body('content')
    .isLength({ min: 20 })
    .withMessage('Answer must be at least 20 characters long'),
  body('questionId')
    .isMongoId()
    .withMessage('Valid question ID is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { content, questionId } = req.body;

    // Check if question exists
    const question = await Question.findById(questionId);
    if (!question || question.isDeleted) {
      return res.status(404).json({ message: 'Question not found' });
    }

    // Check if user already answered this question
    const existingAnswer = await Answer.findOne({
      question: questionId,
      author: req.user._id,
      isDeleted: false
    });

    if (existingAnswer) {
      return res.status(400).json({ message: 'You have already answered this question' });
    }

    const answer = new Answer({
      content,
      question: questionId,
      author: req.user._id
    });

    await answer.save();

    // Populate author info
    await answer.populate('author', 'username avatar reputation');

    // Create notification for question author
    if (question.author.toString() !== req.user._id.toString()) {
      await Notification.createNotification({
        recipient: question.author,
        sender: req.user._id,
        type: 'answer_received',
        title: 'New answer received',
        message: `${req.user.username} answered your question "${question.title}"`,
        relatedQuestion: questionId,
        relatedAnswer: answer._id
      });

      // Send real-time notification
      const io = req.app.get('io');
      const connectedUsers = req.app.get('connectedUsers');
      const recipientSocketId = connectedUsers.get(question.author.toString());
      if (io && recipientSocketId) {
        io.to(recipientSocketId).emit('newNotification', {
          type: 'answer_received',
          title: 'New answer received',
          message: `${req.user.username} answered your question "${question.title}"`
        });
      }
    }

    res.status(201).json({
      message: 'Answer posted successfully',
      answer: {
        ...answer.toObject(),
        voteCount: 0,
        userVote: null,
        votes: undefined
      }
    });
  } catch (error) {
    console.error('Create answer error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/answers/:id
// @desc    Update an answer
// @access  Private (author or admin)
router.put('/:id', requireUser, [
  body('content')
    .isLength({ min: 20 })
    .withMessage('Answer must be at least 20 characters long')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const answer = await Answer.findById(req.params.id);
    if (!answer || answer.isDeleted) {
      return res.status(404).json({ message: 'Answer not found' });
    }

    // Check permissions
    if (answer.author.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to edit this answer' });
    }

    const { content, editReason } = req.body;

    if (content === answer.content) {
      return res.status(400).json({ message: 'No changes to update' });
    }

    // Add to edit history
    answer.editHistory = answer.editHistory || [];
    answer.editHistory.push({
      editedBy: req.user._id,
      editedAt: new Date(),
      previousContent: answer.content,
      editReason: editReason || 'No reason provided'
    });

    answer.content = content;
    answer.isEdited = true;
    await answer.save();

    // Populate author info
    await answer.populate('author', 'username avatar reputation');

    res.json({
      message: 'Answer updated successfully',
      answer: {
        ...answer.toObject(),
        voteCount: answer.votes.upvotes.length - answer.votes.downvotes.length,
        userVote: answer.hasUserVoted(req.user._id),
        votes: undefined
      }
    });
  } catch (error) {
    console.error('Update answer error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/answers/:id
// @desc    Delete an answer
// @access  Private (author or admin)
router.delete('/:id', requireUser, async (req, res) => {
  try {
    const answer = await Answer.findById(req.params.id);
    if (!answer || answer.isDeleted) {
      return res.status(404).json({ message: 'Answer not found' });
    }

    // Check permissions
    if (answer.author.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to delete this answer' });
    }

    // Soft delete
    answer.isDeleted = true;
    answer.deletedBy = req.user._id;
    answer.deletedAt = new Date();
    answer.deleteReason = req.body.reason || 'No reason provided';
    await answer.save();

    res.json({ message: 'Answer deleted successfully' });
  } catch (error) {
    console.error('Delete answer error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/answers/:id/vote
// @desc    Vote on an answer
// @access  Private
router.post('/:id/vote', requireUser, [
  body('voteType').isIn(['upvote', 'downvote', 'remove']).withMessage('Invalid vote type')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const answer = await Answer.findById(req.params.id);
    if (!answer || answer.isDeleted) {
      return res.status(404).json({ message: 'Answer not found' });
    }

    const { voteType } = req.body;

    if (voteType === 'remove') {
      await answer.removeVote(req.user._id);
    } else {
      await answer.addVote(req.user._id, voteType);
    }

    // Populate author info
    await answer.populate('author', 'username avatar reputation');

    res.json({
      message: 'Vote updated successfully',
      answer: {
        ...answer.toObject(),
        voteCount: answer.votes.upvotes.length - answer.votes.downvotes.length,
        userVote: answer.hasUserVoted(req.user._id),
        votes: undefined
      }
    });
  } catch (error) {
    console.error('Vote answer error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/answers/:id/accept
// @desc    Accept an answer
// @access  Private (question author only)
router.post('/:id/accept', requireUser, async (req, res) => {
  try {
    const answer = await Answer.findById(req.params.id);
    if (!answer || answer.isDeleted) {
      return res.status(404).json({ message: 'Answer not found' });
    }

    const question = await Question.findById(answer.question);
    if (!question || question.isDeleted) {
      return res.status(404).json({ message: 'Question not found' });
    }

    // Check if user is the question author
    if (question.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the question author can accept answers' });
    }

    // Unaccept previously accepted answer if any
    if (question.acceptedAnswer) {
      const previousAccepted = await Answer.findById(question.acceptedAnswer);
      if (previousAccepted) {
        await previousAccepted.unacceptAnswer();
      }
    }

    // Accept the new answer
    await answer.acceptAnswer(req.user._id);

    // Update question
    question.isAnswered = true;
    question.acceptedAnswer = answer._id;
    await question.save();

    // Create notification for answer author
    if (answer.author.toString() !== req.user._id.toString()) {
      await Notification.createNotification({
        recipient: answer.author,
        sender: req.user._id,
        type: 'answer_accepted',
        title: 'Answer accepted',
        message: `Your answer to "${question.title}" was accepted`,
        relatedQuestion: question._id,
        relatedAnswer: answer._id
      });

      // Send real-time notification
      const io = req.app.get('io');
      const connectedUsers = req.app.get('connectedUsers');
      const recipientSocketId = connectedUsers.get(answer.author.toString());
      if (io && recipientSocketId) {
        io.to(recipientSocketId).emit('newNotification', {
          type: 'answer_accepted',
          title: 'Answer accepted',
          message: `Your answer to "${question.title}" was accepted`
        });
      }
    }

    // Populate author info
    await answer.populate('author', 'username avatar reputation');

    res.json({
      message: 'Answer accepted successfully',
      answer: {
        ...answer.toObject(),
        voteCount: answer.votes.upvotes.length - answer.votes.downvotes.length,
        userVote: answer.hasUserVoted(req.user._id),
        votes: undefined
      }
    });
  } catch (error) {
    console.error('Accept answer error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/answers/:id/unaccept
// @desc    Unaccept an answer
// @access  Private (question author only)
router.post('/:id/unaccept', requireUser, async (req, res) => {
  try {
    const answer = await Answer.findById(req.params.id);
    if (!answer || answer.isDeleted) {
      return res.status(404).json({ message: 'Answer not found' });
    }

    const question = await Question.findById(answer.question);
    if (!question || question.isDeleted) {
      return res.status(404).json({ message: 'Question not found' });
    }

    // Check if user is the question author
    if (question.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the question author can unaccept answers' });
    }

    // Check if this answer is actually accepted
    if (!answer.isAccepted) {
      return res.status(400).json({ message: 'This answer is not accepted' });
    }

    // Unaccept the answer
    await answer.unacceptAnswer();

    // Update question
    question.isAnswered = false;
    question.acceptedAnswer = null;
    await question.save();

    // Populate author info
    await answer.populate('author', 'username avatar reputation');

    res.json({
      message: 'Answer unaccepted successfully',
      answer: {
        ...answer.toObject(),
        voteCount: answer.votes.upvotes.length - answer.votes.downvotes.length,
        userVote: answer.hasUserVoted(req.user._id),
        votes: undefined
      }
    });
  } catch (error) {
    console.error('Unaccept answer error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router; 