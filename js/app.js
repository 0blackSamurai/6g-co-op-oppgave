const express = require("express");
const app = express();
const path = require("path");
const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser");

app.use(cookieParser("your-secret-key"));
app.use(bodyParser.urlencoded({ extended: true }));

app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));

// Variable to keep track of logged-in status
let isLogged = false;

// Middleware to check if the user is logged in
const checkLoggedIn = (req, res, next) => {
    if (isLogged) {
        return next();
    }
    res.redirect("/"); // Redirect to home page if not logged in
};

// Middleware to check if the user has purchased
const hasPurchased = (req, res, next) => {
    if (req.signedCookies.purchase) {
        return next();
    }
    res.redirect("/buying");
};

// Routes
app.get("/",(req, res) => {
    res.render("index", { title: "Home"});
});

// Login route
app.post("/login", (req, res) => {
    const { username, password } = req.body;
    console.log("Attempting login with:", username, password);
    isLogged = true; 

    // Mock authentication check
    if (islogged=true) {
        console.log("Login successful, redirecting to /buying");
        res.redirect("/buying"); 
    } else {
        console.log("Login failed");
        res.redirect("/"); 
    }
});
let buyed = false
// Buying page - only accessible if logged in
app.get("/buying", checkLoggedIn, (req, res) => {
    res.render("buying", { title: "Buying" });
});

// Buy route to simulate purchase and set purchase status
app.post("/buy", checkLoggedIn, (req, res) => {
    res.cookie("purchase", true, { signed: true });
    res.redirect("/onWay");
    buyed = true;
});
// Logout route
app.post("/logout", (req, res) => {
    isLogged = false; // Set logged-in status to false
    res.clearCookie("purchase"); // Optionally clear the purchase cookie
    res.redirect("/"); // Redirect to home page
});


// OnWay page - accessible only if logged in and has purchased
app.get("/onWay", checkLoggedIn, hasPurchased, (req, res) => {
    res.render("OnWay", { title: "On the Way" });
});
app.get("/profile",(req, res) => {
        res.render("profile", { title: "Profile" });
    })

// Start server
app.listen(5000, () => {
    console.log("Server started on port 5000");
});
