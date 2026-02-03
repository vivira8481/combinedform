const express = require("express");
const cors = require("cors");
require("dotenv").config();
const formRoutes = require("./routes/formRoutes");
const connectDB = require("./db")
const app = express();



// 🔴 IMPORTANT: fallback port
const PORT = process.env.PORT || 5000;

connectDB()


/* =========================
   Middleware
========================= */
app.use(
    cors({
        origin: [
            "http://localhost:3000",
        ],
        methods: ["GET", "POST", "PUT", "DELETE"],
        allowedHeaders: ["Content-Type", "Authorization"],
    })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* =========================
   Routes
========================= */
app.get("/api/test", (req, res) => {
    res.status(200).send("Welcome to the UKTOURISM");
});

app.use("/api/form", formRoutes);

/* =========================
   Start Server
========================= */
app.listen(PORT, () => {
    console.log(`✅ Server is running on port ${PORT}`);
});
