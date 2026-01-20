const CmsHero = require('../models/CmsHero.model');
const CmsStep = require('../models/CmsStep.model');
const CmsConditionsSection = require('../models/CmsConditionsSection.model');
const CmsWhyUs = require('../models/CmsWhyUs.model');
const CmsFaq = require('../models/CmsFaq.model');
const CmsTerms = require('../models/CmsTerms.model');
const CmsFeaturedTherapist = require('../models/CmsFeaturedTherapist.model');
const CmsContact = require('../models/CmsContact.model');
const CmsAbout = require('../models/CmsAbout.model');

// Hero Section
exports.getHeroPublic = async (req, res) => {
    try {
        const hero = await CmsHero.findOne({ isPublic: true }).sort({ createdAt: -1 });
        if (!hero) {
            return res.status(404).json({
                success: false,
                message: 'Hero section not found'
            });
        }
        res.json({
            success: true,
            data: hero
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching hero section',
            error: error.message
        });
    }
};

exports.getHeroAdmin = async (req, res) => {
    try {
        const hero = await CmsHero.findOne().sort({ createdAt: -1 });
        res.json({
            success: true,
            data: hero || {}
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching hero section',
            error: error.message
        });
    }
};

exports.updateHero = async (req, res) => {
    try {
        const heroData = req.body;

        // Check if hero exists
        let hero = await CmsHero.findOne().sort({ createdAt: -1 });

        if (hero) {
            // Update existing hero
            Object.assign(hero, heroData);
            await hero.save();
        } else {
            // Create new hero
            hero = new CmsHero(heroData);
            await hero.save();
        }

        res.json({
            success: true,
            message: 'Hero section updated successfully',
            data: hero
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error updating hero section',
            error: error.message
        });
    }
};

// Steps Section
exports.getStepsPublic = async (req, res) => {
    try {
        const steps = await CmsStep.find({ isPublic: true }).sort({ createdAt: 1 });
        res.json({
            success: true,
            data: steps
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching steps',
            error: error.message
        });
    }
};

exports.getStepsAdmin = async (req, res) => {
    try {
        const steps = await CmsStep.find().sort({ createdAt: 1 });
        res.json({
            success: true,
            data: steps
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching steps',
            error: error.message
        });
    }
};

exports.createStep = async (req, res) => {
    try {
        const step = new CmsStep(req.body);
        await step.save();
        res.status(201).json({
            success: true,
            message: 'Step created successfully',
            data: step
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error creating step',
            error: error.message
        });
    }
};

exports.updateStep = async (req, res) => {
    try {
        const { id } = req.params;
        const step = await CmsStep.findByIdAndUpdate(id, req.body, { new: true });

        if (!step) {
            return res.status(404).json({
                success: false,
                message: 'Step not found'
            });
        }

        res.json({
            success: true,
            message: 'Step updated successfully',
            data: step
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error updating step',
            error: error.message
        });
    }
};

exports.deleteStep = async (req, res) => {
    try {
        const { id } = req.params;
        const step = await CmsStep.findByIdAndDelete(id);

        if (!step) {
            return res.status(404).json({
                success: false,
                message: 'Step not found'
            });
        }

        res.json({
            success: true,
            message: 'Step deleted successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error deleting step',
            error: error.message
        });
    }
};

// Conditions Section
exports.getConditionsPublic = async (req, res) => {
    try {
        const conditions = await CmsConditionsSection.findOne({ isPublic: true }).sort({ createdAt: -1 });
        res.json({
            success: true,
            data: conditions || {}
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching conditions section',
            error: error.message
        });
    }
};

exports.getConditionsAdmin = async (req, res) => {
    try {
        const conditions = await CmsConditionsSection.findOne().sort({ createdAt: -1 });
        res.json({
            success: true,
            data: conditions || {}
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching conditions section',
            error: error.message
        });
    }
};

exports.updateConditions = async (req, res) => {
    try {
        const conditionsData = req.body;

        let conditions = await CmsConditionsSection.findOne().sort({ createdAt: -1 });

        if (conditions) {
            Object.assign(conditions, conditionsData);
            await conditions.save();
        } else {
            conditions = new CmsConditionsSection(conditionsData);
            await conditions.save();
        }

        res.json({
            success: true,
            message: 'Conditions section updated successfully',
            data: conditions
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error updating conditions section',
            error: error.message
        });
    }
};

