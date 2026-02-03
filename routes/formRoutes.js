const express = require("express");
const router = express.Router();
const nodemailer = require("nodemailer");
const puppeteer = require("puppeteer");
const fs = require("fs");
const Submission = require("../models/Submission")
const path = require("path");
require("dotenv").config();

/* =========================
   Email Transporter
========================= */
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

transporter.verify((error) => {
    if (error) console.error("Email error:", error);
    else console.log("✅ Email server ready");
});

/* =========================
   JSON Storage Helpers
========================= */
// const submissionsFile = path.join(__dirname, "submissions.json");

// const readSubmissions = () => {
//     try {
//         if (!fs.existsSync(submissionsFile)) return [];
//         return JSON.parse(fs.readFileSync(submissionsFile, "utf-8"));
//     } catch {
//         return [];
//     }
// };

// const writeSubmissions = (data) => {
//     fs.writeFileSync(submissionsFile, JSON.stringify(data, null, 2));
// };

/* =========================
   POST /api/form/submit
========================= */
router.post("/submit", async (req, res) => {
    let browser;

    try {
        const raw = req.body;

        if (!raw || Object.keys(raw).length === 0) {
            return res.status(400).json({ error: "No form data received" });
        }

        // Determine form type
        const formType = raw.formType || "unknown-form";

        // Map fields depending on formType
        let body = {};
        if (formType === "safari-form") {
            body = {
                name: (raw.name || raw.fullName || "").trim(),
                phone: (raw.phone || raw.mobileNumber || "").trim(),
                email: (raw.email || "").trim(),
                safari: (raw.safari || raw.tourTitle || "Customized Tour").trim(),
                zone: (raw.zone || raw.location || "").trim(),
                date: raw.date,
                timing: (raw.timing || raw.numberOfDays || "").trim(),
                persons: raw.persons || raw.numberOfPersons || 1,
                message: (raw.message || raw.textarea || "").trim(),
                agree: raw.agree ?? false,
                formType,
            };
        } else if (formType === "customized-tour-form") {
            body = {
                fullName: (raw.fullName || "").trim(),
                mobileNumber: (raw.mobileNumber || "").trim(),
                email: (raw.email || "").trim(),
                departureCity: (raw.departureCity || "").trim(),
                location: (raw.location || "").trim(),
                numberOfPersons: raw.numberOfPersons || 1,
                date: raw.date,
                numberOfDays: raw.numberOfDays || 1,
                textarea: (raw.textarea || "").trim(),
                agree: raw.agree ?? false,
                tourTitle: raw.tourTitle || "Customized Tour",
                formType,
            };
        } else {
            return res.status(400).json({ error: "Unknown form type" });
        }

        /* =========================
           Required Fields Validation
        ========================== */
        const requiredFields =
            formType === "safari-form"
                ? ["name", "phone", "date", "safari", "zone", "timing"]
                : ["fullName", "mobileNumber", "agree"];

        const missing = requiredFields.filter((f) => !body[f]);
        if (missing.length) {
            return res.status(400).json({
                error: `Missing fields: ${missing.join(", ")}`,
            });
        }

        /* =========================
           Normalize Data for Storage / Email
        ========================== */
        const formDataArray = Object.entries(body).map(([key, value]) => ({
            key,
            value,
        }));

        const submission = {
            receivedAt: new Date().toISOString(),
            formData: formDataArray,
        };

        /* =========================
           Save JSON
        ========================== */
        // const existing = readSubmissions();
        // const normalized = existing.filter(
        //     (item) => item && item.receivedAt && item.formData
        // );
        // normalized.push(submission);
        // writeSubmissions(normalized);

        const mongooseSubmission = new Submission({
            receivedAt: new Date(submission.receivedAt),
            formType: body.formType || formType,
            formData: formDataArray,
        });

        await mongooseSubmission.save();

        /* =========================
           HTML for Email / PDF
        ========================== */
        const formHtml = formDataArray
            .map(
                (item) => `
                <p>
                    <strong>${item.key.replace(/([A-Z])/g, " $1")}:</strong>
                    ${typeof item.value === "object"
                        ? JSON.stringify(item.value, null, 2)
                        : item.value
                    }
                </p>
            `
            )
            .join("");

        const htmlContent = `
        <html>
          <body style="font-family: Arial; padding: 20px;">
            <h2>New ${formType === "safari-form" ? "Safari Enquiry" : "Customized Tour Enquiry"}</h2>
            <p><strong>Submitted At:</strong> ${new Date(
            submission.receivedAt
        ).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</p>
            <hr />
            ${formHtml}
          </body>
        </html>
        `;

        /* =========================
           Generate PDF
        ========================== */
        browser = await puppeteer.launch({
            args: ["--no-sandbox", "--disable-setuid-sandbox"],
            headless: true,
        });

        const page = await browser.newPage();
        await page.setContent(htmlContent, { waitUntil: "networkidle0" });

        const pdfBuffer = await page.pdf({
            format: "A4",
            printBackground: true,
        });

        await browser.close();
        browser = null;

        /* =========================
           Send Email
        ========================== */
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: process.env.EMAIL_USER,
            subject: `New ${formType === "safari-form" ? "Safari Enquiry" : "Customized Tour Enquiry"}`,
            html: htmlContent,
            attachments: [
                {
                    filename: `${formType}-Enquiry.pdf`,
                    content: pdfBuffer,
                },
            ],
        });

        return res.status(200).json({
            success: true,
            message: "Form submitted successfully",
        });
    } catch (error) {
        console.error("Submit error:", error);
        if (browser) await browser.close().catch(() => { });
        return res.status(500).json({
            error: "Server error while processing submission",
        });
    }
});

// /* =========================
//    GET /api/form/submissions
// ========================= */
// // router.get("/submissions", async (req, res) => {
// //     try {
// //         const submissions = await Submission.find().sort({ receivedAt: -1 });
// //         res.status(200).json(submissions);
// //     } catch (error) {
// //         console.error("Error fetching submissions:", error);
// //         res.status(500).json({ error: "Failed to fetch submissions" });
// //     }
// // });

module.exports = router;
