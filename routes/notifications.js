const express = require('express');
const { query, validationResult } = require('express-validator');
const Notification = require('../models/Notification');
const { auth, requireUser } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/notifications
// @desc    Get user notifications with pagination
// @access  Private
router.get('/', requireUser, [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
  query('unreadOnly').optional().isBoolean().withMessage('unreadOnly must be a boolean')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const unreadOnly = req.query.unreadOnly === 'true';
    const skip = (page - 1) * limit;

    const filter = { recipient: req.user._id };
    if (unreadOnly) {
      filter.isRead = false;
    }

    const notifications = await Notification.find(filter)
      .populate('sender', 'username avatar')
      .populate('relatedQuestion', 'title')
      .populate('relatedAnswer', 'content')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Notification.countDocuments(filter);
    const totalPages = Math.ceil(total / limit);
    const unreadCount = await Notification.getUnreadCount(req.user._id);

    res.json({
      notifications,
      pagination: {
        currentPage: page,
        totalPages,
        totalNotifications: total,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      },
      unreadCount
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/notifications/unread-count
// @desc    Get unread notification count
// @access  Private
router.get('/unread-count', requireUser, async (req, res) => {
  try {
    const unreadCount = await Notification.getUnreadCount(req.user._id);
    res.json({ unreadCount });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/notifications/:id/read
// @desc    Mark a notification as read
// @access  Private
router.put('/:id/read', requireUser, async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    // Check if user owns this notification
    if (notification.recipient.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to access this notification' });
    }

    await notification.markAsRead();

    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/notifications/:id/unread
// @desc    Mark a notification as unread
// @access  Private
router.put('/:id/unread', requireUser, async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    // Check if user owns this notification
    if (notification.recipient.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to access this notification' });
    }

    await notification.markAsUnread();

    res.json({ message: 'Notification marked as unread' });
  } catch (error) {
    console.error('Mark notification unread error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/notifications/mark-all-read
// @desc    Mark all notifications as read
// @access  Private
router.put('/mark-all-read', requireUser, async (req, res) => {
  try {
    await Notification.markAllAsRead(req.user._id);
    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Mark all notifications read error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/notifications/:id
// @desc    Delete a notification
// @access  Private
router.delete('/:id', requireUser, async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    // Check if user owns this notification
    if (notification.recipient.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this notification' });
    }

    await notification.remove();
    res.json({ message: 'Notification deleted successfully' });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/notifications/clear-all
// @desc    Clear all notifications
// @access  Private
router.delete('/clear-all', requireUser, async (req, res) => {
  try {
    await Notification.deleteMany({ recipient: req.user._id });
    res.json({ message: 'All notifications cleared' });
  } catch (error) {
    console.error('Clear all notifications error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/notifications/types
// @desc    Get notification types for filtering
// @access  Private
router.get('/types', requireUser, async (req, res) => {
  try {
    const types = await Notification.distinct('type', { recipient: req.user._id });
    res.json(types);
  } catch (error) {
    console.error('Get notification types error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/notifications/by-type/:type
// @desc    Get notifications by type
// @access  Private
router.get('/by-type/:type', requireUser, [
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

    const filter = { 
      recipient: req.user._id,
      type: req.params.type
    };

    const notifications = await Notification.find(filter)
      .populate('sender', 'username avatar')
      .populate('relatedQuestion', 'title')
      .populate('relatedAnswer', 'content')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Notification.countDocuments(filter);
    const totalPages = Math.ceil(total / limit);

    res.json({
      notifications,
      pagination: {
        currentPage: page,
        totalPages,
        totalNotifications: total,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });
  } catch (error) {
    console.error('Get notifications by type error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router; 