// Why Us Section
exports.getWhyUsPublic = async (req, res) => {
    try {
        const whyUs = await CmsWhyUs.findOne({ isPublic: true }).sort({ createdAt: -1 });
        res.json({
            success: true,
            data: whyUs || {}
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching why us section',
            error: error.message
        });
    }
};

exports.getWhyUsAdmin = async (req, res) => {
    try {
        const whyUs = await CmsWhyUs.findOne().sort({ createdAt: -1 });
        res.json({
            success: true,
            data: whyUs || {}
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching why us section',
            error: error.message
        });
    }
};

exports.updateWhyUs = async (req, res) => {
    try {
        const whyUsData = req.body;

        let whyUs = await CmsWhyUs.findOne().sort({ createdAt: -1 });

        if (whyUs) {
            Object.assign(whyUs, whyUsData);
            await whyUs.save();
        } else {
            whyUs = new CmsWhyUs(whyUsData);
            await whyUs.save();
        }

        res.json({
            success: true,
            message: 'Why us section updated successfully',
            data: whyUs
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error updating why us section',
            error: error.message
        });
    }
};

// FAQ Section
exports.getFaqsPublic = async (req, res) => {
    try {
        const faqs = await CmsFaq.find({ isPublic: true }).sort({ createdAt: 1 });
        res.json({
            success: true,
            data: faqs
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching FAQs',
            error: error.message
        });
    }
};

exports.getFaqsAdmin = async (req, res) => {
    try {
        const faqs = await CmsFaq.find().sort({ createdAt: 1 });
        res.json({
            success: true,
            data: faqs
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching FAQs',
            error: error.message
        });
    }
};

exports.createFaq = async (req, res) => {
    try {
        const faq = new CmsFaq(req.body);
        await faq.save();
        res.status(201).json({
            success: true,
            message: 'FAQ created successfully',
            data: faq
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error creating FAQ',
            error: error.message
        });
    }
};

exports.updateFaq = async (req, res) => {
    try {
        const { id } = req.params;
        const faq = await CmsFaq.findByIdAndUpdate(id, req.body, { new: true });

        if (!faq) {
            return res.status(404).json({
                success: false,
                message: 'FAQ not found'
            });
        }

        res.json({
            success: true,
            message: 'FAQ updated successfully',
            data: faq
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error updating FAQ',
            error: error.message
        });
    }
};

exports.deleteFaq = async (req, res) => {
    try {
        const { id } = req.params;
        const faq = await CmsFaq.findByIdAndDelete(id);

        if (!faq) {
            return res.status(404).json({
                success: false,
                message: 'FAQ not found'
            });
        }

        res.json({
            success: true,
            message: 'FAQ deleted successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error deleting FAQ',
            error: error.message
        });
    }
};

// Terms Section
exports.getTermsPublic = async (req, res) => {
    try {
        const terms = await CmsTerms.findOne({ isPublic: true }).sort({ createdAt: -1 });
        res.json({
            success: true,
            data: terms || {}
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching terms section',
            error: error.message
        });
    }
};

exports.getTermsAdmin = async (req, res) => {
    try {
        const terms = await CmsTerms.findOne().sort({ createdAt: -1 });
        res.json({
            success: true,
            data: terms || {}
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching terms section',
            error: error.message
        });
    }
};

exports.updateTerms = async (req, res) => {
    try {
        const termsData = req.body;

        let terms = await CmsTerms.findOne().sort({ createdAt: -1 });

        if (terms) {
            Object.assign(terms, termsData);
            await terms.save();
        } else {
            terms = new CmsTerms(termsData);
            await terms.save();
        }

        res.json({
            success: true,
            message: 'Terms section updated successfully',
            data: terms
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error updating terms section',
            error: error.message
        });
    }
};

// Featured Therapist Section
exports.getFeaturedTherapistPublic = async (req, res) => {
    try {
        const therapist = await CmsFeaturedTherapist.findOne({ isPublic: true }).sort({ createdAt: -1 });
        res.json({
            success: true,
            data: therapist || {}
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching featured therapist',
            error: error.message
        });
    }
};

