const { createApp } = require("./createApp");

const PORT = Number(process.env.PORT || 5050);

async function bootstrap() {
  const app = createApp();

  app.listen(PORT, () => {
    console.log(`Premiere Downgrade Converter running on http://localhost:${PORT}`);
  });
}

bootstrap().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
