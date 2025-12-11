// ...existing code...
// ...existing code...
// Load environment variables from .env file into memory
require('dotenv').config();

const express = require("express");
// Needed for the session variable - Stored on the server to hold data
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

// Configure Multer's disk storage engine
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
            userSchemaCapabilities[column] = await knex.schema.hasColumn("user_account", column);
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
const publicPaths = new Set(["/", "/index", "/faq", "/about", "/login", "/logout", "/create-login", "/register"]);

/*=======================================
Authentication Utilities
=======================================*/
const loadUserColumnsForLogin = () => {
    // USER_ACCOUNT schema: user_id, email, password_hash, password_salt, first_name, last_name, phone, is_active, created_on, updated_on
    const columns = ["user_id", "email", "password_hash", "password_salt", "first_name", "last_name", "phone", "is_active", "created_on", "updated_on"];
    return columns;
};

const storePasswordRecord = async (userId, record) => {
    // Only update password_hash and password_salt
    const updates = {
        password_hash: record.hash,
        password_salt: record.salt
    };
    await knex("user_account").where("user_id", userId).update(updates);
};

const validateUserPassword = async (user, password) => {
    if (userTableSupportsHashColumns() && user.password_hash && user.password_salt) {
        return verifyPassword(password, user.password_salt, user.password_hash);
    }
    return false;
};

// Tells Express how to read form data sent in the body of a request
app.use(express.urlencoded({extended: true}));
// Tells Express how to parse JSON data in request bodies
app.use(express.json());

