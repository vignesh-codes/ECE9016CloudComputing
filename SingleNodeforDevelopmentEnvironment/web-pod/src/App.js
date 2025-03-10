import React, { useState, useEffect } from "react";
import { auth } from "./firebase";
import {
	signInWithEmailAndPassword,
	createUserWithEmailAndPassword,
	signOut,
} from "firebase/auth";
import axios from "axios";
import "./App.css";

const App = () => {
	const [user, setUser] = useState(null);
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [text, setText] = useState("");
	const [image, setImage] = useState(null);
	const [posts, setPosts] = useState([]);

	const API_URL = "https://socialmediaapp.duckdns.org";

	// Handle Firebase auth state
	useEffect(() => {
		const unsubscribe = auth.onAuthStateChanged((user) => {
			if (user) {
				setUser(user);
				fetchPosts();
			} else {
				setUser(null);
				setPosts([]);
			}
		});
		return unsubscribe;
	}, []);

	// Fetch posts
	const fetchPosts = async () => {
		try {
			const idToken = await auth.currentUser.getIdToken();
			const response = await axios.get(`${API_URL}/api/posts`, {
				headers: { Authorization: `Bearer ${idToken}` },
			});
			setPosts(response.data);
		} catch (error) {
			console.error("Error fetching posts:", error);
		}
	};

	// Handle registration
	const handleRegister = async () => {
		try {
			await createUserWithEmailAndPassword(auth, email, password);
			alert("Registration successful! Please log in.");
		} catch (error) {
			alert("Error registering: " + error.message);
		}
	};

	// Handle login
	const handleLogin = async () => {
		try {
			await signInWithEmailAndPassword(auth, email, password);
		} catch (error) {
			alert("Error logging in: " + error.message);
		}
	};

	// Handle post submission
	const handleSubmitPost = async () => {
		if (!text) {
			alert("Please provide text for your post.");
			return;
		}

		try {
			const idToken = await auth.currentUser.getIdToken();
			const postData = { username: user.email, text, imageBase64: null };

			if (image) {
				const reader = new FileReader();
				reader.readAsDataURL(image);
				reader.onload = async () => {
					const imageBase64 = reader.result.split(",")[1];
					postData.imageBase64 = imageBase64;
					await submitPost(idToken, postData);
				};
			} else {
				await submitPost(idToken, postData);
			}
		} catch (error) {
			alert(
				"Error submitting post: " + error.response?.data?.error ||
					error.message
			);
		}
	};

	const submitPost = async (idToken, postData) => {
		await axios.post(`${API_URL}/api/posts`, postData, {
			headers: { Authorization: `Bearer ${idToken}` },
		});
		setText("");
		setImage(null);
		fetchPosts();
	};

	// Handle logout
	const handleLogout = async () => {
		try {
			await signOut(auth);
		} catch (error) {
			console.error("Error logging out:", error);
		}
	};

	if (!user) {
		return (
			<div className="App">
				<h1>Social Media App</h1>
				<h2>Register</h2>
				<input
					type="email"
					placeholder="Email"
					value={email}
					onChange={(e) => setEmail(e.target.value)}
				/>
				<input
					type="password"
					placeholder="Password"
					value={password}
					onChange={(e) => setPassword(e.target.value)}
				/>
				<button onClick={handleRegister}>Register</button>

				<h2>Login</h2>
				<button onClick={handleLogin}>Login</button>
			</div>
		);
	}

	return (
		<div className="App">
			<h1>Welcome, {user.email}!</h1>
			<button onClick={handleLogout}>Logout</button>

			<h2>Create a Post</h2>
			<textarea
				placeholder="Write your post..."
				value={text}
				onChange={(e) => setText(e.target.value)}
			/>
			<input
				type="file"
				accept="image/*"
				onChange={(e) => setImage(e.target.files[0])}
			/>
			<button onClick={handleSubmitPost}>Submit Post</button>

			<h2>Posts</h2>
			{posts.map((post) => (
				<div key={post.id} className="post">
					<p>
						<strong>{post.username}</strong>: {post.text}
					</p>
					<img
						src={post.imageUrl}
						alt="Post"
						style={{ maxWidth: "300px" }}
					/>
				</div>
			))}
		</div>
	);
};

export default App;
