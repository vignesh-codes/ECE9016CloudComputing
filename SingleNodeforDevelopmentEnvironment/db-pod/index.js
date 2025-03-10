const express = require("express");
const admin = require("firebase-admin");
const { Storage } = require("@google-cloud/storage");
const cors = require("cors");
const app = express();

app.use(cors());
app.use(express.json({ limit: "50mb" }));

// Initialize Firebase Admin SDK with service account key
const serviceAccount = require("./firebase-service-account-key.json");
admin.initializeApp({
	credential: admin.credential.cert(serviceAccount),
});

const firestore = admin.firestore();
const storage = new Storage();
const bucketName = "socialmediaapp-images-firebase";
const bucket = storage.bucket(bucketName);

// Middleware to verify Firebase ID token
const authenticateToken = async (req, res, next) => {
	const authHeader = req.headers["authorization"];
	if (!authHeader)
		return res.status(401).json({ error: "No token provided" });

	const idToken = authHeader.split(" ")[1];
	try {
		const decodedToken = await admin.auth().verifyIdToken(idToken);
		req.user = decodedToken;
		next();
	} catch (error) {
		res.status(401).json({ error: "Invalid or expired token" });
	}
};

// API to submit a post (requires authentication)
app.post("/api/posts", authenticateToken, async (req, res) => {
	const { username, text, imageBase64 } = req.body;

	// Validate required fields
	if (!text) {
		return res.status(400).json({ error: "Text content is required" });
	}

	console.log("Received imageBase64:", imageBase64); // Debug log

	try {
		// Verify the username matches the authenticated user
		const firebaseUser = await admin.auth().getUser(req.user.uid);
		if (firebaseUser.email !== username) {
			return res.status(403).json({ error: "Unauthorized" });
		}

		let imageUrl = null;
		// Only process image if imageBase64 is provided and valid
		if (imageBase64) {
			if (typeof imageBase64 !== "string" || !imageBase64.trim()) {
				return res.status(400).json({ error: "Invalid image data" });
			}
			// Save image to Cloud Storage
			const imageFileName = `${username}-${Date.now()}.png`;
			const file = bucket.file(imageFileName);
			const buffer = Buffer.from(imageBase64, "base64");
			await file.save(buffer, { contentType: "image/png" });

			// Get the public URL of the image
			imageUrl = `https://storage.googleapis.com/${bucketName}/${imageFileName}`;
		}

		// Save post to Firestore
		const postRef = await firestore.collection("posts").add({
			username,
			text,
			imageUrl,
			createdAt: new Date().toISOString(),
			userId: req.user.uid,
		});

		res.status(201).json({
			id: postRef.id,
			text,
			...(imageUrl && { imageUrl }),
		});
	} catch (error) {
		console.error("Error in /api/posts:", error); // Debug log
		res.status(500).json({ error: error.message });
	}
});

// API to get all posts (public or authenticated)
app.get("/api/posts", authenticateToken, async (req, res) => {
	try {
		const postsSnapshot = await firestore.collection("posts").get();
		const posts = postsSnapshot.docs.map((doc) => ({
			id: doc.id,
			...doc.data(),
		}));
		res.status(200).json(posts);
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
});

app.get("/test", (req, res) => {
	res.status(200).json({ message: "Test route working!" });
});

const PORT = 8080;
app.listen(PORT, "0.0.0.0", () => {
	console.log(`Database server running on port ${PORT}`);
});
