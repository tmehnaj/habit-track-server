const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const cors = require('cors');
const admin = require("firebase-admin");
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const port = process.env.PORT || 3000;

var serviceAccount = require("./habit-track-firebase-admin-sdk.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

app.use(cors());
app.use(express.json());


const verifyFirebaseToken= async(req,res,next)=>{
  if(!req.headers.authorization){
    return res.status(401).send({message: "unauthorized access"});
  }
  const token = req.headers.authorization.split(" ")[1];
  //  console.log('token',token);
  if(!token){
    return res.status(401).send({message: "unauthorized access"});
  }

  try{
    const decoded = await admin.auth().verifyIdToken(token);
    req.token_email = decoded.email;
    next();
  }catch(err){
    return res.status(401).send({message: "unauthorized access"});
  }
}

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@customcluster.mlvrouu.mongodb.net/?appName=CustomCluster`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});


app.get('/',(req,res)=>{
    res.send('I am the habit track server.');
})


async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    const db = client.db("habit_tracker");
    const habitCollection = db.collection("habits");

    //habits related apis

    //complete habit
    app.patch("/habits/complete/:id",verifyFirebaseToken,async(req,res)=>{
      const id=req.params.id;
      const query = { _id: new ObjectId(id)};
      const habit = await habitCollection.findOne(query);
      if(!habit){
        return res.status(404).send({ message: "Habit not found" });
      }

      const today = new Date().toDateString();
        const habitHistory = habit.completionHistory || [];

      const alreadyCompleted = habitHistory.find(date=> new Date(date).toDateString() === today);

      if(alreadyCompleted){
        return res.send({ message: "Already Today's Habit Completed." });
      }
      const update = {
        $push: {
          completionHistory: new Date(),
        }
      }

      const result = await habitCollection.updateOne(query,update);
      res.send(result);


    })
        //update habit
        app.put("/habits/:id",verifyFirebaseToken,async(req,res)=>{
          const id = req.params.id;
          const updateHabit = req.body;
          const query = { _id: new ObjectId(id)};
          const update = {
            $set: updateHabit,
          }
          const result = await habitCollection.updateOne(query,update);
          res.send(result);
        })
       //get habits for certain user
    app.get("/myHabits",verifyFirebaseToken,async(req,res)=>{

      const reqEmail = req.query.email;
      const query = {};
      if(reqEmail){
        query.email = reqEmail;
      }
      //verify if the user using others gmail/token
      if(reqEmail !== req.token_email){
        res.status(403).send({message: "forbidden access"});
      }
      const cursor = habitCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    })
    //get all habits
    app.get("/habits",async(req,res)=>{
      const cursor = habitCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    })
    //get lastest habits
    app.get("/latestHabits",async(req,res)=>{
      const cursor = habitCollection.find().sort({createdAt: -1}).limit(6);
      const result = await cursor.toArray();
      res.send(result);
    })
    //get habit by id
    app.get("/habits/:id",verifyFirebaseToken,async(req,res)=>{
       const id = req.params.id;
      const query = { _id: new ObjectId(id)};
      const result = await habitCollection.findOne(query);
      res.send(result);    
    })
 
    // post habit
    app.post("/habits",verifyFirebaseToken,async(req,res)=>{
      const newHabit = req.body;
      console.log('from post habit')
      // const email = req.body.email;
      // if(email !== req.token_email){
      //   res.status(403).send({message: "forbidden access"});
      // }
      const result = await habitCollection.insertOne(newHabit);
      res.send(result);
    })

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(port,()=>{
    console.log(`Example app listening on port ${port}`);
})