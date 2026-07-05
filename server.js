const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://Hassan:PASSWORD@salons.lh88xnl.mongodb.net/kuwait_salons?retryWrites=true&w=majority')
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB error:', err));

// Schemas
const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  phone: String,
  role: { type: String, default: 'user' },
  favorites: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Salon' }],
  createdAt: { type: Date, default: Date.now }
});

const salonSchema = new mongoose.Schema({
  name: { type: String, required: true },
  nameAr: String,
  email: String,
  phone: String,
  governorate: String,
  area: String,
  address: String,
  description: String,
  descriptionAr: String,
  services: [{ name: String, nameAr: String, price: Number, duration: Number }],
  workingHours: {
    saturday: { open: String, close: String, closed: Boolean },
    sunday: { open: String, close: String, closed: Boolean },
    monday: { open: String, close: String, closed: Boolean },
    tuesday: { open: String, close: String, closed: Boolean },
    wednesday: { open: String, close: String, closed: Boolean },
    thursday: { open: String, close: String, closed: Boolean },
    friday: { open: String, close: String, closed: Boolean }
  },
  rating: { type: Number, default: 0 },
  reviewCount: { type: Number, default: 0 },
  images: [String],
  logo: String,
  featured: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

const bookingSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  salon: { type: mongoose.Schema.Types.ObjectId, ref: 'Salon', required: true },
  services: [{ name: String, price: Number }],
  totalPrice: Number,
  date: String,
  time: String,
  status: { type: String, default: 'pending' },
  paymentMethod: String,
  paymentStatus: { type: String, default: 'pending' },
  notes: String,
  createdAt: { type: Date, default: Date.now }
});

const reviewSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  salon: { type: mongoose.Schema.Types.ObjectId, ref: 'Salon', required: true },
  booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
  rating: { type: Number, min: 1, max: 5 },
  comment: String,
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Salon = mongoose.model('Salon', salonSchema);
const Booking = mongoose.model('Booking', bookingSchema);
const Review = mongoose.model('Review', reviewSchema);

// JWT Middleware
const auth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET || 'salonsecret2024');
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};

