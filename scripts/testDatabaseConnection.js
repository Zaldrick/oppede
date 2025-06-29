const { MongoClient, ObjectId } = require("mongodb");

async function testDatabaseConnection() {
  const uri = process.env.MONGO_URI || "mongodb+srv://zaldrick:xtHDAM0ZFpq2iL9L@oppede.zfhlzph.mongodb.net/oppede";
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log("Connected to MongoDB successfully!");

    const db = client.db("oppede");
    const item = await db.collection("photos").findOne({ _id: new ObjectId("6861b4d899886bdbb19568bb") })
    console.log("Photo found:", item);
  } catch (error) {
    console.error("Error connecting to MongoDB or fetching items:", error);
  } finally {
    await client.close();
  }
}

testDatabaseConnection();