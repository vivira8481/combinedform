const mongoose = require('mongoose');

const formDataSchema = new mongoose.Schema({
    key: { type: String, required: true },
    value: { type: mongoose.Schema.Types.Mixed }
});

const submissionSchema = new mongoose.Schema({
    receivedAt: { type: Date, default: Date.now },
    formType: { type: String, required: true },
    formData: [formDataSchema]
});

module.exports = mongoose.model('Submission', submissionSchema);
