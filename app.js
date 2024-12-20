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
    password: { type: String, required: true },
    savedBurgers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Burger' }] 
});
const transactionSchema = new mongoose.Schema({
    user: { type: String, required: true },   // Username of the user making the purchase
    cardNumber: { type: String, required: true }, // Card number (for demo purposes, it should be 16 digits)
    cardExpiry: { type: String },               // Card expiry date (if needed)
    cardCVV: { type: String },                  // CVV (3-digit number)
    phoneNumber: { type: String, required: true }, // User's phone number
    email: { type: String },                    // User's email address (optional)
    address: {                                  // Delivery address (required for delivery)
        houseNumber: { type: String, required: true },
        street: { type: String, required: true },
        city: { type: String, required: true },
        postalCode: { type: String, required: true }
    },
    paymentMethod: {                             // Payment method (e.g., card, cash)
        type: String,
        required: true,
        enum: ['card', 'cash', 'applePay', 'paypal'] // Possible payment methods
    },
    createdAt: { type: Date, default: Date.now } // Timestamp of the transaction
});

const Transaction = mongoose.model("Transaction", transactionSchema);

const customizedBurgerSchema = new mongoose.Schema({
    user: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    originalBurger: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Burger', 
        required: true 
    },
    customIngredients: [{
        name: { type: String, required: true },
        quantity: { type: Number, default: 1 }
    }],
    createdAt: { 
        type: Date, 
        default: Date.now 
    }
});

const CustomizedBurger = mongoose.model('CustomizedBurger', customizedBurgerSchema);


const burgerSchema = new mongoose.Schema({
    name: { type: String, required: true },
    price: { type: Number, required: true },
    ingredients: { type: [String], required: true }
});


const Burger = mongoose.model("Burger", burgerSchema);

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
// let burgers = [
//     { id: 1, name: "BIGGY Burger", price: 10, description: "klassik", ingredients: ["burger", "brød"] },
//     { id: 2, name: "CHEESY Burger", price: 12, description: "with extra cheese", ingredients: ["burger", "cheese", "brød"] }
// ];

const availableIngredients = ["lettuce", "tomato", "onion", "cheese", "bacon", "pickle", "ketchup", "mayo"];

// Routes
app.get("/", (req, res) => {
    const user = req.signedCookies.user;
    res.render("index", { title: "Home", user: user, error: null });
});
app.get("/login", (req, res) => {
    const user = req.signedCookies.user;
    res.render("login", {
        title: "Login",
        user: user
    })
    
    });
app.get("/register", (req, res) => {
    const user = req.signedCookies.user;
    res.render("register", {
        title: "Register",
        user: user
    })
});
// Route to handle editing a transaction by its ID
app.get("/TransactionsEdit/:id", checkLoggedIn, async (req, res) => {
    try {
        const transactionId = req.params.id; // Get the transaction ID from the URL params
        const user = await User.findOne({ username: req.signedCookies.user.username });
        
        // Fetch the specific transaction using the ID
        const transaction = await Transaction.findById(transactionId).lean(); 

        if (!transaction) {
            return res.status(404).send("Transaction not found");
        }

        // Render the edit page with the transaction data
        res.render("TransactionsEdit", {
            title: "Edit Transaction",
            user: user,
            transaction: transaction, // Pass the single transaction
        });
    } catch (error) {
        console.error("Error fetching transaction:", error);
        res.status(500).send("Server error");
    }
});


