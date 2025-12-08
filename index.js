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
const crypto = require("crypto");

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
        host: process.env.DB_HOST || "54.172.11.89",
        user: process.env.DB_USER || "admin",
        password: process.env.DB_PASSWORD || "#Team12ForTheWin",
        database: process.env.DB_NAME || "law_firm_db",
        port: Number(process.env.DB_PORT) || 3306
    },
    pool: { min: 0, max: 10 }
});

/*=======================================
User Schema Detection
=======================================*/
const userSchemaCapabilities = {
    password_hash: false,
    password_salt: false,
    email: false,
    first_name: false,
    last_name: false,
    phone: false
};

const detectUserSchema = async () => {
    const columns = Object.keys(userSchemaCapabilities);
    for (const column of columns) {
        try {
            userSchemaCapabilities[column] = await knex.schema.hasColumn("users", column);
        } catch (err) {
            userSchemaCapabilities[column] = false;
        }
    }
};

detectUserSchema().catch((err) => {
    console.error("User schema detection failed:", err.message);
});

/*=======================================
Password Hash Helpers
=======================================*/
const PASSWORD_ITERATIONS = 250000;
const PASSWORD_KEY_LENGTH = 64;
const PASSWORD_DIGEST = "sha512";

const createPasswordRecord = (password) => {
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = crypto.pbkdf2Sync(password, salt, PASSWORD_ITERATIONS, PASSWORD_KEY_LENGTH, PASSWORD_DIGEST).toString("hex");
    return { salt, hash };
};

const verifyPassword = (password, salt, hash) => {
    if (!salt || !hash) {
        return false;
    }
    const hashedAttempt = crypto.pbkdf2Sync(password, salt, PASSWORD_ITERATIONS, PASSWORD_KEY_LENGTH, PASSWORD_DIGEST).toString("hex");
    if (hash.length !== hashedAttempt.length) {
        return false;
    }
    return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(hashedAttempt, "hex"));
};

const collapsePasswordRecord = ({ salt, hash }) => `${salt}:${hash}`;

const expandPasswordRecord = (storedValue) => {
    if (!storedValue || !storedValue.includes(":")) {
        return null;
    }
    const [salt, hash] = storedValue.split(":");
    if (!salt || !hash) {
        return null;
    }
    return { salt, hash };
};

const userTableSupportsHashColumns = () => userSchemaCapabilities.password_hash && userSchemaCapabilities.password_salt;

/*=======================================
Public Route Allowlist
=======================================*/
const publicPaths = new Set(["/", "/login", "/logout", "/create-login"]);

/*=======================================
Authentication Utilities
=======================================*/
const loadUserColumnsForLogin = () => {
    const columns = ["id", "username", "password"];
    if (userTableSupportsHashColumns()) {
        columns.push("password_hash", "password_salt");
    }
    return columns;
};

const storePasswordRecord = async (userId, record) => {
    const updates = {
        password: collapsePasswordRecord(record)
    };
    if (userTableSupportsHashColumns()) {
        updates.password_hash = record.hash;
        updates.password_salt = record.salt;
    }
    await knex("users").where("id", userId).update(updates);
};

const validateUserPassword = async (user, password) => {
    if (userTableSupportsHashColumns() && user.password_hash && user.password_salt) {
        return verifyPassword(password, user.password_salt, user.password_hash);
    }
    const expandedRecord = expandPasswordRecord(user.password);
    if (expandedRecord && verifyPassword(password, expandedRecord.salt, expandedRecord.hash)) {
        if (userTableSupportsHashColumns() && (!user.password_hash || !user.password_salt)) {
            await knex("users").where("id", user.id).update({
                password_hash: expandedRecord.hash,
                password_salt: expandedRecord.salt
            });
        }
        return true;
    }
    if (user.password && user.password === password) {
        const refreshedRecord = createPasswordRecord(password);
        await storePasswordRecord(user.id, refreshedRecord);
        return true;
    }
    return false;
};

// Tells Express how to read form data sent in the body of a request
app.use(express.urlencoded({extended: true}));

