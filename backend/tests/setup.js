const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

let mongoServer;

/**
 * Spin up an in-memory MongoDB instance before any tests run.
 * If importing server.js already connected mongoose (it won't because of
 * the require.main guard, but just in case), we disconnect first.
 */
beforeAll(async () => {
  // Disconnect any existing mongoose connection (safety net)
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
});

/**
 * Tear down: disconnect mongoose and stop the in-memory server.
 */
afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});
