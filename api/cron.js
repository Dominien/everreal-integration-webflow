// Serverless function for Vercel Cron Job
const { main } = require('../index');
const winston = require('winston');

// Setup a simple logger for the cron job
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} - ${level} - ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console()
  ]
});

module.exports = async (req, res) => {
  try {
    logger.info('Starting scheduled import via cron job');
    
    // Only allow GET requests from Vercel's cron system
    if (req.method !== 'GET') {
      logger.warn(`Rejected ${req.method} request - only GET is allowed`);
      return res.status(405).json({ error: 'Method not allowed' });
    }
    
    // Optional: Add authorization check for manual triggers
    // const authHeader = req.headers.authorization;
    // if (!authHeader || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    //   logger.warn('Unauthorized cron job trigger attempt');
    //   return res.status(401).json({ error: 'Unauthorized' });
    // }
    
    // Execute the main function - wrap in promise with timeout
    const timeout = 50000; // 50 seconds (to stay under Vercel's 60s limit)
    
    const mainPromise = new Promise(async (resolve, reject) => {
      try {
        await main();
        resolve({ success: true });
      } catch (error) {
        reject(error);
      }
    });
    
    // Create a timeout promise
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error('Processing timed out, execution will continue but response returned'));
      }, timeout);
    });
    
    // Race the main execution against the timeout
    const result = await Promise.race([mainPromise, timeoutPromise]);
    
    logger.info('Scheduled import completed successfully');
    return res.status(200).json({ success: true, message: 'Import completed' });
  } catch (error) {
    logger.error(`Error in cron job: ${error.message}`);
    
    // Return 200 status even on error to prevent Vercel from retrying
    // This is important to avoid duplicate imports
    return res.status(200).json({ 
      success: false, 
      error: error.message,
      note: 'Processing may still be running in the background'
    });
  }
};