// Global authentication middleware - runs on EVERY request
app.use((req, res, next) => {
    // Skip authentication for login routes
    if (publicPaths.has(req.path)) {
        //continue with the request path
        return next();
    }
    
    // Check if user is logged in for all other routes
    if (req.session.isLoggedIn) {
        //notice no return because nothing below it
        next(); // User is logged in, continue
    } 
    else {
        res.render("login", { error_message: "Please log in to access this page", success_message: "", username_value: "" });
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

/*=======================================
Authentication Routes
=======================================*/
app.get("/login", (req, res) => {
    const successMessage = req.session.successMessage || "";
    if (req.session.successMessage) {
        delete req.session.successMessage;
    }
    res.render("login", { error_message: "", success_message: successMessage, username_value: "" });
});

app.post("/login", async (req, res) => {
    const username = (req.body.username || "").trim();
    const password = req.body.password || "";

    if (!username || !password) {
        return res.render("login", { error_message: "Username and password are required", success_message: "", username_value: username });
    }

    try {
        const user = await knex("users")
            .select(loadUserColumnsForLogin())
            .where("username", username)
            .first();

        if (!user) {
            return res.render("login", { error_message: "Invalid login", success_message: "", username_value: username });
        }

        const authenticated = await validateUserPassword(user, password);

        if (!authenticated) {
            return res.render("login", { error_message: "Invalid login", success_message: "", username_value: username });
        }

        req.session.isLoggedIn = true;
        req.session.username = user.username;
        req.session.userId = user.id;
        res.redirect("/");
    } catch (err) {
        console.error("Login error:", err.message);
        res.render("login", { error_message: "Login failed. Please try again.", success_message: "", username_value: username });
    }
});

app.get("/create-login", (req, res) => {
    res.render("create-login", {
        error_message: "",
        form_values: {
            first_name: "",
            last_name: "",
            email: "",
            phone: "",
            username: ""
        }
    });
});

app.post("/create-login", async (req, res) => {
    const formValues = {
        first_name: (req.body.first_name || "").trim(),
        last_name: (req.body.last_name || "").trim(),
        email: (req.body.email || "").trim(),
        phone: (req.body.phone || "").trim(),
        username: (req.body.username || "").trim()
    };
    const password = req.body.password || "";
    const confirmPassword = req.body.confirm_password || "";

    const renderWithError = (message) => {
        res.render("create-login", { error_message: message, form_values: formValues });
    };

    if (!formValues.first_name || !formValues.last_name || !formValues.email || !formValues.phone || !formValues.username || !password || !confirmPassword) {
        return renderWithError("All fields are required.");
    }

    if (password !== confirmPassword) {
        return renderWithError("Passwords do not match.");
    }

    try {
        const query = knex("users").where("username", formValues.username);
        if (userSchemaCapabilities.email && formValues.email) {
            query.orWhere("email", formValues.email);
        }
        const existingUser = await query.first();
        if (existingUser) {
            return renderWithError("An account with the provided details already exists.");
        }

        const passwordRecord = createPasswordRecord(password);
        const newUserRecord = {
            username: formValues.username,
            password: collapsePasswordRecord(passwordRecord)
        };

        if (userTableSupportsHashColumns()) {
            newUserRecord.password_hash = passwordRecord.hash;
            newUserRecord.password_salt = passwordRecord.salt;
        }
        if (userSchemaCapabilities.email) {
            newUserRecord.email = formValues.email;
        }
        if (userSchemaCapabilities.first_name) {
            newUserRecord.first_name = formValues.first_name;
        }
        if (userSchemaCapabilities.last_name) {
            newUserRecord.last_name = formValues.last_name;
        }
        if (userSchemaCapabilities.phone) {
            newUserRecord.phone = formValues.phone;
        }

        await knex("users").insert(newUserRecord);
        req.session.successMessage = "Account created successfully. Please log in.";
        res.redirect("/login");
    } catch (err) {
        console.error("Create login error:", err.message);
        renderWithError("Unable to create an account right now. Please try again.");
    }
});

// Logout route
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
        res.render("login", { error_message: "", success_message: "", username_value: "" });
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
        res.render("login", { error_message: "", success_message: "", username_value: "" });
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
