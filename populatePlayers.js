const mongoose = require('mongoose');

const connectToDatabase = async () => {
  try {
    await mongoose.connect('mongodb+srv://zaldrick:xtHDAM0ZFpq2iL9L@oppede.zfhlzph.mongodb.net/oppede', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB successfully!');
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    process.exit(1);
  }
};

const populatePlayers = async () => {
  const db = mongoose.connection.db;
  const players = db.collection('players');

  const testData = [
    { pseudo: 'Mehdi', dailyTeam: '1', dailyScore: 10, totalScore: 100, posX: 0, posY: 0 },
    { pseudo: 'Arthur', dailyTeam: '1', dailyScore: 20, totalScore: 200, posX: 10, posY: 10 },
    { pseudo: 'Ulrich', dailyTeam: '1', dailyScore: 30, totalScore: 300, posX: 20, posY: 20 },
  ];

  try {
    await players.insertMany(testData);
    console.log('Test data inserted successfully!');
  } catch (error) {
    console.error('Error inserting test data:', error);
  } finally {
    mongoose.connection.close();
  }
};

const main = async () => {
  await connectToDatabase();
  await populatePlayers();
};

main();
