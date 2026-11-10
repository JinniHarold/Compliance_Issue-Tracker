import { createApp } from "./app";
import { config } from "./config";

const app = createApp();

app.listen(config.PORT, () => {
  console.log(`API running on http://localhost:${config.PORT} (${config.NODE_ENV})`);
});