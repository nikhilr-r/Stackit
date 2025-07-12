const express = require('express');
const { body, validationResult, query } = require('express-validator');
const User = require('../models/User');
const Question = require('../models/Question');
const Answer = require('../models/Answer');
const { auth, requireUser, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/users
// @desc    Get all users (admin only)
// @access  Private (Admin)
router.get('/', requireAdmin, [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
  query('search').optional().isString().withMessage('Search must be a string'),
  query('role').optional().isIn(['user', 'admin']).withMessage('Invalid role')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search;
    const role = req.query.role;
    const skip = (page - 1) * limit;

    const filter = {};
    if (search) {
      filter.$text = { $search: search };
    }
    if (role) {
      filter.role = role;
    }

    const users = await User.find(filter)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await User.countDocuments(filter);
    const totalPages = Math.ceil(total / limit);

    res.json({
      users,
      pagination: {
        currentPage: page,
        totalPages,
        totalUsers: total,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/users/:id
// @desc    Get user profile by ID
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password -emailVerificationToken -passwordResetToken -passwordResetExpires');

    if (!user || user.isBanned) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get user stats
    const questionCount = await Question.countDocuments({ 
      author: user._id, 
      isDeleted: false 
    });
    const answerCount = await Answer.countDocuments({ 
      author: user._id, 
      isDeleted: false 
    });
    const acceptedAnswers = await Answer.countDocuments({ 
      author: user._id, 
      isAccepted: true,
      isDeleted: false 
    });

    const userProfile = {
      ...user.getPublicProfile(),
      stats: {
        questions: questionCount,
        answers: answerCount,
        acceptedAnswers
      }
    };

    res.json(userProfile);
  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/users/:id/questions
// @desc    Get questions by user
// @access  Public
router.get('/:id/questions', [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const questions = await Question.find({ 
      author: req.params.id, 
      isDeleted: false 
    })
      .populate('author', 'username avatar reputation')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Question.countDocuments({ 
      author: req.params.id, 
      isDeleted: false 
    });
    const totalPages = Math.ceil(total / limit);

    // Add vote counts
    const questionsWithVotes = questions.map(question => {
      const voteCount = question.votes.upvotes.length - question.votes.downvotes.length;
      return {
        ...question.toObject(),
        voteCount,
        votes: undefined
      };
    });

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
    console.error('Get user questions error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/users/:id/answers
// @desc    Get answers by user
// @access  Public
router.get('/:id/answers', [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const answers = await Answer.find({ 
      author: req.params.id, 
      isDeleted: false 
    })
      .populate('author', 'username avatar reputation')
      .populate('question', 'title')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Answer.countDocuments({ 
      author: req.params.id, 
      isDeleted: false 
    });
    const totalPages = Math.ceil(total / limit);

    // Add vote counts
    const answersWithVotes = answers.map(answer => {
      const voteCount = answer.votes.upvotes.length - answer.votes.downvotes.length;
      return {
        ...answer.toObject(),
        voteCount,
        votes: undefined
      };
    });

    res.json({
      answers: answersWithVotes,
      pagination: {
        currentPage: page,
        totalPages,
        totalAnswers: total,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });
  } catch (error) {
    console.error('Get user answers error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/users/:id/ban
// @desc    Ban a user (admin only)
// @access  Private (Admin)
router.put('/:id/ban', requireAdmin, [
  body('reason').notEmpty().withMessage('Ban reason is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.role === 'admin') {
      return res.status(403).json({ message: 'Cannot ban admin users' });
    }

    user.isBanned = true;
    user.banReason = req.body.reason;
    await user.save();

    res.json({ message: 'User banned successfully' });
  } catch (error) {
    console.error('Ban user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/users/:id/unban
// @desc    Unban a user (admin only)
// @access  Private (Admin)
router.put('/:id/unban', requireAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.isBanned = false;
    user.banReason = '';
    await user.save();

    res.json({ message: 'User unbanned successfully' });
  } catch (error) {
    console.error('Unban user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/users/:id/role
// @desc    Change user role (admin only)
// @access  Private (Admin)
router.put('/:id/role', requireAdmin, [
  body('role').isIn(['user', 'admin']).withMessage('Invalid role')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.role = req.body.role;
    await user.save();

    res.json({ message: 'User role updated successfully' });
  } catch (error) {
    console.error('Change user role error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/users/stats/overview
// @desc    Get platform statistics (admin only)
// @access  Private (Admin)
router.get('/stats/overview', requireAdmin, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalQuestions = await Question.countDocuments({ isDeleted: false });
    const totalAnswers = await Answer.countDocuments({ isDeleted: false });
    const answeredQuestions = await Question.countDocuments({ 
      isAnswered: true, 
      isDeleted: false 
    });

    const recentUsers = await User.countDocuments({
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
    });

    const recentQuestions = await Question.countDocuments({
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      isDeleted: false
    });

    const recentAnswers = await Answer.countDocuments({
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      isDeleted: false
    });

    res.json({
      overview: {
        totalUsers,
        totalQuestions,
        totalAnswers,
        answeredQuestions,
        answerRate: totalQuestions > 0 ? (answeredQuestions / totalQuestions * 100).toFixed(1) : 0
      },
      recent: {
        users: recentUsers,
        questions: recentQuestions,
        answers: recentAnswers
      }
    });
  } catch (error) {
    console.error('Get stats overview error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/users/search
// @desc    Search users
// @access  Public
router.get('/search', [
  query('q').notEmpty().withMessage('Search query is required'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const searchQuery = req.query.q;

    const users = await User.find({
      $text: { $search: searchQuery },
      isBanned: false
    })
      .select('-password')
      .sort({ score: { $meta: 'textScore' } })
      .skip(skip)
      .limit(limit);

    const total = await User.countDocuments({
      $text: { $search: searchQuery },
      isBanned: false
    });
    const totalPages = Math.ceil(total / limit);

    res.json({
      users,
      pagination: {
        currentPage: page,
        totalPages,
        totalUsers: total,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router; 