// Global authentication middleware - runs on EVERY request
app.use((req, res, next) => {
    // Skip authentication for login routes
    if (publicPaths.has(req.path)) {
        //continue with the request path
        return next();
    }
    // Check if user is logged in for all other routes
    if (req.session.isLoggedIn) {
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
    res.render("submit", {
        success_message: "",
        error_message: "",
        form_values: { title: "", description: "", practice_area: "" }
    });
});

/*=======================================
Case Submission Handler
=======================================*/
app.post("/submit", async (req, res) => {
    const title = (req.body.title || "").trim();
    const description = (req.body.description || "").trim();
    const practiceAreaText = req.body["practice-area"] || "";
    const preferredContact = req.body["preferred-contact"] || "";

    if (!title || !description || !practiceAreaText || !preferredContact) {
        return res.render("submit", { 
            error_message: "All fields are required.",
            form_values: { title, description, practice_area: practiceAreaText, preferred_contact: preferredContact }
        });
    }

    const practiceAreaMap = {
        "Slip/Trip Fall": 1,
        "Negligence Security": 2,
        "Car Crashes": 3,
        "Professional Negligence": 4,
        "Workers Compensation": 5,
        "Products Liability": 6,
        "Wrongful Death": 7,
        "Motorcycle Crash": 8,
        "Other": 9
    };

    const practiceAreaId = practiceAreaMap[practiceAreaText];
    if (!practiceAreaId) {
        return res.render("submit", { 
            error_message: "Invalid practice area selected.",
            form_values: { title, description, practice_area: practiceAreaText, preferred_contact: preferredContact }
        });
    }

    try {
        if (!req.session.userId) {
            return res.render("submit", { 
                error_message: "You must be logged in to submit a case.",
                success_message: "",
                form_values: { title, description, practice_area: practiceAreaText, preferred_contact: preferredContact }
            });
        }
        
        let client = await knex("client")
            .select("client_id")
            .where("user_id", req.session.userId)
            .first();
        
        if (!client) {
            const user = await knex("user_account")
                .select("first_name", "last_name", "email", "phone")
                .where("user_id", req.session.userId)
                .first();
            
            if (!user) {
                return res.render("submit", { 
                    error_message: "User account not found. Please contact support.",
                    success_message: "",
                    form_values: { title, description, practice_area: practiceAreaText, preferred_contact: preferredContact }
                });
            }
            
            const [clientId] = await knex("client").insert({
                first_name: user.first_name,
                last_name: user.last_name,
                email: user.email,
                phone: user.phone,
                preferred_contact_method: preferredContact,
                created_on: knex.fn.now(),
                user_id: req.session.userId
            });
            
            client = { client_id: clientId };
        }
        
        const newCase = {
            title: title,
            description: description,
            opened_on: new Date(),
            closed_on: null,
            priority: "low",
            reference_no: 0,
            is_public_submission: 1,
            status_id: 1,
            practice_area_id: practiceAreaId,
            client_id: client.client_id
        };

        await knex("case_info").insert(newCase);
        
        res.render("submit", { 
            success_message: "Your case has been submitted successfully. We will review it and contact you soon.",
            error_message: "",
            form_values: { title: "", description: "", practice_area: "", preferred_contact: "" }
        });
    } catch (err) {
        console.error("Case submission error:", err.message);
        res.render("submit", { 
            error_message: "Unable to submit your case right now. Please try again later.",
            form_values: { title, description, practice_area: practiceAreaText, preferred_contact: preferredContact }
        });
    }
});

app.get("/review", async (req, res) => {
    try {
        const cases = await knex('case_info')
            .join('client', 'case_info.client_id', 'client.client_id')
            .join('user_account', 'client.user_id', 'user_account.user_id')
            .leftJoin('practice_area', 'case_info.practice_area_id', 'practice_area.practice_area_id')
            .select(
                'case_info.case_id',
                'case_info.title',
                'case_info.description',
                'case_info.opened_on',
                'case_info.priority',
                'case_info.reference_no',
                'case_info.status_id',
                'user_account.first_name',
                'user_account.last_name',
                'client.email',
                'client.phone',
                'client.preferred_contact_method',
                'practice_area.name as practice_area_name'
            )
            .orderBy('case_info.opened_on', 'desc');

        res.render("review", { cases });
    } catch (error) {
        console.error("Error fetching cases:", error);
        res.render("review", { cases: [] });
    }
});

app.post("/update-case", async (req, res) => {
    const { case_id, title, description, priority, status_id } = req.body;

    if (!case_id || !title || !description || !priority || !status_id) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    const validPriorities = ["low", "medium", "high"];
    if (!validPriorities.includes(priority.toLowerCase())) {
        return res.status(400).json({ error: "Invalid priority value" });
    }

    const validStatuses = [1, 2, 3];
    const statusIdNum = parseInt(status_id);
    if (!validStatuses.includes(statusIdNum)) {
        return res.status(400).json({ error: "Invalid status value" });
    }

    try {
        const updateData = {
            title: title,
            description: description,
            priority: priority.toLowerCase(),
            status_id: statusIdNum
        };

        if (statusIdNum === 3) {
            updateData.closed_on = knex.fn.now();
        }

        await knex('case_info')
            .where('case_id', case_id)
            .update(updateData);

        res.json({ success: true });
    } catch (error) {
        console.error("Error updating case:", error);
        res.status(500).json({ error: "Failed to update case" });
    }
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
        const user = await knex("user_account")
            .select(loadUserColumnsForLogin())
            .where("email", username)
            .first();

        if (!user) {
            return res.render("login", { error_message: "Invalid login", success_message: "", username_value: username });
        }

        const authenticated = await validateUserPassword(user, password);

        if (!authenticated) {
            return res.render("login", { error_message: "Invalid login", success_message: "", username_value: username });
        }

        req.session.isLoggedIn = true;
        req.session.username = user.email;
        req.session.userId = user.user_id;
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
        // Only check by email for user_account
        const existingUser = await knex("user_account").where("email", formValues.email).first();
        if (existingUser) {
            return renderWithError("An account with the provided email already exists.");
        }

        const passwordRecord = createPasswordRecord(password);
        const newUserRecord = {
            email: formValues.email,
            password_hash: passwordRecord.hash,
            password_salt: passwordRecord.salt,
            first_name: formValues.first_name,
            last_name: formValues.last_name,
            phone: formValues.phone,
            is_active: true,
            created_on: new Date(),
            updated_on: new Date()
        };

        await knex("user_account").insert(newUserRecord);
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

// Registration form
app.get("/register", (req, res) => {
    res.render("create_user", { error_message: "" });
});

// Registration handler
app.post("/register", async (req, res) => {
    const { email, password, first_name, last_name, phone } = req.body;
    try {
        // Check if email already exists
        const existing = await knex('user_account').where({ email }).first();
        if (existing) {
            return res.render("create_user", { error_message: "Email already registered." });
        }
        // Generate password record
        const passwordRecord = createPasswordRecord(password);
        // Insert new user (no password field)
        await knex('user_account').insert({
            email,
            password_hash: passwordRecord.hash,
            password_salt: passwordRecord.salt,
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
        knex.select().from("user_account")
            // then send ___ what? to the users
            .then(users => {
                console.log(`Successfully retrieved ${users.length} users from database`);
                res.render("displayUsers", {users: users});
            })
            .catch((err) => {
                console.error("Database query error:", err.message);
                res.render("displayUsers", {
                    users: [],
                    error_message: `Database error: ${err.message}. Please check if the 'user_account' table exists.`
                });
            });
    }
    else {
        res.render("login", { error_message: "", success_message: "", username_value: "" });
    }
});

app.post("/deleteUser/:id", (req, res) => {
    knex("user_account").where("user_id", req.params.id).del().then(users => {
        res.redirect("/users");
    }).catch(err => {
        console.log(err);
        res.status(500).json({err});
    })
});

app.listen(port, () => {
    console.log("The server is listening");
});