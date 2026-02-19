import { startServer } from './app.js';

startServer()
  .then(() => {
    // no-op
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
