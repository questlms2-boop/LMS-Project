const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// MongoDB connection
mongoose.connect('mongodb+srv://questlms2_db_user:Muthu@97@cluster0.pk5yy9w.mongodb.net/', { useNewUrlParser: true, useUnifiedTopology: true });
// Muthu@97
// User Schema
const userSchema = new mongoose.Schema({
    username: String,
    password: String,
    role: String,
    studentId: String,
    instructorId: String,
    name: String,
    department: String,
    class: String,
    xp: { type: Number, default: 0 }, // accumulate XP
});

const User = mongoose.model('User', userSchema);

const courseContentSchema = new mongoose.Schema({
  courseName: String,
  content: String,
  approved: { type: Boolean, default: false },  // <-- new field for approval
  createdAt: { type: Date, default: Date.now },
});
const CourseContent = mongoose.model('CourseContent', courseContentSchema);

const quizSchema = new mongoose.Schema({
  courseContentId: { type: mongoose.Schema.Types.ObjectId, ref: 'CourseContent', required: true },
  question: { type: String, required: true },
  option1: String,
  option2: String,
  option3: String,
  option4: String,
  correctAnswer: { type: String, required: true }, // e.g., "option1"
  createdAt: { type: Date, default: Date.now },
});

const Quiz = mongoose.model('Quiz', quizSchema);

const userQuizSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  courseContentId: { type: mongoose.Schema.Types.ObjectId, ref: 'CourseContent' },
  quizId: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz' },
  selectedOption: String,
  isCorrect: Boolean,
  score: Number,
  attemptedAt: { type: Date, default: Date.now },
});
const UserQuiz = mongoose.model('UserQuiz', userQuizSchema);
// Login endpoint
app.post('/api/login', async (req, res) => {
  const { username, password, role, studentId, instructorId } = req.body;
  let user;

  if (role === "Learner") {
    user = await User.findOne({ username, password, studentId });
  } else if (role === "Instructor") {
    user = await User.findOne({ username, password, instructorId });
  } else if (role === "Admin") {
    user = await User.findOne({ username, password });
  }

  if (!user) {
    return res.status(401).json({ success: false, message: "User not found" });
  }

  // For demo: compare plain text (use bcrypt in prod!)
  if (user.password !== password) {
    return res.status(401).json({ success: false, message: "Incorrect password" });
  }

  res.json({ 
    success: true, 
    userId: user._id.toString(), // send user ID here
    message: `Login successful as ${role}`
  });
});


// GET /api/users - fetch all users
app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find({}, 'name username email department xp role');
    console.log('Users fetched:', users);

    res.json({ success: true, data: users });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// DELETE /api/users/:id - delete user by MongoDB _id
app.delete('/api/users/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    await User.findByIdAndDelete(userId);
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Register endpoint
app.post('/api/register', async (req, res) => {
    const { id, name, email, role, department, class: userClass, password } = req.body;
  
    // Check if user already exists by username (email)
    const existingUser = await User.findOne({ username: email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }
  
    // Prepare user object based on role
    let newUser = {
      username: email,
      password,  // Save as plain text for now; hash in production!
      role,
    };
  
    // Set role-specific IDs
    if (role === 'Student') {
      newUser.studentId = id;
    } else if (role === 'Instructor') {
      newUser.instructorId = id;
    }
  
    // Save new fields
    newUser.name = name;
    newUser.department = department;
    if (role === 'Student') newUser.class = userClass;
  
    // Create and save user in DB
    try {
      const user = new User(newUser);
      await user.save();
      res.json({ success: true, userId: user._id.toString(),  message: "User registered successfully" });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ success: false, message: 'Server error during registration' });
    }
  });


  app.post('/api/course-content', async (req, res) => {
    try {
      const { courseName, content } = req.body;
      const saved = await CourseContent.create({ courseName, content });
      res.json({ success: true, data: saved });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Server error' });
    }
  });
  
  // GET /api/course-content (List all course content)
  app.get('/api/course-content', async (req, res) => {
    try {
      const list = await CourseContent.find().sort({ createdAt: -1 });
      res.json({ success: true, data: list });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Server error' });
    }
  });

  // POST new quiz for a course
