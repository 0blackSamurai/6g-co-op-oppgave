const express = require("express");
const app = express();
const path = require("path");
const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

// Connect to MongoDB with your Burgershop database
mongoose.connect("mongodb://127.0.0.1:27017/Burgershop", {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log("Connected to Burgershop database successfully"))
.catch((err) => console.error("MongoDB connection error:", err));

// User Schema and Model
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true }
});

const User = mongoose.model("User", userSchema);

app.use(cookieParser("your-secret-key"));
app.use(bodyParser.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));

// Middleware to check if the user is logged in
const checkLoggedIn = (req, res, next) => {
    if (req.signedCookies.user) {
        return next();
    }
    res.redirect("/");
};

// Middleware to check if the user has purchased
const hasPurchased = (req, res, next) => {
    if (req.signedCookies.purchase) {
        return next();
    }
    res.redirect("/buying");
};

// Burgers data (in-memory)
let burgers = [
    { id: 1, name: "BIGGY Burger", price: 10, description: "klassik", ingredients: ["burger", "brød"] },
    { id: 2, name: "CHEESY Burger", price: 12, description: "with extra cheese", ingredients: ["burger", "cheese", "brød"] }
];

const availableIngredients = ["lettuce", "tomato", "onion", "cheese", "bacon", "pickle", "ketchup", "mayo"];

// Routes
app.get("/", (req, res) => {
    const user = req.signedCookies.user;
    res.render("index", { title: "Home", user: user, error: null });
});

app.post("/login", async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await User.findOne({ username });
        if (!user) {
            return res.render("login", { title: "Login", user: null, error: "User not found" });
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if (isMatch) {
            res.cookie("user", { username: user.username }, { signed: true, httpOnly: true, maxAge: 24 * 60 * 60 * 1000 });
            res.redirect("/buying");
        } else {
            res.render("index", { title: "Home", user: null, error: "Invalid password" });
        }
    } catch (error) {
        console.error("Login error:", error);
        res.render("index", { title: "Home", user: null, error: "Login failed" });
    }
});

app.post("/create-user", async (req, res) => {
    const { username, password } = req.body;
    try {
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.render("index", { title: "Home", user: null, error: "Username already exists" });
        }
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        const newUser = new User({ username, password: hashedPassword });
        await newUser.save();
        res.cookie("user", { username: newUser.username }, { signed: true, httpOnly: true, maxAge: 24 * 60 * 60 * 1000 });
        res.redirect("/buying");
    } catch (error) {
        console.error("Create user error:", error);
        res.render("index", { title: "Home", user: null, error: "Failed to create user" });
    }
});

app.get("/buying", checkLoggedIn, (req, res) => {
    const user = req.signedCookies.user;
    res.render("buying", { title: "Buying", user: user, burgers: burgers });
});

app.get("/edit/:id", checkLoggedIn, (req, res) => {
    const burgerId = parseInt(req.params.id);
    const burger = burgers.find(b => b.id === burgerId);
    if (!burger) {
        return res.status(404).send("Burger not found");
    }
    const user = req.signedCookies.user;
    res.render("edit", { title: "Edit Burger", burger: burger, availableIngredients: availableIngredients, user: user });
});

app.post("/edit/:id", checkLoggedIn, (req, res) => {
    const burgerId = parseInt(req.params.id);
    const { ingredients } = req.body;
    const burger = burgers.find(b => b.id === burgerId);
    if (!burger) {
        return res.status(404).send("Burger not found");
    }
    const newBurger = {
        id: burgers.length + 1,
        name: `${burger.name} (Customized)`,
        price: burger.price + 2,
        description: "A customized burger",
        ingredients: ingredients.split(",")
    };
    burgers.push(newBurger);
    res.redirect("/buying");
});

app.post("/buy", checkLoggedIn, (req, res) => {
    res.cookie("purchase", true, { signed: true, httpOnly: true, maxAge: 24 * 60 * 60 * 1000 });
    res.redirect("/onWay");
});

app.get("/onWay", checkLoggedIn, hasPurchased, (req, res) => {
    const user = req.signedCookies.user;
    res.render("OnWay", { title: "On the Way", user: user });
});

app.get("/profile", checkLoggedIn, (req, res) => {
    const user = req.signedCookies.user;
    res.render("profile", { title: "Profile", user: user });
});

app.post("/logout", (req, res) => {
    res.clearCookie("user");
    res.clearCookie("purchase");
    res.redirect("/");
});

// Start server
app.listen(5000, () => {
    console.log("Server started on port 5000");
});
