const express = require('express');
const { body, validationResult, query } = require('express-validator');
const Question = require('../models/Question');
const Answer = require('../models/Answer');
const Notification = require('../models/Notification');
const { auth, optionalAuth, requireUser, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/questions
// @desc    Get all questions with filtering and pagination
// @access  Public
router.get('/', optionalAuth, [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
  query('sort').optional().isIn(['newest', 'oldest', 'votes', 'views', 'unanswered']).withMessage('Invalid sort option'),
  query('tag').optional().isString().withMessage('Tag must be a string'),
  query('search').optional().isString().withMessage('Search must be a string')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const sort = req.query.sort || 'newest';
    const tag = req.query.tag;
    const search = req.query.search;

    const skip = (page - 1) * limit;
    const filter = { isDeleted: false };

    // Add tag filter
    if (tag) {
      filter.tags = tag.toLowerCase();
    }

    // Add search filter
    if (search) {
      filter.$text = { $search: search };
    }

    // Build sort object
    let sortObj = {};
    switch (sort) {
      case 'newest':
        sortObj = { createdAt: -1 };
        break;
      case 'oldest':
        sortObj = { createdAt: 1 };
        break;
      case 'votes':
        sortObj = { 'votes.upvotes': -1 };
        break;
      case 'views':
        sortObj = { views: -1 };
        break;
      case 'unanswered':
        filter.isAnswered = false;
        sortObj = { createdAt: -1 };
        break;
    }

    const questions = await Question.find(filter)
      .populate('author', 'username avatar reputation')
      .sort(sortObj)
      .skip(skip)
      .limit(limit)
      .lean();

    // Add vote count and user vote status
    const questionsWithVotes = questions.map(question => {
      const voteCount = question.votes.upvotes.length - question.votes.downvotes.length;
      const userVote = req.user ? question.votes.upvotes.some(v => v.user.toString() === req.user._id.toString()) ? 'upvote' :
        question.votes.downvotes.some(v => v.user.toString() === req.user._id.toString()) ? 'downvote' : null : null;
      
      return {
        ...question,
        voteCount,
        userVote,
        votes: undefined // Remove votes array from response
      };
    });

    const total = await Question.countDocuments(filter);
    const totalPages = Math.ceil(total / limit);

    res.json({
      questions: questionsWithVotes,
      pagination: {
        currentPage: page,
        totalPages,
        totalQuestions: total,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });
  } catch (error) {
    console.error('Get questions error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/questions/:id
// @desc    Get a single question by ID
// @access  Public
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const question = await Question.findById(req.params.id)
      .populate('author', 'username avatar reputation bio')
      .populate('acceptedAnswer')
      .populate({
        path: 'answers',
        populate: {
          path: 'author',
          select: 'username avatar reputation'
        },
        options: { sort: { isAccepted: -1, 'votes.upvotes': -1 } }
      });

    if (!question || question.isDeleted) {
      return res.status(404).json({ message: 'Question not found' });
    }

    // Increment views
    await question.incrementViews();

    // Add vote count and user vote status
    const voteCount = question.votes.upvotes.length - question.votes.downvotes.length;
    const userVote = req.user ? question.hasUserVoted(req.user._id) : null;

    // Process answers
    const processedAnswers = question.answers.map(answer => {
      const answerVoteCount = answer.votes.upvotes.length - answer.votes.downvotes.length;
      const answerUserVote = req.user ? answer.hasUserVoted(req.user._id) : null;
      
      return {
        ...answer.toObject(),
        voteCount: answerVoteCount,
        userVote: answerUserVote,
        votes: undefined
      };
    });

    const questionData = {
      ...question.toObject(),
      voteCount,
      userVote,
      answers: processedAnswers,
      votes: undefined
    };

    res.json(questionData);
  } catch (error) {
    console.error('Get question error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/questions
// @desc    Create a new question
// @access  Private
router.post('/', requireUser, [
  body('title')
    .isLength({ min: 10, max: 300 })
    .withMessage('Title must be between 10 and 300 characters'),
  body('description')
    .isLength({ min: 20 })
    .withMessage('Description must be at least 20 characters long'),
  body('tags')
    .isArray({ min: 1, max: 5 })
    .withMessage('Must provide 1-5 tags'),
  body('tags.*')
    .isLength({ min: 2, max: 20 })
    .withMessage('Each tag must be between 2 and 20 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { title, description, tags } = req.body;

    // Normalize tags
    const normalizedTags = tags.map(tag => tag.toLowerCase().trim());

    const question = new Question({
      title,
      description,
      tags: normalizedTags,
      author: req.user._id
    });

    await question.save();

    // Populate author info
    await question.populate('author', 'username avatar reputation');

    res.status(201).json({
      message: 'Question created successfully',
      question: {
        ...question.toObject(),
        voteCount: 0,
        userVote: null,
        votes: undefined
      }
    });
  } catch (error) {
    console.error('Create question error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/questions/:id
// @desc    Update a question
// @access  Private (author or admin)
router.put('/:id', requireUser, [
  body('title')
    .optional()
    .isLength({ min: 10, max: 300 })
    .withMessage('Title must be between 10 and 300 characters'),
  body('description')
    .optional()
    .isLength({ min: 20 })
    .withMessage('Description must be at least 20 characters long'),
  body('tags')
    .optional()
    .isArray({ min: 1, max: 5 })
    .withMessage('Must provide 1-5 tags'),
  body('tags.*')
    .optional()
    .isLength({ min: 2, max: 20 })
    .withMessage('Each tag must be between 2 and 20 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const question = await Question.findById(req.params.id);
    if (!question || question.isDeleted) {
      return res.status(404).json({ message: 'Question not found' });
    }

    // Check permissions
    if (question.author.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to edit this question' });
    }

    const { title, description, tags, editReason } = req.body;
    const updateFields = {};

    if (title && title !== question.title) {
      updateFields.title = title;
    }
    if (description && description !== question.description) {
      updateFields.description = description;
    }
    if (tags) {
      updateFields.tags = tags.map(tag => tag.toLowerCase().trim());
    }

    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({ message: 'No changes to update' });
    }

    // Add to edit history
    updateFields.isEdited = true;
    updateFields.editHistory = question.editHistory || [];
    updateFields.editHistory.push({
      editedBy: req.user._id,
      editedAt: new Date(),
      previousContent: JSON.stringify({
        title: question.title,
        description: question.description,
        tags: question.tags
      }),
      editReason: editReason || 'No reason provided'
    });

    const updatedQuestion = await Question.findByIdAndUpdate(
      req.params.id,
      updateFields,
      { new: true, runValidators: true }
    ).populate('author', 'username avatar reputation');

    res.json({
      message: 'Question updated successfully',
      question: {
        ...updatedQuestion.toObject(),
        voteCount: updatedQuestion.votes.upvotes.length - updatedQuestion.votes.downvotes.length,
        userVote: updatedQuestion.hasUserVoted(req.user._id),
        votes: undefined
      }
    });
  } catch (error) {
    console.error('Update question error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/questions/:id
// @desc    Delete a question
// @access  Private (author or admin)
router.delete('/:id', requireUser, async (req, res) => {
  try {
    const question = await Question.findById(req.params.id);
    if (!question || question.isDeleted) {
      return res.status(404).json({ message: 'Question not found' });
    }

    // Check permissions
    if (question.author.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to delete this question' });
    }

    // Soft delete
    question.isDeleted = true;
    question.deletedBy = req.user._id;
    question.deletedAt = new Date();
    question.deleteReason = req.body.reason || 'No reason provided';
    await question.save();

    res.json({ message: 'Question deleted successfully' });
  } catch (error) {
    console.error('Delete question error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/questions/:id/vote
// @desc    Vote on a question
// @access  Private
router.post('/:id/vote', requireUser, [
  body('voteType').isIn(['upvote', 'downvote', 'remove']).withMessage('Invalid vote type')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const question = await Question.findById(req.params.id);
    if (!question || question.isDeleted) {
      return res.status(404).json({ message: 'Question not found' });
    }

    const { voteType } = req.body;

    if (voteType === 'remove') {
      await question.removeVote(req.user._id);
    } else {
      await question.addVote(req.user._id, voteType);
    }

    const updatedQuestion = await Question.findById(req.params.id)
      .populate('author', 'username avatar reputation');

    res.json({
      message: 'Vote updated successfully',
      question: {
        ...updatedQuestion.toObject(),
        voteCount: updatedQuestion.votes.upvotes.length - updatedQuestion.votes.downvotes.length,
        userVote: updatedQuestion.hasUserVoted(req.user._id),
        votes: undefined
      }
    });
  } catch (error) {
    console.error('Vote question error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/questions/tags/popular
// @desc    Get popular tags
// @access  Public
router.get('/tags/popular', async (req, res) => {
  try {
    const popularTags = await Question.aggregate([
      { $match: { isDeleted: false } },
      { $unwind: '$tags' },
      {
        $group: {
          _id: '$tags',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 20 }
    ]);

    res.json(popularTags);
  } catch (error) {
    console.error('Get popular tags error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router; 