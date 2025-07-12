# StackIt - Q&A Forum Platform

A modern, full-stack Q&A forum platform built with React, Node.js, and MongoDB. StackIt provides a collaborative environment for developers to ask questions, share knowledge, and learn from the community.

## Features

### 🔐 Authentication & User Management
- User registration and login
- JWT-based authentication
- User profiles with avatar support
- Role-based access control

### 📝 Questions & Answers
- Create, edit, and delete questions
- Add tags to categorize questions
- Rich text content support
- Question voting system
- Mark answers as accepted

### 💬 Community Features
- Answer questions with voting
- Comment on questions and answers
- Real-time notifications
- User reputation system
- Search and filter questions

### 🎨 Modern UI/UX
- Responsive Material-UI design
- Dark/light theme support
- Intuitive navigation
- Loading states and error handling
- Mobile-friendly interface

## Tech Stack

### Frontend
- **React 19** - UI framework
- **Material-UI (MUI)** - Component library
- **React Router** - Client-side routing
- **React Hook Form** - Form handling
- **Yup** - Form validation
- **Axios** - HTTP client
- **Socket.IO Client** - Real-time communication

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **MongoDB** - Database
- **Mongoose** - ODM
- **JWT** - Authentication
- **bcryptjs** - Password hashing
- **Socket.IO** - Real-time features
- **Multer** - File uploads
- **Cloudinary** - Image storage

### Development Tools
- **Nodemon** - Development server
- **CORS** - Cross-origin resource sharing
- **Helmet** - Security headers
- **Rate Limiting** - API protection

## Getting Started

### Prerequisites
- Node.js (v16 or higher)
- MongoDB (local or cloud)
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd StackIt
   ```

2. **Install backend dependencies**
   ```bash
   npm install
   ```

3. **Install frontend dependencies**
   ```bash
   cd client
   npm install
   cd ..
   ```

4. **Environment Setup**
   Create a `.env` file in the root directory:
   ```env
   MONGODB_URI=mongodb://localhost:27017/stackit
   JWT_SECRET=your_jwt_secret_here
   CLIENT_URL=http://localhost:3000
   PORT=5000
   NODE_ENV=development
   
   # Optional: Cloudinary for image uploads
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret
   ```

5. **Start the development servers**

   **Option 1: Run both servers separately**
   ```bash
   # Terminal 1 - Backend
   npm run dev
   
   # Terminal 2 - Frontend
   npm run client
   ```

   **Option 2: Run both with a single command**
   ```bash
   npm run dev
   npm run client
   ```

6. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - User logout

### Questions
- `GET /api/questions` - Get all questions (with filters)
- `POST /api/questions` - Create a new question
- `GET /api/questions/:id` - Get question by ID
- `PUT /api/questions/:id` - Update question
- `DELETE /api/questions/:id` - Delete question
- `POST /api/questions/:id/vote` - Vote on question
- `POST /api/questions/:id/accept-answer` - Accept answer

### Answers
- `GET /api/questions/:id/answers` - Get answers for question
- `POST /api/questions/:id/answers` - Create answer
- `PUT /api/answers/:id` - Update answer
- `DELETE /api/answers/:id` - Delete answer
- `POST /api/answers/:id/vote` - Vote on answer

### Users
- `GET /api/users/:id` - Get user profile
- `PUT /api/users/:id` - Update user profile
- `GET /api/users/:id/questions` - Get user's questions
- `GET /api/users/:id/answers` - Get user's answers

### Notifications
- `GET /api/notifications` - Get user notifications
- `PUT /api/notifications/:id/read` - Mark notification as read

## Project Structure

```
StackIt/
├── client/                 # React frontend
│   ├── public/
│   ├── src/
│   │   ├── components/     # Reusable components
│   │   ├── contexts/       # React contexts
│   │   ├── pages/          # Page components
│   │   └── App.js          # Main app component
│   └── package.json
├── models/                 # MongoDB models
├── routes/                 # API routes
├── middleware/             # Custom middleware
├── utils/                  # Utility functions
├── server.js              # Express server
└── package.json
```

## Key Features Implementation

### Real-time Notifications
- Socket.IO integration for instant notifications
- Notification badges in header
- Real-time updates for votes and answers

### Search & Filtering
- Full-text search across questions
- Tag-based filtering
- Sort by newest, most voted, trending
- Pagination support

### Voting System
- Upvote/downvote questions and answers
- Vote tracking per user
- Reputation system integration

### File Uploads
- Avatar upload support
- Cloudinary integration
- Image optimization

## Deployment

### Backend Deployment (Heroku)
1. Create a Heroku app
2. Set environment variables
3. Deploy using Git:
   ```bash
   heroku git:remote -a your-app-name
   git push heroku main
   ```

### Frontend Deployment
1. Build the React app:
   ```bash
   cd client
   npm run build
   ```
2. Deploy to Netlify, Vercel, or similar platform

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For support and questions, please open an issue in the GitHub repository.

---

**StackIt** - Where developers learn and grow together! 🚀 