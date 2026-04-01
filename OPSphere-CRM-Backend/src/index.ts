import 'dotenv/config';
import app from './app.js';

const PORT = parseInt(process.env.PORT || '3003', 10);

app.listen(PORT, () => {
  console.log(`OPSphere CRM Backend running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});