exports.getFeaturedTherapistAdmin = async (req, res) => {
    try {
        const therapist = await CmsFeaturedTherapist.findOne().sort({ createdAt: -1 });
        res.json({
            success: true,
            data: therapist || {}
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching featured therapist',
            error: error.message
        });
    }
};

exports.updateFeaturedTherapist = async (req, res) => {
    try {
        const therapistData = req.body;

        let therapist = await CmsFeaturedTherapist.findOne().sort({ createdAt: -1 });

        if (therapist) {
            Object.assign(therapist, therapistData);
            await therapist.save();
        } else {
            therapist = new CmsFeaturedTherapist(therapistData);
            await therapist.save();
        }

        res.json({
            success: true,
            message: 'Featured therapist updated successfully',
            data: therapist
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error updating featured therapist',
            error: error.message
        });
    }
};

// Contact Section
exports.getContactPublic = async (req, res) => {
    try {
        const contact = await CmsContact.findOne({ isPublic: true }).sort({ createdAt: -1 });
        res.json({
            success: true,
            data: contact || {}
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching contact section',
            error: error.message
        });
    }
};

exports.getContactAdmin = async (req, res) => {
    try {
        const contact = await CmsContact.findOne().sort({ createdAt: -1 });
        res.json({
            success: true,
            data: contact || {}
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching contact section',
            error: error.message
        });
    }
};

exports.updateContact = async (req, res) => {
    try {
        const contactData = req.body;

        let contact = await CmsContact.findOne().sort({ createdAt: -1 });

        if (contact) {
            Object.assign(contact, contactData);
            await contact.save();
        } else {
            contact = new CmsContact(contactData);
            await contact.save();
        }

        res.json({
            success: true,
            message: 'Contact section updated successfully',
            data: contact
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error updating contact section',
            error: error.message
        });
    }
};

// About Section
exports.getAboutPublic = async (req, res) => {
    try {
        const about = await CmsAbout.findOne({ isPublic: true }).sort({ createdAt: -1 });
        res.json({
            success: true,
            data: about || {}
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching about section',
            error: error.message
        });
    }
};

exports.getAboutAdmin = async (req, res) => {
    try {
        const about = await CmsAbout.findOne().sort({ createdAt: -1 });
        res.json({
            success: true,
            data: about || {}
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching about section',
            error: error.message
        });
    }
};

exports.updateAbout = async (req, res) => {
    try {
        const aboutData = req.body;

        let about = await CmsAbout.findOne().sort({ createdAt: -1 });

        if (about) {
            Object.assign(about, aboutData);
            await about.save();
        } else {
            about = new CmsAbout(aboutData);
            await about.save();
        }

        res.json({
            success: true,
            message: 'About section updated successfully',
            data: about
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error updating about section',
            error: error.message
        });
    }
};

// Get all CMS data (for admin dashboard)
exports.getAllCmsData = async (req, res) => {
    try {
        const [
            hero,
            steps,
            conditions,
            whyUs,
            faqs,
            terms,
            featuredTherapist,
            contact,
            about
        ] = await Promise.all([
            CmsHero.findOne().sort({ createdAt: -1 }),
            CmsStep.find().sort({ createdAt: 1 }),
            CmsConditionsSection.findOne().sort({ createdAt: -1 }),
            CmsWhyUs.findOne().sort({ createdAt: -1 }),
            CmsFaq.find().sort({ createdAt: 1 }),
            CmsTerms.findOne().sort({ createdAt: -1 }),
            CmsFeaturedTherapist.findOne().sort({ createdAt: -1 }),
            CmsContact.findOne().sort({ createdAt: -1 }),
            CmsAbout.findOne().sort({ createdAt: -1 })
        ]);

        res.json({
            success: true,
            data: {
                hero: hero || {},
                steps: steps || [],
                conditions: conditions || {},
                whyUs: whyUs || {},
                faq: faqs || [],
                terms: terms || {},
                featuredTherapist: featuredTherapist || {},
                contact: contact || {},
                about: about || {}
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching all CMS data',
            error: error.message
        });
    }
};