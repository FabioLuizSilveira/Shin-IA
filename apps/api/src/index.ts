import Fastify from "fastify";

const fastify = Fastify({
  logger: true,
});

// Basic Healthcheck Route
fastify.get("/health", async (request, reply) => {
  return { status: "ok", service: "@shina/api", timestamp: new Date().toISOString() };
});

// Start the server
const start = async () => {
  try {
    const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;
    await fastify.listen({ port, host: "0.0.0.0" });
    fastify.log.info(`Server listening on port ${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
