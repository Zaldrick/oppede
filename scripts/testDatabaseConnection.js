const { MongoClient } = require("mongodb");

async function testDatabaseConnection() {
  const uri = process.env.MONGO_URI || "mongodb+srv://zaldrick:xtHDAM0ZFpq2iL9L@oppede.zfhlzph.mongodb.net/oppede";
  const client = new MongoClient(uri); // Remove deprecated options

  try {
    await client.connect();
    console.log("Connected to MongoDB successfully!");

    const db = client.db("oppede");
    const items = await db.collection("items").find().toArray();
    console.log("Items in the database:", items);
  } catch (error) {
    console.error("Error connecting to MongoDB or fetching items:", error);
  } finally {
    await client.close();
  }
}

testDatabaseConnection();
