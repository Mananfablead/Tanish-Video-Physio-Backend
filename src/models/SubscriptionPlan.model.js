const mongoose = require('mongoose');

const subscriptionPlanSchema = new mongoose.Schema({
    planId: {
        type: String,
        // Will be auto-generated if not provided
        unique: true,
        trim: true
    },
    name: {
        type: String,
        required: [true, 'Plan name is required'],
        trim: true
    },
    price: {
        type: Number,
        required: [true, 'Price is required'],
        min: 0
    },
    description: {
        type: String,
        required: [true, 'Description is required']
    },
    features: [{
        type: String
    }],
    duration: {
        type: String,
        required: [true, 'Duration is required'],
        enum: ["one-time", "monthly", "quarterly", "half-yearly", "yearly"]
    },
    sessions: {
        type: Number,
        default: 0,
        required: [true, 'Number of sessions is required']
    },
    session_type: {
        type: String,
        enum: ['individual', 'group'],
        default: 'individual',
        required: [true, 'Session type is required']
    },
    price_inr: {
        type: Number,
        min: 0,
        default: 0
    },
    price_usd: {
        type: Number,
        min: 0,
        default: 0
    },
    status: {
        type: String,
        enum: ['active', 'inactive'],
        default: 'active'
    },
    sortOrder: {
        type: Number,
        default: 0
    },
    validityDays: {
        type: Number,
        default: function() {
            // Set default validity based on duration
            switch(this.duration) {
                case 'one-time': return 1; // Valid for 1 day
                case 'monthly': return 30;
                case 'quarterly': return 90;
                case 'half-yearly': return 180;
                case 'yearly': return 365;
                default: return 30;
            }
        }
    }
}, {
    timestamps: true
});

// Helper function to generate slug from plan name
const generatePlanSlug = (name) => {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
};

// Pre-save middleware to auto-generate planId if not provided
subscriptionPlanSchema.pre('save', async function(next) {
    if (!this.planId) {
        // Option 1: Generate slug-based ID from plan name
        if (this.name) {
            const baseSlug = generatePlanSlug(this.name);
            let slug = baseSlug;
            let counter = 1;
            
            // Ensure uniqueness
            while (await mongoose.model('SubscriptionPlan').findOne({ planId: slug })) {
                slug = `${baseSlug}-${counter}`;
                counter++;
            }
            this.planId = slug;
        } else {
            // Option 2: Fallback to numeric ID
            const prefix = 'PLAN';
            const count = await mongoose.model('SubscriptionPlan').countDocuments();
            const paddedNumber = (count + 1).toString().padStart(3, '0');
            this.planId = `${prefix}_${paddedNumber}`;
            
            // Ensure uniqueness (in case of concurrent saves)
            let isUnique = false;
            let attempt = 1;
            while (!isUnique && attempt <= 10) {
                const existingPlan = await mongoose.model('SubscriptionPlan').findOne({ planId: this.planId });
                if (!existingPlan) {
                    isUnique = true;
                } else {
                    // Generate new ID with attempt number
                    this.planId = `${prefix}_${paddedNumber}_${attempt}`;
                    attempt++;
                }
            }
        }
    }
    next();
});

module.exports = mongoose.model('SubscriptionPlan', subscriptionPlanSchema);