const adminOnly = async (req, res, next) => {
  const user = await User.findById(req.user.id);
  if (user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  next();
};

// Email Setup
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

const sendEmail = async (to, subject, html) => {
  try {
    await transporter.sendMail({ from: process.env.EMAIL_USER, to, subject, html });
    console.log('Email sent to', to);
  } catch (err) {
    console.error('Email error:', err);
  }
};

// ========== AUTH ROUTES ==========

app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ error: 'Email already registered' });

    const hashed = await bcrypt.hash(password, 10);
    const userCount = await User.countDocuments();
    const role = userCount === 0 ? 'admin' : 'user';

    const user = new User({ name, email, password: hashed, phone, role });
    await user.save();

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET || 'salonsecret2024');
    res.json({ token, user: { id: user._id, name, email, phone, role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !await bcrypt.compare(password, user.password)) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET || 'salonsecret2024');
    res.json({ token, user: { id: user._id, name: user.name, email, phone: user.phone, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/auth/me', auth, async (req, res) => {
  const user = await User.findById(req.user.id).select('-password');
  res.json(user);
});

// ========== SALON ROUTES ==========

app.get('/api/salons', async (req, res) => {
  try {
    const { governorate, area, search, sort } = req.query;
    let query = {};
    if (governorate) query.governorate = governorate;
    if (area) query.area = area;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { nameAr: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    let salons = await Salon.find(query);
    if (sort === 'rating') salons.sort((a, b) => b.rating - a.rating);
    if (sort === 'price') salons.sort((a, b) => (a.services[0]?.price || 0) - (b.services[0]?.price || 0));
    res.json(salons);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/salons/:id', async (req, res) => {
  try {
    const salon = await Salon.findById(req.params.id);
    if (!salon) return res.status(404).json({ error: 'Salon not found' });
    const reviews = await Review.find({ salon: req.params.id }).populate('user', 'name');
    res.json({ salon, reviews });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/salons', auth, adminOnly, async (req, res) => {
  try {
    const salon = new Salon(req.body);
    await salon.save();
    res.json(salon);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/salons/:id', auth, adminOnly, async (req, res) => {
  try {
    const salon = await Salon.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(salon);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/salons/:id', auth, adminOnly, async (req, res) => {
  try {
    await Salon.findByIdAndDelete(req.params.id);
    res.json({ message: 'Salon deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== BOOKING ROUTES ==========

app.post('/api/bookings', auth, async (req, res) => {
  try {
    const { salonId, services, totalPrice, date, time, paymentMethod, notes } = req.body;
    const booking = new Booking({
      user: req.user.id,
      salon: salonId,
      services,
      totalPrice,
      date,
      time,
      paymentMethod,
      notes
    });
    await booking.save();

    const salon = await Salon.findById(salonId);
    const user = await User.findById(req.user.id);

    // Email to salon
    if (salon.email) {
      await sendEmail(salon.email, 'New Booking - Kuwait Salons', `
        <h2>New Booking Received</h2>
        <p><strong>Customer:</strong> ${user.name}</p>
        <p><strong>Phone:</strong> ${user.phone || 'N/A'}</p>
        <p><strong>Date:</strong> ${date}</p>
        <p><strong>Time:</strong> ${time}</p>
        <p><strong>Services:</strong> ${services.map(s => s.name).join(', ')}</p>
        <p><strong>Total:</strong> ${totalPrice} KD</p>
        <p><strong>Payment:</strong> ${paymentMethod}</p>
        ${notes ? `<p><strong>Notes:</strong> ${notes}</p>` : ''}
      `);
    }

    // Email to customer
    await sendEmail(user.email, 'Booking Confirmation - Kuwait Salons', `
      <h2>Booking Confirmed!</h2>
      <p><strong>Salon:</strong> ${salon.name}</p>
      <p><strong>Date:</strong> ${date}</p>
      <p><strong>Time:</strong> ${time}</p>
      <p><strong>Services:</strong> ${services.map(s => s.name).join(', ')}</p>
      <p><strong>Total:</strong> ${totalPrice} KD</p>
      <p><strong>Payment:</strong> ${paymentMethod}</p>
      <p>Salon Phone: ${salon.phone || 'N/A'}</p>
    `);

    res.json(booking);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/bookings', auth, async (req, res) => {
  try {
    const bookings = await Booking.find({ user: req.user.id })
      .populate('salon', 'name phone email')
      .sort({ createdAt: -1 });
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/bookings', auth, adminOnly, async (req, res) => {
  try {
    const bookings = await Booking.find()
      .populate('user', 'name email phone')
      .populate('salon', 'name')
      .sort({ createdAt: -1 });
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/bookings/:id/cancel', auth, async (req, res) => {
  try {
    const booking = await Booking.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { status: 'cancelled' },
      { new: true }
    );
    res.json(booking);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== REVIEW ROUTES ==========

app.post('/api/reviews', auth, async (req, res) => {
  try {
    const { salonId, bookingId, rating, comment } = req.body;
    const review = new Review({ user: req.user.id, salon: salonId, booking: bookingId, rating, comment });
    await review.save();

    // Update salon rating
    const reviews = await Review.find({ salon: salonId });
    const avg = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
    await Salon.findByIdAndUpdate(salonId, { rating: Math.round(avg * 10) / 10, reviewCount: reviews.length });

    res.json(review);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== FAVORITES ==========

app.post('/api/favorites/:salonId', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const idx = user.favorites.indexOf(req.params.salonId);
    if (idx > -1) user.favorites.splice(idx, 1);
    else user.favorites.push(req.params.salonId);
    await user.save();
    res.json(user.favorites);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/favorites', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate('favorites');
    res.json(user.favorites);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== ADMIN ROUTES ==========

app.get('/api/admin/users', auth, adminOnly, async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/stats', auth, adminOnly, async (req, res) => {
  try {
    const [users, salons, bookings, reviews] = await Promise.all([
      User.countDocuments(),
      Salon.countDocuments(),
      Booking.countDocuments(),
      Review.countDocuments()
    ]);
    res.json({ users, salons, bookings, reviews });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
