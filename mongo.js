const MongoClient = require('mongodb').MongoClient;
const ObjectId = require('mongodb').ObjectID;
const atlasURL = process.env.ATLAS_URL;

async function getConnectedClient() {
    const client = await new MongoClient(atlasURL, { useNewUrlParser: true });
    await client.connect();
    return client;
}

module.exports = {
    getUserFromSessionKey: async function(sessionKey) {
        const client = await new MongoClient(atlasURL, { useNewUrlParser: true });
        await client.connect();
        console.log('Connected to MongoDB');
        const db = client.db('your-final-grade');
        const sessionsCollection = db.collection('sessions');
        
        const sessionDocument = await sessionsCollection.findOne({ _id: ObjectId(sessionKey) });
        if (!sessionDocument) {
            throw new Error('Invalid Session Key');
        }
        
        const usersCollection = db.collection('users');
        const userDocument = await usersCollection.findOne({ _id: sessionDocument.user });
        if (!userDocument) {
            throw new Error('User Does Not Exist');
        }
        await client.close();
        return userDocument;
    },
    createToken: async function() {
        const client = await getConnectedClient();
        const db = client.db('your-final-grade');
        const tokensCollection = db.collection('tokens');
        const ret = await tokensCollection.insertOne({ scanned: false, scanned_by: ObjectId() })
        await client.close();
        return { token: ret.insertedId.toString() };
    },
    createSession: async function(userId) {
        const client = await new MongoClient(atlasURL, { useNewUrlParser: true });
        await client.connect();
        console.log('Connected to MongoDB');
        const db = client.db('your-final-grade');
        const sessionsCollection = db.collection('sessions');
        const ret = await sessionsCollection.insertOne({ user: ObjectId(userId) })
        await client.close();
        return { sessionKey: ret.insertedId.toString(), userId: userId.toString() };
    },
    setUserDataStore: async function(userObjectId, newDataStore) {
        const client = await getConnectedClient();
        const db = client.db('your-final-grade');
        const usersCollection = db.collection('users');
        await usersCollection.updateOne(
            {
                _id: userObjectId,
            },
            {
                '$set': {
                    dataStore: newDataStore
                }
            }
        )
        await client.close();
    },
    setTokenAsScanned: async function(token) {
        const client = await getConnectedClient();
        const db = client.db('your-final-grade');
        const tokensCollection = db.collection('tokens');
        await tokensCollection.updateOne(
            {
                _id: ObjectId(token),
            },
            {
                '$set': {
                    scanned: true
                }
            }
        );
        await client.close();
    },
    setTokenAsRedeemed: async function(token, userId) {
        const client = await getConnectedClient();
        const db = client.db('your-final-grade');
        const tokensCollection = db.collection('tokens');
        await tokensCollection.updateOne(
            {
                _id: ObjectId(token),
            },
            {
                '$set': {
                    scanned_by: userId,
                }
            }
        );
        await client.close();
    }
}
