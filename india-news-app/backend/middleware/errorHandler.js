module.exports.notFound = (req, res) => {
  res.status(404).json({ error: 'Not Found' });
};

module.exports.errorHandler = (err, req, res, next) => {
  // pino-http attached as req.log
  req.log?.error({ err, path: req.path, userId: req.user?.id }, 'Unhandled error');
  
  // Handle Mongoose ValidationError with 422 status
  if (err.name === 'ValidationError') {
    const validationErrors = Object.values(err.errors).map(e => e.message);
    return res.status(422).json({
      error: 'Validation failed',
      details: validationErrors
    });
  }
  
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Server error';
  res.status(status).json({ error: message });
};