app.post('/api/quizzes', async (req, res) => {
  try {
    const { courseContentId, question, option1, option2, option3, option4,correctAnswer } = req.body;
    const saved = await Quiz.create({ courseContentId, question, option1, option2, option3, option4 ,correctAnswer});
    res.json({ success: true, data: saved });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET quizzes by course content ID
app.get('/api/quizzes/:courseContentId', async (req, res) => {
  const quizzes = await Quiz.find({ courseContentId: req.params.courseContentId });
  res.json({ success: true, data: quizzes });
});
  
// GET /api/quizzes/:courseContentId
app.get('/api/quizzes/:courseContentId', async (req, res) => {
  const quizzes = await Quiz.find({ courseContentId: req.params.courseContentId });
  res.json({ success: true, data: quizzes });
});

// Submit quiz answers
app.post('/api/user-quizzes/submit', async (req, res) => {
  try {
    // Expect: userId, courseContentId, answers array [{ quizId, selectedOption }]
    const { userId, courseContentId, answers } = req.body;

    let totalScore = 0;
    for (const answer of answers) {
      const quiz = await Quiz.findById(answer.quizId);
      if (!quiz) continue;
      const isCorrect = quiz.correctAnswer === answer.selectedOption;
      const score = isCorrect ? 10 : 0; // 10 XP per correct answer

      totalScore += score;

      await UserQuiz.findOneAndUpdate(
        { userId, quizId: quiz._id },
        { selectedOption: answer.selectedOption, isCorrect, score, courseContentId: quiz.courseContentId,  attemptedAt: new Date() },
        { upsert: true, new: true }
      );
    }

    // Update user's total XP
    const user = await User.findById(userId);
    user.xp = (user.xp || 0) + totalScore;
    await user.save();

    res.json({ success: true, totalScore, message: 'Quiz submitted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get('/api/user-progress/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;

    // Check userId format before aggregation!
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: "Invalid userId" });
    }

    // Aggregation for attempts
    const attempts = await UserQuiz.aggregate([
      { 
        $match: { 
          userId: new mongoose.Types.ObjectId(userId),
          courseContentId: { $ne: null },
        } 
      },
      {
        $group: {
          _id: '$courseContentId',
          attemptedCount: { $sum: 1 },
          correctCount: { $sum: { $cond: [{ $eq: ['$isCorrect', true] }, 1, 0] } },
        },
      },
    ]);
    
    console.log("Attempts aggregation result:", attempts);

    // Aggregation for quiz counts per course
    const quizCounts = await Quiz.aggregate([
      { $group: { _id: '$courseContentId', totalQuizzes: { $sum: 1 } } },
    ]);
    console.log("Quiz Counts:", quizCounts);

    const courses = await CourseContent.find();
    console.log("Courses:", courses);
    
    const user = await User.findById(userId);
    // Compose progress array
    const progress = courses.map((course) => {
      const attempt = attempts.find(a => a._id.toString() === course._id.toString());
      const quizCount = quizCounts.find(q => q._id.toString() === course._id.toString());

      const totalQuizzes = quizCount ? quizCount.totalQuizzes : 0;
      const attemptedCount = attempt ? attempt.attemptedCount : 0;
      const correctCount = attempt ? attempt.correctCount : 0;
      const completed = totalQuizzes > 0 && attemptedCount === totalQuizzes;

      return {
        courseId: course._id,
        courseName: course.courseName,
        totalQuizzes,
        attemptedCount,
        correctCount,
        completed,
        xp: user ? user.xp : 0,
      };
    });

    res.json({ success: true, data: progress });
  } catch (error) {
    console.error("API /user-progress error:", error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});


app.get('/api/leaderboard', async (req, res) => {
  try {
    const leaders = await User.find({ role: 'Student' }, 'name xp')
      .sort({ xp: -1 })
      .limit(10);
    res.json({ success: true, data: leaders });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get('/api/students', async (req, res) => {
  try {
    const students = await User.find(
      { role: 'Student' },             // Filter for role = Student
      'name username email department xp role'  // Fields to return
    );
    console.log('Students fetched:', students);

    res.json({ success: true, data: students });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get('/api/instructors', async (req, res) => {
  try {
    const instructors = await User.find(
      { role: 'Instructor' },             // Filter for role = Instructor
      'name username email department xp role'  // Fields to return
    );
    console.log('Instructors fetched:', instructors);

    res.json({ success: true, data: instructors });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});


// Approve course by ID
app.patch('/api/course-content/:id/approve', async (req, res) => {
  try {
    const courseId = req.params.id;
    const course = await CourseContent.findByIdAndUpdate(courseId, { approved: true }, { new: true });
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }
    res.json({ success: true, message: 'Course approved', data: course });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});


// List approved courses
app.get('/api/course-content/approved', async (req, res) => {
  try {
    const courses = await CourseContent.find({ approved: true }).sort({ createdAt: -1 });
    res.json({ success: true, data: courses });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});


// List pending courses (approved: false)
app.get('/api/course-content/pending', async (req, res) => {
  try {
    const courses = await CourseContent.find({ approved: false }).sort({ createdAt: -1 });
    console.log('Pending courses fetched:', courses);
    res.json({ success: true, data: courses });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/instructors/:id - fetch single instructor by instructorId
app.get('/api/instructors/:id', async (req, res) => {
  try {
    const instructor = await User.findOne(
      { instructorId: req.params.id, role: "Instructor" },
      'name  department'
    );

    if (!instructor) {
      return res.status(404).json({ success: false, message: 'Instructor not found' });
    }

    res.json({ success: true, data: instructor });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});



app.listen(8081, () => console.log('Server running on port 8081'));
