import logger from '../lib/logger.js';

export function isLoggedIn(req, res, next) {
  try {
    if (req.session && req.session.user) {
      req.user = req.session.user;
      return next();
    }

    return res.status(401).json({ message: 'Not authenticated' });
  } catch (error) {
    logger.error(error, 'isLoggedIn middleware error');
    return res.status(500).json({ message: 'Internal server error' });
  }
}

export default { isLoggedIn };
