module.exports.notFound = (req, res) => {
  res.status(404).json({ error: 'Not Found' });
};

module.exports.errorHandler = (err, req, res, next) => {
  // pino-http attached as req.log
  req.log?.error({ err, path: req.path, userId: req.user?.id }, 'Unhandled error');
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Server error';
  res.status(status).json({ error: message });
};