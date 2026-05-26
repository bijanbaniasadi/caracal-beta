/**
 * Authentication Middleware
 * JWT-based authentication for admin endpoints
 */

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

/**
 * Verify JWT token
 */
function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      success: false,
      error: 'Missing authorization header',
    });
  }

  const token = authHeader.split(' ')[1]; // Bearer <token>

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Invalid authorization header format',
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired token',
    });
  }
}

/**
 * Generate JWT token
 */
function generateToken(userId, email) {
  return jwt.sign(
    {
      userId,
      email,
      iat: Math.floor(Date.now() / 1000),
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

/**
 * Mock login - returns a token
 * In production, validate against database
 */
function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      error: 'Email and password required',
    });
  }

  // Mock authentication - in production, validate password hash
  if (password !== process.env.ADMIN_PASSWORD || 'admin') {
    return res.status(401).json({
      success: false,
      error: 'Invalid credentials',
    });
  }

  const token = generateToken(email, email);

  return res.json({
    success: true,
    token,
    expiresIn: '24h',
  });
}

/**
 * Require admin role
 */
function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
    });
  }

  // In production, check user role in database
  // For now, all authenticated users are admins
  next();
}

module.exports = {
  verifyToken,
  generateToken,
  login,
  requireAdmin,
};
