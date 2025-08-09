const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();

const admin = require("firebase-admin");
app.use(cors());
app.use(express.json());
app.get("/", (req, res) => res.send("Server running"));

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const uri = `mongodb+srv://${process.env.name}:${process.env.password}@cluster0.6w1zkna.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const database = client.db("Artifacts");
    const collection = database.collection("artifacts");

    // Endpoint to get top 6 recipes based on likes
    app.get("/top-artifact", async (req, res) => {
      try {
        const topArtifact = await collection
          .find({})
          .sort({ like: -1 })
          .limit(6)
          .toArray();
        res.status(200).json(topArtifact);
      } catch (error) {
        console.error("Error fetching top recipes:", error);
        res.status(500).json({ error: "Failed to fetch top recipes" });
      }
    });

    // Endpoint to get all artifacts
    app.get("/all-artifacts", async (req, res) => {
      try {
        const artifacts = await collection.find({}).toArray();
        res.status(200).json(artifacts);
      } catch (error) {
        console.error("Error fetching artifacts:", error);
        res.status(500).json({ error: "Failed to fetch artifacts" });
      }
    });

    // Endpoint to get liked artifacts
    app.get("/liked-artifacts", async (req, res) => {
      try {
        const userUID = req.headers["user-uid"];
        if (!userUID) {
          return res.status(400).json({ error: "User UID is required" });
        }
        const likedArtifacts = await collection
          .find({ likedBy: userUID })
          .toArray();
        res.status(200).json(likedArtifacts);
      } catch (error) {
        console.error("Error fetching liked artifacts:", error);
        res.status(500).json({ error: "Failed to fetch liked artifacts" });
      }
    });

    // View details
    app.get("/artifact/:id", async (req, res) => {
      try {
        const artifactId = req.params.id;
        if (!ObjectId.isValid(artifactId)) {
          return res.status(400).json({ error: "Invalid Artifact ID" });
        }
        const artifact = await collection.findOne({
          _id: new ObjectId(artifactId),
        });
        if (!artifact) {
          return res.status(404).json({ error: "Artifact not found" });
        }
        res.status(200).json(artifact);
      } catch (error) {
        console.error("Error fetching artifact details:", error);
        res.status(500).json({ error: "Failed to fetch artifact details" });
      }
    });

    // My artifacts
    app.get("/my-artifacts", async (req, res) => {
      try {
        const userUID = req.headers["user-uid"];

        const token = req.decodedToken;
        console.log("Decoded token:", token);

        if (userUID !== token.uid) {
          console.log("User UID does not match decoded token UID");
          return res.status(403).json({ error: "Forbidden access" });
        }

        if (!userUID) {
          return res.status(400).json({ error: "User UID is required" });
        }
        const userCollection = database.collection(userUID);
        const myArtifacts = await userCollection.find({}).toArray();
        res.status(200).json(myArtifacts);
      } catch (error) {
        console.error("Error fetching my artifacts:", error);
        res.status(500).json({ error: "Failed to fetch my artifacts" });
      }
    });

    // Like artifact
    app.patch("/artifact/like/:id", async (req, res) => {
      try {
        const artifactId = req.params.id;
        const userUID = req.headers["user-uid"];

        if (!ObjectId.isValid(artifactId)) {
          return res.status(400).json({ error: "Invalid Artifact ID" });
        }
        if (!userUID) {
          return res.status(400).json({ error: "User UID is required" });
        }
        const artifact = await collection.findOne({
          _id: new ObjectId(artifactId),
        });
        if (!artifact) {
          return res.status(404).json({ error: "Artifact not found" });
        }
        if (artifact.likedBy && artifact.likedBy.includes(userUID)) {
          return res
            .status(400)
            .json({ error: "User has already liked this artifact" });
        }
        const result = await collection.updateOne(
          { _id: new ObjectId(artifactId) },
          {
            $inc: { like: 1 },
            $addToSet: { likedBy: userUID },
          }
        );
        if (result.modifiedCount === 0) {
          return res.status(500).json({ error: "Failed to update like" });
        }
        res.status(200).json({ message: "Like added successfully" });
      } catch (error) {
        console.error("Error liking artifact:", error);
        res.status(500).json({ error: "Failed to like artifact" });
      }
    });

    // Delete artifact
    app.delete("/artifact/:id", async (req, res) => {
      try {
        const artifactId = req.params.id;
        const userUID = req.headers["user-uid"];

        if (!ObjectId.isValid(artifactId)) {
          return res.status(400).json({ error: "Invalid Artifact ID" });
        }
        if (!userUID) {
          return res.status(400).json({ error: "User UID is required" });
        }

        const query = { _id: new ObjectId(artifactId) };
        const userCollection = database.collection(userUID);

        const result1 = await collection.deleteOne(query);
        const result2 = await userCollection.deleteOne(query);

        if (result1.deletedCount === 1 && result2.deletedCount === 1) {
          res.status(200).json({ message: "Artifact deleted successfully" });
        } else {
          res.status(404).json({ message: "Artifact not found" });
        }
      } catch (error) {
        console.error("Error deleting artifact:", error);
        res.status(500).json({ error: "Internal Server Error" });
      }
    });

    // Update artifact
    app.patch("/artifact/:id", async (req, res) => {
      try {
        const artifactId = req.params.id;
        const userUID = req.headers["user-uid"];
        const update = req.body;

        if (!ObjectId.isValid(artifactId)) {
          return res.status(400).json({ error: "Invalid Artifact ID" });
        }
        if (!userUID) {
          return res.status(400).json({ error: "User UID is required" });
        }

        const query = { _id: new ObjectId(artifactId) };
        const userCollection = database.collection(userUID);

        const updateData = {
          ...update,
          like: update.like !== undefined ? update.like : undefined,
          likedBy: update.likedBy !== undefined ? update.likedBy : undefined,
        };

        const result1 = await collection.updateOne(query, { $set: updateData });
        const result2 = await userCollection.updateOne(query, {
          $set: updateData,
        });

        if (result1.modifiedCount === 1 && result2.modifiedCount === 1) {
          res.status(200).json({ message: "Artifact updated successfully" });
        } else {
          res.status(404).json({ message: "Artifact not found" });
        }
      } catch (error) {
        console.error("Error updating artifact:", error);
        res.status(500).json({ error: "Internal Server Error" });
      }
    });

    // Add artifact
    app.post("/add-artifact", async (req, res) => {
      try {
        const artifact = req.body;
        const userUID = req.headers["user-uid"];
        if (!userUID) {
          return res.status(400).json({ error: "User UID is required" });
        }
        artifact.adderUID = userUID;
        artifact.likedBy = [];
        artifact.like = 0;
        const userCollection = database.collection(userUID);
        const result = await collection.insertOne(artifact);
        const userResult = await userCollection.insertOne(artifact);
        if (!result.acknowledged || !userResult.acknowledged) {
          return res.status(500).json({ error: "Failed to add artifact" });
        }
        res.status(201).json({ ...artifact, _id: result.insertedId });
      } catch (error) {
        console.error("Error adding artifact:", error);
        res.status(500).json({ error: "Failed to add artifact" });
      }
    });
  } finally {
  }
}
run().catch(console.dir);

app.listen(5000, () => console.log("Server running on port 5000"));
