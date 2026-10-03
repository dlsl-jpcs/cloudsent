import app from './app.js';
import { config } from './config.js';

// Only local development opens a port. Vercel imports the app without starting it.
app.listen(config.PORT, () => console.log(`CloudSent API listening on ${config.PORT}`));
