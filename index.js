//npm install dotenv - explain
//npm install express-session - explain
//create the .env file

// Load environment variables from .env file into memory
// Allows you to use process.env
require('dotenv').config();

const express = require("express");

//Needed for the session variable - Stored on the server to hold data
const session = require("express-session");

let path = require("path");

// Create a variable that refers to the CLASS (methods being used are classwide, not object specific)
const multer = require("multer")

// Allows you to read the body of incoming HTTP requests and makes that data available on req.body
let bodyParser = require("body-parser");

let app = express();

// Use EJS for the web pages - requires a views folder and all files are .ejs
app.set("view engine", "ejs");

// Root directory for static images
const uploadRoot = path.join(__dirname, "images");
// Sub-directory where uploaded profile pictures will be stored
const uploadDir = path.join(uploadRoot, "uploads");
// cb is the callback function
// The callback is how you hand control back to Multer after
// your customization step
// Configure Multer's disk storage engine
// Multer calls it once per upload to ask where to store the file. Your function receives:
// req: the incoming request.
// file: metadata about the file (original name, mimetype, etc.).
// cb: the callback.

// WHAT we are storing and WHERE we are storing it
const storage = multer.diskStorage({
    // Save files into our uploads directory
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    // Reuse the original filename so users see familiar names
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    }
});
// Create the Multer instance that will handle single-file uploads
const upload = multer({ storage }); // constructor making an object

// Expose everything in /images (including uploads) as static assets
app.use("/images", express.static(uploadRoot));

// process.env.PORT is when you deploy and 3000 is for test
const port = process.env.PORT || 3000;

/* Session middleware (Middleware is code that runs between the time the request comes
to the server and the time the response is sent back. It allows you to intercept and
decide if the request should continue. It also allows you to parse the body request
from the html form, handle errors, check authentication, etc.)

REQUIRED parameters for session:
secret - The only truly required parameter
    Used to sign session cookies
    Prevents tampering and session hijacking with session data

OPTIONAL (with defaults):
resave - Default: true
    true = save session on every request
    false = only save if modified (recommended)

saveUninitialized - Default: true
    true = create session for every request
    false = only create when data is stored (recommended)
*/

app.use(
    session(
        {
    secret: process.env.SESSION_SECRET || 'fallback-secret-key',
    resave: false,
    saveUninitialized: false,
        }
    )
);

const knex = require("knex")({
    client: "mysql2",
    connection: {
        host : process.env.DB_HOST || "54.172.11.89",
        user : process.env.DB_USER || "admin",
        password : process.env.DB_PASSWORD || "#Team12ForTheWin",
        database : process.env.DB_NAME || "Law Firm DB",
        port : process.env.DB_PORT || 3306 // MySQL default port
    }
});

// Tells Express how to read form data sent in the body of a request
app.use(express.urlencoded({extended: true}));

// Global authentication middleware - runs on EVERY request
app.use((req, res, next) => {
    // Skip authentication for public routes
    if (
        req.path === '/' ||
        req.path === '/login' ||
        req.path === '/logout' ||
        req.path === '/register' ||
        (req.path === '/register' && req.method === 'POST')
    ) {
        return next();
    }
    
    // Check if user is logged in for all other routes
    if (req.session.isLoggedIn) {
        //notice no return because nothing below it
        next(); // User is logged in, continue
    } 
    else {
        res.render("login", { error_message: "Please log in to access this page" });
    }
});

// Main page route - notice it checks if they have logged in
app.get("/", (req, res) => {       
        res.render("index");
});

app.get("/index", (req, res) => {
    res.render("index");
});

// Public informational pages
app.get("/about", (req, res) => {
    res.render("about");
});

app.get("/faq", (req, res) => {
    res.render("faq");
});

app.get("/submit", (req, res) => {
    res.render("submit");
});

app.get("/review", (req, res) => {
    res.render("review");
});

// Render login form
app.get("/login", (req, res) => {
    res.render("login", { error_message: "" });
});

// This creates attributes in the session object to keep track of user and if they logged in
app.post("/login", (req, res) => {
        const email = req.body.email;
        const password = req.body.password;

        knex('user_account')
            .where({ email: email, is_active: true })
            .first()
            .then(user => {
                if (!user) {
                    return res.render("login", { error_message: "Invalid login" });
                }
                // Use bcrypt to compare password
                const bcrypt = require('bcrypt');
                bcrypt.compare(password + user.password_salt, user.password_hash, (err, result) => {
                    if (err || !result) {
                        return res.render("login", { error_message: "Invalid login" });
                    }
                    req.session.isLoggedIn = true;
                    req.session.user_id = user.user_id;
                    req.session.email = user.email;
                    res.redirect("/");
                });
            })
            .catch(err => {
                console.error("Login error:", err);
                res.render("login", { error_message: "Invalid login" });
            });

});

// Logout route
// Registration form
app.get("/register", (req, res) => {
    res.render("create_user", { error_message: "" });
});

// Registration handler
app.post("/register", async (req, res) => {
    const { email, password, first_name, last_name, phone } = req.body;
    const bcrypt = require('bcrypt');
    const saltRounds = 10;
    try {
        // Check if email already exists
        const existing = await knex('user_account').where({ email }).first();
        if (existing) {
            return res.render("create_user", { error_message: "Email already registered." });
        }
        // Generate salt and hash
        const password_salt = await bcrypt.genSalt(saltRounds);
        const password_hash = await bcrypt.hash(password + password_salt, saltRounds);
        // Insert new user
        await knex('user_account').insert({
            email,
            password_hash,
            password_salt,
            first_name,
            last_name,
            phone,
            is_active: true,
            created_on: new Date(),
            updated_on: new Date()
        });
        res.redirect("/login");
    } catch (err) {
        console.error("Registration error:", err);
        res.render("create_user", { error_message: "Registration failed. Please try again." });
    }
});
app.get("/logout", (req, res) => {
    // Get rid of the session object
    req.session.destroy((err) => {
        if (err) {
            console.log(err);
        }
        res.redirect("/");
    });
});

// If the user is logged in when they enter the test page, return BYU
app.get("/test", (req, res) => {
    // Check if user is logged in
    if (req.session.isLoggedIn) {
        res.render("test", {name : "BYU"});
    }
    else {
        res.render("login", { error_message: "" });
    }
});

// Connect to the database (knex)
app.get("/users", (req, res) => {
    // Check if user is logged in
    if (req.session.isLoggedIn) {
        // run the query
        knex.select().from("users")
            // then send ___ what? to the users
            .then(users => {
                console.log(`Successfully retrieved ${users.length} users from database`);
                res.render("displayUsers", {users: users});
            })
            .catch((err) => {
                console.error("Database query error:", err.message);
                res.render("displayUsers", {
                    users: [],
                    error_message: `Database error: ${err.message}. Please check if the 'users' table exists.`
                });
            });
    }
    else {
        res.render("login", { error_message: "" });
    }
});

app.post("/deleteUser/:id", (req, res) => {
    knex("users").where("id", req.params.id).del().then(users => {
        res.redirect("/users");
    }).catch(err => {
        console.log(err);
        res.status(500).json({err});
    })
});

app.listen(port, () => {
    console.log("The server is listening");
});
