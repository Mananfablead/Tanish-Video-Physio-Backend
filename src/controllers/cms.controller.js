const CmsHero = require('../models/CmsHero.model');
const CmsStep = require('../models/CmsStep.model');
const CmsConditionsSection = require('../models/CmsConditionsSection.model');
const CmsWhyUs = require('../models/CmsWhyUs.model');
const CmsFaq = require('../models/CmsFaq.model');
const CmsTerms = require('../models/CmsTerms.model');
const CmsFeaturedTherapist = require('../models/CmsFeaturedTherapist.model');
const CmsContact = require('../models/CmsContact.model');
const CmsAbout = require('../models/CmsAbout.model');
const config = require('../config/env');

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
        // Clean up the request body to remove any problematic id fields
        const heroData = { ...req.body };
        delete heroData._id;
        delete heroData.id;
        
        // If there's an uploaded file, update the image field with the full URL
        if (req.file) {
            heroData.image = `${config.BASE_URL}/uploads/cms-images/${req.file.filename}`;
        }
        
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
        // Check if multiple steps are being sent
        if (Array.isArray(req.body)) {
            // Handle multiple steps creation
            const createdSteps = [];
            
            for (const stepData of req.body) {
                // Clean up the request body to remove any problematic id fields
                const cleanedStepData = { ...stepData };
                delete cleanedStepData._id;
                delete cleanedStepData.id;
                
                const step = new CmsStep(cleanedStepData);
                await step.save();
                createdSteps.push(step);
            }
            
            res.status(201).json({
                success: true,
                message: `${createdSteps.length} step(s) created successfully`,
                data: createdSteps
            });
        } else {
            // Handle single step creation
            // Clean up the request body to remove any problematic id fields
            const stepData = { ...req.body };
            delete stepData._id;
            delete stepData.id;
            
            // If there's an uploaded file, update the image field with the full URL
            if (req.file) {
                stepData.image = `${config.BASE_URL}/uploads/cms-images/${req.file.filename}`;
            }
            
            const step = new CmsStep(stepData);
            await step.save();
            res.status(201).json({
                success: true,
                message: 'Step created successfully',
                data: step
            });
        }
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
        // Clean up the request body to remove any problematic id fields
        const stepData = { ...req.body };
        delete stepData._id;
        delete stepData.id;
        
        // If there's an uploaded file, update the image field with the full URL
        if (req.file) {
            stepData.image = `${config.BASE_URL}/uploads/cms-images/${req.file.filename}`;
        }
        
        const step = await CmsStep.findByIdAndUpdate(id, stepData, { new: true });

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
        // DEBUG: Log incoming data
        console.log('=== CONDITIONS UPDATE DEBUG ===');
        console.log('Body keys:', Object.keys(req.body));
        console.log('Files keys:', req.files ? Object.keys(req.files) : 'No files');
        console.log('Conditions data from body:', req.body.conditions);
        
        if (req.files) {
            Object.keys(req.files).forEach(key => {
                console.log(`File ${key}:`, req.files[key][0]?.filename);
            });
        }
        
        // Clean up the request body to remove any problematic id fields
        const conditionsData = { ...req.body };
        delete conditionsData._id;
        delete conditionsData.id;
        
        // Handle file uploads
        if (req.files) {
            // Process main image
            if (req.files['image'] && req.files['image'].length > 0) {
                conditionsData.image = `${config.BASE_URL}/uploads/cms-condition-images/${req.files['image'][0].filename}`;
            }
            
            // Process condition images if any
            // Handle files sent - multer.any() changes field names to numeric indices
            if (req.files) {
                console.log('Processing uploaded files...');
                
                // Parse the conditions from the body
                let conditionsArray;
                if (typeof conditionsData.conditions === 'string') {
                    conditionsArray = JSON.parse(conditionsData.conditions);
                } else {
                    conditionsArray = conditionsData.conditions || [];
                }
                
                console.log(`Found ${conditionsArray.length} conditions`);
                console.log('Received files:', Object.keys(req.files));
                
                // Process each uploaded file - handle both numeric indices and named fields
                Object.keys(req.files).forEach(fieldKey => {
                    // Check if it's an array (multer behavior) or direct file object
                    const uploadedFile = Array.isArray(req.files[fieldKey]) ? req.files[fieldKey][0] : req.files[fieldKey];
                    
                    if (uploadedFile && uploadedFile.filename) {
                        let conditionIndex = null;
                        
                        // Try to extract index from field name like 'conditions[0].image'
                        const match = fieldKey.match(/conditions\\[(\\d+)\\]\\.image/);
                        if (match) {
                            conditionIndex = parseInt(match[1]);
                        } else {
                            // Fall back to numeric index if fieldKey is a number
                            conditionIndex = parseInt(fieldKey);
                        }
                        
                        if (!isNaN(conditionIndex) && conditionsArray[conditionIndex]) {
                            console.log(`Found file for condition ${conditionIndex}: ${uploadedFile.filename}`);
                            
                            // Update the condition at this index
                            conditionsArray[conditionIndex].image = `${config.BASE_URL}/uploads/cms-condition-images/${uploadedFile.filename}`;
                            console.log(`Set image URL for condition ${conditionIndex}: ${conditionsArray[conditionIndex].image}`);
                        } else {
                            console.log(`Could not map file ${fieldKey} to a condition index`);
                        }
                    } else {
                        console.log(`No valid file found for field ${fieldKey}`);
                        console.log('File data:', req.files[fieldKey]);
                    }
                });
                
                // Update the conditions data
                conditionsData.conditions = conditionsArray;
            }
        }
        
        // If conditions data is a string (from form data), parse it
        if (typeof conditionsData.conditions === 'string') {
            try {
                conditionsData.conditions = JSON.parse(conditionsData.conditions);
            } catch (e) {
                // If it's not JSON, leave it as is
            }
        }
        
        // First, get the existing conditions from database to preserve existing image URLs
        const existingConditionsDoc = await CmsConditionsSection.findOne().sort({ createdAt: -1 });
        const existingConditions = existingConditionsDoc?.conditions || [];
        
        // Process conditions array to properly handle image updates
        if (conditionsData.conditions && Array.isArray(conditionsData.conditions)) {
            conditionsData.conditions = conditionsData.conditions.map((condition, index) => {
                // If there was a file uploaded for this specific condition index, use the new image
                const hasNewImage = req.files && (
                    req.files[`conditions[${index}].image`] || 
                    req.files[index.toString()] // fallback for numeric indices
                );
                
                if (hasNewImage) {
                    // A new image was uploaded for this condition, keep the new URL
                    return condition;
                } else {
                    // No new image uploaded for this condition, preserve existing image URL from database
                    if (existingConditions[index] && existingConditions[index].image && typeof existingConditions[index].image === 'string') {
                        return {
                            ...condition,
                            image: existingConditions[index].image
                        };
                    } else {
                        // Handle cleanup for problematic data in the new condition
                        return {
                            ...condition,
                            image: (condition.image && typeof condition.image === 'object') ? null : condition.image
                        };
                    }
                }
            });
        }
        
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
        // Clean up the request body to remove any problematic id fields
        const whyUsData = { ...req.body };
        delete whyUsData._id;
        delete whyUsData.id;
        
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
        // Clean up the request body to remove any problematic id fields
        const faqData = { ...req.body };
        delete faqData._id;
        delete faqData.id;
        
        const faq = new CmsFaq(faqData);
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
        // Clean up the request body to remove any problematic id fields
        const faqData = { ...req.body };
        delete faqData._id;
        delete faqData.id;
        
        const faq = await CmsFaq.findByIdAndUpdate(id, faqData, { new: true });

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
        // Clean up the request body to remove any problematic id fields
        const termsData = { ...req.body };
        delete termsData._id;
        delete termsData.id;
        
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
        // Clean up the request body to remove any problematic id fields
        const therapistData = { ...req.body };
        delete therapistData._id;
        delete therapistData.id;
        
        // If there's an uploaded file, update the image field with the full URL
        if (req.file) {
            therapistData.image = `${config.BASE_URL}/uploads/cms-images/${req.file.filename}`;
        }
        
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
        // Clean up the request body to remove any problematic id fields
        const contactData = { ...req.body };
        delete contactData._id;
        delete contactData.id;
        
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
        // Clean up the request body to remove any problematic id fields
        const aboutData = { ...req.body };
        delete aboutData._id;
        delete aboutData.id;
        
        // Handle multiple image uploads
        if (req.files && req.files.length > 0) {
            // Get the current about section to preserve existing images
            const currentAbout = await CmsAbout.findOne().sort({ createdAt: -1 });
            
            // Initialize images array with existing images
            const images = [...(currentAbout?.images || [])];
            
            // Add new uploaded images
            req.files.forEach(file => {
                images.push(`${config.BASE_URL}/uploads/cms-images/${file.filename}`);
            });
            
            aboutData.images = images;
            
            // Also update the legacy single image field for backward compatibility
            if (images.length > 0) {
                aboutData.image = images[0];
            }
        }
        
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