app.post("/editTransaction/:id", checkLoggedIn, async (req, res) => {
    try {
        // Get the updated data from the form submission
        const { cardNumber, cardExpiry, cardCVV, phoneNumber, email, houseNumber, street, city, postalCode, paymentMethod } = req.body;

        // Find the transaction by its ID
        const transaction = await Transaction.findById(req.params.id);
        
        if (!transaction) {
            return res.status(404).send("Transaction not found");
        }

        // Ensure the user is the owner of the transaction
        if (transaction.user !== req.signedCookies.user.username) {
            return res.status(403).send("You are not authorized to edit this transaction");
        }

        // Update the transaction fields
        transaction.cardNumber = cardNumber || transaction.cardNumber;
        transaction.cardExpiry = cardExpiry || transaction.cardExpiry;
        transaction.cardCVV = cardCVV || transaction.cardCVV;
        transaction.phoneNumber = phoneNumber || transaction.phoneNumber;
        transaction.email = email || transaction.email;
        transaction.address.houseNumber = houseNumber || transaction.address.houseNumber;
        transaction.address.street = street || transaction.address.street;
        transaction.address.city = city || transaction.address.city;
        transaction.address.postalCode = postalCode || transaction.address.postalCode;
        transaction.paymentMethod = paymentMethod || transaction.paymentMethod;

        // Save the updated transaction
        await transaction.save();

        // Redirect to the profile or a confirmation page
        res.redirect("/profile");
    } catch (error) {
        console.error("Error updating transaction:", error);
        res.status(500).send("Error updating transaction");
    }
});
app.post("/UpdateTransactions/:id", checkLoggedIn, async (req, res) => {
    try {
        const transactionId = req.params.id;
        const updates = {
            "address.houseNumber": req.body.houseNumber,
            "address.street": req.body.street,
            "address.city": req.body.city,
            "address.postalCode": req.body.postalCode,
            cardNumber: req.body.cardNumber,
            cardExpiry: req.body.cardExpiry,
            cardCVV: req.body.cardCVV,
            paymentMethod: req.body.paymentMethod,
            phoneNumber: req.body.phoneNumber,
            email: req.body.email,
        };

        // Update the transaction in the database
        const transaction = await Transaction.findByIdAndUpdate(transactionId, updates, { new: true });

        if (!transaction) {
            return res.status(404).send("Transaction not found");
        }

        // Redirect or respond after successful update
        res.redirect("/Profile"); // Or send a success message: res.status(200).json({ success: true });
    } catch (error) {
        console.error("Error updating transaction:", error);
        res.status(500).send("Server error");
    }
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


// Update existing routes to handle customization
app.post("/customize", checkLoggedIn, async (req, res) => {
    try {
        const { burgerId, ingredients } = req.body;

        // Find the original burger
        const originalBurger = await Burger.findById(burgerId);
        if (!originalBurger) {
            return res.status(404).send("Original burger not found");
        }

        // Create a new customized burger object (no price calculation)
        const customizedBurger = {
            originalBurger: {
                name: originalBurger.name,
                ingredients: originalBurger.ingredients,
            },
            customIngredients: [],
        };
        
        ingredients.forEach(ingredient => {
            customizedBurger.customIngredients.push({
                name: ingredient,
                quantity: 1
            });
        });
        
        // Save the customized burger to a signed cookie
        res.cookie("customBurger", JSON.stringify(customizedBurger), {
            signed: true,
            httpOnly: true,
            maxAge: 24 * 60 * 60 * 1000
        });

        // Redirect to the confirm buy page
        res.redirect("/confirmBuy");
    } catch (error) {
        console.error("Error customizing burger:", error);
        res.status(500).send("Server error");
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




app.get("/createburger", checkLoggedIn, (req, res) => {
    const user = req.signedCookies.user;
    res.render("createBurger", { 
        title: "Create Burger", 
        user: user, 
        error: null, 
        availableIngredients: availableIngredients
    });
});
app.post("/create-burger", checkLoggedIn, async (req, res) => {
    const { name, price, ingredients } = req.body;

    try {
        const newBurger = new Burger({
            name,
            price: parseFloat(price),
            ingredients: Array.isArray(ingredients) ? ingredients : [ingredients] // Handles both single and multiple selections
        });

        await newBurger.save();
        res.redirect("/buying"); // Redirect to the buying page after saving
    } catch (error) {
        console.error("Error creating burger:", error);
        res.render("createBurger", { 
            title: "Create Burger", 
            user: req.signedCookies.user, 
            availableIngredients: availableIngredients, 
            error: "Failed to create the burger. Please try again."
        });
    }
});




app.get("/buying", checkLoggedIn, async (req, res) => {
    const user = req.signedCookies.user;

    try {
        const burgers = await Burger.find(); // Fetch all burgers from the database
        res.render("buying", { 
            title: "Buying", 
            user: user, 
            burgers: burgers,
            availableIngredients: availableIngredients // Add this line
        });
    } catch (error) {
        console.error("Error fetching burgers:", error);
        res.render("buying", { 
            title: "Buying", 
            user: user, 
            burgers: [], 
            availableIngredients: [], // Add this as well
            error: "Failed to load burgers. Please try again later." 
        });
    }
});

// Render Edit Page
// Render Edit Page
app.get("/edit/:id", checkLoggedIn, async (req, res) => {
    try {
        const burger = await Burger.findById(req.params.id);
        if (!burger) {
            return res.status(404).send("Burger not found");
        }
        const user = req.signedCookies.user;
        res.render("edit", { 
            title: "Edit Burger", 
            burger: burger, 
            availableIngredients: availableIngredients, 
            user: user 
        });
    } catch (error) {
        console.error("Error finding burger:", error);
        res.status(500).send("Server error");
    }
});

// Handle Edit Form Submission
app.post("/edit/:id", checkLoggedIn, async (req, res) => {
    const { ingredients } = req.body;
    const ingredientsArray = ingredients.split(",");
    
    try {
        const selectedBurger = await Burger.findById(req.params.id);

        if (!selectedBurger) {
            return res.status(404).send("Burger not found");
        }

        const newBurger = new CustomizedBurger({
            user: req.signedCookies.user,
            originalBurger: selectedBurger,
            customIngredients: ingredientsArray.map(ingredient => ({
                name: ingredient,
                quantity: 1
            })),
        });

        res.render("confirmBuy", { 
            title: "Confirm Purchase", 
            user: req.signedCookies.user, 
            burger: selectedBurger 
        });
    } catch (error) {
        console.error("Error updating burger:", error);
        res.status(500).send("Server error");
    }
});

// Bekreft kjøp og omdiriger til profilen
app.post("/confirmBuy", checkLoggedIn, async (req, res) => {
    const customBurger = req.signedCookies.customBurger;

    if (!customBurger) {
        return res.redirect("/buying");
    }
    try {
        const { burgerId, ingredients } = req.body;

        // Find the original burger
        const originalBurger = await Burger.findById(burgerId);
        if (!originalBurger) {
            return res.status(404).send("Original burger not found");
        }

        // Find the current user
        const user = await User.findOne({ username: req.signedCookies.user.username });

        // Calculate additional price for custom ingredients
        const additionalPrice = ingredients.reduce((total, ingredient) => {
            // Define a pricing logic for additional ingredients here
            // For example, each ingredient adds $0.50
            return total + 0.50;
        }, 0);

        // Create a new customized burger object (not saved to DB yet)
        // const customizedBurger = {
        //     originalBurger: {
        //         name: originalBurger.name,
        //         price: originalBurger.price,
        //         ingredients: originalBurger.ingredients
        //     },
        //     ingredients.forEach(ingredient => {
        //         customIngredients.push({
        //             name: ingredient,
        //             quantity: 1
        //     })),
        //     totalPrice: originalBurger.price + additionalPrice
        // };

        // Save the customized burger to a signed cookie

        
        
        res.cookie("customBurger", JSON.stringify(customizedBurger), {
            signed: true,
            httpOnly: true,
            maxAge: 24 * 60 * 60 * 1000
        });

        // Redirect to the confirm buy page
        res.redirect("/confirmBuy");
    } catch (error) {
        console.error("Error customizing burger:", error);
        res.status(500).send("Server error");
    }
});
const ONE_HOUR = 60 * 60 * 1000; // 1 hour in milliseconds

app.post("/donebuy", checkLoggedIn, async (req, res) => {
    try {
        const user = req.signedCookies.user;
        const selectedBurger = await Burger.findById(req.body.burgerId);

        // Set a cookie for the timer (1 hour)
        const timerExpiration = Date.now() + ONE_HOUR;
        res.cookie("deliveryTimer", timerExpiration, { httpOnly: true });

        // Set a message cookie for the 1-hour message
        res.cookie("deliveryMessage", "Your order has been placed and is being prepared!", { httpOnly: true, maxAge: ONE_HOUR });

        res.render("Donebuy", { 
            title: "Donebuy", 
            user: req.signedCookies.user, 
            burger: selectedBurger 
        });
    } catch (error) {
        console.error("Error in donebuy:", error);
        res.status(500).send("Server error");
    }
});

   
app.post("/chooshe", checkLoggedIn, async (req, res) => {
    try {
        const user = req.signedCookies.user;
        const selectedBurger = await Burger.findById(req.body.burgerId);
        const transactions = await Transaction.find({ user: user.username }).lean();
        // Set a cookie for the timer (1 hour)
        const timerExpiration = Date.now() + ONE_HOUR;
        res.cookie("deliveryTimer", timerExpiration, { httpOnly: true });

        res.render("chooshe", { 
            title: "Chooshe", 
            user: req.signedCookies.user, 
            burger: selectedBurger,
            transactions: transactions
            
        });
    } catch (error) {
        console.error("Error in chooshe:", error);
        res.status(500).send("Server error");
    }
});
app.post("/finishbuy", checkLoggedIn, async (req, res) => {
    const {
        location = "N/A", // Default value for location if not provided
        cardNumber,
        cardExpiry,
        cardCVV,
        phoneNumber,
        email,
        houseNumber,
        street,
        city,
        postalCode,
        orderDetails,
        paymentMethod = "card", // Default to "card" if not provided
    } = req.body;

    // Basic validation
    if (!/^\d{16}$/.test(cardNumber)) {
        return res.status(400).send("Invalid card number. Please ensure it is 16 digits.");
    }
    if (!/^\d{3}$/.test(cardCVV)) {
        return res.status(400).send("Invalid CVV. Please ensure it is a 3-digit number.");
    }
    if (!/^\d{10}$/.test(phoneNumber)) {
        return res.status(400).send("Invalid phone number. Please ensure it is 10 digits.");
    }

    try {
        // Save transaction to MongoDB
        const transaction = new Transaction({
            user: req.signedCookies.user.username, // Username from signed cookies
            location,
            cardNumber,
            cardExpiry,
            cardCVV,
            phoneNumber,
            email,
            address: {
                houseNumber,
                street,
                city,
                postalCode,
            },
            orderDetails,
            paymentMethod,
        });
        await transaction.save();

        // Redirect to the "finishbuy" page
        res.render("finishbuy", {
            title: "finishbuy",
            user: req.signedCookies.user,
        });
    } catch (error) {
        console.error("Error saving transaction:", error);
        res.status(500).send("An error occurred while processing the payment.");
    }
});

app.get("/Chooshe", checkLoggedIn, async (req, res) => {
    const user = req.signedCookies.user;
    const customBurger = req.signedCookies.customBurger;

    if (!customBurger) {
        return res.redirect("/buying");
    }
    else {
        res.render("Chooshe", { title: "Chooshe", user: user }); 
    }
});
app.get("/Donebuy", checkLoggedIn, async (req, res) => {
    const user = req.signedCookies.user;
    const customBurger = req.signedCookies.customBurger;

    if (!customBurger) {
        return res.redirect("/buying");
    }
    else {
        res.render("Donebuy", { title: "DoneBuy", user: user }); 
    }
});
//     try {
//         const burgerData = JSON.parse(customBurger);
//         const user = await User.findOne({ username: req.signedCookies.user.username });

//         // Create a new CustomizedBurger document
//         const newCustomizedBurger = new CustomizedBurger({
//             user: user._id,
//             originalBurger: burgerData.originalBurger._id,
//             customIngredients: burgerData.customIngredients,
//             totalPrice: burgerData.totalPrice
//         });

//         // Save to the database
//         await newCustomizedBurger.save();

//         // Add the customized burger to user's saved burgers
//         user.savedBurgers.push(newCustomizedBurger._id);
//         await user.save();

//         // Clear the cookie and redirect to profile
//         res.clearCookie("customBurger");
//         res.redirect("/profile");
//     } catch (error) {
//         console.error("Error saving customized burger:", error);
//         res.status(500).send("Server error");
//     }
// });


app.post("/buy", checkLoggedIn, async (req, res) => {
    console.log(req.body.burgerId, "burgerid");
    try {
        const selectedBurger = await Burger.findById(req.body.burgerId);
        console.log(selectedBurger, "selectedburger");
        if (!selectedBurger) {
            return res.status(404).send("Burger not found");
        }

        res.cookie("purchase", true, { 
            signed: true, 
            httpOnly: true, 
            maxAge: 24 * 60 * 60 * 1000 
        });

        res.render("confirmBuy", { 
            title: "Confirm Purchase", 
            user: req.signedCookies.user, 
            burger: selectedBurger 
        });
    } catch (error) {
        console.error("Error finding burger:", error);
        res.status(500).send("Server error");
    }
});


app.get("/onWay", checkLoggedIn, hasPurchased, (req, res) => {
    const user = req.signedCookies.user;
    res.render("OnWay", { title: "On the Way", user: user });
});
app.get("/profile", checkLoggedIn, async (req, res) => {
    try {
        const user = await User.findOne({ username: req.signedCookies.user.username });
        const customizedBurgers = await CustomizedBurger.find({ user: user._id })
            .populate("originalBurger")
            .lean();
        const transactions = await Transaction.find({ user: user.username }).lean();

        // Retrieve and calculate remaining time from the deliveryTimer cookie
        const timerExpiration = parseInt(req.cookies.deliveryTimer, 10);
        let timeRemaining = null;

        if (timerExpiration && !isNaN(timerExpiration)) {
            const now = Date.now();
            timeRemaining = Math.max(timerExpiration - now, 0);

            // Clear the cookie if the timer has expired
            if (timeRemaining === 0) {
                res.clearCookie("deliveryTimer");
            }
        }

        // Retrieve the message from the cookie
        const deliveryMessage = req.cookies.deliveryMessage;

        // Clear the message cookie if the timer has expired
        if (!timeRemaining && deliveryMessage) {
            res.clearCookie("deliveryMessage");
        }

        res.render("profile", { 
            title: "Profile", 
            user: user, 
            customizedBurgers: customizedBurgers, 
            transactions: transactions,
            timerRemaining: timeRemaining, // Pass remaining time to the view
            deliveryMessage: deliveryMessage // Pass message to the view
        });
    } catch (error) {
        console.error("Error fetching profile:", error);
        res.status(500).send("Server error");
    }
});


app.post("/Testing1", checkLoggedIn, async (req, res) => {
    try {
        const transaction = await Transaction.findById(req.params.id);

        if (!transaction) {
            return res.status(404).send("Transaction not found");
        }

        // Ensure only the owner of the transaction can edit it
        if (transaction.user !== req.signedCookies.user.username) {
            return res.status(403).send("You are not authorized to edit this transaction");
        }

        res.render("TransactionsEdit", { 
            title: " TransactionsEdit", 
            user: req.signedCookies.user,
            transaction: transaction 
        });
    } catch (error) {
        console.error("Error fetching transaction:", error);
        res.status(500).send("Server error");
    }
});


app.post("/logout", (req, res) => {
    res.clearCookie("user");
    res.clearCookie("purchase");
    res.clearCookie("customBurger");
    res.redirect("/");
});

// Start server
app.listen(5000, () => {
    console.log("Server started on port 5000");
});